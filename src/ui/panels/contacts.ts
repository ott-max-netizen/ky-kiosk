import type { Contact } from "../../data/types";
import { pageItems } from "../../domain/contacts/paging";
import { clearElement, createElement, requireElement } from "../dom";
import { updatePageLabel } from "./helpers";
import type { Panel } from "./panel";

export interface ContactsSlice {
  items: Contact[];
  pageSize: number;
  nowMs: number;
  rotationMs: number;
}

export function appendContactCard(area: HTMLElement, primary: string, secondary: string, phoneText: string, important: boolean, primaryEmergency = false): void {
  const row = createElement("div", `contact-card${important ? " contact-card-important" : ""}${primaryEmergency ? " contact-card-emergency-primary" : ""}`);
  const copy = createElement("div", "contact-copy");
  copy.append(createElement("div", "contact-primary", primary || "Kontakt"), createElement("div", "contact-secondary", secondary));
  const phone = createElement("div", "contact-phone phone numeric", phoneText);
  row.append(copy, phone);
  area.appendChild(row);
}

export class ContactsPanel implements Panel<ContactsSlice> {
  private area!: HTMLElement;
  private page = 0;
  private nextRotationAt = 0;
  private slice: ContactsSlice = { items: [], pageSize: 5, nowMs: 0, rotationMs: 18_000 };
  private mounted = false;

  mount(): void {
    if (this.mounted) return;
    this.area = requireElement("contactsArea");
    this.mounted = true;
  }

  update(slice: ContactsSlice): void {
    this.mount();
    this.slice = slice;
    const pages = Math.max(1, Math.ceil(slice.items.length / slice.pageSize));
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
    updatePageLabel("contactsPageLabel", this.slice.items.length, result.pageSize, result.page);
    if (!this.slice.items.length) {
      this.area.appendChild(createElement("div", "empty", "Kontaktandmed puuduvad."));
      return;
    }
    for (const item of result.items) appendContactCard(this.area, item.name, item.role, item.phone, false);
  }
}
