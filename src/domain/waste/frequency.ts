export const WASTE_WEEKDAYS: Readonly<Record<string, number>> = { P: 0, E: 1, T: 2, K: 3, N: 4, R: 5, L: 6 };

export type WasteFrequency =
  | { kind: "once" }
  | { kind: "weekly"; weekdays: number[] }
  | { kind: "interval"; weeks: number; weekday: number | null };

export interface WasteFrequencyResult {
  frequency: WasteFrequency | null;
  warnings: string[];
}

export function parseWasteFrequency(value: unknown): WasteFrequencyResult {
  const raw = String(value ?? "").trim();
  if (!raw) return { frequency: { kind: "once" }, warnings: [] };
  const normalized = raw.toLocaleUpperCase("et-EE").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  const interval = normalized.match(/^(?:KORD|IGA)\s+(\d+)\s+N[ÄA]DALA\s+TAGANT(?:\s+([PETKNRL]))?$/);
  if (interval) {
    const weeks = Number(interval[1]);
    if (!Number.isFinite(weeks) || weeks < 1 || weeks > 52) {
      return { frequency: null, warnings: [`Tundmatu prügiveo sagedus: ${raw}`] };
    }
    const token = interval[2];
    return {
      frequency: { kind: "interval", weeks, weekday: token ? (WASTE_WEEKDAYS[token] ?? null) : null },
      warnings: [],
    };
  }
  const weekly = normalized.match(/^IGA\s*:?\s*(.+)$/);
  if (weekly) {
    const weekdays: number[] = [];
    for (const token of (weekly[1] ?? "").split(/[\s,;/]+/)) {
      const key = token.replace(/[^A-ZÕÄÖÜŠŽ]/g, "");
      const day = WASTE_WEEKDAYS[key];
      if (day !== undefined && !weekdays.includes(day)) weekdays.push(day);
    }
    return weekdays.length
      ? { frequency: { kind: "weekly", weekdays }, warnings: [] }
      : { frequency: null, warnings: [`Tundmatu prügiveo sagedus: ${raw}`] };
  }
  return { frequency: null, warnings: [`Tundmatu prügiveo sagedus: ${raw}`] };
}
