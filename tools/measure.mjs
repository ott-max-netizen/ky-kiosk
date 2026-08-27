/**
 * Mõõdab kioskirakenduse jooksvat kuju päris Chromiumis: käivitusaeg, DOM- ja
 * SVG-sõlmede arv, registreeritud taimerid ja kuulajad, JS-i mälukasutus ning
 * nende kasv kiirendatud 24 h sessiooni jooksul.
 *
 *   node tools/measure.mjs [--hours 24] [--json out.json]
 *
 * Eeldab, et `npm run build` on tehtud. Brauseri saab ette anda muutujaga
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE, muidu kasutatakse Playwrighti oma brauserit.
 */
import { spawn } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const hours = Number(argValue("hours", "24"));
const jsonOut = argValue("json", "");
const PORT = 4178;

function bundleSizes() {
  const assets = join(root, "dist", "assets");
  const out = { jsBytes: 0, jsGzipBytes: 0, cssBytes: 0, cssGzipBytes: 0, htmlBytes: 0, htmlGzipBytes: 0 };
  for (const name of readdirSync(assets)) {
    const buffer = readFileSync(join(assets, name));
    if (name.endsWith(".js")) {
      out.jsBytes += buffer.length;
      out.jsGzipBytes += gzipSync(buffer).length;
    }
    if (name.endsWith(".css")) {
      out.cssBytes += buffer.length;
      out.cssGzipBytes += gzipSync(buffer).length;
    }
  }
  const html = readFileSync(join(root, "dist", "index.html"));
  out.htmlBytes = html.length;
  out.htmlGzipBytes = gzipSync(html).length;
  return out;
}

// Loendab taimerid ja kuulajad juba enne rakenduse skripti käivitumist.
const INSTRUMENT = `
(() => {
  const w = window;
  w.__ku = { intervals: 0, timeouts: 0, clearedIntervals: 0, listeners: 0, removed: 0, rafs: 0, created: 0, createdNS: 0, reflows: 0 };
  const ce = Document.prototype.createElement, ceNS = Document.prototype.createElementNS;
  Document.prototype.createElement = function (...a) { w.__ku.created += 1; return ce.apply(this, a); };
  Document.prototype.createElementNS = function (...a) { w.__ku.createdNS += 1; return ceNS.apply(this, a); };
  // Sünkroonne paigutuse lugemine sunnib reflow'd; loendame kõige kuumemad teed.
  const sh = Object.getOwnPropertyDescriptor(Element.prototype, "scrollHeight");
  if (sh && sh.get) Object.defineProperty(Element.prototype, "scrollHeight", {
    ...sh, get() { w.__ku.reflows += 1; return sh.get.call(this); },
  });
  const si = w.setInterval, st = w.setTimeout, ci = w.clearInterval, raf = w.requestAnimationFrame;
  w.setInterval = function (...a) { w.__ku.intervals += 1; return si.apply(this, a); };
  w.setTimeout = function (...a) { w.__ku.timeouts += 1; return st.apply(this, a); };
  w.clearInterval = function (...a) { w.__ku.clearedIntervals += 1; return ci.apply(this, a); };
  w.requestAnimationFrame = function (...a) { w.__ku.rafs += 1; return raf.apply(this, a); };
  const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (...a) { w.__ku.listeners += 1; return add.apply(this, a); };
  EventTarget.prototype.removeEventListener = function (...a) { w.__ku.removed += 1; return remove.apply(this, a); };
})();
`;

const SNAPSHOT = `(() => {
  const all = document.getElementsByTagName("*").length;
  const svg = document.getElementsByTagName("*").length - document.querySelectorAll(":not(svg):not(svg *)").length;
  return {
    domNodes: all,
    svgNodes: document.querySelectorAll("svg, svg *").length,
    totalNodes: document.querySelectorAll("*").length,
    textNodes: document.evaluate("count(//text())", document, null, XPathResult.NUMBER_TYPE, null).numberValue,
    intervals: window.__ku.intervals,
    intervalsCleared: window.__ku.clearedIntervals,
    timeouts: window.__ku.timeouts,
    listeners: window.__ku.listeners,
    listenersRemoved: window.__ku.removed,
    rafs: window.__ku.rafs,
    elementsCreated: window.__ku.created,
    svgElementsCreated: window.__ku.createdNS,
    forcedReflows: window.__ku.reflows,
  };
})()`;

async function waitIdle(page) {
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
}

