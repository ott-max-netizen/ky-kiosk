import type { EuriborPoint } from "../../data/types";
import { formatNumber } from "../dom";
import { svgElement } from "./svg";

export class EuriborChart {
  private svg: SVGSVGElement | null = null;
  private dataKey = "";

  constructor(private readonly container: HTMLElement) {}

  mount(): void {
    if (this.svg) return;
    this.svg = svgElement("svg", {
      viewBox: "0 0 220 82",
      class: "market-chart",
      role: "img",
      "aria-label": "Kuue kuu Euribori trend",
    });
    this.container.appendChild(this.svg);
  }

  update(points: EuriborPoint[]): void {
    this.mount();
    const clean = points
      .map((point) => ({ date: point.date, value: Number(point.value) }))
      .filter(
        (point) => Number.isFinite(Date.parse(`${point.date}T12:00:00Z`)) && Number.isFinite(point.value),
      );
    const key = clean.map((point) => `${point.date}:${point.value}`).join("|");
    if (key === this.dataKey) return;
    this.dataKey = key;
    this.svg?.replaceChildren();
    if (!this.svg || clean.length < 2) return;

    const width = 220;
    const height = 82;
    const pad = { top: 5, right: 5, bottom: 14, left: 24 };
    const values = clean.map((point) => point.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) {
      min -= 0.05;
      max += 0.05;
    }
    const margin = Math.max(0.02, (max - min) * 0.12);
    min -= margin;
    max += margin;
    const x = (index: number) => pad.left + (index / (clean.length - 1)) * (width - pad.left - pad.right);
    const y = (value: number) => pad.top + ((max - value) / (max - min)) * (height - pad.top - pad.bottom);

    for (const fraction of [0, 0.5, 1]) {
      const value = max - (max - min) * fraction;
      const lineY = y(value);
      this.svg.appendChild(
        svgElement("line", {
          x1: pad.left,
          y1: lineY,
          x2: width - pad.right,
          y2: lineY,
          class: "market-grid-line",
        }),
      );
      const label = svgElement("text", {
        x: pad.left - 3,
        y: lineY + 2,
        "text-anchor": "end",
        class: "market-chart-scale",
      });
      label.textContent = formatNumber(value, 1);
      this.svg.appendChild(label);
    }

    const path = clean
      .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(2)} ${y(point.value).toFixed(2)}`)
      .join(" ");
    this.svg.appendChild(svgElement("path", { d: path, class: "market-rate-line", fill: "none" }));
    const last = clean.at(-1);
    if (last)
      this.svg.appendChild(
        svgElement("circle", {
          cx: x(clean.length - 1),
          cy: y(last.value),
          r: 2.4,
          class: "market-rate-dot",
        }),
      );

    const firstLabel = svgElement("text", {
      x: pad.left,
      y: height - 2,
      "text-anchor": "start",
      class: "market-chart-label",
    });
    firstLabel.textContent = clean[0]?.date.slice(5).replace("-", ".") ?? "";
    const lastLabel = svgElement("text", {
      x: width - pad.right,
      y: height - 2,
      "text-anchor": "end",
      class: "market-chart-label",
    });
    lastLabel.textContent = last?.date.slice(5).replace("-", ".") ?? "";
    this.svg.append(firstLabel, lastLabel);
  }

  destroy(): void {
    this.svg?.remove();
    this.svg = null;
    this.dataKey = "";
  }
}
