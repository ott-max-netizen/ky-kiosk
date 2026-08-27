import { zonedParts, ymdKey } from "../time/zoned";

export type ElectricityUnit = "s/kWh" | "€/kWh" | "€/MWh";

export interface ElectricityPointLike {
  time: string;
  price: number;
}

export function priceToCentsPerKwh(value: unknown, unit: unknown): number | null {
  const price = Number(value);
  if (!Number.isFinite(price)) return null;
  if (unit === "s/kWh") return price;
  if (unit === "€/kWh") return price * 100;
  if (unit === "€/MWh") return price / 10;
  return null;
}

export function marketCurrentIndex(points: ElectricityPointLike[], now = new Date()): number {
  const nowMs = now.getTime();
  for (let index = 0; index < points.length; index += 1) {
    const start = Date.parse(points[index]?.time ?? "");
    const next = index + 1 < points.length ? Date.parse(points[index + 1]?.time ?? "") : Number.NaN;
    if (!Number.isFinite(start)) continue;
    const fallbackEnd = start + (index > 0 ? Math.max(900_000, start - Date.parse(points[index - 1]?.time ?? "")) : 3_600_000);
    const end = Number.isFinite(next) ? next : fallbackEnd;
    if (nowMs >= start && nowMs < end) return index;
  }
  return -1;
}

export function electricityDateIsToday(date: unknown, now = new Date(), timeZone = "Europe/Tallinn"): boolean {
  return String(date ?? "") === ymdKey(zonedParts(now, timeZone));
}
