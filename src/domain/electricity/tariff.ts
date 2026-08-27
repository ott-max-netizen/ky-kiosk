import { isEstonianPublicHoliday } from "../time/holidays";
import { weekday, zonedParts } from "../time/zoned";

export type ElectricityTariffType = "day" | "night";

export interface ElectricityFees {
  exciseCentsPerKwh: number;
  purchaseMarginCentsPerKwh: number;
  securityFeeCentsPerKwh: number;
  renewableFeeCentsPerKwh: number;
  distributionDayCentsPerKwh: number;
  distributionNightCentsPerKwh: number;
  vatRate?: number;
}

export function electricityTariffType(at: Date, timeZone = "Europe/Tallinn"): ElectricityTariffType {
  const parts = zonedParts(at, timeZone);
  const day = weekday(parts);
  const workday = day >= 1 && day <= 5 && !isEstonianPublicHoliday(parts);
  return workday && parts.hour >= 7 && parts.hour < 22 ? "day" : "night";
}

export function calculatePurchasePriceCentsPerKwh(
  marketPriceEurMwh: number,
  fees: ElectricityFees,
  at: Date,
  timeZone = "Europe/Tallinn",
): number | null {
  if (!Number.isFinite(marketPriceEurMwh)) return null;
  const tariff = electricityTariffType(at, timeZone);
  const distribution = tariff === "day" ? fees.distributionDayCentsPerKwh : fees.distributionNightCentsPerKwh;
  const subtotal =
    marketPriceEurMwh / 10 +
    fees.exciseCentsPerKwh +
    fees.purchaseMarginCentsPerKwh +
    fees.securityFeeCentsPerKwh +
    fees.renewableFeeCentsPerKwh +
    distribution;
  const result = subtotal * (fees.vatRate ?? 1.24);
  return Number.isFinite(result) ? result : null;
}
