import type { DashboardData, ElectricityPoint } from "../../data/types";
import {
  electricityDateIsToday,
  marketCurrentIndex,
  priceToCentsPerKwh,
} from "../../domain/electricity/price";
import { ElectricityChart } from "../charts/electricity-chart";
import { createElement, formatNumber, requireElement, setHidden, setText } from "../dom";
import { reconcileChildren } from "../reconcile";
import { formatDateValue, sectionUpdatedTime } from "./helpers";
import type { Panel } from "./panel";

export interface ElectricitySlice {
  data: DashboardData;
  now: Date;
  timeZone: string;
}

export class MarketElectricityPanel implements Panel<ElectricitySlice> {
  private meta!: HTMLElement;
  private current!: HTMLElement;
  private chartContainer!: HTMLElement;
  private stats!: HTMLElement;
  private source!: HTMLElement;
  private stale!: HTMLElement;
  private card!: HTMLElement;
  private chart!: ElectricityChart;
  private currentValue!: Text;
  private currentUnit!: HTMLElement;
  private mounted = false;

  mount(): void {
    if (this.mounted) return;
    this.meta = requireElement("electricityMeta");
    this.current = requireElement("electricityNow");
    this.chartContainer = requireElement("electricityChart");
    this.stats = requireElement("electricityStats");
    this.source = requireElement("electricitySource");
    this.stale = requireElement("electricityStale");
    this.card = requireElement("electricityCard");
    this.chart = new ElectricityChart(this.chartContainer);
    this.chart.mount();
    // Praeguse hinna number ja ühik on püsivad sõlmed: neid uuendatakse iga
    // minutivahetuse järel ja varem loodi mõlemad iga kord uuesti.
    this.currentValue = document.createTextNode("–");
    this.currentUnit = createElement("small", undefined, "s/kWh");
    this.current.replaceChildren(this.currentValue, this.currentUnit);
    this.mounted = true;
  }

  update(slice: ElectricitySlice): void {
    this.mount();
    const value = slice.data.electricity;
    const points = this.normalizedPoints(value?.points ?? [], value?.unit);
    if (!value || !points.length) {
      setText(this.meta, "Täna · s/kWh · KM 24%");
      this.setCurrent(null);
      this.chart.update([], -1);
      const existing = this.stats.firstElementChild as HTMLElement | null;
      if (existing?.classList.contains("market-empty") && this.stats.childElementCount === 1)
        setText(existing, "Elektrihind puudub");
      else this.stats.replaceChildren(createElement("div", "market-empty", "Elektrihind puudub"));
      this.applyStale(slice.data);
      return;
    }
    if (this.stats.firstElementChild?.classList.contains("market-empty")) this.stats.replaceChildren();
    const today = electricityDateIsToday(value.date, slice.now, slice.timeZone);
    const currentIndex = today ? marketCurrentIndex(points, slice.now) : -1;
    const currentPoint = currentIndex >= 0 ? points[currentIndex] : undefined;
    const tariff = currentPoint?.tariffLabelEt || value.currentTariffLabelEt || "";
    setText(
      this.meta,
      [formatDateValue(value.date, "dayMonth", slice.timeZone), tariff, "KM 24%"].filter(Boolean).join(" · "),
    );
    this.setCurrent(today && currentPoint ? currentPoint.price : null);
    if (!today) this.current.title = "Tänase päeva elektrihind pole veel saadaval";
    else this.current.removeAttribute("title");
    this.chart.update(points, currentIndex);
    const prices = points.map((point) => point.price).filter(Number.isFinite);
    const stats = [
      ["min", prices.length ? Math.min(...prices) : null],
      ["keskm", prices.length ? prices.reduce((sum, number) => sum + number, 0) / prices.length : null],
      ["max", prices.length ? Math.max(...prices) : null],
    ] as const;
    // Kolm statistikarida uuenevad iga minut; sildid ja sõlmed jäävad püsima.
    reconcileChildren(
      this.stats,
      stats,
      () => {
        const item = createElement("div", "market-stat");
        item.append(
          createElement("span", "market-stat-label"),
          createElement("strong", "market-stat-value numeric"),
        );
        return item;
      },
      (item, [label, number]) => {
        setText(item.firstElementChild as HTMLElement, label);
        setText(item.lastElementChild as HTMLElement, number === null ? "–" : formatNumber(number, 2));
      },
    );
    const updated = sectionUpdatedTime(slice.data, "electricity", slice.timeZone);
    const sourceText = value.tariffSource
      ? "Elering + Elekter · muutuvtasud · püsitasudeta"
      : "Elering · Nord Pool · s/kWh koos 24% KM-ga";
    setText(this.source, [sourceText, updated ? `andmed ${updated}` : ""].filter(Boolean).join(" · "));
    this.applyStale(slice.data);
  }

  destroy(): void {
    this.chart?.destroy();
    this.mounted = false;
  }

  private normalizedPoints(points: ElectricityPoint[], unit: unknown): ElectricityPoint[] {
    return points.flatMap((point) => {
      const price = priceToCentsPerKwh(point.price, unit);
      return price === null || !point.time ? [] : [{ ...point, price }];
    });
  }

  private setCurrent(value: number | null): void {
    const missing = value === null || !Number.isFinite(value);
    const text = missing ? "–" : formatNumber(value as number, 2);
    if (this.currentValue.data !== text) this.currentValue.data = text;
    // Puuduva hinna korral kadus <small> varem koos kogu sisuga; `hidden` annab sama tulemuse.
    setHidden(this.currentUnit, missing);
  }

  private applyStale(data: DashboardData): void {
    const error = data.sectionErrors.electricity;
    const updated = Date.parse(data.sectionUpdatedAt.electricity ?? "");
    const age = Number.isFinite(updated) ? Date.now() - updated : Number.POSITIVE_INFINITY;
    const stale = Boolean(error) || age > 86_400_000;
    this.card.classList.toggle("is-stale", stale);
    this.stale.hidden = !stale;
    setText(
      this.stale,
      stale ? (error ? "vahemälust" : `${Math.max(1, Math.floor(age / 86_400_000))} p vana`) : "",
    );
  }
}
