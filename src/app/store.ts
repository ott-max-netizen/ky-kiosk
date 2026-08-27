import { createFallbackData, createSectionVersions } from "../data/merge";
import type { DashboardData, SectionVersions } from "../data/types";

export type ConnectionState = "online" | "offline" | "neutral";

export interface RuntimeStatus {
  connectionState: ConnectionState;
  connectionText: string;
  lastSuccessfulSyncMs: number;
  lastSyncDurationMs: number;
  lastError: string;
  syncing: boolean;
  retryDelayMs: number;
  runtimeProblems: string[];
  startedAtMs: number;
}

export interface AppState {
  data: DashboardData;
  versions: SectionVersions;
  status: RuntimeStatus;
}

export type StoreListener = (next: AppState, previous: AppState) => void;

export class AppStore {
  private state: AppState;
  private readonly listeners = new Set<StoreListener>();

  constructor(initial?: Partial<AppState>) {
    this.state = {
      data: initial?.data ?? createFallbackData(),
      versions: initial?.versions ?? createSectionVersions(),
      status: initial?.status ?? {
        connectionState: "neutral",
        connectionText: "Kontrollin ühendust…",
        lastSuccessfulSyncMs: 0,
        lastSyncDurationMs: 0,
        lastError: "",
        syncing: false,
        retryDelayMs: 30_000,
        runtimeProblems: [],
        startedAtMs: Date.now(),
      },
    };
  }

  get(): AppState {
    return this.state;
  }

  setData(data: DashboardData, versions: SectionVersions): void {
    const previous = this.state;
    this.state = { ...this.state, data, versions };
    this.emit(previous);
  }

  patchStatus(patch: Partial<RuntimeStatus>): void {
    const previous = this.state;
    this.state = { ...this.state, status: { ...this.state.status, ...patch } };
    this.emit(previous);
  }

  addRuntimeProblem(problem: string): void {
    const current = this.state.status.runtimeProblems;
    if (current.includes(problem)) return;
    this.patchStatus({ runtimeProblems: [...current, problem].slice(-20) });
  }

  clearRuntimeProblem(problem: string): void {
    const next = this.state.status.runtimeProblems.filter((item) => item !== problem);
    if (next.length !== this.state.status.runtimeProblems.length) this.patchStatus({ runtimeProblems: next });
  }

  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(previous: AppState): void {
    for (const listener of this.listeners) listener(this.state, previous);
  }
}
