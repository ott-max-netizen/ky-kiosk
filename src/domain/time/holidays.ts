import { addCalendarDays, type CalendarDate, sameCalendarDate } from "./zoned";

const FIXED_HOLIDAYS = new Set([
  "01-01",
  "02-24",
  "05-01",
  "06-23",
  "06-24",
  "08-20",
  "12-24",
  "12-25",
  "12-26",
]);

export function easterSundayParts(year: number): CalendarDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { year, month, day };
}

export function isEstonianPublicHoliday(parts: CalendarDate): boolean {
  const mmdd = `${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  if (FIXED_HOLIDAYS.has(mmdd)) return true;
  const easter = easterSundayParts(parts.year);
  return (
    sameCalendarDate(parts, addCalendarDays(easter, -2)) ||
    sameCalendarDate(parts, easter) ||
    sameCalendarDate(parts, addCalendarDays(easter, 49))
  );
}
