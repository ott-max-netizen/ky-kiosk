import { epochDay, parseDateOnly, type CalendarDate } from "../time/zoned";

export interface ScheduleMetadata {
  validFrom?: string | null;
  validUntil?: string | null;
}

export interface BusScheduleStatus {
  level: "ok" | "warning";
  code: "missing" | "invalid-from" | "invalid-until" | "not-yet-valid" | "expired" | "no-end-date" | "valid";
  uiText: string;
  debugText: string;
}

export function busScheduleStatus(schedule: ScheduleMetadata | null, parts: CalendarDate): BusScheduleStatus {
  if (!schedule) return { level: "warning", code: "missing", uiText: "Sõiduplaan puudub", debugText: "puudub" };
  const fromText = String(schedule.validFrom ?? "").trim();
  const untilText = String(schedule.validUntil ?? "").trim();
  const from = fromText ? parseDateOnly(fromText) : null;
  const until = untilText ? parseDateOnly(untilText) : null;
  if (fromText && !from) return { level: "warning", code: "invalid-from", uiText: "Vigane alguskuupäev", debugText: `vigane validFrom: ${fromText}` };
  if (untilText && !until) return { level: "warning", code: "invalid-until", uiText: "Vigane lõppkuupäev", debugText: `vigane validUntil: ${untilText}` };
  const today = epochDay(parts);
  if (from && today < epochDay(from)) return { level: "warning", code: "not-yet-valid", uiText: "Sõiduplaan pole veel kehtiv", debugText: `pole veel kehtiv (${fromText})` };
  if (until && today > epochDay(until)) return { level: "warning", code: "expired", uiText: "Sõiduplaan vajab kontrolli", debugText: `kontrolltähtaeg ületatud (${untilText})` };
  if (!untilText) return { level: "ok", code: "no-end-date", uiText: "", debugText: "kehtivuse lõpp määramata" };
  return { level: "ok", code: "valid", uiText: "", debugText: `kehtiv kuni ${untilText}` };
}
