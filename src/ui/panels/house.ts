import type { DashboardData } from "../../data/types";
import {
  HOUSE_METRICS,
  calculatePercentageChange,
  calculateYearTotals,
  getLastTwelveMonths,
  getLatestHouseMonth,
  getPreviousHouseMonth,
  sortHouseMonths,
  type HouseMetric,
  type HouseMetricKey,
  type HouseMonth,
} from "../../domain/house/consumption";
import { svgElement } from "../charts/svg";
import { clearElement, createElement, requireElement, setText } from "../dom";
import { updateSectionStale } from "./helpers";
import type { Panel } from "./panel";

export interface HouseSlice {
  data: DashboardData;
  timeZone: string;
}

type HouseViewIndex = 0 | 1 | 2;

const VIEW_INTERVAL_MS = 8_000;
const VIEW_LABELS = ["Viimase kuu näitajad", "Viimase 12 kuu trendid", "Jooksva aasta koondnäitajad"] as const;
const SERIES_CLASS: Record<HouseMetricKey, string> = {
  waterM3: "house-water",
  heatMWh: "house-heat",
  electricityKWh: "house-electricity",
  solarKWh: "house-solar",
};
const METRIC_ICONS: Record<HouseMetricKey, string> = {
  waterM3: "💧",
  heatMWh: "♨",
  electricityKWh: "⚡",
  solarKWh: "☀",
};
const NUMBER_FORMATTERS = new Map<number, Intl.NumberFormat>();

function formatter(digits: number): Intl.NumberFormat {
  let value = NUMBER_FORMATTERS.get(digits);
  if (!value) {
    value = new Intl.NumberFormat("et-EE", { minimumFractionDigits: 0, maximumFractionDigits: digits });
    NUMBER_FORMATTERS.set(digits, value);
  }
  return value;
}

function formatMetricValue(metric: HouseMetric, value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "–";
  return `${formatter(metric.digits).format(value)} ${metric.unit}`;
}

function formatLatestPeriod(month: HouseMonth | null): string {
  if (!month) return "";
  const name = String(month.monthName || "").trim();
  const monthName = name ? name.charAt(0).toLocaleUpperCase("et-EE") + name.slice(1).toLocaleLowerCase("et-EE") : "";
  return `${monthName} ${month.year}`.trim();
}

function metricChangeClass(metric: HouseMetric, change: number | null): string {
  if (change === null || change === 0) return "is-neutral";
  const isPositive = metric.key === "solarKWh" ? change > 0 : change < 0;
  return isPositive ? "is-positive" : "is-warning";
}

function metricChangeLabel(change: number | null): string {
  if (change === null) return "–";
  if (change === 0) return "→ 0%";
  const arrow = change > 0 ? "↑" : "↓";
  return `${arrow} ${Math.abs(change)}%`;
}

export class HousePanel implements Panel<HouseSlice> {
  private area!: HTMLElement;
  private period!: HTMLElement;
  private indicator!: HTMLElement;
  private mounted = false;
  private paused = false;
  private activeView: HouseViewIndex = 0;
  private nextSwitchAt = 0;
  private months: HouseMonth[] = [];
  private monthsSource: HouseMonth[] | null = null;

  private readonly onPointerEnter = () => this.pause();
  private readonly onPointerLeave = () => this.resume();
  private readonly onFocusIn = () => this.pause();
  private readonly onFocusOut = () => this.resume();

  mount(): void {
    if (this.mounted) return;
    this.area = requireElement("houseArea");
    this.period = requireElement("housePeriod");
    this.indicator = requireElement("houseViewIndicator");
    this.area.addEventListener("pointerenter", this.onPointerEnter);
    this.area.addEventListener("pointerleave", this.onPointerLeave);
    this.area.addEventListener("focusin", this.onFocusIn);
    this.area.addEventListener("focusout", this.onFocusOut);
    this.area.tabIndex = 0;
    this.area.setAttribute("aria-live", "polite");
    this.mounted = true;
  }

