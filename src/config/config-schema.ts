export interface RuntimeConfig {
  appsScriptUrl: string;
  feedToken: string;
  scale: number;
  refreshMinutes: number;
  noticeRotationSeconds: number;
  listRotationSeconds: number;
  maxContacts: number;
  maxEmergency: number;
  maxWaste: number;
  wasteWindowDays: number;
  timeZone: string;
  nightThemeStartHour: number;
  nightThemeEndHour: number;
  nightlyReloadHour: number;
  nightlyReloadMinute: number;
  buildVersion: string;
  buildDate: string;
}

export const MIN_RUNTIME_SCALE = 0.82;

export const DEFAULT_CONFIG: RuntimeConfig = {
  appsScriptUrl: "",
  feedToken: "",
  scale: 0.82,
  refreshMinutes: 5,
  noticeRotationSeconds: 14,
  listRotationSeconds: 18,
  maxContacts: 5,
  maxEmergency: 5,
  maxWaste: 5,
  wasteWindowDays: 30,
  timeZone: "Europe/Tallinn",
  nightThemeStartHour: 22,
  nightThemeEndHour: 6,
  nightlyReloadHour: 4,
  nightlyReloadMinute: 10,
  buildVersion: "dev",
  buildDate: "–",
};

function numberValue(value: unknown, fallback: number, min: number, max: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function parseRuntimeConfig(value: unknown): RuntimeConfig {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    appsScriptUrl: textValue(source.appsScriptUrl),
    feedToken: textValue(source.feedToken),
    scale: numberValue(source.scale, DEFAULT_CONFIG.scale, MIN_RUNTIME_SCALE, 1.4),
    refreshMinutes: numberValue(source.refreshMinutes, DEFAULT_CONFIG.refreshMinutes, 1, 60),
    noticeRotationSeconds: numberValue(source.noticeRotationSeconds, DEFAULT_CONFIG.noticeRotationSeconds, 6, 120),
    listRotationSeconds: numberValue(source.listRotationSeconds, DEFAULT_CONFIG.listRotationSeconds, 8, 300),
    maxContacts: Math.round(numberValue(source.maxContacts, DEFAULT_CONFIG.maxContacts, 1, 8)),
    maxEmergency: Math.round(numberValue(source.maxEmergency, DEFAULT_CONFIG.maxEmergency, 1, 8)),
    maxWaste: Math.round(numberValue(source.maxWaste, DEFAULT_CONFIG.maxWaste, 1, 10)),
    wasteWindowDays: Math.round(numberValue(source.wasteWindowDays, DEFAULT_CONFIG.wasteWindowDays, 1, 90)),
    timeZone: textValue(source.timeZone, DEFAULT_CONFIG.timeZone),
    nightThemeStartHour: Math.round(numberValue(source.nightThemeStartHour, DEFAULT_CONFIG.nightThemeStartHour, 0, 23)),
    nightThemeEndHour: Math.round(numberValue(source.nightThemeEndHour, DEFAULT_CONFIG.nightThemeEndHour, 0, 23)),
    nightlyReloadHour: Math.round(numberValue(source.nightlyReloadHour, DEFAULT_CONFIG.nightlyReloadHour, 0, 23)),
    nightlyReloadMinute: Math.round(numberValue(source.nightlyReloadMinute, DEFAULT_CONFIG.nightlyReloadMinute, 0, 59)),
    buildVersion: textValue(source.buildVersion, DEFAULT_CONFIG.buildVersion),
    buildDate: textValue(source.buildDate, DEFAULT_CONFIG.buildDate),
  };
}

export function endpointConfigured(config: RuntimeConfig): boolean {
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:\?.*)?$/.test(config.appsScriptUrl);
}

export function tokenConfigured(config: RuntimeConfig): boolean {
  return config.feedToken.length >= 16 && !config.feedToken.includes("_SIIA_") && !/^REPLACE_/i.test(config.feedToken);
}
