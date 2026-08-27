import type { Contact } from "../../data/types";
import { pageItems } from "../../domain/contacts/paging";
import { createElement, requireElement, setClass, setText } from "../dom";
import { reconcileChildren } from "../reconcile";
import { updatePageLabel } from "./helpers";
import type { Panel } from "./panel";

export interface ContactsSlice {
  items: Contact[];
  pageSize: number;
  nowMs: number;
  rotationMs: number;
}

export interface ContactCardValues {
  primary: string;
  secondary: string;
  phoneText: string;
  important: boolean;
  primaryEmergency: boolean;
}

/** Loob tühja kontaktikaardi skeleti. Sisu täidab `patchContactCard`. */
export function createContactCard(): HTMLElement {
  const row = createElement("div", "contact-card");
  const copy = createElement("div", "contact-copy");
  copy.append(createElement("div", "contact-primary"), createElement("div", "contact-secondary"));
  row.append(copy, createElement("div", "contact-phone phone numeric"));
  return row;
}

/** Kirjutab olemasolevale kaardile uue sisu, ilma elemente uuesti loomata. */
export function patchContactCard(row: HTMLElement, values: ContactCardValues): void {
  setClass(row, "contact-card-important", values.important);
  setClass(row, "contact-card-emergency-primary", values.primaryEmergency);
  const copy = row.firstElementChild as HTMLElement;
  setText(copy.firstElementChild as HTMLElement, values.primary || "Kontakt");
  setText(copy.lastElementChild as HTMLElement, values.secondary);
  setText(row.lastElementChild as HTMLElement, values.phoneText);
}

export class ContactsPanel implements Panel<ContactsSlice> {
  private area!: HTMLElement;
  private page = 0;
  private nextRotationAt = 0;
  private slice: ContactsSlice = { items: [], pageSize: 5, nowMs: 0, rotationMs: 18_000 };
  private mounted = false;
  private empty: HTMLElement | null = null;

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
    updatePageLabel("contactsPageLabel", this.slice.items.length, result.pageSize, result.page);
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
        secondary: item.role,
        phoneText: item.phone,
        important: false,
        primaryEmergency: false,
      }),
    );
  }
}
