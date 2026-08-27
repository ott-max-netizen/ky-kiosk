export interface HouseMonth {
  year: number;
  month: number;
  monthName: string;
  key: string;
  waterM3: number | null;
  heatMWh: number | null;
  electricityKWh: number | null;
  solarKWh: number | null;
}

export const HOUSE_METRICS = [
  { key: "waterM3", label: "Vesi", unit: "m³", digits: 0, icon: "water" },
  { key: "heatMWh", label: "Soojus", unit: "MWh", digits: 2, icon: "heat" },
  { key: "electricityKWh", label: "Elekter", unit: "kWh", digits: 0, icon: "electricity" },
  { key: "solarKWh", label: "Päike", unit: "kWh", digits: 0, icon: "solar" },
] as const;

export type HouseMetric = (typeof HOUSE_METRICS)[number];
export type HouseMetricKey = HouseMetric["key"];

export interface HouseYearTotals {
  year: number;
  monthCount: number;
  totals: Record<HouseMetricKey, number | null>;
}

export function houseMonthKey(item: Partial<HouseMonth>): number {
  return Number(item.year || 0) * 12 + Number(item.month || 0);
}

export function hasHouseData(item: HouseMonth): boolean {
  return HOUSE_METRICS.some((metric) => {
    const value = item[metric.key];
    return value !== null && value !== undefined && Number.isFinite(Number(value));
  });
}

export function sortHouseMonths(months: HouseMonth[]): HouseMonth[] {
  return months.filter(hasHouseData).slice().sort((a, b) => houseMonthKey(a) - houseMonthKey(b));
}

export function lastHouseMonths(months: HouseMonth[], count = 4): HouseMonth[] {
  return sortHouseMonths(months).slice(-Math.max(1, count));
}

export function getLastTwelveMonths(months: HouseMonth[]): HouseMonth[] {
  return sortHouseMonths(months).slice(-12);
}

export function getLatestHouseMonth(months: HouseMonth[]): HouseMonth | null {
  const sorted = sortHouseMonths(months);
  return sorted.at(-1) ?? null;
}

/**
 * Returns the actual previous calendar month. If that month is missing from the
 * sheet, comparisons are intentionally omitted instead of comparing against an
 * older, non-adjacent month.
 */
export function getPreviousHouseMonth(months: HouseMonth[], latest: HouseMonth): HouseMonth | null {
  const previousKey = houseMonthKey(latest) - 1;
  return sortHouseMonths(months).find((item) => houseMonthKey(item) === previousKey) ?? null;
}

export function calculatePercentageChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || !Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  const raw = ((current - previous) / previous) * 100;
  if (!Number.isFinite(raw) || Math.abs(raw) < 0.5) return 0;
  const rounded = Math.round(raw);
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function calculateYearTotals(months: HouseMonth[], reportYear?: number): HouseYearTotals | null {
  const latest = getLatestHouseMonth(months);
  const year = reportYear ?? latest?.year;
  if (!year) return null;
  const rows = sortHouseMonths(months).filter((item) => item.year === year);
  if (!rows.length) return null;

  const totals = {} as Record<HouseMetricKey, number | null>;
  for (const metric of HOUSE_METRICS) {
    const values = rows
      .map((item) => item[metric.key])
      .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
    totals[metric.key] = values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  }
  return { year, monthCount: rows.length, totals };
}

export function metricScale(months: HouseMonth[], key: HouseMetricKey): { min: number; max: number } {
  const values = months
    .map((item) => item[key])
    .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(Number(value)))
    .map(Number);
  if (!values.length) return { min: 0, max: 1 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? { min: 0, max: max || 1 } : { min, max };
}
