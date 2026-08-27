import { describe, expect, it } from "vitest";
import { validateCachedDashboard } from "../../src/data/validate";
import { createFallbackData } from "../../src/data/merge";

/**
 * IndexedDB vahemälu on ainus andmeallikas, mis üle elab brauseri taaskäivituse.
 * Kui sealt tuleb tagasi valideerimata objekt, jookseb esimene renderdus kokku
 * ja kiosk jääb tühjale ekraanile kuni öise reload'ini (C-23, C-25).
 */
describe("vahemälu valideerimine", () => {
  it("ei tagasta valideerimata toorobjekti", () => {
    const broken = {
      ok: true,
      updatedAt: "2026-08-25T10:00:00.000Z",
      sections: {},
      settings: {
        buildingName: "KÜ",
        buildingAddress: "",
        weatherLocation: "Viljandi",
        timeZone: "Europe/Tallinn",
      },
      notices: "see ei ole massiiv",
      contacts: [{ role: "Juhatus", name: "Mari", phone: "5000000", email: "private@example.test" }],
    };
    const result = validateCachedDashboard(broken);
    expect(result).not.toBeNull();
    // Vigane sektsioon asendatakse turvalise vaikeväärtusega, mitte ei lasta läbi.
    expect(Array.isArray(result?.notices)).toBe(true);
    // Ka vahemälust tulnud kontakt ei tohi kanda e-posti (C-33).
    expect(result?.contacts[0]).toEqual({ role: "Juhatus", name: "Mari", phone: "5000000" });
  });

  it("täidab puuduvad kohustuslikud väljad", () => {
    const result = validateCachedDashboard({ ok: true, updatedAt: null, sections: {} });
    expect(result).not.toBeNull();
    expect(result?.settings.timeZone).toBe("Europe/Tallinn");
    expect(result?.contacts).toEqual([]);
    expect(result?.emergency).toEqual([]);
    expect(result?.waste).toEqual([]);
    expect(result?.sectionUpdatedAt).toEqual({});
    expect(result?.sectionErrors).toEqual({});
  });

  it("lükkab tagasi selle, mis ei ole objekt", () => {
    expect(validateCachedDashboard(null)).toBeNull();
    expect(validateCachedDashboard("string")).toBeNull();
    expect(validateCachedDashboard([1, 2, 3])).toBeNull();
  });

  it("säilitab korrektse vahemälu sisu ja sektsioonimetaandmed", () => {
    const source = createFallbackData();
    source.updatedAt = "2026-08-25T10:00:00.000Z";
    source.sectionUpdatedAt = { weather: "2026-08-25T09:00:00.000Z" };
    source.sectionErrors = { fuel: "Allikas ei vastanud" };
    const result = validateCachedDashboard(JSON.parse(JSON.stringify(source)));
    expect(result?.updatedAt).toBe("2026-08-25T10:00:00.000Z");
    expect(result?.notices[0]?.id).toBe("start");
    expect(result?.emergency[0]?.phone).toBe("112");
    expect(result?.sectionUpdatedAt.weather).toBe("2026-08-25T09:00:00.000Z");
    expect(result?.sectionErrors.fuel).toBe("Allikas ei vastanud");
  });

  it("piirab vahemälust tuleva teate pikkust", () => {
    const result = validateCachedDashboard({
      ok: true,
      updatedAt: null,
      sections: {},
      notices: [
        { id: "x", title: "T", body: "a".repeat(50_000), type: "info", priority: 1, start: null, end: null },
      ],
    });
    expect(result?.notices[0]?.body.length).toBe(12_000);
  });

  it("annab id-ta teatele püsiva id, mis ei muutu iga valideerimisega", () => {
    const payload = {
      ok: true,
      updatedAt: null,
      sections: {},
      notices: [{ title: "Ilma id-ta", body: "tekst" }],
    };
    const first = validateCachedDashboard(JSON.parse(JSON.stringify(payload)));
    const second = validateCachedDashboard(JSON.parse(JSON.stringify(payload)));
    expect(first?.notices[0]?.id).toBeTruthy();
    expect(first?.notices[0]?.id).toBe(second?.notices[0]?.id);
  });
});
