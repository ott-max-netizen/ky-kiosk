import { describe, expect, it } from "vitest";
import {
  calculatePercentageChange,
  calculateYearTotals,
  getLastTwelveMonths,
  getLatestHouseMonth,
  getPreviousHouseMonth,
  sortHouseMonths,
  type HouseMonth,
} from "../../src/domain/house/consumption";

const SAMPLE: HouseMonth[] = [
  {
    year: 2026,
    month: 1,
    monthName: "Jaanuar",
    key: "2026-01",
    waterM3: 249,
    heatMWh: 73.04,
    electricityKWh: 4924,
    solarKWh: 10,
  },
  {
    year: 2026,
    month: 2,
    monthName: "Veebruar",
    key: "2026-02",
    waterM3: 224,
    heatMWh: 57.74,
    electricityKWh: 4607,
    solarKWh: 15,
  },
  {
    year: 2026,
    month: 3,
    monthName: "Märts",
    key: "2026-03",
    waterM3: 251,
    heatMWh: 36.97,
    electricityKWh: 4301.58,
    solarKWh: 20,
  },
  {
    year: 2026,
    month: 4,
    monthName: "Aprill",
    key: "2026-04",
    waterM3: 233,
    heatMWh: 36.97,
    electricityKWh: 3699.68,
    solarKWh: 30,
  },
];

describe("house consumption", () => {
  it("sorts chronologically and selects the latest actual row", () => {
    const shuffled = [SAMPLE[2], SAMPLE[0], SAMPLE[3], SAMPLE[1]].filter((item): item is HouseMonth =>
      Boolean(item),
    );
    expect(sortHouseMonths(shuffled).map((item) => item.month)).toEqual([1, 2, 3, 4]);
    expect(getLatestHouseMonth(shuffled)?.month).toBe(4);
  });

  it("compares only against the actual previous calendar month", () => {
    const latest = getLatestHouseMonth(SAMPLE);
    expect(latest).not.toBeNull();
    expect(getPreviousHouseMonth(SAMPLE, latest as HouseMonth)?.month).toBe(3);
    expect(
      getPreviousHouseMonth(
        SAMPLE.filter((item) => item.month !== 3),
        latest as HouseMonth,
      ),
    ).toBeNull();
  });

  it("matches the requested percentage change example without negative zero", () => {
    expect(calculatePercentageChange(233, 251)).toBe(-7);
    expect(calculatePercentageChange(36.97, 36.97)).toBe(0);
    expect(calculatePercentageChange(3699.68, 4301.58)).toBe(-14);
    expect(calculatePercentageChange(30, 20)).toBe(50);
    expect(calculatePercentageChange(10, 0)).toBeNull();
    expect(calculatePercentageChange(100.1, 100)).toBe(0);
  });

  it("calculates the current report year totals from existing values only", () => {
    const result = calculateYearTotals(SAMPLE);
    expect(result?.year).toBe(2026);
    expect(result?.monthCount).toBe(4);
    expect(result?.totals.waterM3).toBe(957);
    expect(result?.totals.heatMWh).toBeCloseTo(204.72, 8);
    expect(result?.totals.electricityKWh).toBeCloseTo(17532.26, 8);
    expect(result?.totals.solarKWh).toBe(75);
  });

  it("keeps at most twelve populated months for sparklines", () => {
    const months = Array.from(
      { length: 18 },
      (_, index): HouseMonth => ({
        year: 2025 + Math.floor(index / 12),
        month: (index % 12) + 1,
        monthName: String((index % 12) + 1),
        key: `${2025 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`,
        waterM3: 200 + index,
        heatMWh: null,
        electricityKWh: null,
        solarKWh: null,
      }),
    );
    expect(getLastTwelveMonths(months)).toHaveLength(12);
    expect(getLastTwelveMonths(months)[0]?.key).toBe("2025-07");
  });
});
