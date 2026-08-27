export type ScheduledTaskName = "clock" | "time-sensitive" | "watchdog" | "maintenance" | "debug" | "pixel-shift";

interface ScheduledTask {
  name: ScheduledTaskName;
  intervalMs: number;
  nextAt: number;
  callback: () => void | Promise<void>;
}

export class Scheduler {
  private readonly tasks = new Map<ScheduledTaskName, ScheduledTask>();
  private timer: number | null = null;

  register(name: ScheduledTaskName, intervalMs: number, callback: () => void | Promise<void>, runImmediately = false): void {
    const now = Date.now();
    this.tasks.set(name, {
      name,
      intervalMs: Math.max(250, intervalMs),
      nextAt: runImmediately ? now : now + Math.max(250, intervalMs),
      callback,
    });
  }

  names(): ScheduledTaskName[] {
    return [...this.tasks.keys()];
  }

  start(): void {
    if (this.timer !== null) return;
    const tick = () => {
      const now = Date.now();
      for (const task of this.tasks.values()) {
        if (now < task.nextAt) continue;
        // Säilita faas nii hästi kui võimalik ka siis, kui üks tick hilineb.
        do task.nextAt += task.intervalMs;
        while (task.nextAt <= now);
        try {
          void task.callback();
        } catch (error) {
          console.error(`Ajastatud toiming ${task.name} ebaõnnestus`, error);
        }
      }
    };
    tick();
    const shortest = Math.min(...[...this.tasks.values()].map((task) => task.intervalMs), 1_000);
    this.timer = window.setInterval(tick, Math.max(250, shortest));
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }
}
