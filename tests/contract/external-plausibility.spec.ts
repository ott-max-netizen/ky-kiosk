import { describe, expect, it } from "vitest";
import { validateDashboardPayload } from "../../src/data/validate";

/**
 * Väline allikas ei tohi vaikselt vale väärtust ekraanile saata. Kui ülesvoolu
 * ühik muutub (sendid euro asemel, €/MWh €/kWh asemel), tuleb kohale täiesti
 * usutava kujuga, aga sajakordselt vale arv. Sellisel juhul eelistame „andmed
 * puuduvad“ või viimast head vahemälu väärtust.
 */
function payload(extra: Record<string, unknown>) {
  return validateDashboardPayload({
    ok: true,
    updatedAt: "2026-08-25T10:00:00.000Z",
    sections: {},
    ...extra,
  });
}

describe("väliste allikate usutavuskontroll", () => {
  it("võtab vastu tavapärased kütusehinnad", () => {
    const result = payload({ fuel: { petrol95: 1.812, petrol98: 1.862, diesel: 1.877, unit: "EUR/l" } });
    expect(result.value?.fuel?.petrol95).toBe(1.812);
    expect(result.problems).toHaveLength(0);
  });

  it("lükkab tagasi sendipõhise kütusehinna ja hoiatab", () => {
    const result = payload({ fuel: { petrol95: 181.2, petrol98: 186.2, diesel: 187.7, unit: "EUR/l" } });
    expect(result.value?.fuel).toBeUndefined();
    expect(result.problems.join(" ")).toContain("usutava");
  });

  it("jätab ainult ühe vigase kütuseliigi välja", () => {
    const result = payload({ fuel: { petrol95: 1.812, petrol98: 186.2, diesel: 1.877, unit: "EUR/l" } });
    expect(result.value?.fuel?.petrol95).toBe(1.812);
    expect(result.value?.fuel?.petrol98).toBeNull();
    expect(result.value?.fuel?.diesel).toBe(1.877);
    expect(result.problems.join(" ")).toContain("98");
  });

  it("võtab vastu tavapärase Euribori, aga mitte baaspunktides antut", () => {
    const good = payload({
      euribor: { tenor: "6M", unit: "%", latest: 2.683, latestDate: "2026-08-25", points: [] },
    });
    expect(good.value?.euribor?.latest).toBe(2.683);
    const bad = payload({
      euribor: { tenor: "6M", unit: "%", latest: 268.3, latestDate: "2026-08-25", points: [] },
    });
    expect(bad.value?.euribor).toBeUndefined();
    expect(bad.problems.join(" ")).toContain("Euribor");
  });

  it("viskab välja ebausutava elektrihinna punkti, säilitades ülejäänud", () => {
    const result = payload({
      electricity: {
        date: "2026-08-25",
        unit: "s/kWh",
        points: [
          { time: "2026-08-25T00:00:00.000Z", price: 9.09 },
          { time: "2026-08-25T01:00:00.000Z", price: 900_000 },
          { time: "2026-08-25T02:00:00.000Z", price: -4.2 },
        ],
      },
    });
    expect(result.value?.electricity?.points).toHaveLength(2);
    // Negatiivne börsihind on päris nähtus ja peab läbi tulema.
    expect(result.value?.electricity?.points.at(-1)?.price).toBe(-4.2);
  });

  it("lükkab tagasi võimatu ilmanäidu", () => {
    const good = payload({
      weather: {
        current: { temperature: 16.1, apparentTemperature: 15, weatherCode: 3, windSpeed: 2.9 },
        daily: [],
      },
    });
    expect(good.value?.weather?.current.temperature).toBe(16.1);
    const bad = payload({
      weather: {
        current: { temperature: 1610, apparentTemperature: 15, weatherCode: 3, windSpeed: 2.9 },
        daily: [],
      },
    });
    expect(bad.value?.weather).toBeUndefined();
    expect(bad.problems.join(" ")).toContain("weather");
  });
});
