import { safeTimeZone } from "./zoned";

export interface AppFormatters {
  clock: Intl.DateTimeFormat;
  dateLong: Intl.DateTimeFormat;
  dayMonth: Intl.DateTimeFormat;
  dayLongMonth: Intl.DateTimeFormat;
  dayOnly: Intl.DateTimeFormat;
  monthShort: Intl.DateTimeFormat;
  weekdayShort: Intl.DateTimeFormat;
  time: Intl.DateTimeFormat;
  dateTime: Intl.DateTimeFormat;
  utcDayMonth: Intl.DateTimeFormat;
  utcDayLongMonth: Intl.DateTimeFormat;
  utcDayOnly: Intl.DateTimeFormat;
  utcMonthShort: Intl.DateTimeFormat;
  utcWeekdayShort: Intl.DateTimeFormat;
}

const cache = new Map<string, AppFormatters>();

export function getFormatters(timeZone = "Europe/Tallinn"): AppFormatters {
  const zone = safeTimeZone(timeZone);
  const cached = cache.get(zone);
  if (cached) return cached;
  const result: AppFormatters = {
    clock: new Intl.DateTimeFormat("et-EE", {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    dateLong: new Intl.DateTimeFormat("et-EE", {
      timeZone: zone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    dayMonth: new Intl.DateTimeFormat("et-EE", { timeZone: zone, day: "numeric", month: "short" }),
    dayLongMonth: new Intl.DateTimeFormat("et-EE", { timeZone: zone, day: "numeric", month: "long" }),
    dayOnly: new Intl.DateTimeFormat("et-EE", { timeZone: zone, day: "numeric" }),
    monthShort: new Intl.DateTimeFormat("et-EE", { timeZone: zone, month: "short" }),
    weekdayShort: new Intl.DateTimeFormat("et-EE", { timeZone: zone, weekday: "short" }),
    time: new Intl.DateTimeFormat("et-EE", { timeZone: zone, hour: "2-digit", minute: "2-digit" }),
    dateTime: new Intl.DateTimeFormat("et-EE", {
      timeZone: zone,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    utcDayMonth: new Intl.DateTimeFormat("et-EE", { timeZone: "UTC", day: "numeric", month: "short" }),
    utcDayLongMonth: new Intl.DateTimeFormat("et-EE", { timeZone: "UTC", day: "numeric", month: "long" }),
    utcDayOnly: new Intl.DateTimeFormat("et-EE", { timeZone: "UTC", day: "numeric" }),
    utcMonthShort: new Intl.DateTimeFormat("et-EE", { timeZone: "UTC", month: "short" }),
    utcWeekdayShort: new Intl.DateTimeFormat("et-EE", { timeZone: "UTC", weekday: "short" }),
  };
  cache.set(zone, result);
  return result;
}
