import { describe, expect, it } from "vitest";
import { ElectricityChart } from "../../src/ui/charts/electricity-chart";

describe("SVG graafiku patchimine", () => {
  it("ei loo minutiuuendusel uusi SVG elemente", () => {
    const original = document.createElementNS.bind(document);
    let created = 0;
    document.createElementNS = ((...args: Parameters<typeof document.createElementNS>) => {
      created += 1;
      return original(...args);
    }) as typeof document.createElementNS;
    try {
      const area = document.createElement("div");
      document.body.appendChild(area);
      const chart = new ElectricityChart(area);
      const points = Array.from({ length: 96 }, (_, index) => ({
        time: new Date(Date.UTC(2026, 7, 25, 0, index * 15)).toISOString(),
        price: 10 + Math.sin(index / 8),
      }));
      chart.update(points, 20);
      created = 0;
      chart.update(points, 21);
      expect(created).toBeLessThanOrEqual(10);
      chart.destroy();
    } finally {
      document.createElementNS = original;
      document.body.replaceChildren();
    }
  });
});
