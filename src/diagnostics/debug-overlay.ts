import type { AppState } from "../app/store";
import type { RuntimeConfig } from "../config/config-schema";
import { redactSecrets } from "./logger";
import { requireElement, setHidden, setText } from "../ui/dom";

export interface DebugSlice {
  state: AppState;
  config: RuntimeConfig;
  enabled: boolean;
  schedulerNames: string[];
  busDebug: string;
}

export class DebugOverlay {
  private element!: HTMLElement;
  private mounted = false;

  mount(): void {
    if (this.mounted) return;
    this.element = requireElement("debugOverlay");
    this.mounted = true;
  }

  update(slice: DebugSlice): void {
    this.mount();
    setHidden(this.element, !slice.enabled);
    if (!slice.enabled) return;
    const data = slice.state.data;
    const weather = data.weather?.current;
    const lines = [
      `versioon: ${slice.config.buildVersion} · ${slice.config.buildDate}`,
      `ajavöönd: ${data.settings.timeZone || slice.config.timeZone}`,
      `tööaeg: ${Math.floor((Date.now() - slice.state.status.startedAtMs) / 3_600_000)} h`,
      `sünkroon: ${slice.state.status.lastSuccessfulSyncMs ? new Date(slice.state.status.lastSuccessfulSyncMs).toLocaleString("et-EE") : "puudub"} · ${slice.state.status.lastSyncDurationMs} ms`,
      `taimerid: ${slice.schedulerNames.join(", ")}`,
      `kirjed: teated ${data.notices.length}, kontaktid ${data.contacts.length}, olulised ${data.emergency.length}, prügi ${data.waste.length}`,
      `ilm: ${weather ? `${weather.temperature}° · ${weather.stationName || weather.source || "varuallikas"}` : "puudub"}`,
      `bussid: ${slice.busDebug}`,
      `viimane viga: ${redactSecrets(slice.state.status.lastError || "puudub")}`,
      `probleemid: ${slice.state.status.runtimeProblems.length ? slice.state.status.runtimeProblems.map(redactSecrets).join(" | ") : "puuduvad"}`,
    ];
    setText(this.element, lines.join("\n"));
  }

  destroy(): void { this.mounted = false; }
}
