import type { DashboardData, SectionName } from "../../data/types";
import { validDate } from "../../domain/time/zoned";
import { requireElement, setHidden, setText } from "../dom";
import type { Panel } from "./panel";

const DAY_MS = 86_400_000;
const LABELS: Array<[SectionName | "root", string]> = [
  ["root", "põhiandmed"],
  ["weather", "ilm"],
  ["house", "maja tarbimine"],
  ["electricity", "elektrihind"],
  ["fuel", "kütusehind"],
  ["euribor", "Euribor"],
];

export interface StaleBannerSlice {
  data: DashboardData;
  nowMs: number;
}

export class StaleBannerPanel implements Panel<StaleBannerSlice> {
  private banner!: HTMLElement;
  private text!: HTMLElement;
  private mounted = false;

  mount(): void {
    if (this.mounted) return;
    this.banner = requireElement("staleBanner");
    this.text = requireElement("staleBannerText");
    this.mounted = true;
  }

  update(slice: StaleBannerSlice): void {
    this.mount();
    const candidates: Array<{ label: string; age: number }> = [];
    for (const [name, label] of LABELS) {
      const value = name === "root" ? slice.data.updatedAt : slice.data.sectionUpdatedAt[name];
      const date = validDate(value);
      if (date) candidates.push({ label, age: slice.nowMs - date.getTime() });
    }
    const stale = candidates.filter((item) => item.age > DAY_MS).sort((a, b) => b.age - a.age);
    setHidden(this.banner, stale.length === 0);
    setText(
      this.text,
      stale.length
        ? `${stale.map((item) => item.label).join(", ")} · vanim kuvatav plokk on umbes ${Math.floor(stale[0]!.age / 3_600_000)} tundi vana.`
        : "",
    );
  }

  destroy(): void {
    this.mounted = false;
  }
}
