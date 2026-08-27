import type { WasteItem, WasteOccurrence } from "../../domain/waste/occurrences";
import { nextWasteByType } from "../../domain/waste/occurrences";
import { zonedParts } from "../../domain/time/zoned";
import { pageItems } from "../../domain/contacts/paging";
import { clearElement, createElement, requireElement, setText } from "../dom";
import { formatDateValue, updatePageLabel } from "./helpers";
import type { Panel } from "./panel";

export interface WasteSlice {
  items: WasteItem[];
  now: Date;
  timeZone: string;
  windowDays: number;
  pageSize: number;
  rotationMs: number;
  onWarnings?(warnings: string[]): void;
}

export class WastePanel implements Panel<WasteSlice> {
  private area!: HTMLElement;
  private windowLabel!: HTMLElement;
  private slice: WasteSlice = { items: [], now: new Date(), timeZone: "Europe/Tallinn", windowDays: 30, pageSize: 5, rotationMs: 18_000 };
  private occurrences: WasteOccurrence[] = [];
  private page = 0;
  private nextRotationAt = 0;
  private mounted = false;
  private dateKey = "";

  mount(): void {
    if (this.mounted) return;
    this.area = requireElement("wasteChart");
    this.windowLabel = requireElement("wasteWindowLabel");
    this.mounted = true;
  }

  update(slice: WasteSlice): void {
    this.mount();
    this.slice = slice;
    const result = nextWasteByType(slice.items, slice.windowDays, zonedParts(slice.now, slice.timeZone), slice.timeZone);
    this.occurrences = result.occurrences;
    slice.onWarnings?.(result.warnings);
    const pages = Math.max(1, Math.ceil(this.occurrences.length / slice.pageSize));
    this.page %= pages;
    this.nextRotationAt ||= slice.now.getTime() + slice.rotationMs;
    const parts = zonedParts(slice.now, slice.timeZone);
    this.dateKey = `${parts.year}-${parts.month}-${parts.day}`;
    this.render();
  }

  tick(now: Date): void {
    const parts = zonedParts(now, this.slice.timeZone);
    const key = `${parts.year}-${parts.month}-${parts.day}`;
    if (key !== this.dateKey) {
      this.update({ ...this.slice, now });
      return;
    }
    const pages = Math.max(1, Math.ceil(this.occurrences.length / this.slice.pageSize));
    if (pages <= 1 || now.getTime() < this.nextRotationAt) return;
    this.page = (this.page + 1) % pages;
    this.nextRotationAt = now.getTime() + this.slice.rotationMs;
    this.render();
  }

  destroy(): void {
    this.mounted = false;
  }

  private render(): void {
    clearElement(this.area);
    setText(this.windowLabel, String(this.slice.windowDays));
    const page = pageItems(this.occurrences, this.page, this.slice.pageSize);
    this.page = page.page;
    updatePageLabel("wastePageLabel", this.occurrences.length, page.pageSize, page.page);
    if (!this.occurrences.length) {
      this.area.appendChild(createElement("div", "empty", `Järgmise ${this.slice.windowDays} päeva prügivedusid ei ole sisestatud.`));
      return;
    }
    for (const occurrence of page.items) this.renderOccurrence(occurrence);
    this.renderAxis();
  }

  private renderOccurrence({ item, days }: WasteOccurrence): void {
    const pct = Math.min(100, Math.max(0, (days / this.slice.windowDays) * 100));
    const row = createElement("div", "waste-row");
    const name = createElement("div", "waste-name", item.type || "Jäätmed");
    const track = createElement("div", "waste-track");
    const progress = createElement("div", "waste-progress");
    progress.style.width = `${pct}%`;
    const marker = createElement("div", "waste-marker");
    marker.style.left = `${pct}%`;
    track.append(progress, marker);
    const date = createElement("div", "waste-date numeric");
    const strong = createElement("strong", undefined, days === 0 ? "Täna" : days === 1 ? "Homme" : `${days} p`);
    if (days <= 1) strong.classList.add("is-word");
    const small = createElement("span", undefined, formatDateValue(item.date, "dayMonth", this.slice.timeZone));
    date.append(strong, small);
    row.append(name, track, date);
    this.area.appendChild(row);
  }

  private renderAxis(): void {
    const axis = createElement("div", "axis");
    axis.appendChild(createElement("div"));
    const labels = createElement("div", "axis-labels numeric");
    const ticks = [0, 7, 14, 21, this.slice.windowDays].filter((value, index, values) => value <= this.slice.windowDays && values.indexOf(value) === index);
    for (const value of ticks) {
      const span = createElement("span", undefined, value === 0 ? "täna" : `${value} p`);
      span.style.left = `${(value / this.slice.windowDays) * 100}%`;
      labels.appendChild(span);
    }
    axis.append(labels, createElement("div"));
    this.area.appendChild(axis);
  }
}
