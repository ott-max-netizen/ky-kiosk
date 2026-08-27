import type { EmergencyContact } from "../../data/types";
import { pageItems } from "../../domain/contacts/paging";
import { createElement, requireElement } from "../dom";
import { reconcileChildren } from "../reconcile";
import { createContactCard, patchContactCard } from "./contacts";
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
  private empty: HTMLElement | null = null;

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

  tick(now: Date): void {
    const nowMs = now.getTime();
    const pages = Math.max(1, Math.ceil(this.slice.items.length / this.slice.pageSize));
    if (pages <= 1 || nowMs < this.nextRotationAt) return;
    this.page = (this.page + 1) % pages;
    this.nextRotationAt = nowMs + this.slice.rotationMs;
    this.render();
  }

  destroy(): void {
    this.mounted = false;
    this.empty = null;
  }

  private render(): void {
    const result = pageItems(this.slice.items, this.page, this.slice.pageSize);
    this.page = result.page;
    updatePageLabel("emergencyPageLabel", this.slice.items.length, result.pageSize, result.page);
    if (!this.slice.items.length) {
      if (!this.empty) {
        this.area.replaceChildren();
        this.empty = createElement("div", "empty", "Kontaktandmed puuduvad.");
        this.area.appendChild(this.empty);
      }
      return;
    }
    if (this.empty) {
      this.empty.remove();
      this.empty = null;
    }
    reconcileChildren(this.area, result.items, createContactCard, (row, item) =>
      patchContactCard(row, {
        primary: item.name,
        secondary: item.note,
        phoneText: item.phone,
        important: true,
        primaryEmergency: item.phone.replace(/\D/g, "") === "112",
      }),
    );
  }
}
