export type ScheduledTaskName =
  | "clock"
  | "time-sensitive"
  | "watchdog"
  | "maintenance"
  | "debug"
  | "pixel-shift";

interface ScheduledTask {
  name: ScheduledTaskName;
  intervalMs: number;
  nextAt: number;
  running: boolean;
  callback: () => void | Promise<void>;
}

/**
 * Kioskimasina kell võib hüpata taha (NTP korrektsioon, suveaeg, BIOS-i kellaviga).
 * Kui `nextAt` jääb sellisel juhul kaugele tulevikku, seisaks ülesanne kuni kell
 * järele jõuab — sekundilise kella puhul tähendaks see külmunud ekraani. Kui
 * järgmine käivitus on rohkem kui sellevõrra ees, planeeritakse ülesanne ümber.
 */
const MAX_CLOCK_DRIFT_MS = 60_000;

/**
 * Üks jagatud intervall kõigi korduvate tööde jaoks (C-28 tugi). Ülesanded
 * hoiavad oma faasi ka siis, kui üksik tick hilineb, ega kuhju üksteise otsa.
 */
export class Scheduler {
  private readonly tasks = new Map<ScheduledTaskName, ScheduledTask>();
  private timer: number | null = null;
  private onError: (name: ScheduledTaskName, error: unknown) => void = (name, error) =>
    console.error(`Ajastatud toiming ${name} ebaõnnestus`, error);

  register(
    name: ScheduledTaskName,
    intervalMs: number,
    callback: () => void | Promise<void>,
    runImmediately = false,
  ): void {
    const now = Date.now();
    const interval = Math.max(250, intervalMs);
    this.tasks.set(name, {
      name,
      intervalMs: interval,
      nextAt: runImmediately ? now : now + interval,
      running: false,
      callback,
    });
  }

  /** Vahetab vaikimisi veakäsitluse (kasutusel testides ja diagnostikas). */
  setErrorHandler(handler: (name: ScheduledTaskName, error: unknown) => void): void {
    this.onError = handler;
  }

  names(): ScheduledTaskName[] {
    return [...this.tasks.keys()];
  }

  start(): void {
    if (this.timer !== null) return;
    const tick = () => this.runDueTasks(Date.now());
    tick();
    const shortest = Math.min(...[...this.tasks.values()].map((task) => task.intervalMs), 1_000);
    this.timer = window.setInterval(tick, Math.max(250, shortest));
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  /** Nähtav testide jaoks: käivitab kõik tähtajaks küpsed ülesanded. */
  runDueTasks(now: number): void {
    for (const task of this.tasks.values()) {
      if (task.nextAt - now > task.intervalMs + MAX_CLOCK_DRIFT_MS) {
        // Kell hüppas taha; taasta faas praegusest hetkest.
        task.nextAt = now;
      }
      if (now < task.nextAt) continue;
      // Säilita faas nii hästi kui võimalik ka siis, kui üks tick hilineb.
      do task.nextAt += task.intervalMs;
      while (task.nextAt <= now);
      // Aeglane asünkroonne ülesanne ei tohi iseendaga kattuda ega kuhjuda.
      if (task.running) continue;
      this.invoke(task);
    }
  }

  private invoke(task: ScheduledTask): void {
    try {
      const result = task.callback();
      // `void promise` neelas varem iga asünkroonse tagasilükkamise: try/catch ei
      // püüa juba tagastatud lubadust ja veast sai käsitlemata rejection.
      if (result && typeof (result as Promise<void>).then === "function") {
        task.running = true;
        void (result as Promise<void>).then(
          () => {
            task.running = false;
          },
          (error: unknown) => {
            task.running = false;
            this.onError(task.name, error);
          },
        );
      }
    } catch (error) {
      task.running = false;
      this.onError(task.name, error);
    }
  }
}
