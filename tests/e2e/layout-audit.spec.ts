import { expect, type Page, test } from "@playwright/test";
import { makeDemoData, makeMaxDemoData, makeStaleCache } from "../fixtures/make-demo-data";
import { freeze, routeDemo, seedCache, waitForReady } from "./helpers";

/*
 * Pikslivõrdlusest sõltumatu paigutusaudit. PNG-baseline nõuab kioskiga võrreldavat
 * masinat; need kontrollid töötavad igas Chromiumis ja püüavad vead, mis 4.4.0-s
 * baseline'i puudumise tõttu märkamata jäid:
 *  - ööteemas loetamatu tekst (heledad kõvakodeeritud pinnad heleda teksti all);
 *  - nähtav tekst, mis lõigatakse ilma kolmikpunktita poolikuks;
 *  - SVG teljesildid, mis ulatuvad viewBox'ist välja (nt "22,3" -> ",2,3");
 *  - tühjaks jäänud kuupäevaväljad ("seisuga ", "Eesti keskmine · ").
 */

interface AuditResult {
  contrast: string[];
  clipped: string[];
  svgOverflow: string[];
}

async function audit(page: Page): Promise<AuditResult> {
  return page.evaluate(() => {
    type Rgba = [number, number, number, number];
    const parseColor = (value: string): Rgba | null => {
      const match = /rgba?\(([^)]+)\)/.exec(value);
      if (!match?.[1]) return null;
      const parts = match[1]
        .split(/[\s,/]+/)
        .filter(Boolean)
        .map(Number);
      return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
    };
    const over = (top: Rgba, bottom: Rgba): Rgba => {
      const alpha = top[3] + bottom[3] * (1 - top[3]);
      if (alpha === 0) return [0, 0, 0, 0];
      const mix = (index: number) =>
        (top[index]! * top[3] + bottom[index]! * bottom[3] * (1 - top[3])) / alpha;
      return [mix(0), mix(1), mix(2), alpha];
    };
    const luminance = ([r, g, b]: Rgba): number => {
      const channel = (value: number) => {
        const v = value / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const ratio = (a: Rgba, b: Rgba) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
      return (hi + 0.05) / (lo + 0.05);
    };
    /** Kõik võimalikud taustavärvid (gradiendi puhul iga peatus), alt üles komposiitituna. */
    const backgrounds = (element: Element): Rgba[] => {
      const chain: Element[] = [];
      for (let node: Element | null = element; node; node = node.parentElement) chain.push(node);
      let layers: Rgba[] = [[255, 255, 255, 1]];
      for (const node of chain.reverse()) {
        const style = getComputedStyle(node);
        const stops = [...style.backgroundImage.matchAll(/rgba?\([^)]+\)/g)]
          .map((match) => parseColor(match[0]))
          .filter((color): color is Rgba => Boolean(color));
        const solid = parseColor(style.backgroundColor);
        const candidates = stops.length ? stops : solid && solid[3] > 0 ? [solid] : [];
        if (candidates.length)
          layers = candidates.flatMap((top) => layers.map((bottom) => over(top, bottom)));
      }
      return layers;
    };
    const label = (element: Element) => {
      const id = element.id ? `#${element.id}` : "";
      const cls =
        typeof element.className === "string" && element.className
          ? `.${element.className.split(/\s+/)[0]}`
          : "";
      return `${element.tagName.toLowerCase()}${id}${cls} "${(element.textContent ?? "").trim().slice(0, 40)}"`;
    };
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      for (let node: Element | null = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0)
          return false;
      }
      return true;
    };
    const hasOwnText = (element: Element) =>
      [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());

    const result: AuditResult = { contrast: [], clipped: [], svgOverflow: [] };
    for (const element of document.querySelectorAll("body *")) {
      if (!hasOwnText(element) || !visible(element) || element.closest(".debug-overlay")) continue;
      const style = getComputedStyle(element);
      const isSvgText = element instanceof SVGElement;
      const foreground = parseColor(isSvgText ? style.fill : style.color);
      if (foreground) {
        const size = Number.parseFloat(style.fontSize);
        const bold = Number(style.fontWeight) >= 700;
        const large = size >= 24 || (bold && size >= 18.66);
        const minimum = large ? 3 : 4.5;
        const worst = Math.min(...backgrounds(element).map((bg) => ratio(over(foreground, bg), bg)));
        if (worst < minimum) result.contrast.push(`${label(element)} ${worst.toFixed(2)} < ${minimum}`);
      }
      if (
        !isSvgText &&
        element instanceof HTMLElement &&
        style.overflowX !== "visible" &&
        style.textOverflow !== "ellipsis" &&
        element.scrollWidth > element.clientWidth + 1
      )
        result.clipped.push(`${label(element)} ${element.scrollWidth}>${element.clientWidth}`);
    }
    for (const text of document.querySelectorAll<SVGTextElement>("svg text")) {
      if (!visible(text)) continue;
      const svg = text.ownerSVGElement;
      const box = svg?.viewBox.baseVal;
      if (!box || box.width === 0) continue;
      const bbox = text.getBBox();
      if (bbox.x < box.x - 0.5 || bbox.x + bbox.width > box.x + box.width + 0.5)
        result.svgOverflow.push(`${label(text)} x=${bbox.x.toFixed(1)} w=${bbox.width.toFixed(1)}`);
    }
    return result;
  });
}

