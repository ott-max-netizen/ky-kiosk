import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { busDayType, busSchoolSeasonActive } from "../dist/src/domain/bus/day-type.js";
import { busRelativeLabel, getBusState } from "../dist/src/domain/bus/departures.js";
import { priceToCentsPerKwh } from "../dist/src/domain/electricity/price.js";
import { calculatePurchasePriceCentsPerKwh, electricityTariffType } from "../dist/src/domain/electricity/tariff.js";
import { hasHouseData, lastHouseMonths } from "../dist/src/domain/house/consumption.js";
import { activeNotices } from "../dist/src/domain/notices/active.js";
import { isEstonianPublicHoliday } from "../dist/src/domain/time/holidays.js";
import { addCalendarDays, parseDateOnly } from "../dist/src/domain/time/zoned.js";
import { parseWasteFrequency } from "../dist/src/domain/waste/frequency.js";
import { nextWasteByType } from "../dist/src/domain/waste/occurrences.js";
import { weatherPhenomenonEt } from "../dist/src/domain/weather/phenomenon.js";
import { BUS_TIMETABLE } from "../dist/src/data/bus-timetable.js";
import { createFallbackData, createSectionVersions, mergeIncoming } from "../dist/src/data/merge.js";
import { validateDashboardPayload } from "../dist/src/data/validate.js";
import { MIN_RUNTIME_SCALE } from "../dist/src/config/config-schema.js";

