import { expect, test } from "@playwright/test";
import {
  makeDemoData,
  makeMaxDemoData,
  makeStaleCache,
  VISUAL_REFERENCE_NOW,
} from "../fixtures/make-demo-data";
import { freeze, routeDemo, seedCache, waitForReady } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.addStyleTag({
    content:
      "* { animation: none !important; transition: none !important; caret-color: transparent !important; }",
  });
});

test("teadetega päevavaade", async ({ page }) => {
  await freeze(page);
  await routeDemo(page, makeDemoData());
  await page.goto("/?demo=1");
  await waitForReady(page);
  await expect(page.locator("#dashboard")).toHaveClass(/has-notices/);
  await expect(page).toHaveScreenshot("demo-with-notices.png");
});

test("teadeteta lai turunäitajate vaade", async ({ page }) => {
  await freeze(page);
  await routeDemo(page, makeDemoData(VISUAL_REFERENCE_NOW, false));
  await page.goto("/?demo=1&notices=0");
  await waitForReady(page);
  await expect(page.locator("#dashboard")).toHaveClass(/no-notices/);
  await expect(page.locator("#noticeColumn")).toBeHidden();
  await expect(page).toHaveScreenshot("demo-without-notices.png");
});

test("soe ööteema", async ({ page }) => {
  const night = new Date("2026-08-25T23:15:00+03:00");
  await freeze(page, night);
  await routeDemo(page, makeDemoData(night));
  await page.goto("/?demo=1");
  await waitForReady(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await expect(page).toHaveScreenshot("demo-night.png");
});

test("ainult IndexedDB vahemälu", async ({ page }) => {
  await freeze(page);
  await routeDemo(page, makeDemoData());
  await seedCache(page, makeDemoData());
  await page.unroute("**/sample-data.json");
  await page.goto("/");
  await waitForReady(page);
  await expect(page.locator("#noticeArea")).toContainText("Veevarustuse katkestus");
  await expect(page).toHaveScreenshot("cache-only.png");
});

test("vananenud andmete hoiatus", async ({ page }) => {
  await freeze(page);
  await routeDemo(page, makeStaleCache());
  await seedCache(page, makeStaleCache());
  await page.unroute("**/sample-data.json");
  await page.goto("/");
  await expect(page.locator("#staleBanner")).toBeVisible();
  await expect(page).toHaveScreenshot("stale-banner.png");
});

test("1200-tähemärgiline teade ja maksimaalsed loendid", async ({ page }) => {
  await freeze(page);
  await routeDemo(page, makeMaxDemoData());
  await page.goto("/?demo=1");
  await waitForReady(page);
  // #noticePageLabel täidetakse ainult siis, kui teateid on üle ühe, ja on
  // muidu `hidden` (.notice-column > .page-label[hidden]). See fixture sisaldab
  // täpselt ühte teadet, nii et "1/1" ei ole ühelgi kooditeel saavutatav.
  // Sisuline kontroll on pika teate lehekülgede lugeja (C-14).
  await expect(page.locator("#noticePageLabel")).toBeHidden();
  await expect(page.locator(".notice-page-count")).toContainText("lk 1/");
  await expect(page).toHaveScreenshot("max-content.png");
});

test("väga pika teate leheküljed liiguvad edasi", async ({ page }) => {
  await freeze(page);
  const payload = makeMaxDemoData();
  const notice = payload.notices?.[0];
  if (!notice) throw new Error("Pika teate fixture puudub");
  notice.body = `${notice.body} `.repeat(4).slice(0, 4200);
  await routeDemo(page, payload);
  await page.goto("/?demo=1");
  await waitForReady(page);
  await expect(page.locator(".notice-page-count")).toContainText("lk 1/");
  const firstPage = await page.locator(".notice-page-count").textContent();
  await page.clock.fastForward(30_000);
  const laterPage = await page.locator(".notice-page-count").textContent();
  expect(laterPage).not.toBe(firstPage);
});
