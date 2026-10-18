// @vitest-environment happy-dom
// happy-dom asendab globaalse URL-i, seega loetakse failid projekti juurest (vitest cwd).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppStore } from "../../src/app/store";
import { DEFAULT_CONFIG } from "../../src/config/config-schema";
import { createFallbackData, createSectionVersions, mergeIncoming } from "../../src/data/merge";
import type { DashboardData } from "../../src/data/types";
import { validateDashboardPayload } from "../../src/data/validate";
import { AppView } from "../../src/ui/app-view";
import { updateMarketCardStale } from "../../src/ui/panels/helpers";
import { MarketFuelPanel } from "../../src/ui/panels/market-fuel";

const html = readFileSync(resolve("index.html"), "utf8");
// Skriptisildid eemaldatakse: happy-dom ei laadi neid ja logiks iga testi kohta vea.
const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] ?? "").replace(
  /<script[\s\S]*?<\/script>/g,
  "",
);
const SYNCED_AT = "2026-08-25T10:00:00+03:00";

/** Näidisandmed, mille kõik sektsioonid sünkroniseeriti viimati `SYNCED_AT` ajal. */
function syncedData(): DashboardData {
  const raw = JSON.parse(readFileSync(resolve("public/sample-data.json"), "utf8"));
  const payload = validateDashboardPayload(raw).value;
  if (!payload) throw new Error("sample-data.json ei läbinud valideerimist");
  const updatedAt = new Date(SYNCED_AT).toISOString();
  payload.updatedAt = updatedAt;
  for (const meta of Object.values(payload.sections)) if (meta) meta.updatedAt = updatedAt;
  return mergeIncoming(createFallbackData(), payload, createSectionVersions(), new Date(SYNCED_AT)).data;
}

function staleState(id: "electricity" | "fuel" | "euribor") {
  const card = document.getElementById(`${id}Card`) as HTMLElement;
  const label = document.getElementById(`${id}Stale`) as HTMLElement;
  return { stale: card.classList.contains("is-stale"), hidden: label.hidden, text: label.textContent };
}

describe("turukaartide aegumismärgis ilma võrgusünkroonimiseta", () => {
  beforeEach(() => {
    document.body.innerHTML = body;
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("muutub kellaga edasi liikudes 1 p vanaks ka siis, kui store'i versioonid ei muutu", () => {
    vi.setSystemTime(new Date("2026-08-25T12:00:00+03:00"));
    const store = new AppStore({ data: syncedData() });
    const view = new AppView(
      DEFAULT_CONFIG,
      false,
      () => [],
      () => undefined,
    );
    view.mount();
    view.update(store.get(), true);
    view.tickTimeSensitive(new Date());
    for (const id of ["electricity", "fuel", "euribor"] as const)
      expect(staleState(id)).toEqual({ stale: false, hidden: true, text: "" });

    // Kesköö järel, aga alla 24 h: päevavahetuse haru jookseb siin ja kaardid on värsked.
    vi.setSystemTime(new Date("2026-08-26T00:00:30+03:00"));
    view.tickTimeSensitive(new Date());
    for (const id of ["electricity", "fuel", "euribor"] as const) expect(staleState(id).stale).toBe(false);

    // 25 h pärast viimast sünkroonimist samal päeval: ainult minutiharu (`tick`) saab
    // märgist muuta; võrku pole olnud ja view.update'i ei kutsuta.
    vi.setSystemTime(new Date("2026-08-26T11:00:00+03:00"));
    view.tickTimeSensitive(new Date());
    for (const id of ["electricity", "fuel", "euribor"] as const)
      expect(staleState(id)).toEqual({ stale: true, hidden: false, text: "1 p vana" });

    // Kesköö järel liigub märgis edasi ka päevavahetuse uuenduse kaudu.
    vi.setSystemTime(new Date("2026-08-28T00:00:30+03:00"));
    view.tickTimeSensitive(new Date());
    for (const id of ["electricity", "fuel", "euribor"] as const)
      expect(staleState(id).text).toBe("2 p vana");
    view.destroy();
  });

  it("paneeli tick kasutab antud kella, mitte Date.now()", () => {
    vi.setSystemTime(new Date("2026-08-25T12:00:00+03:00"));
    const panel = new MarketFuelPanel();
    panel.update({ data: syncedData(), now: new Date(), timeZone: "Europe/Tallinn" });
    expect(staleState("fuel").stale).toBe(false);
    panel.tick(new Date("2026-08-26T10:00:01+03:00"));
    expect(staleState("fuel")).toEqual({ stale: true, hidden: false, text: "1 p vana" });
    panel.tick(new Date("2026-08-25T13:00:00+03:00"));
    expect(staleState("fuel")).toEqual({ stale: false, hidden: true, text: "" });
  });

  it("sektsiooni viga näitab vahemälu märgist sõltumata vanusest", () => {
    const data = syncedData();
    data.sectionErrors.euribor = "Soome Pank HTTP 503";
    const card = document.getElementById("euriborCard") as HTMLElement;
    const label = document.getElementById("euriborStale") as HTMLElement;
    updateMarketCardStale(data, "euribor", card, label, Date.parse(SYNCED_AT) + 60_000);
    expect(staleState("euribor")).toEqual({ stale: true, hidden: false, text: "vahemälust" });
  });
});
