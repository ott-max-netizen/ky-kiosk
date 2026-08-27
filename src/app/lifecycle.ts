import type { RuntimeConfig } from "../config/config-schema";
import { ymdKey, zonedParts } from "../domain/time/zoned";

const RELOAD_LOG_KEY = "ku-reload-log";
const NIGHTLY_RELOAD_KEY = "ku-nightly-reload-date";
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export type ReloadReason = "watchdog" | "nightly";

/**
 * localStorage viskab erindi, kui salvestus on poliitikaga blokeeritud või kettal
 * pole ruumi. Varem lekkis see erind välja ja jättis kogu hoolduse tegemata;
 * nüüd käitub rakendus lihtsalt nii, nagu ajalugu poleks kättesaadav.
 */
function persistentStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readStoredItem(key: string): string | null {
  try {
    return persistentStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStoredItem(key: string, value: string): void {
  try {
    persistentStorage()?.setItem(key, value);
  } catch {
    // Salvestus pole saadaval; reload'i ajalugu jääb ainult selle sessiooni sisse.
  }
}

function readReloadLog(nowMs = Date.now()): number[] {
  let recent: number[] = [];
  try {
    const parsed = JSON.parse(readStoredItem(RELOAD_LOG_KEY) ?? "[]") as unknown;
    recent = Array.isArray(parsed)
      ? parsed.map(Number).filter((value) => Number.isFinite(value) && nowMs - value < SIX_HOURS_MS)
      : [];
  } catch {
    recent = [];
  }
  writeStoredItem(RELOAD_LOG_KEY, JSON.stringify(recent));
  return recent;
}

export function requestSupervisedReload(reason: ReloadReason, nowMs = Date.now(), demoMode = false): boolean {
  if (demoMode) return false;
  if (reason === "watchdog" && !navigator.onLine) return false;
  const recent = readReloadLog(nowMs);
  if (reason === "watchdog" && recent.length > 0) return false;
  recent.push(nowMs);
  writeStoredItem(RELOAD_LOG_KEY, JSON.stringify(recent));
  location.reload();
  return true;
}

export interface SupervisorInput {
  lastSuccessfulSyncMs: number;
  refreshMinutes: number;
  syncing: boolean;
  demoMode: boolean;
  nowMs?: number;
  retrySync(): void;
}

export function tickSupervisor(input: SupervisorInput): "noop" | "sync" | "reload" {
  if (input.demoMode || !navigator.onLine || !input.lastSuccessfulSyncMs) return "noop";
  const nowMs = input.nowMs ?? Date.now();
  const age = nowMs - input.lastSuccessfulSyncMs;
  if (age > SIX_HOURS_MS && requestSupervisedReload("watchdog", nowMs, false)) return "reload";
  if (age > Math.max(1, input.refreshMinutes) * 60_000 * 3 && !input.syncing) {
    input.retrySync();
    return "sync";
  }
  return "noop";
}

/**
 * Öine reload (C-28). `sessionStartedAtMs` on selle brauserisessiooni algus;
 * 0 tähendab „teadmata“ ja säilitab varasema käitumise.
 *
 * Ilma sessiooni alguseta tegi iga pärast 04:10 alanud käivitus 30 s jooksul veel
 * ühe reload'i, sest tänast märget veel polnud. Kui localStorage oli kättesaamatu
 * (poliitika, incognito, täis ketas), ei jäänud märge kunagi püsima ja kiosk
 * laadis end lõputult iga 30 sekundi järel uuesti. Sessioon, mis algas juba pärast
 * sihtaega, ei ole midagi vahele jätnud — siis pole ka midagi järele teha.
 */
export function tickMaintenance(
  config: RuntimeConfig,
  demoMode: boolean,
  now = new Date(),
  sessionStartedAtMs = 0,
): boolean {
  if (demoMode) return false;
  const parts = zonedParts(now, config.timeZone);
  const dateKey = ymdKey(parts);
  const currentMinutes = parts.hour * 60 + parts.minute;
  const targetMinutes = config.nightlyReloadHour * 60 + config.nightlyReloadMinute;
  if (currentMinutes < targetMinutes || readStoredItem(NIGHTLY_RELOAD_KEY) === dateKey) return false;
  if (sessionStartedAtMs > 0) {
    const startParts = zonedParts(new Date(sessionStartedAtMs), config.timeZone);
    const startedAfterTarget = startParts.hour * 60 + startParts.minute >= targetMinutes;
    if (ymdKey(startParts) === dateKey && startedAfterTarget) {
      writeStoredItem(NIGHTLY_RELOAD_KEY, dateKey);
      return false;
    }
  }
  writeStoredItem(NIGHTLY_RELOAD_KEY, dateKey);
  return requestSupervisedReload("nightly", now.getTime(), false);
}

export async function retireServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("ku-infoekraan-")).map((key) => caches.delete(key)));
    }
  } catch (error) {
    console.warn("Vana service workeri eemaldamine ebaõnnestus", error);
  }
}
