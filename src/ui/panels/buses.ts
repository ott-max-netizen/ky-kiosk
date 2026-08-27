import type { RuntimeConfig } from "../../config/config-schema";
import type { BusDeparture, BusState, BusTimetable } from "../../domain/bus/departures";
import { busRelativeLabel, getBusState } from "../../domain/bus/departures";
import { busDayTypeLabel } from "../../domain/bus/day-type";
import { getFormatters } from "../../domain/time/formatters";
import { zonedParts } from "../../domain/time/zoned";
import { clearElement, createElement, requireElement, setClass, setText } from "../dom";
import type { Panel } from "./panel";

export interface BusesSlice {
  timetable: BusTimetable | null;
  now: Date;
  config: RuntimeConfig;
}

function dayLabel(item: BusDeparture, timeZone: string): string {
  if (item.dayOffset === 0) return "Täna";
  if (item.dayOffset === 1) return "Homme";
  const date = new Date(Date.UTC(item.dateParts.year, item.dateParts.month - 1, item.dateParts.day, 12));
  return getFormatters(timeZone).utcDayMonth.format(date);
}

export class BusesPanel implements Panel<BusesSlice> {
  private center!: HTMLElement;
  private suurKaare!: HTMLElement;
  private source!: HTMLElement;
  private heading!: HTMLElement;
  private mounted = false;
  private lastKey = "";

  mount(): void {
    if (this.mounted) return;
    this.center = requireElement("busCenterArea");
    this.suurKaare = requireElement("busSuurKaareArea");
    this.source = requireElement("busSourceLabel");
    this.heading = requireElement("busHeading");
    this.mounted = true;
  }

  update(slice: BusesSlice): void {
    this.mount();
    const state = getBusState(slice.timetable, slice.now, slice.config.timeZone);
    const key = this.key(state, slice.now, slice.config.timeZone);
    if (key === this.lastKey) return;
    this.lastKey = key;
    setText(this.heading, slice.timetable?.stop || "Kauge peatus");
    this.renderSource(state, slice);
    this.renderDirection(this.center, state.center, slice.config.timeZone, Boolean(slice.timetable));
    this.renderDirection(this.suurKaare, state.suurKaare, slice.config.timeZone, Boolean(slice.timetable));
  }

  destroy(): void {
    this.mounted = false;
  }

  private key(state: BusState, now: Date, timeZone: string): string {
    const minute = getFormatters(timeZone).time.format(now);
    const encode = (items: BusDeparture[]) => items.map((item) => `${item.date}|${item.time}|${item.line}|${item.minutesUntil}`).join(";");
    return `${minute}|${state.schedule.code}|${encode(state.center)}|${encode(state.suurKaare)}`;
  }

  private renderSource(state: BusState, slice: BusesSlice): void {
    const day = busDayTypeLabel(zonedParts(slice.now, slice.config.timeZone));
    const text = !slice.timetable || state.schedule.level === "warning"
      ? state.schedule.uiText || "Sõiduplaan puudub"
      : [day, slice.timetable.sourceLabel || ""].filter(Boolean).join(" · ");
    setText(this.source, text);
    this.source.title = [day, slice.timetable?.sourceLabel, state.schedule.debugText].filter(Boolean).join(" · ");
    setClass(this.source, "is-warning", state.schedule.level === "warning");
  }

  private renderDirection(area: HTMLElement, items: BusDeparture[], timeZone: string, hasTimetable: boolean): void {
    clearElement(area);
    if (!items.length) {
      area.appendChild(createElement("div", "bus-empty", hasTimetable ? "Järgmisi väljumisi sõiduplaanist ei leitud." : "Bussisõiduplaani fail puudub."));
      return;
    }
    for (const item of items) {
      const card = createElement("div", "bus-departure");
      card.title = item.note;
      const day = createElement("div", "bus-departure-day", dayLabel(item, timeZone));
      day.classList.add(item.dayOffset === 0 ? "is-today" : item.dayOffset === 1 ? "is-tomorrow" : "is-future");
      const time = createElement("div", "bus-departure-time numeric", item.time);
      const line = createElement("div", "bus-line numeric", `Liin ${item.line}`);
      const relative = createElement("div", "bus-relative numeric", busRelativeLabel(item));
      card.append(day, time, line, relative);
      area.appendChild(card);
    }
  }
}
