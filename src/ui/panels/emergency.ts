import type { EmergencyContact } from "../../data/types";
import { pageItems } from "../../domain/contacts/paging";
import { clearElement, createElement, requireElement } from "../dom";
import { appendContactCard } from "./contacts";
import { updatePageLabel } from "./helpers";
import type { Panel } from "./panel";

export interface EmergencySlice {
  items: EmergencyContact[];
  pageSize: number;
  nowMs: number;
  rotationMs: number;
}

export class EmergencyPanel implements Panel<EmergencySlice> {
  private area!: HTMLElement;
  private page = 0;
  private nextRotationAt = 0;
  private slice: EmergencySlice = { items: [], pageSize: 5, nowMs: 0, rotationMs: 18_000 };
  private mounted = false;

  mount(): void {
    if (this.mounted) return;
    this.area = requireElement("emergencyArea");
    this.mounted = true;
  }

  update(slice: EmergencySlice): void {
    this.mount();
    this.slice = { ...slice, items: [...slice.items].sort((a, b) => a.priority - b.priority) };
    const pages = Math.max(1, Math.ceil(this.slice.items.length / this.slice.pageSize));
    this.page %= pages;
    if (!this.nextRotationAt) this.nextRotationAt = slice.nowMs + slice.rotationMs;
    this.render();
  }

  tick(nowMs: number): void {
    const pages = Math.max(1, Math.ceil(this.slice.items.length / this.slice.pageSize));
    if (pages <= 1 || nowMs < this.nextRotationAt) return;
    this.page = (this.page + 1) % pages;
    this.nextRotationAt = nowMs + this.slice.rotationMs;
    this.render();
  }

  destroy(): void {
    this.mounted = false;
  }

  private render(): void {
    clearElement(this.area);
    const result = pageItems(this.slice.items, this.page, this.slice.pageSize);
    this.page = result.page;
    updatePageLabel("emergencyPageLabel", this.slice.items.length, result.pageSize, result.page);
    if (!this.slice.items.length) {
      this.area.appendChild(createElement("div", "empty", "Kontaktandmed puuduvad."));
      return;
    }
    for (const item of result.items) {
      const isPrimaryEmergency = item.phone.replace(/\D/g, "") === "112";
      appendContactCard(this.area, item.name, item.note, item.phone, true, isPrimaryEmergency);
    }
  }
}
