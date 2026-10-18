// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeDemoPayload } from "../../src/app/bootstrap";
import type { IncomingDashboardPayload } from "../../src/data/types";
import { validateDashboardPayload } from "../../src/data/validate";
import { zonedParts } from "../../src/domain/time/zoned";
import { ElectricityChart } from "../../src/ui/charts/electricity-chart";
import { formatNumber } from "../../src/ui/dom";

function samplePayload(): IncomingDashboardPayload {
  const raw = JSON.parse(readFileSync(resolve("public/sample-data.json"), "utf8"));
  const payload = validateDashboardPayload(raw).value;
  if (!payload) throw new Error("sample-data.json ei läbinud valideerimist");
  return payload;
}

const localHourMinute = (iso: string, timeZone = "Europe/Tallinn") => {
  const parts = zonedParts(new Date(iso), timeZone);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${String(parts.minute).padStart(2, "0")}`;
};

describe("demoandmete elektrihindade nihutamine üle DST piiri", () => {
  afterEach(() => vi.useRealTimers());

  it("suveaja näidis talvepäevale säilitab kohaliku kellaaja", () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-01-15T12:00:00+02:00") });
    const payload = samplePayload();
    const result = normalizeDemoPayload(payload, false);
    expect(result.electricity?.date).toBe("2026-01-15");
    const before = payload.electricity?.points.map((point) => localHourMinute(point.time).split(" ")[1]);
    const after = result.electricity?.points.map((point) => localHourMinute(point.time));
    expect(after?.[0]).toBe("2026-1-15 0:00");
    expect(after?.map((value) => value.split(" ")[1])).toEqual(before);
    expect(after?.every((value) => value.startsWith("2026-1-15 "))).toBe(true);
  });

  it("talveaja näidis suvepäevale säilitab kohaliku kellaaja", () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-08-25T12:00:00+03:00") });
    const payload = samplePayload();
    payload.electricity = {
      date: "2026-01-15",
      unit: "s/kWh",
      points: Array.from({ length: 24 }, (_, hour) => ({
        time: new Date(`2026-01-15T${String(hour).padStart(2, "0")}:00:00+02:00`).toISOString(),
        price: 10 + hour,
      })),
    };
    const result = normalizeDemoPayload(payload, false);
    const hours = result.electricity?.points.map((point) => localHourMinute(point.time));
    expect(hours?.[0]).toBe("2026-8-25 0:00");
    expect(hours?.[18]).toBe("2026-8-25 18:00");
    expect(result.electricity?.points[18]?.time).toBe("2026-08-25T15:00:00.000Z");
  });

  it("kevadisel DST-päeval jääb 23 erinevat tundi ja auguhetk kannab päris 04:00 hinda", () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-03-29T12:00:00+03:00") });
    const payload = samplePayload();
    const source = payload.electricity?.points ?? [];
    const points = normalizeDemoPayload(payload, false).electricity?.points ?? [];
    const times = points.map((point) => point.time);
    expect(source).toHaveLength(24);
    expect(new Set(times).size).toBe(times.length);
    expect(times).toHaveLength(23);
    const at04 = points.find((point) => point.time === "2026-03-29T01:00:00.000Z");
    expect(at04?.price).toBe(source[4]?.price);
  });

  it("sügisesel DST-päeval jäävad kõik ajatemplid erinevaks", () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-25T12:00:00+02:00") });
    const points = normalizeDemoPayload(samplePayload(), false).electricity?.points ?? [];
    const times = points.map((point) => point.time);
    expect(new Set(times).size).toBe(times.length);
    expect(localHourMinute(times[0] ?? "")).toBe("2026-10-25 0:00");
    expect(localHourMinute(times.at(-1) ?? "")).toBe("2026-10-25 23:00");
  });

  it("kasutab seadistatud ajavööndit, mitte kõvakodeeritud Europe/Tallinn'i", () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-08-25T02:00:00+03:00") });
    const payload = samplePayload();
    payload.settings = {
      ...(payload.settings as NonNullable<IncomingDashboardPayload["settings"]>),
      timeZone: "America/New_York",
    };
    const result = normalizeDemoPayload(payload, false);
    // Tallinnas on juba 25.08, New Yorgis veel 24.08.
    expect(result.electricity?.date).toBe("2026-08-24");
    expect(result.settings?.timeZone).toBe("America/New_York");
  });
});

describe("elektrigraafiku ajatelg", () => {
  const points = Array.from({ length: 24 }, (_, hour) => ({
    time: new Date(Date.UTC(2026, 7, 24, 21 + hour)).toISOString(),
    price: 8 + hour / 4,
  }));
  const labels = (host: HTMLElement) =>
    [...host.querySelectorAll(".market-chart-label")].map((label) => label.textContent);

  it("vormindab teljesildid antud ajavööndis", () => {
    const host = document.createElement("div");
    const chart = new ElectricityChart(host);
    chart.update(points, -1, "Europe/Tallinn");
    expect(labels(host)).toEqual(["00:00", "11:00", "23:00"]);
    chart.update(points, -1, "UTC");
    expect(labels(host)).toEqual(["21:00", "08:00", "20:00"]);
  });
});

describe("elektrihinna koondväljade valideerimine", () => {
  const payload = (extra: Record<string, unknown>) =>
    validateDashboardPayload({
      ok: true,
      sections: { electricity: { ok: true } },
      electricity: {
        date: "2026-08-25",
        unit: "s/kWh",
        points: [{ time: "2026-08-25T00:00:00Z", price: 12 }],
        ...extra,
      },
    });

  it("jätab usutava vahemiku välised koondväärtused välja ja logib probleemi", () => {
    const result = payload({ currentPrice: 1250, min: -350, average: 12.5, max: 9_999 });
    expect(result.value?.electricity?.average).toBe(12.5);
    expect(result.value?.electricity).not.toHaveProperty("currentPrice");
    expect(result.value?.electricity).not.toHaveProperty("min");
    expect(result.value?.electricity).not.toHaveProperty("max");
    expect(result.problems.filter((problem) => problem.startsWith("Elektrihinna "))).toHaveLength(3);
  });

  it("lubab null-hetkehinna ja negatiivse börsihinna", () => {
    const result = payload({ currentPrice: null, min: -4.2, average: 7, max: 30 });
    expect(result.value?.electricity).not.toHaveProperty("currentPrice");
    expect(result.value?.electricity?.min).toBe(-4.2);
    expect(result.problems).toEqual([]);
  });
});

describe("formatNumber", () => {
  it("loob iga komakohtade arvu jaoks ühe Intl.NumberFormat eksemplari", () => {
    const Original = Intl.NumberFormat;
    let created = 0;
    const Counting = function (...args: ConstructorParameters<typeof Intl.NumberFormat>) {
      created += 1;
      return new Original(...args);
    } as unknown as typeof Intl.NumberFormat;
    vi.stubGlobal("Intl", { ...Intl, NumberFormat: Counting });
    const digits = 7; // väärtus, mida rakendus ei kasuta, et vahemälu oleks tühi
    expect(formatNumber(1.5, digits)).toBe("1,5000000");
    expect(formatNumber(2, digits)).toBe("2,0000000");
    expect(formatNumber("x", digits)).toBe("–");
    expect(created).toBe(1);
    vi.unstubAllGlobals();
  });
});
