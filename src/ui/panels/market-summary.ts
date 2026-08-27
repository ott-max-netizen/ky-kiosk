import type { DashboardData } from "../../data/types";
import { requireElement, setHidden, setText } from "../dom";
import type { Panel } from "./panel";

export class MarketSummaryPanel implements Panel<DashboardData> {
  private element!: HTMLElement;
  private mounted = false;
  mount(): void {
    if (this.mounted) return;
    this.element = requireElement("marketStale");
    this.mounted = true;
  }
  update(data: DashboardData): void {
    this.mount();
    const count = ["electricity", "fuel", "euribor"].filter((name) => {
      const updated = Date.parse(data.sectionUpdatedAt[name as "electricity" | "fuel" | "euribor"] ?? "");
      return (
        Boolean(data.sectionErrors[name as "electricity" | "fuel" | "euribor"]) ||
        !Number.isFinite(updated) ||
        Date.now() - updated > 86_400_000
      );
    }).length;
    setHidden(this.element, count === 0);
    setText(
      this.element,
      count ? (count === 1 ? "1 allikas vahemälust" : `${count} allikat vahemälust`) : "",
    );
  }
  destroy(): void {
    this.mounted = false;
  }
}
