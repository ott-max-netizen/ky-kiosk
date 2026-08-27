import { readFileSync } from "node:fs";
import type { IncomingDashboardPayload } from "../../src/data/types";

export const VISUAL_REFERENCE_NOW = new Date("2026-08-25T16:00:00+03:00");

function clone<T>(value: T): T {
  return structuredClone(value);
}

function ymd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Tallinn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function shiftIso(value: string, milliseconds: number): string {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed + milliseconds).toISOString() : value;
}

export function loadDemoTemplate(): IncomingDashboardPayload {
  const path = new URL("../../public/sample-data.json", import.meta.url);
  return JSON.parse(readFileSync(path, "utf8")) as IncomingDashboardPayload;
}

/**
 * Genereerib demoandmed võrdlushetke suhtes. Failis olevad kuupäevad ei määra
 * visuaaltesti käitumist: elektripunktid, sektsioonide ajatemplid ja teated
 * nihutatakse alati referenceNow päeva peale.
 */
export function makeDemoData(
  referenceNow = VISUAL_REFERENCE_NOW,
  withNotices = true,
): IncomingDashboardPayload {
  const source = clone(loadDemoTemplate());
  const sourceDate = source.electricity?.date || "2026-08-25";
  const targetDate = ymd(referenceNow);
  const shift = Date.parse(`${targetDate}T00:00:00Z`) - Date.parse(`${sourceDate}T00:00:00Z`);
  const updatedAt = referenceNow.toISOString();
  source.updatedAt = updatedAt;
  source.notices = withNotices
    ? (source.notices ?? []).map((notice) => ({ ...notice, start: null, end: null }))
    : [];
  source.sections = { ...source.sections };
  for (const [name, meta] of Object.entries(source.sections)) {
    source.sections[name as keyof typeof source.sections] = { ...meta, ok: true, updatedAt };
  }
  if (source.electricity) {
    source.electricity = {
      ...source.electricity,
      date: targetDate,
      points: source.electricity.points.map((point) => ({ ...point, time: shiftIso(point.time, shift) })),
    };
  }
  if (source.weather) {
    source.weather = {
      ...source.weather,
      current: { ...source.weather.current, time: updatedAt, observedAt: updatedAt },
      daily: source.weather.daily.map((day, index) => ({
        ...day,
        date: ymd(new Date(referenceNow.getTime() + index * 86_400_000)),
      })),
    };
  }
  return source;
}

export function makeMaxDemoData(referenceNow = VISUAL_REFERENCE_NOW): IncomingDashboardPayload {
  const source = makeDemoData(referenceNow, true);
  const longBody = Array.from(
    { length: 32 },
    (_, index) =>
      `Pikk teateosa ${index + 1}: maja hooldustööde ajal palume järgida trepikojas olevaid juhiseid ja hoida läbipääsud vabad.`,
  ).join(" ");
  source.notices = [
    {
      id: "MAX-LONG",
      title: "Pika teate lehekülgede kontroll",
      body: longBody.slice(0, 1200),
      type: "warning",
      start: null,
      end: null,
      priority: 1,
    },
  ];
  source.contacts = Array.from({ length: 8 }, (_, index) => ({
    role: index === 0 ? "Juhatuse esimees" : `Kontakt ${index + 1}`,
    name: `Näidisnimi ${index + 1}`,
    phone: `+372 500 ${String(index + 1).padStart(4, "0")}`,
  }));
  source.emergency = Array.from({ length: 8 }, (_, index) => ({
    name: index === 0 ? "Hädaabi" : `Oluline kontakt ${index + 1}`,
    phone: index === 0 ? "112" : `+372 510 ${String(index + 1).padStart(4, "0")}`,
    note: index === 0 ? "Elu, tervise või vara vahetu oht" : "Ööpäevaringne kontakt",
    priority: index + 1,
  }));
  const wasteKinds = [
    "Segaolmejäätmed",
    "Biojäätmed",
    "Segapakend",
    "Paber ja papp",
    "Klaas",
    "Metall",
    "Tekstiil",
    "Ohtlikud jäätmed",
    "Elektroonika",
    "Suurjäätmed",
  ];
  source.waste = wasteKinds.map((type, index) => ({
    type,
    date: `2026-08-${String(25 + (index % 4)).padStart(2, "0")}`,
    frequency: "",
    note: "",
  }));
  if (source.electricity) {
    const start = Date.parse(`${source.electricity.date}T00:00:00+03:00`);
    source.electricity.points = Array.from({ length: 96 }, (_, index) => ({
      time: new Date(start + index * 15 * 60_000).toISOString(),
      price: 8 + Math.sin(index / 8) * 4 + (index > 68 && index < 82 ? 7 : 0),
      tariffType: index >= 28 && index < 88 ? "day" : "night",
      tariffLabelEt: index >= 28 && index < 88 ? "päevahind" : "ööhind",
    }));
  }
  if (source.euribor) {
    const start = Date.parse("2026-02-12T00:00:00Z");
    source.euribor.points = Array.from({ length: 135 }, (_, index) => ({
      date: new Date(start + index * 86_400_000).toISOString().slice(0, 10),
      value: 2.25 + index * 0.0035 + Math.sin(index / 9) * 0.04,
    }));
    source.euribor.latest = source.euribor.points.at(-1)?.value ?? 2.7;
    source.euribor.latestDate = source.euribor.points.at(-1)?.date ?? "2026-08-25";
  }
  return source;
}

export function makeStaleCache(referenceNow = VISUAL_REFERENCE_NOW): IncomingDashboardPayload {
  const source = makeDemoData(referenceNow, true);
  const staleAt = new Date(referenceNow.getTime() - 48 * 60 * 60 * 1000).toISOString();
  source.updatedAt = staleAt;
  for (const [name, meta] of Object.entries(source.sections)) {
    source.sections[name as keyof typeof source.sections] = { ...meta, updatedAt: staleAt };
  }
  return source;
}
