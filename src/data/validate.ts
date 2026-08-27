import { weatherPhenomenonEt } from "../domain/weather/phenomenon";
import type {
  Contact,
  DashboardData,
  ElectricityData,
  ElectricityPoint,
  EmergencyContact,
  EuriborData,
  EuriborPoint,
  FuelData,
  HouseData,
  IncomingDashboardPayload,
  Notice,
  SectionMeta,
  SectionName,
  Settings,
  WeatherCurrent,
  WeatherDaily,
  WeatherData,
} from "./types";
import { SECTION_NAMES } from "./types";
import type { WasteItem } from "../domain/waste/occurrences";
import type { HouseMonth } from "../domain/house/consumption";

export interface ValidationResult<T> {
  value: T | null;
  problems: string[];
}

const MAX_TEXT = 500;
const MAX_BODY = 12_000;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function clampText(value: unknown, max = MAX_TEXT): string {
  return String(value ?? "").trim().slice(0, max);
}

function finite(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nullableFinite(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  return finite(value);
}

function isoOrNull(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function validateSettings(value: unknown): Settings | null {
  if (!isRecord(value)) return null;
  const result: Settings = {
    buildingName: clampText(value.buildingName, 160) || "KÜ Kauge 32 infoekraan",
    buildingAddress: clampText(value.buildingAddress, 200),
    weatherLocation: clampText(value.weatherLocation, 100) || "Viljandi",
    timeZone: clampText(value.timeZone, 80) || "Europe/Tallinn",
  };
  const station = clampText(value.weatherStationName, 100);
  if (station) result.weatherStationName = station;
  const latitude = nullableFinite(value.weatherLatitude);
  const longitude = nullableFinite(value.weatherLongitude);
  if (latitude !== null) result.weatherLatitude = latitude;
  if (longitude !== null) result.weatherLongitude = longitude;
  return result;
}

/**
 * Tuletab id-ta teatele stabiilse id. Varem kasutati `crypto.randomUUID()`, mis
 * andis igal valideerimisel uue id, nii et `NoticesPanel` kaotas iga
 * sünkroonimise järel oma koha rotatsioonis ja hüppas tagasi esimesele leheküljele.
 */
function derivedNoticeId(title: string, body: string): string {
  let hash = 2166136261;
  const source = `${title}\u0000${body}`;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `n${(hash >>> 0).toString(36)}`;
}

function validateNotice(value: unknown): Notice | null {
  if (!isRecord(value)) return null;
  const title = clampText(value.title, 300) || "Info";
  const body = clampText(value.body, MAX_BODY);
  return {
    id: clampText(value.id, 100) || derivedNoticeId(title, body),
    title,
    body,
    type: ["info", "warning", "danger", "success"].includes(String(value.type)) ? String(value.type) : "info",
    priority: finite(value.priority) ?? 100,
    start: isoOrNull(value.start),
    end: isoOrNull(value.end),
  };
}

function validateContact(value: unknown): Contact | null {
  if (!isRecord(value)) return null;
  const phone = clampText(value.phone, 80);
  const name = clampText(value.name, 160);
  const role = clampText(value.role, 160);
  return phone || name || role ? { role, name, phone } : null;
}

function validateEmergency(value: unknown): EmergencyContact | null {
  if (!isRecord(value)) return null;
  const name = clampText(value.name, 160);
  const phone = clampText(value.phone, 80);
  const note = clampText(value.note, 300);
  return name || phone || note ? { name, phone, note, priority: finite(value.priority) ?? 100 } : null;
}

function validateWaste(value: unknown): WasteItem | null {
  if (!isRecord(value)) return null;
  const type = clampText(value.type, 160);
  if (!type) return null;
  return {
    type,
    date: clampText(value.date, 40) || null,
    note: clampText(value.note, 300),
    frequency: clampText(value.frequency, 160),
  };
}

function validateWeatherCurrent(value: unknown): WeatherCurrent | null {
  if (!isRecord(value)) return null;
  const temperature = finite(value.temperature);
  const apparentTemperature = finite(value.apparentTemperature);
  const weatherCode = finite(value.weatherCode);
  const windSpeed = finite(value.windSpeed);
  if (temperature === null || apparentTemperature === null || weatherCode === null || windSpeed === null) return null;
  const result: WeatherCurrent = { temperature, apparentTemperature, weatherCode, windSpeed };
  const optionalNumbers: Array<[keyof WeatherCurrent, unknown]> = [
    ["relativeHumidity", value.relativeHumidity],
    ["latitude", value.latitude],
    ["longitude", value.longitude],
    ["modelTemperature", value.modelTemperature],
    ["stationDistanceKm", value.stationDistanceKm],
  ];
  for (const [key, raw] of optionalNumbers) {
    const number = nullableFinite(raw);
    if (number !== null) (result as unknown as Record<string, unknown>)[key] = number;
  }
  for (const key of ["time", "observedAt", "stationName", "source", "sourceName"] as const) {
    const text = clampText(value[key], 160);
    if (text) result[key] = text;
  }
  const rawPhenomenon = clampText(value.phenomenonRaw || value.phenomenon, 160);
  const phenomenon = weatherPhenomenonEt(rawPhenomenon);
  if (phenomenon) result.phenomenon = phenomenon;
  if (rawPhenomenon) result.phenomenonRaw = rawPhenomenon;
  return result;
}

function validateWeatherDaily(value: unknown): WeatherDaily | null {
  if (!isRecord(value)) return null;
  const weatherCode = finite(value.weatherCode);
  const max = finite(value.max);
  const min = finite(value.min);
  const precipitationProbability = finite(value.precipitationProbability);
  const date = clampText(value.date, 20);
  if (!date || weatherCode === null || max === null || min === null || precipitationProbability === null) return null;
  return {
    date,
    weatherCode,
    max,
    min,
    precipitationProbability,
    sunrise: clampText(value.sunrise, 20),
    sunset: clampText(value.sunset, 20),
  };
}

function validateWeather(value: unknown): WeatherData | null {
  if (!isRecord(value)) return null;
  const current = validateWeatherCurrent(value.current);
  if (!current) return null;
  const daily = Array.isArray(value.daily) ? value.daily.map(validateWeatherDaily).filter((item): item is WeatherDaily => item !== null).slice(0, 7) : [];
  const result: WeatherData = { current, daily };
  const source = clampText(value.source, 160);
  const forecastSource = clampText(value.forecastSource, 160);
  if (source) result.source = source;
  if (forecastSource) result.forecastSource = forecastSource;
  const latitude = nullableFinite(value.latitude);
  const longitude = nullableFinite(value.longitude);
  if (latitude !== null) result.latitude = latitude;
  if (longitude !== null) result.longitude = longitude;
  return result;
}

function validateHouseMonth(value: unknown): HouseMonth | null {
  if (!isRecord(value)) return null;
  const year = finite(value.year);
  const month = finite(value.month);
  if (year === null || month === null || month < 1 || month > 12) return null;
  return {
    year: Math.trunc(year),
    month: Math.trunc(month),
    monthName: clampText(value.monthName, 40),
    key: clampText(value.key, 20) || `${year}-${String(month).padStart(2, "0")}`,
    waterM3: nullableFinite(value.waterM3),
    heatMWh: nullableFinite(value.heatMWh),
    electricityKWh: nullableFinite(value.electricityKWh),
    solarKWh: nullableFinite(value.solarKWh),
  };
}

function validateHouse(value: unknown): HouseData | null {
  if (!isRecord(value) || !Array.isArray(value.months)) return null;
  const months = value.months.map(validateHouseMonth).filter((item): item is HouseMonth => item !== null);
  const result: HouseData = { months };
  const source = clampText(value.source, 160);
  if (source) result.source = source;
  return result;
}

function validateElectricityPoint(value: unknown): ElectricityPoint | null {
  if (!isRecord(value)) return null;
  const time = clampText(value.time, 80);
  const price = finite(value.price);
  if (!time || price === null || Number.isNaN(Date.parse(time))) return null;
  const result: ElectricityPoint = { time, price };
  if (value.tariffType === "day" || value.tariffType === "night") result.tariffType = value.tariffType;
  const label = clampText(value.tariffLabelEt, 80);
  if (label) result.tariffLabelEt = label;
  return result;
}

function validateElectricity(value: unknown, problems: string[]): ElectricityData | null {
  if (!isRecord(value)) return null;
  if (value.unit !== "s/kWh" && value.unit !== "€/kWh" && value.unit !== "€/MWh") {
    problems.push("Elektrihinna ühik puudub või ei ole toetatud");
    return null;
  }
  const points = Array.isArray(value.points)
    ? value.points.map(validateElectricityPoint).filter((item): item is ElectricityPoint => item !== null).slice(0, 192)
    : [];
  if (!points.length) return null;
  const result: ElectricityData = {
    date: clampText(value.date, 20),
    unit: value.unit,
    points,
  };
  const zone = clampText(value.zone, 20);
  if (zone) result.zone = zone;
  if (typeof value.includesVat === "boolean") result.includesVat = value.includesVat;
  for (const key of ["currentPrice", "min", "average", "max"] as const) {
    const number = nullableFinite(value[key]);
    if (number !== null) result[key] = number;
  }
  if (value.currentTariffType === "day" || value.currentTariffType === "night") result.currentTariffType = value.currentTariffType;
  const label = clampText(value.currentTariffLabelEt, 80);
  if (label) result.currentTariffLabelEt = label;
  const source = clampText(value.source, 160);
  const tariffSource = clampText(value.tariffSource, 160);
  if (source) result.source = source;
  if (tariffSource) result.tariffSource = tariffSource;
  if (isRecord(value.tariff)) result.tariff = value.tariff;
  return result;
}

function validateFuel(value: unknown): FuelData | null {
  if (!isRecord(value)) return null;
  const petrol95 = nullableFinite(value.petrol95);
  const petrol98 = nullableFinite(value.petrol98);
  const diesel = nullableFinite(value.diesel);
  if (petrol95 === null && petrol98 === null && diesel === null) return null;
  const result: FuelData = {
    petrol95,
    petrol98,
    diesel,
    unit: clampText(value.unit, 30) || "EUR/l",
  };
  const bulletinDate = clampText(value.bulletinDate, 20);
  const displayDate = clampText(value.displayDate, 20);
  const source = clampText(value.source, 160);
  const note = clampText(value.note, 300);
  if (bulletinDate) result.bulletinDate = bulletinDate;
  if (displayDate) result.displayDate = displayDate;
  if (source) result.source = source;
  if (note) result.note = note;
  return result;
}

function validateEuriborPoint(value: unknown): EuriborPoint | null {
  if (!isRecord(value)) return null;
  const date = clampText(value.date, 20);
  const number = finite(value.value);
  return date && number !== null ? { date, value: number } : null;
}

function validateEuribor(value: unknown): EuriborData | null {
  if (!isRecord(value)) return null;
  const latest = finite(value.latest);
  const latestDate = clampText(value.latestDate, 20);
  if (latest === null || !latestDate) return null;
  const points = Array.isArray(value.points)
    ? value.points.map(validateEuriborPoint).filter((item): item is EuriborPoint => item !== null).slice(-200)
    : [];
  const result: EuriborData = {
    tenor: clampText(value.tenor, 20) || "6M",
    unit: clampText(value.unit, 20) || "%",
    latest,
    latestDate,
    points,
  };
  const source = clampText(value.source, 160);
  const note = clampText(value.note, 300);
  if (source) result.source = source;
  if (note) result.note = note;
  return result;
}

function validateMeta(value: unknown): SectionMeta | null {
  if (!isRecord(value)) return null;
  const result: SectionMeta = { ok: value.ok === true };
  const updatedAt = isoOrNull(value.updatedAt);
  if (updatedAt) result.updatedAt = updatedAt;
  const error = clampText(value.error, 500);
  if (error) result.error = error;
  if (value.missing === true) result.missing = true;
  if (Array.isArray(value.warnings)) result.warnings = value.warnings.map((item) => clampText(item, 500)).filter(Boolean).slice(0, 20);
  return result;
}

const ARRAY_VALIDATORS: Partial<Record<SectionName, (value: unknown) => unknown>> = {
  notices: (value) => (Array.isArray(value) ? value.map(validateNotice).filter((item): item is Notice => item !== null) : null),
  contacts: (value) => (Array.isArray(value) ? value.map(validateContact).filter((item): item is Contact => item !== null) : null),
  emergency: (value) => (Array.isArray(value) ? value.map(validateEmergency).filter((item): item is EmergencyContact => item !== null) : null),
  waste: (value) => (Array.isArray(value) ? value.map(validateWaste).filter((item): item is WasteItem => item !== null) : null),
};

export function validateDashboardPayload(input: unknown): ValidationResult<IncomingDashboardPayload> {
  const problems: string[] = [];
  if (!isRecord(input)) return { value: null, problems: ["Serverivastus ei ole objekt"] };
  const sections: Partial<Record<SectionName, SectionMeta>> = {};
  const rawSections = isRecord(input.sections) ? input.sections : {};
  for (const name of SECTION_NAMES) {
    const meta = validateMeta(rawSections[name]);
    if (meta) sections[name] = meta;
  }
  const output: IncomingDashboardPayload = {
    ok: input.ok !== false,
    updatedAt: isoOrNull(input.updatedAt),
    sections,
  };
  const settings = validateSettings(input.settings);
  if (settings) output.settings = settings;

  for (const name of ["notices", "contacts", "emergency", "waste"] as const) {
    const raw = input[name];
    const validated = ARRAY_VALIDATORS[name]?.(raw);
    if (Array.isArray(validated)) output[name] = validated as never;
    else if (Object.prototype.hasOwnProperty.call(input, name)) problems.push(`${name}: oodati massiivi`);
  }
  const objectSections: Array<["weather" | "house" | "fuel" | "euribor", (value: unknown) => unknown]> = [
    ["weather", validateWeather],
    ["house", validateHouse],
    ["fuel", validateFuel],
    ["euribor", validateEuribor],
  ];
  for (const [name, validator] of objectSections) {
    if (!Object.prototype.hasOwnProperty.call(input, name)) continue;
    const value = validator(input[name]);
    if (value) output[name] = value as never;
    else if (input[name] !== null) problems.push(`${name}: vigane väärtus`);
  }
  if (Object.prototype.hasOwnProperty.call(input, "electricity")) {
    const value = validateElectricity(input.electricity, problems);
    if (value) output.electricity = value;
  }
  return { value: output, problems };
}

function textRecord<T extends string>(value: unknown, max: number): Partial<Record<T, string>> {
  if (!isRecord(value)) return {};
  const result: Partial<Record<T, string>> = {};
  for (const name of SECTION_NAMES) {
    const text = clampText(value[name], max);
    if (text) result[name as T] = text;
  }
  return result;
}

function warningRecord(value: unknown): Partial<Record<SectionName, string[]>> {
  if (!isRecord(value)) return {};
  const result: Partial<Record<SectionName, string[]>> = {};
  for (const name of SECTION_NAMES) {
    const raw = value[name];
    if (!Array.isArray(raw)) continue;
    const warnings = raw.map((item) => clampText(item, 500)).filter(Boolean).slice(0, 20);
    if (warnings.length) result[name] = warnings;
  }
  return result;
}

/**
 * Valideerib IndexedDB-st loetud hetktõmmise. See on ainus andmetee, mis elab üle
 * brauseri taaskäivituse, ja seetõttu ka ainus, mille sisu ei ole kunagi nähtud
 * `validateDashboardPayload`-i poolt enne salvestamist — vahemälu võib olla
 * kirjutatud vanema versiooni poolt, poolikult või rikutud.
 *
 * Varem valideeriti siin sisend ära ja tagastati siis ikkagi valideerimata
 * toorobjekt, nii et kogu kontroll oli sisuliselt olematu: vigane vahemälu
 * jõudis otse paneelidesse, viskas esimesel renderdusel erindi ja jättis kioski
 * tühjale ekraanile ilma uue sünkroonimiskatseta.
 */
export function validateCachedDashboard(input: unknown): DashboardData | null {
  if (!isRecord(input) || Array.isArray(input)) return null;
  const validated = validateDashboardPayload(input);
  const payload = validated.value;
  if (!payload) return null;
  return {
    ok: true,
    updatedAt: payload.updatedAt,
    ...(typeof input.cachedAt === "string" ? { cachedAt: clampText(input.cachedAt, 40) } : {}),
    settings: payload.settings ?? validateSettings({}) ?? {
      buildingName: "KÜ Kauge 32 infoekraan",
      buildingAddress: "",
      weatherLocation: "Viljandi",
      timeZone: "Europe/Tallinn",
    },
    sections: payload.sections,
    sectionUpdatedAt: textRecord(input.sectionUpdatedAt, 40),
    sectionErrors: textRecord(input.sectionErrors, 500),
    sectionWarnings: warningRecord(input.sectionWarnings),
    notices: payload.notices ?? [],
    contacts: payload.contacts ?? [],
    emergency: payload.emergency ?? [],
    waste: payload.waste ?? [],
    weather: payload.weather ?? null,
    house: payload.house ?? null,
    electricity: payload.electricity ?? null,
    fuel: payload.fuel ?? null,
    euribor: payload.euribor ?? null,
  };
}