  update(slice: HouseSlice): void {
    this.mount();
    updateSectionStale(slice.data, "house", "houseStale", "andmed kell", slice.timeZone);
    const source = slice.data.house?.months ?? [];
    const changed = source !== this.monthsSource;
    this.monthsSource = source;
    if (changed) this.months = sortHouseMonths(source);

    const latest = getLatestHouseMonth(this.months);
    setText(this.period, formatLatestPeriod(latest));

    if (!this.months.length) {
      this.activeView = 0;
      this.nextSwitchAt = 0;
      this.renderEmpty();
      return;
    }

    if (!this.nextSwitchAt) this.nextSwitchAt = Date.now() + VIEW_INTERVAL_MS;
    if (changed || !this.area.firstChild) this.renderActiveView();
  }

  tick(nowMs = Date.now()): void {
    if (!this.mounted || this.paused || !this.months.length || !this.nextSwitchAt || nowMs < this.nextSwitchAt) return;
    this.activeView = ((this.activeView + 1) % 3) as HouseViewIndex;
    this.nextSwitchAt = nowMs + VIEW_INTERVAL_MS;
    this.renderActiveView();
  }

  destroy(): void {
    if (!this.mounted) return;
    this.area.removeEventListener("pointerenter", this.onPointerEnter);
    this.area.removeEventListener("pointerleave", this.onPointerLeave);
    this.area.removeEventListener("focusin", this.onFocusIn);
    this.area.removeEventListener("focusout", this.onFocusOut);
    this.mounted = false;
    this.monthsSource = null;
    this.months = [];
    this.nextSwitchAt = 0;
  }

  private pause(): void {
    this.paused = true;
  }

