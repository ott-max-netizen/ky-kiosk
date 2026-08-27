import { DashboardRepository } from "../cache/dashboard-repository";
import { endpointConfigured, tokenConfigured, type RuntimeConfig } from "../config/config-schema";
import { readRuntimeConfig } from "../config/runtime-config";
import { AppsScriptClient, ConfigurationError } from "../data/apps-script-client";
import { createSectionVersions, mergeIncoming } from "../data/merge";
import type { IncomingDashboardPayload, SectionName, SectionVersions } from "../data/types";
import { validateDashboardPayload } from "../data/validate";
import { errorMessage, logger } from "../diagnostics/logger";
import { applyPixelShift, installInteractionGuards } from "../ui/layout";
import { AppView } from "../ui/app-view";
import { retireServiceWorkers, tickMaintenance, tickSupervisor } from "./lifecycle";
import { Scheduler } from "./scheduler";
import { AppStore } from "./store";

const CACHE_WRITE_PROBLEM = "Vahemälu: viimaseid andmeid ei õnnestunud salvestada";

interface Params {
  demo: boolean;
  noNotices: boolean;
  debug: boolean;
}

function readParams(): Params {
  const params = new URLSearchParams(location.search);
  return { demo: params.get("demo") === "1", noNotices: params.get("notices") === "0", debug: params.get("debug") === "1" };
}

function allVersions(value = 1): SectionVersions {
  const result = createSectionVersions();
  for (const key of Object.keys(result) as Array<keyof SectionVersions>) result[key] = value;
  return result;
}

function normalizeDemoPayload(payload: IncomingDashboardPayload, noNotices: boolean): IncomingDashboardPayload {
  const now = new Date();
  const nowIso = now.toISOString();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Tallinn", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const copy: IncomingDashboardPayload = {
    ...payload,
    updatedAt: nowIso,
    notices: noNotices ? [] : (payload.notices ?? []).map((notice) => ({ ...notice, start: null, end: null })),
    sections: { ...payload.sections },
  };
  for (const name of Object.keys(copy.sections) as SectionName[]) copy.sections[name] = { ...copy.sections[name], ok: true, updatedAt: nowIso };
  if (payload.electricity) {
    const sourceDate = payload.electricity.date;
    const sourceMidnight = Date.parse(`${sourceDate}T00:00:00Z`);
    const todayMidnight = Date.parse(`${today}T00:00:00Z`);
    const shift = Number.isFinite(sourceMidnight) ? todayMidnight - sourceMidnight : 0;
    copy.electricity = {
      ...payload.electricity,
      date: today,
      points: payload.electricity.points.map((point) => ({ ...point, time: new Date(Date.parse(point.time) + shift).toISOString() })),
    };
  }
  return copy;
}

