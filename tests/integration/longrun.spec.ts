// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { Scheduler } from "../../src/app/scheduler";

describe("pika tööaja ajastaja", () => {
  it("hoiab ühe intervalli ja kuus registreeritud ülesannet", () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const scheduler = new Scheduler();
    for (const name of ["clock", "time-sensitive", "watchdog", "maintenance", "debug", "pixel-shift"] as const) {
      scheduler.register(name, 1000, () => undefined);
    }
    scheduler.start();
    vi.advanceTimersByTime(12 * 60 * 60 * 1000);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(scheduler.names()).toHaveLength(6);
    scheduler.stop();
    vi.useRealTimers();
  });
});
