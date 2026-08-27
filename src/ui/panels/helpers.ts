import type { DashboardData, SectionName } from "../../data/types";
import { getFormatters } from "../../domain/time/formatters";
import { parseDateOnly, validDate } from "../../domain/time/zoned";
import { requireElement, setHidden, setText } from "../dom";

const MONTHS_SHORT = ["jaan", "veebr", "märts", "apr", "mai", "juuni", "juuli", "aug", "sept", "okt", "nov", "dets"];

export function formatDateValue(value: unknown, kind: "dayMonth" | "dayLongMonth" | "dayOnly" | "monthShort" | "weekdayShort" | "time" | "dateTime", timeZone: string): string {
  const formatters = getFormatters(timeZone);
  const only = parseDateOnly(value);
  if (kind === "monthShort") {
    const parts = only;
    return parts ? MONTHS_SHORT[parts.month - 1] ?? "" : validDate(value) ? formatters.monthShort.format(validDate(value) as Date) : "";
  }
  if (only) {
    const date = new Date(Date.UTC(only.year, only.month - 1, only.day, 12));
    const key = `utc${kind.charAt(0).toUpperCase()}${kind.slice(1)}` as keyof typeof formatters;
    const formatter = formatters[key];
    return formatter instanceof Intl.DateTimeFormat ? formatter.format(date) : "";
  }
  const date = validDate(value);
  return date ? formatters[kind].format(date) : "";
}

export function updateSectionStale(data: DashboardData, name: SectionName, elementId: string, prefix: string, timeZone: string): boolean {
  const element = requireElement(elementId);
  const error = data.sectionErrors[name];
  if (!error) {
    setHidden(element, true);
    setText(element, "");
    element.removeAttribute("title");
    return false;
  }
  const updatedAt = data.sectionUpdatedAt[name];
  const date = validDate(updatedAt);
  const label = date ? `${prefix} ${getFormatters(timeZone).time.format(date)}` : `${prefix} varasemast vahemälust`;
  setText(element, label);
  setHidden(element, false);
  element.title = error;
  return true;
}

export function sectionUpdatedTime(data: DashboardData, name: SectionName, timeZone: string): string {
  const date = validDate(data.sectionUpdatedAt[name]);
  return date ? getFormatters(timeZone).time.format(date) : "";
}

export function updatePageLabel(id: string, total: number, size: number, page: number): void {
  const element = requireElement(id);
  if (total <= size) {
    setText(element, "");
    return;
  }
  const pages = Math.max(1, Math.ceil(total / size));
  const start = page * size;
  const shown = Math.min(size, Math.max(0, total - start));
  const remaining = Math.max(0, total - start - shown);
  setText(element, `${page + 1}/${pages}${remaining ? ` · +${remaining} veel` : ""}`);
}

export function weatherMeta(code: number): [string, string] {
  if (code === 0) return ["Selge", "☀️"];
  if ([1, 2].includes(code)) return ["Vähene pilvisus", "🌤️"];
  if (code === 3) return ["Pilves", "☁️"];
  if ([45, 48].includes(code)) return ["Udu", "🌫️"];
  if ([51, 53, 55, 56, 57].includes(code)) return ["Uduvihm", "🌦️"];
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ["Vihm", "🌧️"];
  if ([71, 73, 75, 77, 85, 86].includes(code)) return ["Lumi", "🌨️"];
  if ([95, 96, 99].includes(code)) return ["Äike", "⛈️"];
  return ["Ilm", "🌥️"];
}