async function loadDemo(noNotices: boolean): Promise<IncomingDashboardPayload> {
  const response = await fetch("./sample-data.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Demoandmete laadimine ebaõnnestus: HTTP ${response.status}`);
  const validated = validateDashboardPayload(await response.json());
  if (!validated.value) throw new Error(validated.problems.join("; ") || "Vigased demoandmed");
  return normalizeDemoPayload(validated.value, noNotices);
}

function configurationMessage(config: RuntimeConfig): string {
  if (!endpointConfigured(config)) return "Apps Scripti URL on seadistamata või vigane";
  if (!tokenConfigured(config)) return "Feed'i token on seadistamata";
  return "";
}

export async function bootstrap(): Promise<void> {
  const config = readRuntimeConfig();
  const params = readParams();
  document.documentElement.style.setProperty("--scale", String(config.scale));
  const scheduler = new Scheduler();
  const store = new AppStore();
  const repository = new DashboardRepository();
  const client = new AppsScriptClient(config);
  const cleanupGuards = installInteractionGuards();
  let retryTimer: number | null = null;
  let regularTimer: number | null = null;
  let pixelShiftIndex = 0;
  let stopped = false;

  const view = new AppView(config, params.debug, () => scheduler.names(), (warnings) => {
    const marker = "Prügiveo sagedus: ";
    const state = store.get();
    const current = state.status.runtimeProblems.filter((item) => !item.startsWith(marker));
    const next = [...current, ...warnings.map((warning) => `${marker}${warning}`)].slice(-20);
    if (next.length === state.status.runtimeProblems.length && next.every((item, index) => item === state.status.runtimeProblems[index])) return;
    store.patchStatus({ runtimeProblems: next });
  });
  view.mount();
  view.update(store.get(), true);
  const unsubscribe = store.subscribe((next, previous) => {
    view.update(next, next.data !== previous.data && previous.versions === next.versions);
  });

  const clearSyncTimers = () => {
    if (retryTimer !== null) window.clearTimeout(retryTimer);
    if (regularTimer !== null) window.clearTimeout(regularTimer);
    retryTimer = null;
    regularTimer = null;
  };

  const scheduleRegular = () => {
    if (params.demo || stopped) return;
    if (regularTimer !== null) window.clearTimeout(regularTimer);
    regularTimer = window.setTimeout(() => void sync(), Math.max(1, config.refreshMinutes) * 60_000);
  };

  const scheduleRetry = () => {
    if (params.demo || stopped) return;
    const delay = store.get().status.retryDelayMs;
    if (retryTimer !== null) window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(() => void sync(), delay);
    store.patchStatus({ retryDelayMs: Math.min(300_000, delay * 2) });
  };

  const applyPayload = async (payload: IncomingDashboardPayload, cache = true) => {
    const state = store.get();
    const merged = mergeIncoming(state.data, payload, state.versions, new Date());
    store.setData(merged.data, merged.versions);
    if (!cache) return;
    // Vahemällu kirjutamise tõrge (kvoot, blokeeritud salvestus, rikutud DB) ei ole
    // ühendusviga. Varem lekkis see erind `sync()` catch-haru ja kiosk teatas
    // „Ühendus puudub“ ning alustas backoff'i, kuigi andmed olid just kohale jõudnud.
    try {
      await repository.set(merged.data);
      store.clearRuntimeProblem(CACHE_WRITE_PROBLEM);
    } catch (error) {
      logger.warn("Vahemällu salvestamine ebaõnnestus", errorMessage(error));
      store.addRuntimeProblem(CACHE_WRITE_PROBLEM);
    }
  };

  const sync = async () => {
    if (params.demo || stopped) return;
    if (store.get().status.syncing) {
      // Käimasolev sünkroonimine plaanib ise järgmise; ilma selleta jäi ahel katki
      // ja uus päring tuli alles minutise watchdog'i pealt.
      return;
    }
    clearSyncTimers();
    const start = performance.now();
    store.patchStatus({ syncing: true, connectionText: "Uuendan andmeid…", connectionState: navigator.onLine ? "neutral" : "offline" });
    try {
      const loaded = await client.load();
      await applyPayload(loaded.payload);
      store.patchStatus({
        syncing: false,
        connectionState: "online",
        connectionText: "Ühendus olemas",
        lastSuccessfulSyncMs: Date.now(),
        lastSyncDurationMs: Math.round(performance.now() - start),
        lastError: "",
        retryDelayMs: 30_000,
        runtimeProblems: loaded.problems,
      });
      scheduleRegular();
    } catch (error) {
      const message = errorMessage(error);
      const configuration = error instanceof ConfigurationError || Boolean(configurationMessage(config));
      store.patchStatus({
        syncing: false,
        connectionState: "offline",
        connectionText: configuration ? message : "Ühendus puudub – kuvatakse viimaseid andmeid",
        lastSyncDurationMs: Math.round(performance.now() - start),
        lastError: message,
      });
      if (!configuration) scheduleRetry();
    }
  };

  try {
    if (params.demo) {
      await applyPayload(await loadDemo(params.noNotices), false);
      store.patchStatus({ connectionState: "online", connectionText: "Demorežiim – välispäringud on välja lülitatud", lastSuccessfulSyncMs: Date.now(), retryDelayMs: 30_000 });
    } else {
      const cached = await repository.get();
      if (cached) {
        store.setData(cached, allVersions());
        store.patchStatus({ connectionState: navigator.onLine ? "neutral" : "offline", connectionText: navigator.onLine ? "Kuvatakse vahemälu, sünkroonin…" : "Ühendus puudub – kuvatakse viimaseid andmeid" });
      }
      const configError = configurationMessage(config);
      if (configError) store.patchStatus({ connectionState: "offline", connectionText: configError, lastError: configError });
      else void sync();
    }
  } catch (error) {
    const message = errorMessage(error);
    logger.error("Rakenduse käivitamine ebaõnnestus", message);
    store.patchStatus({ connectionState: "offline", connectionText: message, lastError: message });
  }

  scheduler.register("clock", 1_000, () => view.tickClock(new Date()), true);
  scheduler.register("time-sensitive", 1_000, () => view.tickTimeSensitive(new Date()), true);
  scheduler.register("watchdog", 60_000, () => {
    const status = store.get().status;
    tickSupervisor({
      lastSuccessfulSyncMs: status.lastSuccessfulSyncMs,
      refreshMinutes: config.refreshMinutes,
      syncing: status.syncing,
      demoMode: params.demo,
      retrySync: () => void sync(),
    });
  });
  scheduler.register("maintenance", 30_000, () => {
    tickMaintenance(config, params.demo, new Date(), store.get().status.startedAtMs);
    void fetch("./heartbeat", { method: "POST", cache: "no-store" }).catch(() => undefined);
  });
  scheduler.register("debug", 10_000, () => view.updateDebug(), true);
  scheduler.register("pixel-shift", 900_000, () => applyPixelShift(++pixelShiftIndex));
  scheduler.start();

  const onOnline = () => {
    store.patchStatus({ connectionState: "neutral", connectionText: "Ühendus taastub, sünkroonin…" });
    void sync();
  };
  const onOffline = () => store.patchStatus({ connectionState: "offline", connectionText: "Ühendus puudub – kuvatakse viimaseid andmeid" });
  const onResize = () => view.invalidateLayout();
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  window.addEventListener("resize", onResize);
  await retireServiceWorkers();

  window.addEventListener("beforeunload", () => {
    stopped = true;
    clearSyncTimers();
    client.abort();
    scheduler.stop();
    unsubscribe();
    cleanupGuards();
    view.destroy();
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    window.removeEventListener("resize", onResize);
  }, { once: true });
}
