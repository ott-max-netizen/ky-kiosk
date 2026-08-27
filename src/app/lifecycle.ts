import type { RuntimeConfig } from "../config/config-schema";
import { ymdKey, zonedParts } from "../domain/time/zoned";

const RELOAD_LOG_KEY = "ku-reload-log";
const NIGHTLY_RELOAD_KEY = "ku-nightly-reload-date";
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export type ReloadReason = "watchdog" | "nightly";

function persistentStorage(): Storage {
  return window.localStorage;
}

function readReloadLog(nowMs = Date.now()): number[] {
  const storage = persistentStorage();
  try {
    const parsed = JSON.parse(storage.getItem(RELOAD_LOG_KEY) ?? "[]") as unknown;
    const recent = Array.isArray(parsed)
      ? parsed.map(Number).filter((value) => Number.isFinite(value) && nowMs - value < SIX_HOURS_MS)
      : [];
    storage.setItem(RELOAD_LOG_KEY, JSON.stringify(recent));
    return recent;
  } catch {
    storage.setItem(RELOAD_LOG_KEY, "[]");
    return [];
  }
}

export function requestSupervisedReload(reason: ReloadReason, nowMs = Date.now(), demoMode = false): boolean {
  if (demoMode) return false;
  if (reason === "watchdog" && !navigator.onLine) return false;
  const recent = readReloadLog(nowMs);
  if (reason === "watchdog" && recent.length > 0) return false;
  recent.push(nowMs);
  persistentStorage().setItem(RELOAD_LOG_KEY, JSON.stringify(recent));
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

export function tickMaintenance(config: RuntimeConfig, demoMode: boolean, now = new Date()): boolean {
  if (demoMode) return false;
  const parts = zonedParts(now, config.timeZone);
  const dateKey = ymdKey(parts);
  const currentMinutes = parts.hour * 60 + parts.minute;
  const targetMinutes = config.nightlyReloadHour * 60 + config.nightlyReloadMinute;
  const storage = persistentStorage();
  if (currentMinutes < targetMinutes || storage.getItem(NIGHTLY_RELOAD_KEY) === dateKey) return false;
  storage.setItem(NIGHTLY_RELOAD_KEY, dateKey);
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
