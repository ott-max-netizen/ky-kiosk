import type { WasteItem, WasteOccurrence } from "../../domain/waste/occurrences";
import { nextWasteByType } from "../../domain/waste/occurrences";
import { zonedParts } from "../../domain/time/zoned";
import { pageItems } from "../../domain/contacts/paging";
import { createElement, requireElement, setClass, setText } from "../dom";
import { reconcileChildren } from "../reconcile";
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

function createRow(): HTMLElement {
  const row = createElement("div", "waste-row");
  const track = createElement("div", "waste-track");
  track.append(createElement("div", "waste-progress"), createElement("div", "waste-marker"));
  const date = createElement("div", "waste-date numeric");
  date.append(createElement("strong"), createElement("span"));
  row.append(createElement("div", "waste-name"), track, date);
  return row;
}

export class WastePanel implements Panel<WasteSlice> {
  private area!: HTMLElement;
  private windowLabel!: HTMLElement;
  private axis: HTMLElement | null = null;
  private empty: HTMLElement | null = null;
  private axisWindowDays = 0;
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
    this.axis = null;
    this.empty = null;
    this.axisWindowDays = 0;
  }

  private render(): void {
    setText(this.windowLabel, String(this.slice.windowDays));
    const page = pageItems(this.occurrences, this.page, this.slice.pageSize);
    this.page = page.page;
    updatePageLabel("wastePageLabel", this.occurrences.length, page.pageSize, page.page);

    const emptyText = `Järgmise ${this.slice.windowDays} päeva prügivedusid ei ole sisestatud.`;
    if (!this.occurrences.length) {
      if (!this.empty) {
        this.area.replaceChildren();
        this.axis = null;
        this.axisWindowDays = 0;
        this.empty = createElement("div", "empty", emptyText);
        this.area.appendChild(this.empty);
      } else {
        setText(this.empty, emptyText);
      }
      return;
    }
    if (this.empty) {
      this.empty.remove();
      this.empty = null;
    }
    // Read on `#wasteChart`-i otsesed lapsed (flex gap sõltub sellest), telg on
    // viimane laps. Telg võetakse lepitamise ajaks välja ja pannakse pärast
    // tagasi — sama sõlm, mitte uus, nii et lisa-elemente ei teki.
    this.axis?.remove();
    reconcileChildren(this.area, page.items, createRow, (row, occurrence) => this.patchRow(row, occurrence));
    this.appendAxis();
  }

  private patchRow(row: HTMLElement, { item, days }: WasteOccurrence): void {
    const pct = Math.min(100, Math.max(0, (days / this.slice.windowDays) * 100));
    const [name, track, date] = row.children as unknown as [HTMLElement, HTMLElement, HTMLElement];
    setText(name, item.type || "Jäätmed");
    const [progress, marker] = track.children as unknown as [HTMLElement, HTMLElement];
    const width = `${pct}%`;
    if (progress.style.width !== width) progress.style.width = width;
    if (marker.style.left !== width) marker.style.left = width;
    const [strong, small] = date.children as unknown as [HTMLElement, HTMLElement];
    setText(strong, days === 0 ? "Täna" : days === 1 ? "Homme" : `${days} p`);
    setClass(strong, "is-word", days <= 1);
    setText(small, formatDateValue(item.date, "dayMonth", this.slice.timeZone));
  }

  /** Telg sõltub ainult aknast; varem ehitati ta iga 18 s pöörde peal uuesti. */
  private appendAxis(): void {
    if (this.axis && this.axisWindowDays === this.slice.windowDays) {
      this.area.appendChild(this.axis);
      return;
    }
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
    this.axis = axis;
    this.axisWindowDays = this.slice.windowDays;
  }
}
