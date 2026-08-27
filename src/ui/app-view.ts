import type { AppState } from "../app/store";
import type { RuntimeConfig } from "../config/config-schema";
import { BUS_TIMETABLE } from "../data/bus-timetable";
import type { SectionVersions } from "../data/types";
import { busScheduleStatus } from "../domain/bus/schedule-status";
import { zonedParts } from "../domain/time/zoned";
import { DebugOverlay } from "./debug-overlay";
import { requireElement, setHidden, setText } from "./dom";
import { BusesPanel } from "./panels/buses";
import { ClockPanel } from "./panels/clock";
import { ContactsPanel } from "./panels/contacts";
import { EmergencyPanel } from "./panels/emergency";
import { HousePanel } from "./panels/house";
import { MarketElectricityPanel } from "./panels/market-electricity";
import { MarketEuriborPanel } from "./panels/market-euribor";
import { MarketFuelPanel } from "./panels/market-fuel";
import { MarketSummaryPanel } from "./panels/market-summary";
import { NoticesPanel } from "./panels/notices";
import { StaleBannerPanel } from "./panels/stale-banner";
import { StatusBarPanel } from "./panels/status-bar";
import { WastePanel } from "./panels/waste";
import { WeatherPanel } from "./panels/weather";

const EMPTY_VERSIONS: SectionVersions = {
  settings: -1,
  notices: -1,
  contacts: -1,
  emergency: -1,
  waste: -1,
  weather: -1,
  house: -1,
  electricity: -1,
  fuel: -1,
  euribor: -1,
  status: -1,
};

export class AppView {
  readonly notices = new NoticesPanel();
  readonly buses = new BusesPanel();
  readonly waste = new WastePanel();
  readonly contacts = new ContactsPanel();
  readonly emergency = new EmergencyPanel();
  readonly weather = new WeatherPanel();
  readonly house = new HousePanel();
  readonly electricity = new MarketElectricityPanel();
  readonly fuel = new MarketFuelPanel();
  readonly euribor = new MarketEuriborPanel();
  readonly marketSummary = new MarketSummaryPanel();
  readonly statusBar = new StatusBarPanel();
  readonly staleBanner = new StaleBannerPanel();
  readonly clock = new ClockPanel();
  readonly debug = new DebugOverlay();

  private versions: SectionVersions = { ...EMPTY_VERSIONS };
  private state!: AppState;
  private lastMinuteKey = "";
  private lastDateKey = "";

  constructor(
    private readonly config: RuntimeConfig,
    private readonly debugMode: boolean,
    private readonly schedulerNames: () => string[],
    private readonly onWasteWarnings: (warnings: string[]) => void,
  ) {}

  mount(): void {
    this.notices.mount();
    this.buses.mount();
    this.waste.mount();
    this.contacts.mount();
    this.emergency.mount();
    this.weather.mount();
    this.house.mount();
    this.electricity.mount();
    this.fuel.mount();
    this.euribor.mount();
    this.marketSummary.mount();
    this.statusBar.mount();
    this.staleBanner.mount();
    this.clock.mount();
    this.debug.mount();
  }

  update(next: AppState, force = false): void {
    this.state = next;
    const previousVersions = this.versions;
    // Salvesta versioonid enne paneelide uuendamist. Mõni paneel võib teatada
    // valideerimishoiatusest store'i kaudu; varajane salvestus väldib reentrantset
    // sama sektsiooni renderdust ja lõpmatut kutseahelat.
    this.versions = { ...next.versions };
    const timeZone = next.data.settings.timeZone || this.config.timeZone;
    const now = new Date();
    if (force || next.versions.settings !== previousVersions.settings) this.updateStaticHeader(next);
    if (force || next.versions.notices !== previousVersions.notices) {
      this.notices.update({
        items: next.data.notices,
        now,
        rotationMs: this.config.noticeRotationSeconds * 1000,
      });
    }
    if (
      force ||
      next.versions.weather !== previousVersions.weather ||
      next.versions.status !== previousVersions.status
    ) {
      this.weather.update({ data: next.data, timeZone });
    }
    if (
      force ||
      next.versions.house !== previousVersions.house ||
      next.versions.status !== previousVersions.status
    ) {
      this.house.update({ data: next.data, timeZone });
    }
    if (force || next.versions.waste !== previousVersions.waste) this.updateWaste(now, timeZone);
    if (force || next.versions.contacts !== previousVersions.contacts) {
      this.contacts.update({
        items: next.data.contacts,
        pageSize: this.config.maxContacts,
        nowMs: now.getTime(),
        rotationMs: this.config.listRotationSeconds * 1000,
      });
    }
    if (force || next.versions.emergency !== previousVersions.emergency) {
      this.emergency.update({
        items: next.data.emergency,
        pageSize: this.config.maxEmergency,
        nowMs: now.getTime(),
        rotationMs: this.config.listRotationSeconds * 1000,
      });
    }
    if (
      force ||
      next.versions.electricity !== previousVersions.electricity ||
      next.versions.status !== previousVersions.status
    ) {
      this.electricity.update({ data: next.data, now, timeZone });
    }
    if (
      force ||
      next.versions.fuel !== previousVersions.fuel ||
      next.versions.status !== previousVersions.status
    )
      this.fuel.update({ data: next.data, timeZone });
    if (
      force ||
      next.versions.euribor !== previousVersions.euribor ||
      next.versions.status !== previousVersions.status
    )
      this.euribor.update({ data: next.data, timeZone });
    if (force || next.versions.status !== previousVersions.status) this.marketSummary.update(next.data);
    this.statusBar.update({ state: next, config: this.config, timeZone });
    this.staleBanner.update({ data: next.data, nowMs: now.getTime() });
    this.buses.update({ timetable: BUS_TIMETABLE, now, config: { ...this.config, timeZone } });
    this.clock.update({ now, timeZone, config: this.config });
    this.updateDebug();
  }

