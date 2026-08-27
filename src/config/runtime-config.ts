import { parseRuntimeConfig, type RuntimeConfig } from "./config-schema";

declare global {
  interface Window {
    KU_CONFIG?: unknown;
  }
}

export function readRuntimeConfig(): RuntimeConfig {
  return parseRuntimeConfig(window.KU_CONFIG);
}
