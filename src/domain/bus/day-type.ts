import { isEstonianPublicHoliday } from "../time/holidays";
import { type CalendarDate, weekday } from "../time/zoned";

export type BusDayType = "weekday" | "saturday" | "sunday";

export function busDayType(parts: CalendarDate): BusDayType {
  const day = weekday(parts);
  if (isEstonianPublicHoliday(parts) || day === 0) return "sunday";
  if (day === 6) return "saturday";
  return "weekday";
}

export function busDayTypeLabel(parts: CalendarDate): string {
  const day = weekday(parts);
  if (isEstonianPublicHoliday(parts) && day !== 0) return "Riigipüha · pühapäev";
  const type = busDayType(parts);
  return type === "saturday" ? "Laupäev" : type === "sunday" ? "Pühapäev" : "Tööpäev";
}

export function busSchoolSeasonActive(parts: CalendarDate): boolean {
  return parts.month >= 9 || parts.month <= 5 || (parts.month === 6 && parts.day <= 10);
}
