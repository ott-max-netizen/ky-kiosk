import { addCalendarDays, datePartsForValue, daysUntil, epochDay, type CalendarDate, weekday, ymdKey } from "../time/zoned";
import { parseWasteFrequency } from "./frequency";

export interface WasteItem {
  type: string;
  date: string | null;
  note?: string;
  frequency?: string;
}

export interface WasteOccurrence {
  item: WasteItem;
  days: number;
}

export interface WasteExpansion {
  occurrences: WasteOccurrence[];
  warnings: string[];
}

export function expandWasteItem(
  item: WasteItem,
  daysMax: number,
  today: CalendarDate,
  timeZone = "Europe/Tallinn",
): WasteExpansion {
  const parsed = parseWasteFrequency(item.frequency);
  if (!parsed.frequency) return { occurrences: [], warnings: parsed.warnings.map((warning) => `${item.type}: ${warning}`) };
  const anchor = datePartsForValue(item.date, timeZone);
  const todayEpoch = epochDay(today);
  const endEpoch = todayEpoch + daysMax;
  const occurrences: WasteOccurrence[] = [];
  const warnings = [...parsed.warnings];

  if (parsed.frequency.kind === "once") {
    const days = daysUntil(item.date, new Date(Date.UTC(today.year, today.month - 1, today.day, 12)), "UTC");
    if (days !== null && days >= 0 && days <= daysMax) occurrences.push({ item: { ...item }, days });
    return { occurrences, warnings };
  }

  if (parsed.frequency.kind === "weekly") {
    const anchorEpoch = anchor ? epochDay(anchor) : null;
    for (let offset = 0; offset <= daysMax; offset += 1) {
      const parts = addCalendarDays(today, offset);
      if (anchorEpoch !== null && epochDay(parts) < anchorEpoch) continue;
      if (!parsed.frequency.weekdays.includes(weekday(parts))) continue;
      occurrences.push({ item: { ...item, date: ymdKey(parts) }, days: offset });
    }
    return { occurrences, warnings };
  }

  if (!anchor) {
    warnings.push(`${item.type}: mitmenädalane sagedus vajab Kuupäev ankrut`);
    return { occurrences, warnings };
  }
  if (parsed.frequency.weekday !== null && weekday(anchor) !== parsed.frequency.weekday) {
    warnings.push(`${item.type}: Kuupäev ankur ei vasta Sagedus väljal määratud nädalapäevale`);
    return { occurrences, warnings };
  }
  const intervalDays = parsed.frequency.weeks * 7;
  const anchorEpoch = epochDay(anchor);
  let cycle = Math.max(0, Math.ceil((todayEpoch - anchorEpoch) / intervalDays));
  for (let occurrenceEpoch = anchorEpoch + cycle * intervalDays; occurrenceEpoch <= endEpoch; occurrenceEpoch += intervalDays) {
    if (occurrenceEpoch >= todayEpoch) {
      const parts = addCalendarDays(anchor, cycle * intervalDays);
      occurrences.push({ item: { ...item, date: ymdKey(parts) }, days: occurrenceEpoch - todayEpoch });
    }
    cycle += 1;
  }
  return { occurrences, warnings };
}

export function nextWasteByType(
  items: WasteItem[],
  daysMax: number,
  today: CalendarDate,
  timeZone = "Europe/Tallinn",
): WasteExpansion {
  const warnings: string[] = [];
  const all = items.flatMap((item) => {
    const result = expandWasteItem(item, daysMax, today, timeZone);
    warnings.push(...result.warnings);
    return result.occurrences;
  });
  const next = new Map<string, WasteOccurrence>();
  for (const occurrence of all.sort((a, b) => a.days - b.days || a.item.type.localeCompare(b.item.type, "et"))) {
    const key = occurrence.item.type.trim().toLocaleLowerCase("et-EE");
    if (!next.has(key)) next.set(key, occurrence);
  }
  return { occurrences: [...next.values()].sort((a, b) => a.days - b.days || a.item.type.localeCompare(b.item.type, "et")), warnings };
}
