import type { RuntimeConfig } from "../../config/config-schema";
import type { AppState } from "../../app/store";
import { getFormatters } from "../../domain/time/formatters";
import { validDate } from "../../domain/time/zoned";
import { requireElement, setText } from "../dom";
import type { Panel } from "./panel";

export interface StatusBarSlice {
  state: AppState;
  config: RuntimeConfig;
  timeZone: string;
}

export class StatusBarPanel implements Panel<StatusBarSlice> {
  private dot!: HTMLElement;
  private connection!: HTMLElement;
  private updated!: HTMLElement;
  private build!: HTMLElement;
  private mounted = false;

  mount(): void {
    if (this.mounted) return;
    this.dot = requireElement("connectionDot");
    this.connection = requireElement("connectionText");
    this.updated = requireElement("lastUpdated");
    this.build = requireElement("buildLabel");
    this.mounted = true;
  }

  update(slice: StatusBarSlice): void {
    this.mount();
    this.dot.classList.toggle("online", slice.state.status.connectionState === "online");
    this.dot.classList.toggle("offline", slice.state.status.connectionState === "offline");
    setText(this.connection, slice.state.status.connectionText);
    const date = validDate(slice.state.data.updatedAt);
    setText(
      this.updated,
      date
        ? `Viimane sünkroonimine ${getFormatters(slice.timeZone).dateTime.format(date)}`
        : slice.state.data.updatedAt
          ? "Viimase sünkroonimise aeg on vigane"
          : "Kuvatakse kohalikku algseadistust",
    );
    setText(this.build, `v${slice.config.buildVersion || "dev"} · ${slice.config.buildDate || "–"}`);
  }

  destroy(): void { this.mounted = false; }
}
