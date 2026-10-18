import { expect, type Page } from "@playwright/test";
import { type makeDemoData, VISUAL_REFERENCE_NOW } from "../fixtures/make-demo-data";

export async function freeze(page: Page, date = VISUAL_REFERENCE_NOW): Promise<void> {
  await page.clock.install({ time: date });
}

export async function routeDemo(page: Page, payload: unknown): Promise<void> {
  await page.route("**/sample-data.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(payload),
    });
  });
}

export async function waitForReady(page: Page): Promise<void> {
  await expect(page.locator("#clock")).not.toHaveText("--:--");
  await expect(page.locator("#connectionText")).toContainText(/Demorežiim|vahemälu|seadistamata/i);
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    document.documentElement.classList.add("visual-ready");
  });
}

export async function seedCache(page: Page, payload: ReturnType<typeof makeDemoData>): Promise<void> {
  await page.goto("/?demo=1");
  await page.evaluate(async (data) => {
    const sectionUpdatedAt = Object.fromEntries(
      Object.entries(data.sections ?? {}).map(([name, meta]) => [name, meta?.updatedAt ?? data.updatedAt]),
    );
    const cached = { ...data, sectionUpdatedAt, sectionErrors: {}, cachedAt: data.updatedAt };
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("ku-infoekraan", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("cache")) db.createObjectStore("cache");
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const transaction = request.result.transaction("cache", "readwrite");
        transaction.objectStore("cache").put(cached, "dashboard-data-v6");
        transaction.oncomplete = () => {
          request.result.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }, payload);
}
