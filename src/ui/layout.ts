import type { RuntimeConfig } from "../config/config-schema";
import { requireElement, setClass, setHidden, setText } from "./dom";

export function applyNoticeLayout(hasNotices: boolean): void {
  const dashboard = requireElement("dashboard");
  const noticeColumn = requireElement("noticeColumn");
  const infoPanel = requireElement("infoPanel");
  const kicker = requireElement("infoSectionKicker");
  setClass(dashboard, "has-notices", hasNotices);
  setClass(dashboard, "no-notices", !hasNotices);
  setHidden(noticeColumn, !hasNotices);
  setText(kicker, hasNotices ? "INFO JA TURUNÄITAJAD" : "TURUNÄITAJAD");
  infoPanel.setAttribute("aria-label", hasNotices ? "Info ja turunäitajad" : "Turunäitajad");
}

export function applyNightTheme(hour: number, config: RuntimeConfig): void {
  const start = config.nightThemeStartHour;
  const end = config.nightThemeEndHour;
  const night = start !== end && (start > end ? hour >= start || hour < end : hour >= start && hour < end);
  const theme = night ? "night" : "day";
  if (document.documentElement.dataset.theme !== theme) document.documentElement.dataset.theme = theme;
}

const PIXEL_SHIFTS = [
  [0, 0],
  [1, 0],
  [-1, 1],
  [2, -1],
  [-2, 0],
  [1, 2],
  [0, -2],
  [-1, -1],
] as const;

export function applyPixelShift(index: number): void {
  const shift = PIXEL_SHIFTS[index % PIXEL_SHIFTS.length] ?? PIXEL_SHIFTS[0];
  requireElement("appShell").style.transform = `translate(${shift[0]}px, ${shift[1]}px)`;
}

export function installInteractionGuards(): () => void {
  const guard = (event: Event) => event.preventDefault();
  document.addEventListener("contextmenu", guard);
  document.addEventListener("dragstart", guard);
  return () => {
    document.removeEventListener("contextmenu", guard);
    document.removeEventListener("dragstart", guard);
  };
}