let assertions = 0;
function check(condition, message) {
  assertions += 1;
  assert.ok(condition, message);
}
function equal(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}
function close(actual, expected, epsilon, message) {
  assertions += 1;
  assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: ${actual} != ${expected}`);
}

// Aeg ja pühad.
equal(parseDateOnly("2024-02-29"), { year: 2024, month: 2, day: 29 }, "liigaasta kuupäev");
equal(parseDateOnly("2026-02-30"), null, "vigane kuupäev");
equal(addCalendarDays({ year: 2026, month: 12, day: 31 }, 1), { year: 2027, month: 1, day: 1 }, "aastavahetus");
for (const parts of [
  { year: 2026, month: 1, day: 1 }, { year: 2026, month: 2, day: 24 }, { year: 2026, month: 4, day: 3 },
  { year: 2026, month: 4, day: 5 }, { year: 2026, month: 5, day: 1 }, { year: 2026, month: 5, day: 24 },
  { year: 2026, month: 6, day: 23 }, { year: 2026, month: 6, day: 24 }, { year: 2026, month: 8, day: 20 },
  { year: 2026, month: 12, day: 24 }, { year: 2026, month: 12, day: 25 }, { year: 2026, month: 12, day: 26 },
]) check(isEstonianPublicHoliday(parts), `riigipüha ${JSON.stringify(parts)}`);
check(!isEstonianPublicHoliday({ year: 2026, month: 4, day: 6 }), "2. ülestõusmispüha ei ole riigipüha");

// Bussid.
equal(busDayType({ year: 2026, month: 8, day: 20 }), "sunday", "riigipühal pühapäevagraafik");
check(busSchoolSeasonActive({ year: 2026, month: 9, day: 1 }), "liin 7 hooaja algus kaasav");
check(busSchoolSeasonActive({ year: 2026, month: 6, day: 10 }), "liin 7 hooaja lõpp kaasav");
check(!busSchoolSeasonActive({ year: 2026, month: 6, day: 11 }), "liin 7 suvevaheaeg");
equal(busRelativeLabel({ dayOffset: 0, minutesUntil: 0 }), "väljub nüüd", "buss väljub nüüd");
equal(busRelativeLabel({ dayOffset: 0, minutesUntil: 18 }), "18 min pärast", "bussi minutid");
equal(busRelativeLabel({ dayOffset: 0, minutesUntil: 60 }), "1 h pärast", "bussi täistund");
equal(busRelativeLabel({ dayOffset: 0, minutesUntil: 72 }), "1 h 12 min pärast", "bussi tunnid ja minutid");
const buses = getBusState(BUS_TIMETABLE, new Date("2026-08-24T06:00:00+03:00"));
equal(buses.center.length, 2, "kaks väljumist Kesklinna suunas");
equal(buses.suurKaare.length, 2, "kaks väljumist Suur-Kaare suunas");

// Prügivedu.
equal(parseWasteFrequency("Iga: T, R").frequency?.kind, "weekly", "nädalane sagedus");
equal(parseWasteFrequency("Kord 2 nädala tagant N").frequency?.kind, "interval", "kahenädalane sagedus");
check(parseWasteFrequency("Kord kuus").warnings.length === 1, "tundmatu sagedus annab hoiatuse");
const waste = nextWasteByType([
  { type: "Segaolmejäätmed", date: "2026-08-25", frequency: "Iga: T, R" },
  { type: "Klaas", date: "2026-08-27", frequency: "Kord 2 nädala tagant N" },
], 30, { year: 2026, month: 8, day: 25 });
equal(waste.occurrences.length, 2, "iga jäätmeliigi järgmine vedu");
check(nextWasteByType([{ type: "Klaas", date: "2026-08-26", frequency: "Kord 2 nädala tagant N" }], 30, { year: 2026, month: 8, day: 25 }).warnings.length > 0, "vale ankrupäev annab hoiatuse");

// Elekter.
equal(priceToCentsPerKwh(100, "€/MWh"), 10, "€/MWh teisendus");
equal(priceToCentsPerKwh(0.15, "€/kWh"), 15, "€/kWh teisendus");
equal(priceToCentsPerKwh(3, undefined), null, "ühikuta elektrihind lükatakse tagasi");
equal(electricityTariffType(new Date("2026-08-25T07:00:00+03:00")), "day", "päevatariifi algus");
equal(electricityTariffType(new Date("2026-08-25T22:00:00+03:00")), "night", "öötariifi algus");
equal(electricityTariffType(new Date("2026-08-20T12:00:00+03:00")), "night", "riigipüha öötariif");
close(calculatePurchasePriceCentsPerKwh(50, {
  exciseCentsPerKwh: 0.21,
  purchaseMarginCentsPerKwh: 0.78,
  securityFeeCentsPerKwh: 0.758,
  renewableFeeCentsPerKwh: 0.84,
  distributionDayCentsPerKwh: 3.49,
  distributionNightCentsPerKwh: 1.99,
}, new Date("2026-08-25T10:00:00+03:00")), (5 + 0.21 + 0.78 + 0.758 + 0.84 + 3.49) * 1.24, 1e-9, "elektri ostuhinna valem");

// Ilm ja maja.
equal(weatherPhenomenonEt("Cloudy"), "Pilves", "ilmanähtuse tõlge");
equal(weatherPhenomenonEt("Alien weather event"), "", "tundmatu inglise tekst ei leki");
const emptyMonth = { year: 2026, month: 8, monthName: "August", key: "2026-08", waterM3: null, heatMWh: null, electricityKWh: null, solarKWh: null };
check(!hasHouseData(emptyMonth), "tühi tulevikukuu jäetakse vahele");
const months = Array.from({ length: 8 }, (_, index) => ({ ...emptyMonth, month: index + 1, key: `2026-${String(index + 1).padStart(2, "0")}`, waterM3: index < 7 ? 200 + index : null }));
equal(lastHouseMonths(months).map((item) => item.month), [4, 5, 6, 7], "neli viimast andmetega kuud");

// Teated ja andmekiht.
const notices = activeNotices([
  { id: "2", title: "B", body: "", type: "info", priority: 2, start: null, end: null },
  { id: "1", title: "A", body: "", type: "info", priority: 1, start: null, end: null },
  { id: "3", title: "C", body: "", type: "info", priority: 0, start: null, end: "2020-01-01T00:00:00.000Z" },
], new Date("2026-08-25T00:00:00Z"));
equal(notices.map((item) => item.id), ["1", "2"], "teadete kliendipoolne kehtivus ja prioriteet");
const previous = createFallbackData();
previous.contacts = [{ role: "Juhatus", name: "Mari", phone: "5000000" }];
const merged = mergeIncoming(previous, {
  ok: true,
  updatedAt: "2026-08-25T10:00:00.000Z",
  sections: { contacts: { ok: false, missing: true, error: "Leht puudub" } },
}, createSectionVersions());
equal(merged.data.contacts, previous.contacts, "puuduv leht säilitab last-known-good");
const validation = validateDashboardPayload({ ok: true, sections: { electricity: { ok: true } }, electricity: { date: "2026-08-25", points: [{ time: "2026-08-25T00:00:00Z", price: 3 }] } });
check(!validation.value?.electricity && validation.problems.some((problem) => problem.includes("ühik")), "elektri ühik on kohustuslik");
const contactsValidation = validateDashboardPayload({ ok: true, sections: { contacts: { ok: true } }, contacts: [{ role: "Juhatus", name: "Mari", phone: "5000000", email: "private@example.test" }] });
check(!(contactsValidation.value?.contacts?.[0] && "email" in contactsValidation.value.contacts[0]), "kontakti e-posti ei saadeta kliendile");

// Staatilised turva- ja ehituslepingud.
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
equal(packageJson.dependencies, {}, "runtime-sõltuvusi ei ole");
const sourceFiles = [];
function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else sourceFiles.push(path);
  }
}
walk("src");
const sources = sourceFiles.filter((path) => /\.(ts|css)$/.test(path)).map((path) => readFileSync(path, "utf8")).join("\n");
equal((sources.match(/\bsetInterval\s*\(/g) ?? []).length, 1, "ainult üks setInterval");
check(!/innerHTML|insertAdjacentHTML/.test(sources), "renderdus ei kasuta innerHTML-i");
check(!/serviceWorker\.register/.test(sources), "service workerit ei registreerita");
const distContent = [];
function walkDist(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walkDist(path);
    else if (!path.endsWith("config.js") && !path.endsWith("config.example.js")) distContent.push(readFileSync(path, "utf8"));
  }
}
walkDist("dist");
const built = distContent.join("\n");
check(!/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}/.test(built), "Apps Scripti URL ei ole buildis");
check(!/[A-Fa-f0-9]{64}/.test(built), "feedToken ei ole buildis");
const server = readFileSync("kiosk/local-server.ps1", "utf8");
check(server.includes("KU-INFOEKRAAN-OK") && server.includes("/healthz"), "healthz leping säilib");


// Tüpograafia: 1920 px juures on 1 rem = 20 px * scale. Tasemed peavad olema
// ohutud minimaalsel lubatud runtime skaalal, mitte ainult vaikimisi väärtusel.
const tokensCss = readFileSync("src/styles/tokens.css", "utf8");
const rootPxAtMinScale = 20 * MIN_RUNTIME_SCALE;
const levelMinimumPx = { a: 34, b: 23, c: 17, d: 12 };
const tokenRem = {};
for (const level of ["a", "b", "c", "d"]) {
  const match = tokensCss.match(new RegExp(`--fs-${level}:\\s*([0-9.]+)rem`));
  check(Boolean(match), `tüpograafiataseme --fs-${level} muutuja on olemas`);
  tokenRem[level] = Number(match && match[1]);
  check(tokenRem[level] * rootPxAtMinScale >= levelMinimumPx[level], `--fs-${level} täidab miinimumi ${levelMinimumPx[level]} px`);
}

function fontSizeForSelector(file, selector) {
  const css = readFileSync(file, "utf8");
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}[^\\{]*\\{[^}]*font-size:\\s*([^;]+);`, "m"));
  return match ? match[1].trim() : "";
}
function fontPx(value) {
  const variable = value.match(/^var\(--fs-([a-d])\)$/);
  if (variable) return tokenRem[variable[1]] * rootPxAtMinScale;
  const rem = value.match(/^([0-9.]+)rem$/);
  if (rem) return Number(rem[1]) * rootPxAtMinScale;
  const px = value.match(/^([0-9.]+)px$/);
  return px ? Number(px[1]) : NaN;
}
for (const [file, selector, level] of [
  ["src/styles/base.css", ".identity h1", "a"],
  ["src/styles/base.css", ".clock", "a"],
  ["src/styles/panels/notices.css", ".notice-title", "a"],
  ["src/styles/panels/notices.css", ".notice-body", "b"],
  ["src/styles/panels/contacts.css", ".contact-primary", "b"],
  ["src/styles/panels/contacts.css", ".contact-phone", "b"],
  ["src/styles/panels/contacts.css", ".contact-secondary", "c"],
  ["src/styles/panels/contacts.css", ".contact-card-emergency-primary .contact-phone", "a"],
  ["src/styles/panels/waste.css", ".waste-name", "b"],
  ["src/styles/panels/weather.css", ".weather-desc", "b"],
  ["src/styles/panels/market.css", ".market-current", "b"],
  ["src/styles/panels/market.css", ".euribor-current", "b"],
  ["src/styles/panels/market.css", ".market-fuel-price", "b"],
  ["src/styles/panels/market.css", ".market-title", "c"],
  ["src/styles/panels/market.css", ".market-fuel-kind", "c"],
  ["src/styles/panels/market.css", ".market-meta", "d"],
  ["src/styles/panels/market.css", ".market-stat strong", "c"],
  ["src/styles/panels/market.css", ".market-card-source", "d"],
  ["src/styles/panels/market.css", ".market-chart-label", "d"],
  ["src/styles/panels/market.css", ".market-chart-scale", "d"],
  ["src/styles/panels/house.css", ".house-kpi-value", "c"],
  ["src/styles/panels/house.css", ".house-trend-value", "d"],
  ["src/styles/panels/house.css", ".house-year-meta", "d"],
]) {
  const value = fontSizeForSelector(file, selector);
  check(Boolean(value), `${selector} font-size on deklareeritud`);
  check(fontPx(value) >= levelMinimumPx[level], `${selector} täidab taseme ${level.toUpperCase()} miinimumi`);
}
const marketCss = readFileSync("src/styles/panels/market.css", "utf8");
check(!/font-size:\s*[0-9.]+px/.test(marketCss), "turugraafiku kirjad ei möödu enam --scale süsteemist");

