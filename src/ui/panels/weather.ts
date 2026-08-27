import type { DashboardData, WeatherData } from "../../data/types";
import { weatherPhenomenonEt } from "../../domain/weather/phenomenon";
import { capitalizeFirst, validDate } from "../../domain/time/zoned";
import { createElement, formatNumber, requireElement, setHidden, setText } from "../dom";
import { reconcileChildren } from "../reconcile";
import { formatDateValue, updateSectionStale, weatherMeta } from "./helpers";
import type { Panel } from "./panel";

export interface WeatherSlice {
  data: DashboardData;
  timeZone: string;
}

function observedTime(weather: WeatherData, timeZone: string): string {
  const value = weather.current.observedAt || weather.current.time;
  const date = validDate(value);
  if (date)
    return new Intl.DateTimeFormat("et-EE", { timeZone, hour: "2-digit", minute: "2-digit" }).format(date);
  const match = String(value || "").match(/T(\d{2}:\d{2})/);
  return match?.[1] ?? "";
}

interface WeatherNodes {
  root: HTMLElement;
  icon: HTMLElement;
  temperature: HTMLElement;
  description: HTMLElement;
  stats: HTMLElement;
  forecast: HTMLElement;
  sunRow: HTMLElement;
  sunrise: HTMLElement;
  sunset: HTMLElement;
}

/**
 * Ilmapaneel ehitati varem iga uuendusega nullist üles. `status`-versioon kasvab
 * igal sünkroonimisel (sektsioonide `updatedAt` muutub), nii et ~30 sõlme visati
 * ära ja loodi uuesti iga viie minuti tagant, ilma et sisu oleks muutunud.
 * Skelett ehitatakse nüüd korra ja väärtused kirjutatakse kohapeal.
 */
export class WeatherPanel implements Panel<WeatherSlice> {
  private area!: HTMLElement;
  private place!: HTMLElement;
  private mounted = false;
  private nodes: WeatherNodes | null = null;
  private empty: HTMLElement | null = null;

  mount(): void {
    if (this.mounted) return;
    this.area = requireElement("weatherArea");
    this.place = requireElement("weatherPlace");
    this.mounted = true;
  }

  update(slice: WeatherSlice): void {
    this.mount();
    updateSectionStale(slice.data, "weather", "weatherStale", "ilmaandmed kell", slice.timeZone);
    const weather = slice.data.weather;
    if (!weather?.current) {
      setText(this.place, slice.data.settings.weatherLocation || "Viljandi");
      this.showEmpty();
      return;
    }
    this.renderMeta(weather, slice);
    const nodes = this.ensureNodes();

    const [fallbackDescription, icon] = weatherMeta(weather.current.weatherCode);
    setText(nodes.icon, icon);
    setText(
      nodes.temperature,
      Number.isFinite(weather.current.temperature)
        ? `${formatNumber(weather.current.temperature, 1)}°`
        : "–°",
    );
    const translated = weatherPhenomenonEt(weather.current.phenomenon || weather.current.phenomenonRaw);
    setText(nodes.description, translated || fallbackDescription);

    const stats = [
      [
        "Tajutav temperatuur",
        Number.isFinite(weather.current.apparentTemperature)
          ? `${formatNumber(weather.current.apparentTemperature, 1)}°`
          : "–",
      ],
      [
        "Tuul",
        Number.isFinite(weather.current.windSpeed)
          ? `${formatNumber(weather.current.windSpeed, 1)} m/s`
          : "–",
      ],
    ] as const;
    reconcileChildren(
      nodes.stats,
      stats,
      () => {
        const item = createElement("div", "weather-stat");
        item.append(createElement("span"), createElement("strong", "numeric"));
        return item;
      },
      (item, [label, value]) => {
        setText(item.firstElementChild as HTMLElement, label);
        setText(item.lastElementChild as HTMLElement, value);
      },
    );

    reconcileChildren(
      nodes.forecast,
      weather.daily.slice(1, 4),
      () => {
        const item = createElement("div", "forecast-day numeric");
        item.append(
          createElement("div", "d"),
          createElement("div", "i"),
          createElement("div", "t"),
          createElement("div", "rain"),
        );
        return item;
      },
      (item, day) => {
        const [weekday, dayIconNode, range, rain] = item.children as unknown as [
          HTMLElement,
          HTMLElement,
          HTMLElement,
          HTMLElement,
        ];
        const [, dayIcon] = weatherMeta(day.weatherCode);
        setText(weekday, capitalizeFirst(formatDateValue(day.date, "weekdayShort", slice.timeZone)));
        setText(dayIconNode, dayIcon);
        setText(range, `${Math.round(day.min)}° / ${Math.round(day.max)}°`);
        setText(
          rain,
          Number.isFinite(day.precipitationProbability)
            ? `Sadu ${Math.round(day.precipitationProbability)}%`
            : "Sadu –",
        );
      },
    );

    const today = weather.daily[0];
    const hasSun = Boolean(today && (today.sunrise || today.sunset));
    setHidden(nodes.sunRow, !hasSun);
    if (hasSun && today) {
      setText(nodes.sunrise, today.sunrise || "–");
      setText(nodes.sunset, today.sunset || "–");
    }
  }

  destroy(): void {
    this.mounted = false;
    this.nodes = null;
    this.empty = null;
  }

  private showEmpty(): void {
    this.nodes = null;
    if (this.empty && this.empty.parentNode === this.area && this.area.childElementCount === 1) return;
    this.empty = createElement("div", "empty", "Ilmaandmed ilmuvad pärast esimest edukat sünkroonimist.");
    this.area.replaceChildren(this.empty);
  }

  private ensureNodes(): WeatherNodes {
    if (this.nodes && this.nodes.root.parentNode === this.area) return this.nodes;
    this.empty = null;
    const current = createElement("div", "weather-current");
    const icon = createElement("div", "weather-icon");
    const text = createElement("div");
    const temperature = createElement("div", "weather-temp numeric");
    const description = createElement("div", "weather-desc");
    text.append(temperature, description);
    current.append(icon, text);

    const stats = createElement("div", "weather-stats");
    const forecast = createElement("div", "forecast");
    const sunRow = createElement("div", "sun-row numeric");
    const sunrise = this.sunItem(sunRow, "☀ tõuseb");
    const sunset = this.sunItem(sunRow, "☾ loojub");

    this.area.replaceChildren(current, stats, forecast, sunRow);
    this.nodes = { root: current, icon, temperature, description, stats, forecast, sunRow, sunrise, sunset };
    return this.nodes;
  }

  private renderMeta(weather: WeatherData, slice: WeatherSlice): void {
    const measured = weather.current.source === "keskkonnaagentuur";
    const station = weather.current.stationName?.trim();
    const location = slice.data.settings.weatherLocation || "Viljandi";
    const source = measured ? "Keskkonnaagentuur" : "Open-Meteo";
    setText(
      this.place,
      [measured ? station || location : location, source, observedTime(weather, slice.timeZone)]
        .filter(Boolean)
        .join(" · "),
    );
  }

  private sunItem(parent: HTMLElement, label: string): HTMLElement {
    const item = createElement("span", "sun-item");
    const value = createElement("strong", "sun-time numeric", "–");
    item.append(createElement("span", undefined, label), value);
    parent.appendChild(item);
    return value;
  }
}
