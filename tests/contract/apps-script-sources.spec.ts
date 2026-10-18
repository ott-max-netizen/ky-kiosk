import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Apps Scripti lähtekood käivitatakse Node'i vm-kontekstis koos minimaalsete
 * Google'i teenuste asendustega. Nii kontrollitakse päris `.gs` loogikat, mitte
 * ainult teksti olemasolu, ilma Google'i kontota.
 */
const FILES = ["Code.gs", "Sheets.gs", "Domain.gs", "Sources.gs"];
const source = FILES.map((name) =>
  readFileSync(new URL(`../../apps-script/${name}`, import.meta.url), "utf8"),
).join("\n");
const TZ = "Europe/Tallinn";

interface FakeResponse {
  getResponseCode(): number;
  getContentText(): string;
}

function response(code: number, body: unknown = ""): FakeResponse {
  return {
    getResponseCode: () => code,
    getContentText: () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

function formatDate(date: Date, timeZone: string, pattern: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return pattern
    .replace("yyyy", parts.year ?? "")
    .replace("MM", parts.month ?? "")
    .replace("dd", parts.day ?? "")
    .replace("HH", parts.hour ?? "")
    .replace("mm", parts.minute ?? "")
    .replace("ss", parts.second ?? "");
}

interface AppsScriptApi {
  getWeather_(settings: Record<string, string>, tz: string): unknown;
  parseElectricityResponse_(
    response: FakeResponse,
    now: Date,
    tz: string,
    tariffs: Record<string, number>,
    dayKey: string,
  ): unknown;
}

function loadAppsScript() {
  const store = new Map<string, string>();
  const UrlFetchApp = { fetchAll: vi.fn(), fetch: vi.fn() };
  const context = {
    console: { log() {}, warn() {}, error() {} },
    CacheService: {
      getScriptCache: () => ({
        get: (key: string) => store.get(key) ?? null,
        put: (key: string, value: string) => void store.set(key, value),
        remove: (key: string) => void store.delete(key),
      }),
    },
    Utilities: { formatDate },
    UrlFetchApp,
  };
  // `globalThis` kaudu, sest skripti tipptaseme `const` ei ole konteksti omadus.
  runInNewContext(`${source}\nglobalThis.__api = { getWeather_, parseElectricityResponse_, KU };`, context);
  const api = (context as unknown as { __api: AppsScriptApi }).__api;
  return { api, store, UrlFetchApp };
}

const TARIFFS = {
  distributionDay: 3.49,
  distributionNight: 1.99,
  renewableEnergyFee: 0.84,
  electricityExcise: 0.21,
  securityOfSupplyFee: 0.758,
  purchaseMargin: 0.78,
  vatRate: 24,
};

/** Pooliku päeva Eleringi vastus: 00:00–11:00 kohaliku aja tunnihinnad. */
function halfDayElering() {
  const ee = Array.from({ length: 12 }, (_, hour) => ({
    timestamp: Date.parse(`2026-08-25T${String(hour).padStart(2, "0")}:00:00+03:00`) / 1000,
    price: 80 + hour,
  }));
  return response(200, { data: { ee } });
}

describe("Apps Script Sources.gs käitumine", () => {
  let app: ReturnType<typeof loadAppsScript>;
  beforeEach(() => {
    app = loadAppsScript();
  });

  describe("parseElectricityResponse_ hetkehind", () => {
    const parse = (now: string) =>
      JSON.parse(
        JSON.stringify(
          app.api.parseElectricityResponse_(halfDayElering(), new Date(now), TZ, TARIFFS, "2026-08-25"),
        ),
      );

    it("valib viimase alanud perioodi, kui see on alla tunni vana", () => {
      const result = parse("2026-08-25T11:20:00+03:00");
      expect(result.currentPrice).toBe(result.points[11].price);
      expect(result.currentTariffType).toBe("day");
    });

    it("ei näita pooliku päeva korral tunde vana punkti hetkehinnana", () => {
      const result = parse("2026-08-25T15:30:00+03:00");
      expect(result.currentPrice).toBeNull();
      expect(result.currentTariffType).toBe("");
      expect(result.points).toHaveLength(12);
      expect(result.max).toBeGreaterThan(result.min);
    });

    it("ei näita tulevast punkti hetkehinnana", () => {
      const result = parse("2026-08-24T23:30:00+03:00");
      expect(result.currentPrice).toBeNull();
    });
  });

  describe("getWeather_", () => {
    const settings = {
      weatherLatitude: "58.3639",
      weatherLongitude: "25.5900",
      weatherStationName: "Viljandi",
    };
    const forecast = response(200, {
      current: {
        temperature_2m: 18.4,
        apparent_temperature: 17.9,
        relative_humidity_2m: 60,
        weather_code: 2,
        wind_speed_10m: 3.1,
        time: "2026-08-25T16:00",
      },
      daily: {
        time: ["2026-08-25", "2026-08-26"],
        weather_code: [2, 3],
        temperature_2m_max: [20, 19],
        temperature_2m_min: [11, 10],
        precipitation_probability_max: [10, 40],
        sunrise: ["2026-08-25T05:58", "2026-08-26T06:00"],
        sunset: ["2026-08-25T20:41", "2026-08-26T20:38"],
      },
    });
    const clearPositiveCache = () => {
      for (const key of app.store.keys()) if (!key.includes("_fail")) app.store.delete(key);
    };

    it("pärib prognoosi ja vaatluse ühe paralleelse fetchAll-iga", () => {
      app.UrlFetchApp.fetchAll.mockReturnValueOnce([forecast, response(503)]);
      const result = JSON.parse(JSON.stringify(app.api.getWeather_(settings, TZ)));
      expect(app.UrlFetchApp.fetchAll).toHaveBeenCalledTimes(1);
      const urls = app.UrlFetchApp.fetchAll.mock.calls[0]?.[0].map((request: { url: string }) => request.url);
      expect(urls).toHaveLength(2);
      expect(urls[0]).toContain("api.open-meteo.com");
      expect(urls[1]).toContain("ilmateenistus.ee");
      expect(app.UrlFetchApp.fetch).not.toHaveBeenCalled();
      expect(result.ok).toBe(true);
      expect(result.data.current.source).toBe("open-meteo");
    });

    it("jätab negatiivses vahemälus oleva vaatluse järgmisel päringul vahele", () => {
      app.UrlFetchApp.fetchAll.mockReturnValueOnce([forecast, response(503)]);
      app.api.getWeather_(settings, TZ);
      clearPositiveCache();
      app.UrlFetchApp.fetchAll.mockReturnValueOnce([forecast]);
      const result = app.api.getWeather_(settings, TZ) as { ok: boolean };
      expect(app.UrlFetchApp.fetchAll.mock.calls[1]?.[0]).toHaveLength(1);
      expect(result.ok).toBe(true);
    });

    it("prognoosi tõrge salvestatakse ja järgmine päring ei tee HTTP-kutset", () => {
      app.UrlFetchApp.fetchAll.mockReturnValueOnce([response(500), response(503)]);
      const first = app.api.getWeather_(settings, TZ) as { ok: boolean; error: string };
      expect(first.ok).toBe(false);
      expect(first.error).toContain("Open-Meteo HTTP 500");
      const second = app.api.getWeather_(settings, TZ) as { ok: boolean; negativeCached: boolean };
      expect(second.ok).toBe(false);
      expect(second.negativeCached).toBe(true);
      expect(app.UrlFetchApp.fetchAll).toHaveBeenCalledTimes(1);
    });

    it("fetchAll-i aegumisel jääb vaatlus vahemällu tõrkena ja prognoos päritakse üksi", () => {
      app.UrlFetchApp.fetchAll.mockImplementationOnce(() => {
        throw new Error("Timeout: https://www.ilmateenistus.ee/ilma_andmed/xml/observations.php");
      });
      // Ainult Open-Meteo URL tagastab prognoosi; vale URL-i korduspäring kukuks läbi.
      app.UrlFetchApp.fetch.mockImplementationOnce((url: string) =>
        url.includes("api.open-meteo.com") ? forecast : response(200, "<observations/>"),
      );
      const result = app.api.getWeather_(settings, TZ) as { ok: boolean };
      expect(result.ok).toBe(true);
      expect(app.UrlFetchApp.fetch).toHaveBeenCalledTimes(1);
      expect(app.UrlFetchApp.fetch.mock.calls[0]?.[0]).toContain("api.open-meteo.com");
      expect([...app.store.keys()].some((key) => key.startsWith("weather_observation_fail"))).toBe(true);
    });
  });
});