// Runtime-konfiguratsioon ei tohi olla Gitis. Kui .git puudub (nt release ZIP),
// skannitakse siiski kõik lähtefailid ning lubatakse ainult tühjad/REPLACE_ näited.
let filesToScan = [];
if (existsSync(".git")) {
  const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
  check(!tracked.includes("config.js"), "juurkausta config.js ei ole Gitiga jälgitav");
  check(!tracked.includes("public/config.js"), "public/config.js ei ole Gitiga jälgitav");
  filesToScan = tracked;
} else {
  const collect = (directory) => {
    for (const name of readdirSync(directory)) {
      if (["dist", "node_modules", ".git"].includes(name)) continue;
      const path = join(directory, name);
      if (statSync(path).isDirectory()) collect(path);
      else filesToScan.push(path);
    }
  };
  collect(".");
  filesToScan = filesToScan.filter((path) => !/^\.?\/?(?:config\.js|public[\\/]config\.js)$/.test(path));
}
for (const path of filesToScan) {
  if (!existsSync(path) || statSync(path).size > 2_000_000 || /\.(png|jpg|jpeg|zip)$/i.test(path)) continue;
  const text = readFileSync(path, "utf8");
  for (const match of text.matchAll(/\bfeedToken\s*:\s*["']([^"'\r\n]*)["']/g)) {
    const value = match[1];
    check(!value || /^REPLACE_/i.test(value) || /^(?:\.{3}|PASTA_|YOUR_|<)/i.test(value), `jälgitavas failis ${path} ei ole päris feedTokenit`);
  }
}

