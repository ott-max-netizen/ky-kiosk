import { defineConfig, devices } from "@playwright/test";

// Lubab osutada eelpaigaldatud Chromiumile (CI, konteiner, offline masin), ilma
// et `npx playwright install` peaks brauseri alla laadima. Tühjana käitub
// Playwright tavapäraselt ja kasutab oma seotud brauserit.
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.003,
    },
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  snapshotPathTemplate: "{testDir}/snapshots/{arg}{ext}",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    locale: "et-EE",
    timezoneId: "Europe/Tallinn",
    colorScheme: "light",
    // Playwright 1.62 ootab reducedMotion'i contextOptions'i sees; varem oli see
    // otse use-plokis ja seetõttu tüübiviga ning seade jäi tegelikult rakendamata.
    contextOptions: { reducedMotion: "reduce" },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    ...(chromiumExecutable ? { launchOptions: { executablePath: chromiumExecutable } } : {}),
  },
  webServer: {
    command: "npm run build && vite preview --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  // NB: projekti `use` kirjutab üle ülemise `use` ploki. Varem laotati siia veel
  // kord `devices["Desktop Chrome"]`, mis tõi kaasa selle 1280x720 vaateava ja
  // muutis kogu visuaalse regressioonikontrolli 1920x1080 baseline'ide vastu
  // kasutuks (C-34). Seade on juba ülemises `use` plokis.
  projects: [{ name: "chromium" }],
});
