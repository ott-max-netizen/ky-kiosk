import type { RuntimeConfig } from "../../config/config-schema";
import type { BusDeparture, BusState, BusTimetable } from "../../domain/bus/departures";
import { busRelativeLabel, getBusState } from "../../domain/bus/departures";
import { busDayTypeLabel } from "../../domain/bus/day-type";
import { getFormatters } from "../../domain/time/formatters";
import { zonedParts } from "../../domain/time/zoned";
import { createElement, requireElement, setClass, setText } from "../dom";
import { reconcileChildren } from "../reconcile";
import type { Panel } from "./panel";

export interface BusesSlice {
  timetable: BusTimetable | null;
  now: Date;
  config: RuntimeConfig;
}

function createDepartureCard(): HTMLElement {
  const card = createElement("div", "bus-departure");
  card.append(
    createElement("div", "bus-departure-day"),
    createElement("div", "bus-departure-time numeric"),
    createElement("div", "bus-line numeric"),
    createElement("div", "bus-relative numeric"),
  );
  return card;
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
    const encode = (items: BusDeparture[]) =>
      items.map((item) => `${item.date}|${item.time}|${item.line}|${item.minutesUntil}`).join(";");
    return `${minute}|${state.schedule.code}|${encode(state.center)}|${encode(state.suurKaare)}`;
  }

  private renderSource(state: BusState, slice: BusesSlice): void {
    const day = busDayTypeLabel(zonedParts(slice.now, slice.config.timeZone));
    const text =
      !slice.timetable || state.schedule.level === "warning"
        ? state.schedule.uiText || "Sõiduplaan puudub"
        : [day, slice.timetable.sourceLabel || ""].filter(Boolean).join(" · ");
    setText(this.source, text);
    this.source.title = [day, slice.timetable?.sourceLabel, state.schedule.debugText]
      .filter(Boolean)
      .join(" · ");
    setClass(this.source, "is-warning", state.schedule.level === "warning");
  }

  private renderDirection(
    area: HTMLElement,
    items: BusDeparture[],
    timeZone: string,
    hasTimetable: boolean,
  ): void {
    const emptyText = hasTimetable
      ? "Järgmisi väljumisi sõiduplaanist ei leitud."
      : "Bussisõiduplaani fail puudub.";
    if (!items.length) {
      const existing = area.firstElementChild as HTMLElement | null;
      if (existing?.classList.contains("bus-empty") && area.childElementCount === 1)
        setText(existing, emptyText);
      else area.replaceChildren(createElement("div", "bus-empty", emptyText));
      return;
    }
    if (area.firstElementChild?.classList.contains("bus-empty")) area.replaceChildren();
    // Väljumisi uuendatakse iga minutivahetuse järel; kaardid on taaskasutatavad.
    reconcileChildren(area, items, createDepartureCard, (card, item) => {
      card.title = item.note;
      const [day, time, line, relative] = card.children as unknown as [
        HTMLElement,
        HTMLElement,
        HTMLElement,
        HTMLElement,
      ];
      setText(day, dayLabel(item, timeZone));
      setClass(day, "is-today", item.dayOffset === 0);
      setClass(day, "is-tomorrow", item.dayOffset === 1);
      setClass(day, "is-future", item.dayOffset > 1);
      setText(time, item.time);
      setText(line, `Liin ${item.line}`);
      setText(relative, busRelativeLabel(item));
    });
  }
}