async function expectCleanAudit(page: Page): Promise<void> {
  const result = await audit(page);
  expect.soft(result.contrast, "WCAG kontrast").toEqual([]);
  expect.soft(result.clipped, "ilma kolmikpunktita lõigatud tekst").toEqual([]);
  expect.soft(result.svgOverflow, "viewBox'ist väljuvad SVG sildid").toEqual([]);
}

async function expectDatesFilled(page: Page): Promise<void> {
  await expect.soft(page.locator("#fuelMeta")).toHaveText(/Eesti keskmine · \d{1,2}\. \S+/);
  await expect.soft(page.locator("#euriborMeta")).toHaveText(/seisuga \d{1,2}\. \S+/);
}

test("päevavaade: kontrast, lõikumine ja kuupäevad", async ({ page }) => {
  await freeze(page);
  await routeDemo(page, makeDemoData());
  await page.goto("/?demo=1");
  await waitForReady(page);
  await expectDatesFilled(page);
  await expectCleanAudit(page);
});

test("ööteema: kontrast ja lõikumine", async ({ page }) => {
  const night = new Date("2026-08-25T23:15:00+03:00");
  await freeze(page, night);
  await routeDemo(page, makeDemoData(night));
  await page.goto("/?demo=1");
  await waitForReady(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await expectDatesFilled(page);
  await expectCleanAudit(page);
});

test("maksimaalne sisu: kontrast ja lõikumine", async ({ page }) => {
  await freeze(page);
  await routeDemo(page, makeMaxDemoData());
  await page.goto("/?demo=1");
  await waitForReady(page);
  await expectCleanAudit(page);
});

test("vananenud andmed: vanusemärk ei kata allikarida", async ({ page }) => {
  await freeze(page);
  await routeDemo(page, makeStaleCache());
  await seedCache(page, makeStaleCache());
  await page.unroute("**/sample-data.json");
  await page.goto("/");
  await expect(page.locator("#staleBanner")).toBeVisible();
  await expectCleanAudit(page);
  for (const card of ["#electricityCard", "#fuelCard", "#euriborCard"]) {
    const badge = page.locator(`${card} .market-stale`);
    if (!(await badge.isVisible())) continue;
    const overlap = await page.evaluate((selector) => {
      const root = document.querySelector(selector);
      const badgeBox = root?.querySelector(".market-stale")?.getBoundingClientRect();
      const source = root?.querySelector<HTMLElement>(".market-card-source");
      if (!badgeBox || !source) return false;
      // Allikarea sisukast (ilma reserveeritud parema polsterduseta) ei tohi ulatuda märgi alla.
      const box = source.getBoundingClientRect();
      const contentRight = box.right - Number.parseFloat(getComputedStyle(source).paddingRight);
      const verticalOverlap = badgeBox.top < box.bottom && badgeBox.bottom > box.top;
      return verticalOverlap && contentRight > badgeBox.left;
    }, card);
    expect(overlap, `${card} vanusemärk katab allikarida`).toBe(false);
  }
});