const packageVersion = packageJson.version;
const snapshotVersion = readFileSync("tests/e2e/snapshots/build-version.txt", "utf8").trim();
if (process.env.KU_ALLOW_STALE_VISUAL_BASELINE === "1") {
  if (snapshotVersion !== packageVersion) console.warn(`HOIATUS: visuaalbaseline on ${snapshotVersion}, projekt ${packageVersion}; uuenda käsuga npm run test:visual:update.`);
} else {
  equal(snapshotVersion, packageVersion, "visuaalbaseline'i versioon vastab package.json versioonile");
}

check(Boolean(BUS_TIMETABLE.validUntil), "bussigraafikul on hoolduslik kontrolltähtaeg");
const busFrom = Date.parse(`${BUS_TIMETABLE.validFrom}T12:00:00Z`);
const busUntil = Date.parse(`${BUS_TIMETABLE.validUntil}T12:00:00Z`);
check(Number.isFinite(busFrom) && Number.isFinite(busUntil) && busUntil >= busFrom, "bussigraafiku kehtivusvahemik on korrektne");
if (Date.now() - busFrom > 366 * 86_400_000) console.warn("HOIATUS: bussigraafiku validFrom on üle 12 kuu vana; kontrolli ametlikku sõiduplaani.");


// Pika teate sobitus ei tohi minna B-tasemest väiksemaks ega kasvatada cache'i lõputult.
const textFitSource = readFileSync("src/ui/text-fit.ts", "utf8");
check(textFitSource.includes("CACHE_LIMIT = 32"), "teate mõõtmise cache on 32-kirjeline LRU");
check(textFitSource.includes('cssLengthPx("--fs-b"'), "teate alampiir on seotud B-tüpograafiatasemega");
check(!/Math\.max\(16\s*,/.test(textFitSource), "teate sobituses pole vana 16 px alampiiri");

// Prügiveo päevavahetus peab kasutama sama ajavööndiloogikat nagu ülejäänud rakendus.
const wastePanelSource = readFileSync("src/ui/panels/waste.ts", "utf8");
check(wastePanelSource.includes("zonedParts("), "prügiveo paneel kasutab zonedParts ajavööndiloogikat");
check(!/\.getFullYear\(|\.getMonth\(|\.getDate\(/.test(wastePanelSource), "prügiveo paneel ei kasuta masina lokaalset kuupäeva");

// Kioskireload peab säilima brauserikrahhi järel ja demo peab elusignaali saatma.
const lifecycleSource = readFileSync("src/app/lifecycle.ts", "utf8");
check(lifecycleSource.includes("window.localStorage"), "reload'i ajalugu säilib localStorage'is");
check(lifecycleSource.includes("currentMinutes < targetMinutes"), "öine reload toimub ka pärast vahele jäänud täpset minutit");
const bootstrapSource = readFileSync("src/app/bootstrap.ts", "utf8");
check(/fetch\("\.\/heartbeat"/.test(bootstrapSource) && !/if\s*\(\s*!params\.demo\s*\)[^\n]*heartbeat/.test(bootstrapSource), "demo saadab samuti lokaalset heartbeat'i");
const watchdogSource = readFileSync("kiosk/watchdog.ps1", "utf8");
check(watchdogSource.includes('[regex]::Escape("127.0.0.1:$Port")'), "watchdog kasutab seadistatud porti");

const sourcesGs = readFileSync("apps-script/Sources.gs", "utf8");
check(sourcesGs.includes("storeApiFailure_") && sourcesGs.includes("negativeCacheSeconds"), "turuallikatel on negatiivne vahemälu");


console.log(`Preflight: ${assertions} kontrolli läbitud.`);
