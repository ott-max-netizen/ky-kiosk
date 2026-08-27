import { describe, expect, it } from "vitest";
import { busDayType, busSchoolSeasonActive } from "../../src/domain/bus/day-type";
import { busRelativeLabel, getBusState, parseBusTime } from "../../src/domain/bus/departures";
import { priceToCentsPerKwh } from "../../src/domain/electricity/price";
import {
  calculatePurchasePriceCentsPerKwh,
  electricityTariffType,
} from "../../src/domain/electricity/tariff";
import { lastHouseMonths, type HouseMonth } from "../../src/domain/house/consumption";
import { activeNotices } from "../../src/domain/notices/active";
import { isEstonianPublicHoliday } from "../../src/domain/time/holidays";
import { addCalendarDays, parseDateOnly } from "../../src/domain/time/zoned";
import { parseWasteFrequency } from "../../src/domain/waste/frequency";
import { nextWasteByType } from "../../src/domain/waste/occurrences";
import { weatherPhenomenonEt } from "../../src/domain/weather/phenomenon";
import { BUS_TIMETABLE } from "../../src/data/bus-timetable";

const timetable = BUS_TIMETABLE;

describe("typed domain contracts", () => {
  it.each([
    ["2024-02-29", { year: 2024, month: 2, day: 29 }],
    ["2026-02-30", null],
    ["", null],
  ])("date-only %s", (value, expected) => expect(parseDateOnly(value)).toEqual(expected));

  it("rolls over a calendar year", () => {
    expect(addCalendarDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1 });
  });

  it.each([
    [{ year: 2026, month: 2, day: 24 }, true],
    [{ year: 2026, month: 4, day: 3 }, true],
    [{ year: 2026, month: 4, day: 5 }, true],
    [{ year: 2026, month: 4, day: 6 }, false],
    [{ year: 2026, month: 5, day: 24 }, true],
  ])("holiday %#", (parts, expected) => expect(isEstonianPublicHoliday(parts)).toBe(expected));

  it("uses the Sunday bus schedule on a public holiday", () => {
    expect(busDayType({ year: 2026, month: 8, day: 20 })).toBe("sunday");
  });

  it.each([
    [{ year: 2026, month: 9, day: 1 }, true],
    [{ year: 2026, month: 6, day: 10 }, true],
    [{ year: 2026, month: 6, day: 11 }, false],
  ])("line 7 school season %#", (parts, expected) => expect(busSchoolSeasonActive(parts)).toBe(expected));

  it.each([
    ["05:43", 343],
    ["24:00", null],
  ])("bus time %s", (value, expected) => expect(parseBusTime(value)).toBe(expected));

  it.each([
    [{ dayOffset: 0, minutesUntil: 18 }, "18 min pärast"],
    [{ dayOffset: 0, minutesUntil: 60 }, "1 h pärast"],
    [{ dayOffset: 0, minutesUntil: 72 }, "1 h 12 min pärast"],
    [{ dayOffset: 1, minutesUntil: 18 }, ""],
  ])("bus relative label %#", (item, expected) => expect(busRelativeLabel(item)).toBe(expected));

  it("returns two next departures per direction", () => {
    const state = getBusState(timetable, new Date("2026-08-24T06:00:00+03:00"));
    expect(state.center).toHaveLength(2);
    expect(state.suurKaare).toHaveLength(2);
  });

  it("rejects unsupported waste frequency with a warning", () => {
    const result = parseWasteFrequency("Kord kuus");
    expect(result.frequency).toBeNull();
    expect(result.warnings).toHaveLength(1);
  });

  it("rejects a mismatching two-week anchor weekday", () => {
    const result = nextWasteByType(
      [{ type: "Klaas", date: "2026-08-26", frequency: "Kord 2 nädala tagant N" }],
      30,
      { year: 2026, month: 8, day: 25 },
    );
    expect(result.occurrences).toHaveLength(0);
    expect(result.warnings[0]).toContain("ei vasta");
  });

  it("shows the next pickup per waste type", () => {
    const result = nextWasteByType(
      [
        { type: "Segaolmejäätmed", date: "2026-08-25", frequency: "Iga: T, R" },
        { type: "Klaas", date: "2026-08-27", frequency: "Kord 2 nädala tagant N" },
      ],
      30,
      { year: 2026, month: 8, day: 25 },
    );
    expect(result.occurrences).toHaveLength(2);
  });

  it.each([
    [100, "€/MWh", 10],
    [0.15, "€/kWh", 15],
    [12.3, "s/kWh", 12.3],
    [3, undefined, null],
    [-3, undefined, null],
  ])("explicit electricity unit %#", (value, unit, expected) =>
    expect(priceToCentsPerKwh(value, unit)).toBe(expected),
  );

  it("applies the day tariff only on non-holiday workdays 07:00–22:00", () => {
    expect(electricityTariffType(new Date("2026-08-25T10:00:00+03:00"))).toBe("day");
    expect(electricityTariffType(new Date("2026-08-25T22:00:00+03:00"))).toBe("night");
    expect(electricityTariffType(new Date("2026-08-20T10:00:00+03:00"))).toBe("night");
  });

  it("calculates electricity purchase price with VAT", () => {
    const price = calculatePurchasePriceCentsPerKwh(
      50,
      {
        exciseCentsPerKwh: 0.21,
        purchaseMarginCentsPerKwh: 0.78,
        securityFeeCentsPerKwh: 0.758,
        renewableFeeCentsPerKwh: 0.84,
        distributionDayCentsPerKwh: 3.49,
        distributionNightCentsPerKwh: 1.99,
      },
      new Date("2026-08-25T10:00:00+03:00"),
    );
    expect(price).toBeCloseTo((5 + 0.21 + 0.78 + 0.758 + 0.84 + 3.49) * 1.24, 8);
  });

  it("never leaks unknown English weather phenomenon", () => {
    expect(weatherPhenomenonEt("Alien weather event")).toBe("");
    expect(weatherPhenomenonEt("Cloudy")).toBe("Pilves");
  });

  it("returns the last four populated house months", () => {
    const months = Array.from({ length: 7 }, (_, index) => ({
      year: 2026,
      month: index + 1,
      monthName: String(index + 1),
      key: `2026-${String(index + 1).padStart(2, "0")}`,
      waterM3: 200 + index,
      heatMWh: null,
      electricityKWh: null,
      solarKWh: null,
    })) satisfies HouseMonth[];
    expect(lastHouseMonths(months).map((item) => item.month)).toEqual([4, 5, 6, 7]);
  });

  it("filters and sorts notices client-side", () => {
    const notices = [
      { id: "2", title: "B", body: "", type: "info", priority: 2, start: null, end: null },
      { id: "1", title: "A", body: "", type: "info", priority: 1, start: null, end: null },
      {
        id: "3",
        title: "C",
        body: "",
        type: "info",
        priority: 0,
        start: null,
        end: "2020-01-01T00:00:00.000Z",
      },
    ];
    expect(activeNotices(notices, new Date("2026-08-25T00:00:00.000Z")).map((item) => item.id)).toEqual([
      "1",
      "2",
    ]);
  });
});
