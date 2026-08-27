// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestSupervisedReload, tickMaintenance, tickSupervisor } from "../../src/app/lifecycle";
import { DEFAULT_CONFIG } from "../../src/config/config-schema";
import { Scheduler } from "../../src/app/scheduler";

describe("scheduler and lifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("owns exactly six named repeating tasks", () => {
    const scheduler = new Scheduler();
    scheduler.register("clock", 1000, () => undefined);
    scheduler.register("time-sensitive", 60_000, () => undefined);
    scheduler.register("watchdog", 60_000, () => undefined);
    scheduler.register("maintenance", 30_000, () => undefined);
    scheduler.register("debug", 10_000, () => undefined);
    scheduler.register("pixel-shift", 900_000, () => undefined);
    expect(scheduler.names()).toEqual(["clock", "time-sensitive", "watchdog", "maintenance", "debug", "pixel-shift"]);
  });

  it("does nothing before the first successful sync", () => {
    const retrySync = vi.fn();
    expect(tickSupervisor({ lastSuccessfulSyncMs: 0, refreshMinutes: 5, syncing: false, demoMode: false, retrySync })).toBe("noop");
    expect(retrySync).not.toHaveBeenCalled();
  });

  it("does not supervise reloads in demo mode", () => {
    expect(requestSupervisedReload("watchdog", Date.now(), true)).toBe(false);
  });

  it("runs nightly maintenance after the target minute, once per calendar day", () => {
    const reload = vi.spyOn(Location.prototype, "reload").mockImplementation(() => undefined);
    const config = { ...DEFAULT_CONFIG, timeZone: "Europe/Tallinn", nightlyReloadHour: 4, nightlyReloadMinute: 10 };
    const startedBeforeTarget = Date.parse("2026-08-25T00:30:00Z"); // 03:30 Tallinn
    expect(tickMaintenance(config, false, new Date("2026-08-25T01:09:59Z"), startedBeforeTarget)).toBe(false); // 04:09:59 Tallinn
    expect(tickMaintenance(config, false, new Date("2026-08-25T01:12:00Z"), startedBeforeTarget)).toBe(true);
    expect(tickMaintenance(config, false, new Date("2026-08-25T06:00:00Z"), startedBeforeTarget)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    reload.mockRestore();
  });

  // Sessioon, mis algas juba pärast sihtaega, ei ole öist reload'i vahele jätnud.
  // Varem tegi iga päevane käivitus 30 s pärast starti kohe veel ühe reload'i.
  it("does not reload a session that started after the nightly target", () => {
    const reload = vi.spyOn(Location.prototype, "reload").mockImplementation(() => undefined);
    const config = { ...DEFAULT_CONFIG, timeZone: "Europe/Tallinn", nightlyReloadHour: 4, nightlyReloadMinute: 10 };
    const startedAtTen = Date.parse("2026-08-25T07:00:00Z"); // 10:00 Tallinn
    expect(tickMaintenance(config, false, new Date("2026-08-25T07:00:30Z"), startedAtTen)).toBe(false);
    expect(tickMaintenance(config, false, new Date("2026-08-25T15:00:00Z"), startedAtTen)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    // Järgmisel kalendripäeval toimub reload endiselt.
    expect(tickMaintenance(config, false, new Date("2026-08-26T01:12:00Z"), startedAtTen)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    reload.mockRestore();
  });

  // Kui localStorage on kättesaamatu, ei tohi hooldus lõputult reload'i korrata.
  it("does not loop when localStorage is unavailable", () => {
    const reload = vi.spyOn(Location.prototype, "reload").mockImplementation(() => undefined);
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    const config = { ...DEFAULT_CONFIG, timeZone: "Europe/Tallinn", nightlyReloadHour: 4, nightlyReloadMinute: 10 };
    const startedAtNoon = Date.parse("2026-08-25T09:00:00Z"); // 12:00 Tallinn
    for (let tick = 0; tick < 20; tick += 1) {
      expect(tickMaintenance(config, false, new Date(startedAtNoon + tick * 30_000), startedAtNoon)).toBe(false);
    }
    expect(reload).not.toHaveBeenCalled();
    getItem.mockRestore();
    setItem.mockRestore();
    reload.mockRestore();
  });
});
