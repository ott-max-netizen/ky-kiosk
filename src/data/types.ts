import type { HouseMonth } from "../domain/house/consumption";
import type { NoticeLike } from "../domain/notices/active";
import type { WasteItem } from "../domain/waste/occurrences";

export const SECTION_NAMES = [
  "notices",
  "contacts",
  "emergency",
  "waste",
  "weather",
  "house",
  "electricity",
  "fuel",
  "euribor",
] as const;

export type SectionName = (typeof SECTION_NAMES)[number];

export interface Settings {
  buildingName: string;
  buildingAddress: string;
  weatherLocation: string;
  weatherStationName?: string;
  weatherLatitude?: number;
  weatherLongitude?: number;
  timeZone: string;
}

export interface Notice extends NoticeLike {}

export interface Contact {
  role: string;
  name: string;
  phone: string;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  note: string;
  priority: number;
}

export interface WeatherCurrent {
  temperature: number;
  apparentTemperature: number;
  weatherCode: number;
  windSpeed: number;
  relativeHumidity?: number;
  time?: string;
  observedAt?: string;
  stationName?: string;
  source?: string;
  sourceName?: string;
  phenomenon?: string;
  phenomenonRaw?: string;
  latitude?: number;
  longitude?: number;
  modelTemperature?: number;
  stationDistanceKm?: number;
}

export interface WeatherDaily {
  date: string;
  weatherCode: number;
  max: number;
  min: number;
  precipitationProbability: number;
  sunrise: string;
  sunset: string;
}

export interface WeatherData {
  current: WeatherCurrent;
  daily: WeatherDaily[];
  source?: string;
  forecastSource?: string;
  latitude?: number;
  longitude?: number;
}

export interface HouseData {
  source?: string;
  months: HouseMonth[];
}

export interface ElectricityPoint {
  time: string;
  price: number;
  tariffType?: "day" | "night";
  tariffLabelEt?: string;
}

export interface ElectricityData {
  date: string;
  zone?: string;
  unit: "s/kWh" | "€/kWh" | "€/MWh";
  includesVat?: boolean;
  currentPrice?: number;
  currentTariffType?: "day" | "night";
  currentTariffLabelEt?: string;
  min?: number;
  average?: number;
  max?: number;
  points: ElectricityPoint[];
  source?: string;
  tariffSource?: string;
  tariff?: Record<string, unknown>;
}

export interface FuelData {
  bulletinDate?: string;
  displayDate?: string;
  petrol95: number | null;
  petrol98: number | null;
  diesel: number | null;
  unit: string;
  source?: string;
  note?: string;
}

export interface EuriborPoint {
  date: string;
  value: number;
}

export interface EuriborData {
  tenor: string;
  unit: string;
  latest: number;
  latestDate: string;
  points: EuriborPoint[];
  source?: string;
  note?: string;
}

export interface SectionMeta {
  ok: boolean;
  updatedAt?: string;
  error?: string;
  missing?: boolean;
  warnings?: string[];
}

export interface DashboardData {
  ok: boolean;
  updatedAt: string | null;
  cachedAt?: string;
  settings: Settings;
  sections: Partial<Record<SectionName, SectionMeta>>;
  sectionUpdatedAt: Partial<Record<SectionName, string>>;
  sectionErrors: Partial<Record<SectionName, string>>;
  sectionWarnings: Partial<Record<SectionName, string[]>>;
  notices: Notice[];
  contacts: Contact[];
  emergency: EmergencyContact[];
  waste: WasteItem[];
  weather: WeatherData | null;
  house: HouseData | null;
  electricity: ElectricityData | null;
  fuel: FuelData | null;
  euribor: EuriborData | null;
}

export interface IncomingDashboardPayload {
  ok: boolean;
  updatedAt: string | null;
  settings?: Settings;
  sections: Partial<Record<SectionName, SectionMeta>>;
  notices?: Notice[];
  contacts?: Contact[];
  emergency?: EmergencyContact[];
  waste?: WasteItem[];
  weather?: WeatherData | null;
  house?: HouseData | null;
  electricity?: ElectricityData | null;
  fuel?: FuelData | null;
  euribor?: EuriborData | null;
}

export interface SectionVersions {
  settings: number;
  notices: number;
  contacts: number;
  emergency: number;
  waste: number;
  weather: number;
  house: number;
  electricity: number;
  fuel: number;
  euribor: number;
  status: number;
}
