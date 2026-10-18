import type { ElectricityPoint } from "../../data/types";
import { getFormatters } from "../../domain/time/formatters";
import { formatNumber } from "../dom";
import { chartFontSize, estimateLabelWidth, patchAttributes, svgElement } from "./svg";

interface CleanPoint {
  time: string;
  price: number;
}

export class ElectricityChart {
  private svg: SVGSVGElement | null = null;
  private plotGroup: SVGGElement | null = null;
  private gridGroup: SVGGElement | null = null;
  private labelGroup: SVGGElement | null = null;
  private bars: SVGRectElement[] = [];
  private dataKey = "";
  private currentIndex = -1;

  constructor(private readonly container: HTMLElement) {}

  mount(): void {
    if (this.svg) return;
    this.svg = svgElement("svg", {
      viewBox: "0 0 320 88",
      class: "market-chart",
      role: "img",
      "aria-label": "Tänase elektri ostuhinna graafik koos muutuvtasude ja käibemaksuga",
    });
    this.gridGroup = svgElement("g");
    this.plotGroup = svgElement("g");
    this.labelGroup = svgElement("g");
    this.svg.append(this.gridGroup, this.plotGroup, this.labelGroup);
    this.container.appendChild(this.svg);
  }

  update(points: ElectricityPoint[], currentIndex: number, timeZone = "Europe/Tallinn"): void {
    this.mount();
    const clean = points
      .map((point) => ({ time: point.time, price: Number(point.price) }))
      .filter((point) => Number.isFinite(point.price) && Number.isFinite(Date.parse(point.time)));
    // Ajavöönd on võtme osa: teljesildid sõltuvad sellest, mitte ainult punktidest.
    const key = `${timeZone}#${clean.map((point) => `${point.time}:${point.price}`).join("|")}`;
    if (key !== this.dataKey) {
      this.dataKey = key;
      this.rebuildData(clean, timeZone);
    }
    this.patchCurrent(currentIndex);
  }

  destroy(): void {
    this.svg?.remove();
    this.svg = null;
    this.plotGroup = null;
    this.gridGroup = null;
    this.labelGroup = null;
    this.bars = [];
    this.dataKey = "";
    this.currentIndex = -1;
  }

  private rebuildData(points: CleanPoint[], timeZone: string): void {
    if (!this.svg || !this.gridGroup || !this.plotGroup || !this.labelGroup) return;
    this.gridGroup.replaceChildren();
    this.plotGroup.replaceChildren();
    this.labelGroup.replaceChildren();
    this.bars = [];
    this.currentIndex = -1;
    if (!points.length) return;

    const width = 320;
    const height = 88;
    const values = points.map((point) => point.price);
    let lower = Math.min(0, ...values);
    let upper = Math.max(0, ...values);
    if (upper === lower) {
      upper += 1;
      lower -= 1;
    }
    const range = upper - lower;

    // Teljesildid luuakse enne paigutust, et vasak veeris arvutada siltide tegelikust
    // pikkusest ja fondi suurusest. Fikseeritud 25-ühikuline veeris lõikas "22,3"
    // esimese numbri ära, sest sildid skaleeruvad koos viewBox'iga.
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => upper - range * fraction);
    const scaleLabels = ticks.map((tick) => {
      const label = svgElement("text", { "text-anchor": "end", class: "market-chart-scale" });
      label.textContent = formatNumber(tick, 1);
      this.labelGroup?.appendChild(label);
      return label;
    });
    const fontSize = chartFontSize(scaleLabels[0] as Element);
    const labelWidth = Math.max(
      ...scaleLabels.map((label) => estimateLabelWidth(label.textContent ?? "", fontSize)),
    );
    const pad = {
      top: Math.ceil(fontSize * 0.4),
      right: 3,
      bottom: Math.ceil(fontSize + 2),
      left: Math.max(25, Math.ceil(labelWidth + 5)),
    };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const y = (value: number) => pad.top + ((upper - value) / range) * plotHeight;
    const zeroY = y(0);

    ticks.forEach((tick, index) => {
      const lineY = y(tick);
      this.gridGroup?.appendChild(
        svgElement("line", {
          x1: pad.left,
          y1: lineY,
          x2: width - pad.right,
          y2: lineY,
          class: Math.abs(tick) < 0.0001 ? "market-zero-line" : "market-grid-line",
        }),
      );
      const label = scaleLabels[index];
      if (label) patchAttributes(label, { x: pad.left - 3, y: lineY + fontSize * 0.35 });
    });

    const slot = plotWidth / points.length;
    const barWidth = Math.max(1.2, slot * 0.72);
    points.forEach((point, index) => {
      const pointY = y(point.price);
      const rect = svgElement("rect", {
        x: pad.left + index * slot + (slot - barWidth) / 2,
        y: Math.min(pointY, zeroY),
        width: barWidth,
        height: Math.max(0.7, Math.abs(zeroY - pointY)),
        class: `market-electric-bar${point.price < 0 ? " is-negative" : ""}`,
      });
      this.plotGroup?.appendChild(rect);
      this.bars.push(rect);
    });

    const timeFormat = getFormatters(timeZone).time;
    const timeIndexes = [0, Math.floor((points.length - 1) / 2), points.length - 1];
    for (const [position, index] of timeIndexes.entries()) {
      const point = points[index];
      if (!point) continue;
      const date = new Date(point.time);
      const label = svgElement("text", {
        x: pad.left + index * slot + slot / 2,
        y: height - 2,
        "text-anchor": position === 0 ? "start" : position === 2 ? "end" : "middle",
        class: "market-chart-label",
      });
      label.textContent = timeFormat.format(date);
      this.labelGroup.appendChild(label);
    }
  }

  private patchCurrent(nextIndex: number): void {
    if (nextIndex === this.currentIndex) return;
    const previous = this.bars[this.currentIndex];
    if (previous) previous.classList.remove("is-current");
    const next = this.bars[nextIndex];
    if (next) next.classList.add("is-current");
    this.currentIndex = nextIndex;
  }
}
