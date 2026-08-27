import type { DashboardData, WeatherData } from "../../data/types";
import { weatherPhenomenonEt } from "../../domain/weather/phenomenon";
import { capitalizeFirst, validDate } from "../../domain/time/zoned";
import { clearElement, createElement, formatNumber, requireElement, setText } from "../dom";
import { formatDateValue, updateSectionStale, weatherMeta } from "./helpers";
import type { Panel } from "./panel";

export interface WeatherSlice {
  data: DashboardData;
  timeZone: string;
}

function observedTime(weather: WeatherData, timeZone: string): string {
  const value = weather.current.observedAt || weather.current.time;
  const date = validDate(value);
  if (date) return new Intl.DateTimeFormat("et-EE", { timeZone, hour: "2-digit", minute: "2-digit" }).format(date);
  const match = String(value || "").match(/T(\d{2}:\d{2})/);
  return match?.[1] ?? "";
}

export class WeatherPanel implements Panel<WeatherSlice> {
  private area!: HTMLElement;
  private place!: HTMLElement;
  private mounted = false;

  mount(): void {
    if (this.mounted) return;
    this.area = requireElement("weatherArea");
    this.place = requireElement("weatherPlace");
    this.mounted = true;
  }

  update(slice: WeatherSlice): void {
    this.mount();
    clearElement(this.area);
    updateSectionStale(slice.data, "weather", "weatherStale", "ilmaandmed kell", slice.timeZone);
    const weather = slice.data.weather;
    if (!weather?.current) {
      setText(this.place, slice.data.settings.weatherLocation || "Viljandi");
      this.area.appendChild(createElement("div", "empty", "Ilmaandmed ilmuvad pärast esimest edukat sünkroonimist."));
      return;
    }
    this.renderMeta(weather, slice);
    const [fallbackDescription, icon] = weatherMeta(weather.current.weatherCode);
    const current = createElement("div", "weather-current");
    const iconElement = createElement("div", "weather-icon", icon);
    const text = createElement("div");
    const temperature = createElement("div", "weather-temp numeric", Number.isFinite(weather.current.temperature) ? `${formatNumber(weather.current.temperature, 1)}°` : "–°");
    const translated = weatherPhenomenonEt(weather.current.phenomenon || weather.current.phenomenonRaw);
    const description = createElement("div", "weather-desc", translated || fallbackDescription);
    text.append(temperature, description);
    current.append(iconElement, text);

    const stats = createElement("div", "weather-stats");
    for (const [label, value] of [
      ["Tajutav temperatuur", Number.isFinite(weather.current.apparentTemperature) ? `${formatNumber(weather.current.apparentTemperature, 1)}°` : "–"],
      ["Tuul", Number.isFinite(weather.current.windSpeed) ? `${formatNumber(weather.current.windSpeed, 1)} m/s` : "–"],
    ]) {
      const item = createElement("div", "weather-stat");
      item.append(createElement("span", undefined, label), createElement("strong", "numeric", value));
      stats.appendChild(item);
    }

    const forecast = createElement("div", "forecast");
    for (const day of weather.daily.slice(1, 4)) {
      const [, dayIcon] = weatherMeta(day.weatherCode);
      const item = createElement("div", "forecast-day numeric");
      item.append(
        createElement("div", "d", capitalizeFirst(formatDateValue(day.date, "weekdayShort", slice.timeZone))),
        createElement("div", "i", dayIcon),
        createElement("div", "t", `${Math.round(day.min)}° / ${Math.round(day.max)}°`),
        createElement("div", "rain", Number.isFinite(day.precipitationProbability) ? `Sadu ${Math.round(day.precipitationProbability)}%` : "Sadu –"),
      );
      forecast.appendChild(item);
    }

    this.area.append(current, stats, forecast);
    const today = weather.daily[0];
    if (today && (today.sunrise || today.sunset)) {
      const sun = createElement("div", "sun-row numeric");
      sun.append(this.sunItem("☀ tõuseb", today.sunrise), this.sunItem("☾ loojub", today.sunset));
      this.area.appendChild(sun);
    }
  }

  destroy(): void {
    this.mounted = false;
  }

  private renderMeta(weather: WeatherData, slice: WeatherSlice): void {
    const measured = weather.current.source === "keskkonnaagentuur";
    const station = weather.current.stationName?.trim();
    const location = slice.data.settings.weatherLocation || "Viljandi";
    const source = measured ? "Keskkonnaagentuur" : "Open-Meteo";
    setText(this.place, [measured ? station || location : location, source, observedTime(weather, slice.timeZone)].filter(Boolean).join(" · "));
  }

  private sunItem(label: string, value: string): HTMLElement {
    const item = createElement("span", "sun-item");
    item.append(createElement("span", undefined, label), createElement("strong", "sun-time numeric", value || "–"));
    return item;
  }
}
