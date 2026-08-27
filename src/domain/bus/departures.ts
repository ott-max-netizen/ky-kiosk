import { busDayType, busSchoolSeasonActive, type BusDayType } from "./day-type";
import { busScheduleStatus, type BusScheduleStatus } from "./schedule-status";
import { addCalendarDays, epochDay, parseDateOnly, type CalendarDate, ymdKey, zonedParts } from "../time/zoned";

export type BusScheduleEntry = readonly [time: string, line: string, note?: string, flag?: string];

export interface BusDirectionSchedule {
  label: string;
  schedules: Record<BusDayType, readonly BusScheduleEntry[]>;
}

export interface BusTimetable {
  stop: string;
  validFrom?: string | null;
  validUntil?: string | null;
  sourceLabel?: string;
  directions: Record<string, BusDirectionSchedule>;
}

export interface BusDeparture {
  time: string;
  line: string;
  note: string;
  date: string;
  dateParts: CalendarDate;
  dayOffset: number;
  minutesUntil: number;
  dayType: BusDayType;
}

export interface BusState {
  center: BusDeparture[];
  suurKaare: BusDeparture[];
  schedule: BusScheduleStatus;
}

export function parseBusTime(value: unknown): number | null {
  const match = String(value ?? "").match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? hour * 60 + minute : null;
}

function entryAllowed(entry: BusScheduleEntry, parts: CalendarDate): boolean {
  return parseBusTime(entry[0]) !== null && (entry[3] !== "schoolSeason" || busSchoolSeasonActive(parts));
}

function scheduleValidOn(timetable: BusTimetable, parts: CalendarDate): boolean {
  const from = timetable.validFrom ? parseDateOnly(timetable.validFrom) : null;
  const until = timetable.validUntil ? parseDateOnly(timetable.validUntil) : null;
  const day = epochDay(parts);
  return (!from || day >= epochDay(from)) && (!until || day <= epochDay(until));
}

export function nextBusDepartures(
  timetable: BusTimetable | null,
  directionKey: string,
  count = 2,
  now = new Date(),
  timeZone = "Europe/Tallinn",
): BusDeparture[] {
  const direction = timetable?.directions[directionKey];
  if (!timetable || !direction) return [];
  const current = zonedParts(now, timeZone);
  const nowMinutes = current.hour * 60 + current.minute;
  const found: BusDeparture[] = [];
  for (let offset = 0; offset <= 7 && found.length < count; offset += 1) {
    const parts = addCalendarDays(current, offset);
    if (!scheduleValidOn(timetable, parts)) continue;
    const dayType = busDayType(parts);
    for (const entry of direction.schedules[dayType] ?? []) {
      if (!entryAllowed(entry, parts)) continue;
      const minute = parseBusTime(entry[0]);
      if (minute === null || (offset === 0 && minute < nowMinutes)) continue;
      found.push({
        time: entry[0],
        line: entry[1],
        note: entry[2] ?? "",
        date: ymdKey(parts),
        dateParts: parts,
        dayOffset: offset,
        minutesUntil: offset * 1440 + minute - nowMinutes,
        dayType,
      });
      if (found.length >= count) break;
    }
  }
  return found;
}

export function busRelativeLabel(item: Pick<BusDeparture, "dayOffset" | "minutesUntil">): string {
  if (item.dayOffset !== 0 || !Number.isFinite(item.minutesUntil)) return "";
  if (item.minutesUntil <= 0) return "väljub nüüd";
  if (item.minutesUntil < 60) return `${item.minutesUntil} min pärast`;
  const hours = Math.floor(item.minutesUntil / 60);
  const minutes = item.minutesUntil % 60;
  return minutes ? `${hours} h ${minutes} min pärast` : `${hours} h pärast`;
}

export function getBusState(timetable: BusTimetable | null, now = new Date(), timeZone = "Europe/Tallinn"): BusState {
  const parts = zonedParts(now, timeZone);
  return {
    center: nextBusDepartures(timetable, "center", 2, now, timeZone),
    suurKaare: nextBusDepartures(timetable, "suurKaare", 2, now, timeZone),
    schedule: busScheduleStatus(timetable, parts),
  };
}
