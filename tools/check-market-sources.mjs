/**
 * Võrguga contract-smoke turuallikatele. Ei kuulu offline `npm run check` sisse.
 * Käivita enne release'i internetiga arendusmasinas: npm run test:sources
 */
const timeoutMs = 12_000;

async function get(url, accept) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: { Accept: accept }, signal: controller.signal });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const now = new Date();
const start = new Date(now.getTime() - 36 * 3_600_000).toISOString();
const end = new Date(now.getTime() + 36 * 3_600_000).toISOString();

const elering = await (
  await get(
    `https://dashboard.elering.ee/api/nps/price?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    "application/json",
  )
).json();
const eleringRoot = elering?.data ?? elering;
const ee = Array.isArray(eleringRoot?.ee)
  ? eleringRoot.ee
  : Array.isArray(eleringRoot?.EE)
    ? eleringRoot.EE
    : eleringRoot;
assert(
  Array.isArray(ee) &&
    ee.some((row) => Number.isFinite(Number(row?.timestamp)) && Number.isFinite(Number(row?.price))),
  "Elering: EE timestamp/price kuju muutus",
);
console.log("OK Elering");

const openVan = await (
  await get("https://openvan.camp/api/fuel/prices?source=ku-kauge-32", "application/json")
).json();
const openVanPrices = openVan?.data?.EE?.prices;
assert(
  openVanPrices &&
    [openVanPrices.gasoline, openVanPrices.gasoline_regular].some((value) => Number.isFinite(Number(value))),
  "OpenVan: EE gasoline kuju muutus",
);
assert(
  [openVanPrices.diesel, openVanPrices.diesel_regular].some((value) => Number.isFinite(Number(value))),
  "OpenVan: EE diesel kuju muutus",
);
console.log("OK OpenVan");

const euroOil = await (await get("https://eurooilwatch.com/api/v1/prices", "application/json")).json();
const estonia = Array.isArray(euroOil?.countries)
  ? euroOil.countries.find((country) => String(country?.countryCode ?? "").toUpperCase() === "EE")
  : null;
assert(
  estonia && Number.isFinite(Number(estonia.petrolPrice)) && Number.isFinite(Number(estonia.dieselPrice)),
  "EuroOilWatch: countries/EE petrolPrice/dieselPrice kuju muutus",
);
console.log("OK EuroOilWatch");

const euriborXmlUrl =
  "https://reports.suomenpankki.fi/WebForms/ReportViewerPage.aspx?output=xml&report=%2Ftilastot%2Fmarkkina-_ja_hallinnolliset_korot%2Feuribor_korot_xml_short_en";
const euriborText = await (await get(euriborXmlUrl, "application/xml,text/xml;q=0.9,*/*;q=0.5")).text();
assert(
  euriborText.length > 100 && /euribor|6\s*(?:month|m)/i.test(euriborText),
  "Soome Pank: Euribori XML raporti kuju muutus",
);
console.log("OK Soome Pank Euribor");
