import type { DashboardData } from "../../data/types";
import { EuriborChart } from "../charts/euribor-chart";
import { createElement, formatNumber, requireElement, setText } from "../dom";
import { formatDateValue, sectionUpdatedTime, updateMarketCardStale } from "./helpers";
import type { Panel } from "./panel";

export interface EuriborSlice {
  data: DashboardData;
  now: Date;
  timeZone: string;
}

export class MarketEuriborPanel implements Panel<EuriborSlice> {
  private meta!: HTMLElement;
  private current!: HTMLElement;
  private container!: HTMLElement;
  private stale!: HTMLElement;
  private source!: HTMLElement;
  private card!: HTMLElement;
  private chart!: EuriborChart;
  private mounted = false;
  private lastData: DashboardData | null = null;

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
      if (!this.container.querySelector(".market-empty"))
        this.container.appendChild(createElement("div", "market-empty", "Euribor puudub"));
      this.applyStale(slice);
      return;
    }
    this.container.querySelector(".market-empty")?.remove();
    const sorted = [...data.points].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted.at(-1)!;
    setText(this.meta, `seisuga ${formatDateValue(latest.date, "dayMonth", slice.timeZone)}`);
    setText(this.current, `${formatNumber(latest.value, 3)}%`);
    this.chart.update(sorted);
    const updated = sectionUpdatedTime(slice.data, "euribor", slice.timeZone);
    setText(
      this.source,
      [data.source || "Soome Pank · EMMI", "24 h viitega", updated ? `andmed ${updated}` : ""]
        .filter(Boolean)
        .join(" · "),
    );
    this.applyStale(slice);
  }

  /** Aegumismärgis liigub kellaga edasi ka ilma uue sünkroonimiseta. */
  tick(now: Date): void {
    if (!this.mounted || !this.lastData) return;
    updateMarketCardStale(this.lastData, "euribor", this.card, this.stale, now.getTime());
  }

  destroy(): void {
    this.lastData = null;
    this.chart?.destroy();
    this.mounted = false;
  }

  private applyStale(slice: EuriborSlice): void {
    this.lastData = slice.data;
    updateMarketCardStale(slice.data, "euribor", this.card, this.stale, slice.now.getTime());
  }
}
