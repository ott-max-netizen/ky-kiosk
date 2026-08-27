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
    expect(tickMaintenance(config, false, new Date("2026-08-25T01:09:59Z"))).toBe(false); // 04:09:59 Tallinn
    expect(tickMaintenance(config, false, new Date("2026-08-25T01:12:00Z"))).toBe(true);
    expect(tickMaintenance(config, false, new Date("2026-08-25T06:00:00Z"))).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    reload.mockRestore();
  });
});
