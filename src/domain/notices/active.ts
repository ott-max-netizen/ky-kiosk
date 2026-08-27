import { validDate } from "../time/zoned";

export interface NoticeLike {
  id: string;
  title: string;
  body: string;
  type: string;
  priority: number;
  start: string | null;
  end: string | null;
}

export function activeNow(startValue: unknown, endValue: unknown, now = new Date()): boolean {
  const nowMs = now.getTime();
  const start = startValue ? validDate(startValue) : null;
  const end = endValue ? validDate(endValue) : null;
  if (startValue && !start) return false;
  if (endValue && !end) return false;
  return (!start || start.getTime() <= nowMs) && (!end || end.getTime() >= nowMs);
}

export function activeNotices<T extends NoticeLike>(notices: T[], now = new Date()): T[] {
  return notices.filter((item) => activeNow(item.start, item.end, now)).sort((a, b) => Number(a.priority || 100) - Number(b.priority || 100));
}