const preview = spawn(
  "npx",
  ["vite", "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"],
  {
    cwd: root,
    stdio: "ignore",
    detached: false,
  },
);
const stop = () => {
  try {
    preview.kill("SIGTERM");
  } catch {
    /* juba lõpetatud */
  }
};
process.on("exit", stop);

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {},
);
const results = { bundle: bundleSizes(), hours };
try {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    locale: "et-EE",
    timezoneId: "Europe/Tallinn",
  });
  const page = await context.newPage();
  // Kell enne instrumentatsiooni: page.clock asendab taimerifunktsioonid ja
  // vastupidises järjekorras loendaks mähis Playwrighti võltskella, mitte rakendust.
  await page.clock.install({ time: new Date("2026-08-25T16:00:00+03:00") });
  await page.addInitScript(INSTRUMENT);
  const cdp = await context.newCDPSession(page);

  // Oota, kuni eelvaateserver vastab.
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await page.goto(`http://127.0.0.1:${PORT}/?demo=1`, { waitUntil: "commit", timeout: 2000 });
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const started = Date.now();
  await page.waitForFunction(() => document.querySelector("#clock")?.textContent !== "--:--", null, {
    timeout: 20_000,
  });
  await page.waitForFunction(
    () => (document.querySelector("#noticeArea")?.textContent ?? "").length > 0,
    null,
    { timeout: 20_000 },
  );
  await waitIdle(page);
  results.firstRenderMs = Date.now() - started;
  results.navigation = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    return nav
      ? { domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd), loadMs: Math.round(nav.loadEventEnd) }
      : null;
  });
  results.initial = await page.evaluate(SNAPSHOT);
  results.initial.heapBytes = (await cdp.send("Runtime.getHeapUsage")).usedSize;

  // Üks tavapärane olekuuuendus: minutivahetus (bussid + elektrigraafik).
  results.minuteTickMs = await page.evaluate(() => {
    const start = performance.now();
    for (let i = 0; i < 20; i += 1) window.dispatchEvent(new Event("resize"));
    return Math.round((performance.now() - start) * 100) / 100;
  });

  const steps = hours <= 1 ? [hours] : [1, hours];
  results.timeline = [];
  let elapsed = 0;
  for (const mark of steps) {
    if (mark <= elapsed) continue;
    // runFor tükkidena, mitte fastForward: fastForward ei käivita 1-sekundilist
    // ajastajat realistlikul arvul kordadel, mistõttu DOM-i kulumine jäi mõõtmata.
    for (let minute = 0; minute < (mark - elapsed) * 60; minute += 1) await page.clock.runFor(60_000);
    elapsed = mark;
    await waitIdle(page);
    const snapshot = await page.evaluate(SNAPSHOT);
    snapshot.heapBytes = (await cdp.send("Runtime.getHeapUsage")).usedSize;
    results.timeline.push({ hours: mark, ...snapshot });
    console.log(
      `  ${String(mark).padStart(3)} h  DOM ${snapshot.totalNodes}  SVG ${snapshot.svgNodes}  created ${snapshot.elementsCreated}  svgCreated ${snapshot.svgElementsCreated}  reflows ${snapshot.forcedReflows}  heap ${Math.round(snapshot.heapBytes / 1024)} kB`,
    );
  }
  results.final = results.timeline.at(-1);
  await context.close();
} finally {
  await browser.close();
  stop();
}

const table = [
  ["JS bundle (bytes)", results.bundle.jsBytes],
  ["JS bundle gzip (bytes)", results.bundle.jsGzipBytes],
  ["CSS bundle (bytes)", results.bundle.cssBytes],
  ["CSS bundle gzip (bytes)", results.bundle.cssGzipBytes],
  ["index.html (bytes)", results.bundle.htmlBytes],
  ["First full render (ms)", results.firstRenderMs],
  ["DOM nodes at start", results.initial.totalNodes],
  ["SVG nodes at start", results.initial.svgNodes],
  [`DOM nodes after ${hours} h`, results.final.totalNodes],
  [`SVG nodes after ${hours} h`, results.final.svgNodes],
  ["HTML elements created at start", results.initial.elementsCreated],
  ["SVG elements created at start", results.initial.svgElementsCreated],
  [`HTML elements created in ${hours} h`, results.final.elementsCreated],
  [`SVG elements created in ${hours} h`, results.final.svgElementsCreated],
  [`Forced reflows in ${hours} h`, results.final.forcedReflows],
  ["addEventListener total", results.final.listeners],
  ["removeEventListener total", results.final.listenersRemoved],
  ["JS heap at start (bytes)", results.initial.heapBytes],
  [`JS heap after ${hours} h (bytes)`, results.final.heapBytes],
];
console.log("");
for (const [label, value] of table) console.log(`${label.padEnd(32)} ${value}`);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(results, null, 2));
