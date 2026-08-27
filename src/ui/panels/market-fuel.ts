import type { DashboardData } from "../../data/types";
import { createElement, formatNumber, requireElement, setHidden, setText } from "../dom";
import { reconcileChildren } from "../reconcile";
import { formatDateValue, sectionUpdatedTime } from "./helpers";
import type { Panel } from "./panel";

export interface FuelSlice { data: DashboardData; timeZone: string }

export class MarketFuelPanel implements Panel<FuelSlice> {
  private meta!: HTMLElement;
  private values!: HTMLElement;
  private source!: HTMLElement;
  private stale!: HTMLElement;
  private card!: HTMLElement;
  private mounted = false;

  mount(): void {
    if (this.mounted) return;
    this.meta = requireElement("fuelMeta");
    this.values = requireElement("fuelValues");
    this.source = requireElement("fuelSource");
    this.stale = requireElement("fuelStale");
    this.card = requireElement("fuelCard");
    this.mounted = true;
  }

  update(slice: FuelSlice): void {
    this.mount();
    const data = slice.data.fuel;
    if (!data) {
      setText(this.meta, "Eesti keskmine");
      const existing = this.values.firstElementChild as HTMLElement | null;
      if (existing?.classList.contains("market-empty") && this.values.childElementCount === 1) setText(existing, "Kütusehind puudub");
      else this.values.replaceChildren(createElement("div", "market-empty", "Kütusehind puudub"));
      this.applyStale(slice.data);
      return;
    }
    if (this.values.firstElementChild?.classList.contains("market-empty")) this.values.replaceChildren();
    setText(this.meta, `Eesti keskmine${data.displayDate || data.bulletinDate ? ` · ${formatDateValue(data.displayDate || data.bulletinDate, "dayMonth", slice.timeZone)}` : ""}`);
    const updated = sectionUpdatedTime(slice.data, "fuel", slice.timeZone);
    setText(this.source, [`${data.source || "OpenVan.camp"} · Eesti nädala keskmine`, updated ? `andmed ${updated}` : ""].filter(Boolean).join(" · "));
    // Kolm rida uuenevad iga sünkroonimisega; sõlmed on taaskasutatavad.
    const rows = [["95", data.petrol95], ["98", data.petrol98], ["D", data.diesel]] as const;
    reconcileChildren(
      this.values,
      rows,
      () => {
        const row = createElement("div", "market-fuel-row");
        const priceElement = createElement("strong", "market-fuel-price numeric");
        priceElement.append(document.createTextNode("–"), createElement("small", undefined, "/l"));
        row.append(createElement("span", "market-fuel-kind"), priceElement);
        return row;
      },
      (row, [kind, price]) => {
        setText(row.firstElementChild as HTMLElement, kind);
        const priceElement = row.lastElementChild as HTMLElement;
        const missing = price === null || !Number.isFinite(price);
        const valueNode = priceElement.firstChild as Text;
        const text = missing ? "–" : `${formatNumber(price as number, 3)} €`;
        if (valueNode.data !== text) valueNode.data = text;
        setHidden(priceElement.lastElementChild as HTMLElement, missing);
      },
    );
    this.applyStale(slice.data);
  }

  destroy(): void { this.mounted = false; }

  private applyStale(data: DashboardData): void {
    const error = data.sectionErrors.fuel;
    const updated = Date.parse(data.sectionUpdatedAt.fuel ?? "");
    const age = Number.isFinite(updated) ? Date.now() - updated : Number.POSITIVE_INFINITY;
    const stale = Boolean(error) || age > 86_400_000;
    this.card.classList.toggle("is-stale", stale);
    this.stale.hidden = !stale;
    setText(this.stale, stale ? (error ? "vahemälust" : `${Math.max(1, Math.floor(age / 86_400_000))} p vana`) : "");
  }
}
