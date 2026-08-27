// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { Scheduler } from "../../src/app/scheduler";

/**
 * Ajastaja peab taluma nädalaid järjest: aeglast asünkroonset tööd, tagasilükatud
 * lubadusi ja süsteemikella hüppeid, ilma et ülesanded kuhjuksid või seisma jääksid.
 */
describe("scheduler robustness", () => {
  it("reports a rejected async callback instead of swallowing it", async () => {
    const scheduler = new Scheduler();
    const errors: unknown[] = [];
    scheduler.setErrorHandler((_name, error) => errors.push(error));
    scheduler.register("watchdog", 1_000, async () => {
      throw new Error("võrk kadus");
    }, true);
    scheduler.runDueTasks(Date.now());
    await Promise.resolve();
    await Promise.resolve();
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe("võrk kadus");
  });

  it("reports a synchronous callback error", () => {
    const scheduler = new Scheduler();
    const errors: unknown[] = [];
    scheduler.setErrorHandler((_name, error) => errors.push(error));
    scheduler.register("clock", 1_000, () => {
      throw new Error("renderdus ebaõnnestus");
    }, true);
    scheduler.runDueTasks(Date.now());
    expect(errors).toHaveLength(1);
  });

  it("does not overlap a slow async task with itself", async () => {
    const scheduler = new Scheduler();
    let started = 0;
    const releases: Array<() => void> = [];
    scheduler.register("maintenance", 1_000, () => {
      started += 1;
      return new Promise<void>((resolve) => {
        releases.push(resolve);
      });
    }, true);

    const base = 1_000_000;
    scheduler.runDueTasks(base);
    expect(started).toBe(1);
    // Kümme tähtaega möödub, kuni eelmine töö alles käib.
    for (let step = 1; step <= 10; step += 1) scheduler.runDueTasks(base + step * 1_000);
    expect(started).toBe(1);

    releases.shift()?.();
    await Promise.resolve();
    await Promise.resolve();
    scheduler.runDueTasks(base + 11_000);
    expect(started).toBe(2);
  });

  it("keeps its phase when a tick is late, firing once rather than catching up", () => {
    const scheduler = new Scheduler();
    let runs = 0;
    scheduler.register("time-sensitive", 1_000, () => {
      runs += 1;
    });
    const base = 2_000_000;
    // Üks tick 10 minutit hiljem: sekundiline ülesanne ei tohi 600 korda järele jõuda.
    scheduler.runDueTasks(base + 600_000);
    expect(runs).toBe(1);
  });

  it("recovers when the system clock jumps backwards", () => {
    const scheduler = new Scheduler();
    let runs = 0;
    scheduler.register("clock", 1_000, () => {
      runs += 1;
    }, true);
    const base = 3_000_000;
    scheduler.runDueTasks(base);
    expect(runs).toBe(1);
    // NTP lükkab kella tund aega tagasi. Varem oleks ülesanne seisnud tund aega.
    const rewound = base - 3_600_000;
    scheduler.runDueTasks(rewound);
    expect(runs).toBe(2);
    scheduler.runDueTasks(rewound + 1_000);
    expect(runs).toBe(3);
  });

  it("uses one shared interval for all registered tasks", () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const scheduler = new Scheduler();
    for (const name of ["clock", "time-sensitive", "watchdog", "maintenance", "debug", "pixel-shift"] as const) {
      scheduler.register(name, 1_000, () => undefined);
    }
    scheduler.start();
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    scheduler.stop();
    vi.useRealTimers();
  });
});
