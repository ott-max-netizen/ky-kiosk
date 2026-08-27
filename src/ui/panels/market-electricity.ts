import type { DashboardData, ElectricityPoint } from "../../data/types";
import { electricityDateIsToday, marketCurrentIndex, priceToCentsPerKwh } from "../../domain/electricity/price";
import { ElectricityChart } from "../charts/electricity-chart";
import { clearElement, createElement, formatNumber, requireElement, setText } from "../dom";
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
    this.mounted = true;
  }

  update(slice: ElectricitySlice): void {
    this.mount();
    const value = slice.data.electricity;
    const points = this.normalizedPoints(value?.points ?? [], value?.unit);
    clearElement(this.stats);
    if (!value || !points.length) {
      setText(this.meta, "Täna · s/kWh · KM 24%");
      this.setCurrent(null);
      this.chart.update([], -1);
      this.stats.appendChild(createElement("div", "market-empty", "Elektrihind puudub"));
      this.applyStale(slice.data);
      return;
    }
    const today = electricityDateIsToday(value.date, slice.now, slice.timeZone);
    const currentIndex = today ? marketCurrentIndex(points, slice.now) : -1;
    const currentPoint = currentIndex >= 0 ? points[currentIndex] : undefined;
    const tariff = currentPoint?.tariffLabelEt || value.currentTariffLabelEt || "";
    setText(this.meta, [formatDateValue(value.date, "dayMonth", slice.timeZone), tariff, "KM 24%"].filter(Boolean).join(" · "));
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
    for (const [label, number] of stats) {
      const item = createElement("div", "market-stat");
      item.append(createElement("span", "market-stat-label", label), createElement("strong", "market-stat-value numeric", number === null ? "–" : formatNumber(number, 2)));
      this.stats.appendChild(item);
    }
    const updated = sectionUpdatedTime(slice.data, "electricity", slice.timeZone);
    const sourceText = value.tariffSource ? "Elering + Elekter · muutuvtasud · püsitasudeta" : "Elering · Nord Pool · s/kWh koos 24% KM-ga";
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
    clearElement(this.current);
    if (value === null || !Number.isFinite(value)) {
      this.current.textContent = "–";
      return;
    }
    this.current.append(document.createTextNode(formatNumber(value, 2)), createElement("small", undefined, "s/kWh"));
  }

  private applyStale(data: DashboardData): void {
    const error = data.sectionErrors.electricity;
    const updated = Date.parse(data.sectionUpdatedAt.electricity ?? "");
    const age = Number.isFinite(updated) ? Date.now() - updated : Number.POSITIVE_INFINITY;
    const stale = Boolean(error) || age > 86_400_000;
    this.card.classList.toggle("is-stale", stale);
    this.stale.hidden = !stale;
    setText(this.stale, stale ? (error ? "vahemälust" : `${Math.max(1, Math.floor(age / 86_400_000))} p vana`) : "");
  }
}
