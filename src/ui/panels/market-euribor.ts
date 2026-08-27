import type { DashboardData } from "../../data/types";
import { EuriborChart } from "../charts/euribor-chart";
import { clearElement, createElement, formatNumber, requireElement, setText } from "../dom";
import { formatDateValue, sectionUpdatedTime } from "./helpers";
import type { Panel } from "./panel";

export interface EuriborSlice { data: DashboardData; timeZone: string }

export class MarketEuriborPanel implements Panel<EuriborSlice> {
  private meta!: HTMLElement;
  private current!: HTMLElement;
  private container!: HTMLElement;
  private stale!: HTMLElement;
  private source!: HTMLElement;
  private card!: HTMLElement;
  private chart!: EuriborChart;
  private mounted = false;

  mount(): void {
    if (this.mounted) return;
    this.meta = requireElement("euriborMeta");
    this.current = requireElement("euriborNow");
    this.container = requireElement("euriborChart");
    this.stale = requireElement("euriborStale");
    this.source = requireElement("euriborSource");
    this.card = requireElement("euriborCard");
    this.chart = new EuriborChart(this.container);
    this.chart.mount();
    this.mounted = true;
  }

  update(slice: EuriborSlice): void {
    this.mount();
    const data = slice.data.euribor;
    if (!data?.points.length) {
      setText(this.meta, "Viimased 6 kuud");
      setText(this.current, "–");
      this.chart.update([]);
      if (!this.container.querySelector(".market-empty")) this.container.appendChild(createElement("div", "market-empty", "Euribor puudub"));
      this.applyStale(slice.data);
      return;
    }
    this.container.querySelector(".market-empty")?.remove();
    const sorted = [...data.points].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted.at(-1)!;
    setText(this.meta, `seisuga ${formatDateValue(latest.date, "dayMonth", slice.timeZone)}`);
    setText(this.current, `${formatNumber(latest.value, 3)}%`);
    this.chart.update(sorted);
    const updated = sectionUpdatedTime(slice.data, "euribor", slice.timeZone);
    setText(this.source, [data.source || "Soome Pank · EMMI", "24 h viitega", updated ? `andmed ${updated}` : ""].filter(Boolean).join(" · "));
    this.applyStale(slice.data);
  }

  destroy(): void { this.chart?.destroy(); this.mounted = false; }

  private applyStale(data: DashboardData): void {
    const error = data.sectionErrors.euribor;
    const updated = Date.parse(data.sectionUpdatedAt.euribor ?? "");
    const age = Number.isFinite(updated) ? Date.now() - updated : Number.POSITIVE_INFINITY;
    const stale = Boolean(error) || age > 86_400_000;
    this.card.classList.toggle("is-stale", stale);
    this.stale.hidden = !stale;
    setText(this.stale, stale ? (error ? "vahemälust" : `${Math.max(1, Math.floor(age / 86_400_000))} p vana`) : "");
  }
}
