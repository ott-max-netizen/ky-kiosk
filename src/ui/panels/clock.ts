import type { RuntimeConfig } from "../../config/config-schema";
import { getFormatters } from "../../domain/time/formatters";
import { capitalizeFirst, zonedParts } from "../../domain/time/zoned";
import { applyNightTheme } from "../layout";
import { requireElement, setText } from "../dom";
import type { Panel } from "./panel";

export interface ClockSlice {
  now: Date;
  timeZone: string;
  config: RuntimeConfig;
}

export class ClockPanel implements Panel<ClockSlice> {
  private clock!: HTMLElement;
  private date!: HTMLElement;
  private mounted = false;
  private lastDate = "";

  mount(): void {
    if (this.mounted) return;
    this.clock = requireElement("clock");
    this.date = requireElement("date");
    this.mounted = true;
  }

  update(slice: ClockSlice): void {
    this.mount();
    const formatters = getFormatters(slice.timeZone);
    setText(this.clock, formatters.clock.format(slice.now));
    const dateText = capitalizeFirst(formatters.dateLong.format(slice.now));
    if (dateText !== this.lastDate) {
      this.lastDate = dateText;
      setText(this.date, dateText);
    }
    applyNightTheme(zonedParts(slice.now, slice.timeZone).hour, slice.config);
  }

  destroy(): void {
    this.mounted = false;
  }
}
