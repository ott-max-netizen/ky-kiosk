import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sources = readFileSync(new URL("../../apps-script/Sources.gs", import.meta.url), "utf8");

describe("turuandmete allikate lepingud", () => {
  it("säilitab Eleringi EE hinnarea väljad", () => {
    expect(sources).toContain("dashboard.elering.ee/api/nps/price");
    expect(sources).toMatch(/Array\.isArray\(root\.ee\)/);
    expect(sources).toMatch(/row\s*&&\s*row\.timestamp/);
    expect(sources).toMatch(/row\s*&&\s*row\.price/);
  });

  it("säilitab OpenVan 95, 98 ja diisli väljad", () => {
    expect(sources).toContain("openvan.camp/api/fuel/prices");
    expect(sources).toContain("raw.data.EE");
    expect(sources).toContain("prices.gasoline_premium");
    expect(sources).toContain("prices.diesel");
  });

  it("säilitab EuroOilWatchi Eesti varuallika kuju", () => {
    expect(sources).toContain("eurooilwatch.com/api/v1/prices");
    expect(sources).toContain("country.countryCode");
    expect(sources).toContain("estonia.petrolPrice");
    expect(sources).toContain("estonia.dieselPrice");
  });

  it("säilitab 6 kuu Euribori kaks Soome Panga varuformaati", () => {
    expect(sources).toContain("euribor_korot_xml_short_en");
    expect(sources).toContain("euriborkorot_pv_chrt_en");
    expect(sources).toContain("parseEuriborReport_");
  });

  it("kasutab ebaõnnestumisel negatiivset vahemälu", () => {
    expect(sources).toContain("storeApiFailure_");
    expect(sources).toContain("negativeCacheSeconds");
  });
});