  private resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.nextSwitchAt = Date.now() + VIEW_INTERVAL_MS;
  }

  private renderEmpty(): void {
    clearElement(this.area);
    setText(this.period, "");
    this.updateIndicator();
    const empty = createElement("div", "house-empty empty", "Andmed puuduvad");
    empty.setAttribute("role", "status");
    this.area.appendChild(empty);
  }

  private renderActiveView(): void {
    clearElement(this.area);
    const view = this.activeView === 0
      ? this.renderCurrentMonthView()
      : this.activeView === 1
        ? this.renderTrendView()
        : this.renderYearSummaryView();
    view.classList.add("house-view", "house-view-enter");
    view.setAttribute("role", "group");
    view.setAttribute("aria-label", VIEW_LABELS[this.activeView]);
    this.area.appendChild(view);
    this.updateIndicator();
  }

  private updateIndicator(): void {
    clearElement(this.indicator);
    this.indicator.setAttribute("aria-label", `Vaade ${this.activeView + 1} kolmest: ${VIEW_LABELS[this.activeView]}`);
    for (let index = 0; index < 3; index += 1) {
      const dot = createElement("span", `house-view-dot${index === this.activeView ? " is-active" : ""}`);
      dot.setAttribute("aria-hidden", "true");
      this.indicator.appendChild(dot);
    }
  }

  private renderCurrentMonthView(): HTMLElement {
    const root = createElement("div", "house-current-view");
    const latest = getLatestHouseMonth(this.months);
    if (!latest) return root;
    const previous = getPreviousHouseMonth(this.months, latest);
    for (const metric of HOUSE_METRICS) {
      const current = latest[metric.key];
      const before = previous?.[metric.key] ?? null;
      const change = calculatePercentageChange(current, before);
      const row = createElement("div", "house-kpi-row");
      const identity = createElement("div", `house-kpi-identity ${SERIES_CLASS[metric.key]}`);
      identity.append(this.renderMetricIcon(metric), createElement("span", "house-kpi-label", metric.label));
      const value = createElement("div", "house-kpi-value numeric", formatMetricValue(metric, current));
      const changeEl = createElement("div", `house-kpi-change numeric ${metricChangeClass(metric, change)}`, metricChangeLabel(change));
      changeEl.title = previous ? "Muutus võrreldes eelmise kuuga" : "Eelmise kuu andmed puuduvad";
      row.append(identity, value, changeEl);
      root.appendChild(row);
    }
    return root;
  }

  private renderTrendView(): HTMLElement {
    const root = createElement("div", "house-trend-view");
    const months = getLastTwelveMonths(this.months);
    for (const metric of HOUSE_METRICS) {
      const row = createElement("div", "house-trend-row");
      const identity = createElement("div", `house-trend-identity ${SERIES_CLASS[metric.key]}`);
      identity.append(this.renderMetricIcon(metric), createElement("span", "house-trend-label", metric.label));
      const latestValue = [...months].reverse().map((item) => item[metric.key]).find((value) => value !== null && value !== undefined) ?? null;
      const value = createElement("div", "house-trend-value numeric", formatMetricValue(metric, latestValue));
      row.append(identity, value, this.renderSparkline(months, metric));
      root.appendChild(row);
    }
    return root;
  }

  private renderYearSummaryView(): HTMLElement {
    const root = createElement("div", "house-year-view");
    const latest = getLatestHouseMonth(this.months);
    const summary = calculateYearTotals(this.months, latest?.year);
    if (!summary) return root;

    const heading = createElement("div", "house-year-heading numeric", `${summary.year} kokku`);
    root.appendChild(heading);
    const rows = createElement("div", "house-year-rows");
    for (const metric of HOUSE_METRICS) {
      const row = createElement("div", "house-year-row");
      const identity = createElement("div", `house-year-identity ${SERIES_CLASS[metric.key]}`);
      identity.append(this.renderMetricIcon(metric), createElement("span", "house-year-label", metric.label));
      row.append(identity, createElement("div", "house-year-value numeric", formatMetricValue(metric, summary.totals[metric.key])));
      rows.appendChild(row);
    }
    root.append(rows, createElement("div", "house-year-meta numeric", `Andmed: ${summary.monthCount} ${summary.monthCount === 1 ? "kuu" : "kuud"}`));
    return root;
  }

  private renderMetricIcon(metric: HouseMetric): HTMLElement {
    const icon = createElement("span", "house-metric-icon", METRIC_ICONS[metric.key]);
    icon.setAttribute("aria-hidden", "true");
    return icon;
  }

  private renderSparkline(months: HouseMonth[], metric: HouseMetric): SVGSVGElement {
    const svg = svgElement("svg", { viewBox: "0 0 100 24", preserveAspectRatio: "none", role: "img" });
    svg.classList.add("house-sparkline", SERIES_CLASS[metric.key]);
    svg.setAttribute("aria-label", `${metric.label}, viimase ${months.length} kuu trend`);
    const values = months.map((month) => month[metric.key]);
    const numeric = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
    if (!numeric.length) return svg;
    const min = Math.min(...numeric);
    const max = Math.max(...numeric);
    const range = Math.max(0.0001, max - min);
    const xFor = (index: number) => months.length <= 1 ? 50 : (index / (months.length - 1)) * 100;
    const yFor = (value: number) => max === min ? 12 : 21 - ((value - min) / range) * 18;

    let segment: string[] = [];
    const flushSegment = () => {
      if (!segment.length) return;
      if (segment.length === 1) {
        const point = segment[0];
        if (point) {
          const parts = point.split(",").map(Number);
          const x = parts[0] ?? 0;
          const y = parts[1] ?? 12;
          svg.appendChild(svgElement("circle", { cx: x, cy: y, r: 1.8, class: "house-spark-point" }));
        }
      } else {
        svg.appendChild(svgElement("polyline", { points: segment.join(" "), class: "house-spark-line" }));
      }
      segment = [];
    };

    values.forEach((value, index) => {
      if (value === null || value === undefined || !Number.isFinite(value)) {
        flushSegment();
        return;
      }
      segment.push(`${xFor(index).toFixed(2)},${yFor(value).toFixed(2)}`);
    });
    flushSegment();

    for (let index = values.length - 1; index >= 0; index -= 1) {
      const value = values[index];
      if (value === null || value === undefined || !Number.isFinite(value)) continue;
      svg.appendChild(svgElement("circle", { cx: xFor(index), cy: yFor(value), r: 2.1, class: "house-spark-last" }));
      break;
    }
    return svg;
  }
}
