// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { Scheduler } from "../../src/app/scheduler";
import { replaceRemoteProblems } from "../../src/app/store";
import { ElectricityChart } from "../../src/ui/charts/electricity-chart";
import { dayMonthLabel, EuriborChart } from "../../src/ui/charts/euribor-chart";
import { estimateLabelWidth } from "../../src/ui/charts/svg";
import { formatDateValue } from "../../src/ui/panels/helpers";

/** 4.5.0 ülevaatuse käigus leitud vigade regressioonitestid. */
describe("4.5.0 regressioonid", () => {
  it("vormindab kuupäevaväärtuse ka siis, kui Intl.DateTimeFormat on asendatud", () => {
    // Playwrighti kell (ja iga muu polüfill) asendab konstruktori; varasem
    // `instanceof Intl.DateTimeFormat` kontroll tagastas siis tühja stringi.
    const Original = Intl.DateTimeFormat;
    const Replaced = function (...args: ConstructorParameters<typeof Intl.DateTimeFormat>) {
      return new Original(...args);
    } as unknown as typeof Intl.DateTimeFormat;
    vi.stubGlobal("Intl", { ...Intl, DateTimeFormat: Replaced });
    // Uus ajavöönd, et vahemälust ei tuleks enne asendust loodud vormindajaid.
    expect(formatDateValue("2026-08-17", "dayMonth", "Europe/Riga")).toBe("17. aug");
    expect(formatDateValue("2026-08-17", "time", "Europe/Riga")).toBe("");
    vi.unstubAllGlobals();
  });

  it("kuvab Euribori telje kuupäeva eesti järjekorras PP.KK", () => {
    expect(dayMonthLabel("2026-08-07")).toBe("07.08");
    expect(dayMonthLabel("2026-06-26")).toBe("26.06");
    expect(dayMonthLabel(undefined)).toBe("");
    expect(dayMonthLabel("vigane")).toBe("");
  });

  it("jätab elektrigraafiku teljesiltidele piisava vasaku veerise", () => {
    const host = document.createElement("div");
    const chart = new ElectricityChart(host);
    chart.update(
      Array.from({ length: 24 }, (_, hour) => ({
        time: new Date(Date.UTC(2026, 7, 25, hour)).toISOString(),
        price: hour === 18 ? 22.3 : 9,
      })),
      -1,
    );
    const scale = [...host.querySelectorAll<SVGTextElement>(".market-chart-scale")];
    expect(scale.map((label) => label.textContent)).toContain("22,3");
    for (const label of scale) {
      const right = Number(label.getAttribute("x"));
      // Paremjoondatud silt algab x - laius; see ei tohi minna viewBox'ist (x=0) välja.
      expect(right - estimateLabelWidth(label.textContent ?? "", 12.3)).toBeGreaterThanOrEqual(0);
    }
    const firstBar = host.querySelector(".market-electric-bar");
    expect(Number(firstBar?.getAttribute("x"))).toBeGreaterThan(
      Math.max(...scale.map((l) => Number(l.getAttribute("x")))),
    );
  });

  it("Euribori graafik paigutab y-sildid viewBox'i sisse", () => {
    const host = document.createElement("div");
    const chart = new EuriborChart(host);
    chart.update(
      Array.from({ length: 30 }, (_, index) => ({
        date: `2026-07-${String(index + 1).padStart(2, "0")}`,
        value: 2.1 + index * 0.03,
      })),
    );
    for (const label of host.querySelectorAll<SVGTextElement>(".market-chart-scale")) {
      const right = Number(label.getAttribute("x"));
      expect(right - estimateLabelWidth(label.textContent ?? "", 12.3)).toBeGreaterThanOrEqual(0);
    }
    const dates = [...host.querySelectorAll(".market-chart-label")].map((label) => label.textContent);
    expect(dates).toEqual(["01.07", "30.07"]);
  });

  it("säilitab kliendi enda probleemid, kui serveri probleemid uuenevad", () => {
    const local = (problem: string) => problem.startsWith("Vahemälu") || problem.startsWith("Prügiveo");
    const next = replaceRemoteProblems(
      ["vana serveri hoiatus", "Vahemälu: salvestus ebaõnnestus", "Prügiveo sagedus: tundmatu"],
      ["uus serveri hoiatus"],
      local,
    );
    expect(next).toEqual([
      "uus serveri hoiatus",
      "Vahemälu: salvestus ebaõnnestus",
      "Prügiveo sagedus: tundmatu",
    ]);
    expect(
      replaceRemoteProblems(
        Array(30).fill("x"),
        Array.from({ length: 25 }, (_, i) => `s${i}`),
        () => false,
      ),
    ).toHaveLength(20);
  });

  it("ajastaja taastub kella aastatepikkusest edasihüppest ühe sammuga", () => {
    const scheduler = new Scheduler();
    let calls = 0;
    const start = Date.UTC(2000, 0, 1);
    scheduler.register(
      "clock",
      1_000,
      () => {
        calls++;
      },
      true,
    );
    scheduler.runDueTasks(start);
    const jumped = Date.UTC(2026, 9, 6);
    const begin = performance.now();
    scheduler.runDueTasks(jumped);
    expect(performance.now() - begin).toBeLessThan(50);
    expect(calls).toBe(2);
    // Faas säilib: järgmine käivitus on täpselt sekundi pärast, mitte kohe uuesti.
    scheduler.runDueTasks(jumped + 999);
    expect(calls).toBe(2);
    scheduler.runDueTasks(jumped + 1_000);
    expect(calls).toBe(3);
  });
});
