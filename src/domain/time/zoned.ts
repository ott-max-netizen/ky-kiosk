export const DAY_MS = 86_400_000;

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export interface ZonedParts extends CalendarDate {
  hour: number;
  minute: number;
  second?: number;
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();
const safeTimeZoneCache = new Map<string, string>();

/**
 * Kontrollib ajavööndi nime ja tagastab vajadusel Europe/Tallinn'i.
 *
 * Tulemus on mällu jäetud: kontroll ise ehitas iga kutse peale uue
 * `Intl.DateTimeFormat`-i ja vormindas kuupäeva. Seda kutsutakse iga
 * `zonedParts`-i ja `getFormatters`-i kaudu — sekundilise kella, paneelide
 * tiksumise ja iga kuupäeva vormindamise pealt kümneid kordi sekundis.
 */
export function safeTimeZone(value: unknown): string {
  const candidate = String(value || "Europe/Tallinn");
  const cached = safeTimeZoneCache.get(candidate);
  if (cached !== undefined) return cached;
  let resolved: string;
  try {
    new Intl.DateTimeFormat("et-EE", { timeZone: candidate }).format(new Date());
    resolved = candidate;
  } catch {
    resolved = "Europe/Tallinn";
  }
  safeTimeZoneCache.set(candidate, resolved);
  return resolved;
}

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const zone = safeTimeZone(timeZone);
  let formatter = partsFormatterCache.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    partsFormatterCache.set(zone, formatter);
  }
  return formatter;
}

export function zonedParts(date: Date = new Date(), timeZone = "Europe/Tallinn"): ZonedParts {
  const out: Record<string, number> = {};
  for (const part of partsFormatter(timeZone).formatToParts(date)) {
    if (part.type !== "literal") out[part.type] = Number(part.value);
  }
  return {
    year: out.year ?? 1970,
    month: out.month ?? 1,
    day: out.day ?? 1,
    hour: out.hour ?? 0,
    minute: out.minute ?? 0,
    second: out.second ?? 0,
  };
}

export function parseDateOnly(value: unknown): CalendarDate | null {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day
    ? { year, month, day }
    : null;
}

export function validDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function datePartsForValue(value: unknown, timeZone = "Europe/Tallinn"): CalendarDate | null {
  return parseDateOnly(value) ?? (validDate(value) ? zonedParts(validDate(value) as Date, timeZone) : null);
}

export function ymdKey(parts: CalendarDate): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function epochDay(parts: CalendarDate): number {
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS);
}

export function addCalendarDays(parts: CalendarDate, days: number): CalendarDate {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function sameCalendarDate(
  a: CalendarDate | null | undefined,
  b: CalendarDate | null | undefined,
): boolean {
  return Boolean(a && b && a.year === b.year && a.month === b.month && a.day === b.day);
}

export function weekday(parts: CalendarDate): number {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)).getUTCDay();
}

export function daysUntil(value: unknown, now = new Date(), timeZone = "Europe/Tallinn"): number | null {
  const target = datePartsForValue(value, timeZone);
  if (!target) return null;
  return epochDay(target) - epochDay(zonedParts(now, timeZone));
}

export function capitalizeFirst(value: unknown): string {
  const text = String(value ?? "");
  return text ? text.charAt(0).toLocaleUpperCase("et-EE") + text.slice(1) : text;
}