  tickClock(now = new Date()): void {
    if (!this.state) return;
    const timeZone = this.state.data.settings.timeZone || this.config.timeZone;
    this.clock.update({ now, timeZone, config: this.config });
  }

  tickTimeSensitive(now = new Date()): void {
    if (!this.state) return;
    const timeZone = this.state.data.settings.timeZone || this.config.timeZone;
    this.notices.tick(now);
    this.contacts.tick(now);
    this.emergency.tick(now);
    this.house.tick(now);
    this.waste.tick(now);
    const parts = zonedParts(now, timeZone);
    const minuteKey = `${parts.year}-${parts.month}-${parts.day}-${parts.hour}-${parts.minute}`;
    const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
    if (minuteKey !== this.lastMinuteKey) {
      this.lastMinuteKey = minuteKey;
      this.buses.update({ timetable: BUS_TIMETABLE, now, config: { ...this.config, timeZone } });
      this.electricity.update({ data: this.state.data, now, timeZone });
    }
    if (dateKey !== this.lastDateKey) {
      this.lastDateKey = dateKey;
      this.notices.update({
        items: this.state.data.notices,
        now,
        rotationMs: this.config.noticeRotationSeconds * 1000,
      });
      this.updateWaste(now, timeZone);
      this.staleBanner.update({ data: this.state.data, nowMs: now.getTime() });
    }
  }

  updateDebug(): void {
    if (!this.state) return;
    // Ilma selle väravata arvutati bussigraafiku olek ja ajavööndi osad iga 10 s
    // ja iga oleku uuenduse peale ka siis, kui overlay on välja lülitatud.
    if (!this.debugMode) {
      this.debug.update({
        state: this.state,
        config: this.config,
        enabled: false,
        schedulerNames: [],
        busDebug: "",
      });
      return;
    }
    const timeZone = this.state.data.settings.timeZone || this.config.timeZone;
    this.debug.update({
      state: this.state,
      config: this.config,
      enabled: this.debugMode,
      schedulerNames: this.schedulerNames(),
      busDebug: busScheduleStatus(BUS_TIMETABLE, zonedParts(new Date(), timeZone)).debugText,
    });
  }

  invalidateLayout(): void {
    this.notices.invalidateLayout();
  }

  destroy(): void {
    this.notices.destroy();
    this.buses.destroy();
    this.waste.destroy();
    this.contacts.destroy();
    this.emergency.destroy();
    this.weather.destroy();
    this.house.destroy();
    this.electricity.destroy();
    this.fuel.destroy();
    this.euribor.destroy();
    this.marketSummary.destroy();
    this.statusBar.destroy();
    this.staleBanner.destroy();
    this.clock.destroy();
    this.debug.destroy();
  }

  private updateStaticHeader(state: AppState): void {
    const settings = state.data.settings;
    setText(requireElement("buildingName"), settings.buildingName || "KÜ Kauge 32 infoekraan");
    const address = requireElement("buildingAddress");
    setText(address, settings.buildingAddress || "");
    setHidden(address, !settings.buildingAddress.trim());
    setText(requireElement("weatherPlace"), settings.weatherLocation || "Viljandi");
    setText(requireElement("wasteWindowLabel"), String(this.config.wasteWindowDays));
    setText(
      requireElement("buildLabel"),
      `v${this.config.buildVersion || "dev"} · ${this.config.buildDate || "–"}`,
    );
  }

  private updateWaste(now: Date, timeZone: string): void {
    this.waste.update({
      items: this.state.data.waste,
      now,
      timeZone,
      windowDays: this.config.wasteWindowDays,
      pageSize: this.config.maxWaste,
      rotationMs: this.config.listRotationSeconds * 1000,
      onWarnings: this.onWasteWarnings,
    });
  }
}
