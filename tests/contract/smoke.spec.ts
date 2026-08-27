import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ehituse ja kioski lepingud", () => {
  it("ei kompileeri runtime tokenit HTML-i", () => {
    const html = readFileSync(new URL("../../dist/index.html", import.meta.url), "utf8");
    expect(html).not.toMatch(/feedToken|PASTA_SIIA|REPLACE_WITH_64_CHARACTER_TOKEN/);
    expect(html).toContain("config.js");
  });

  it("säilitab healthz vastuse", () => {
    const server = readFileSync(new URL("../../kiosk/local-server.ps1", import.meta.url), "utf8");
    expect(server).toContain("KU-INFOEKRAAN-OK");
    expect(server).toContain("/healthz");
  });

  it("ei registreeri service workerit", () => {
    const source = readFileSync(new URL("../../src/app/lifecycle.ts", import.meta.url), "utf8");
    expect(source).toContain("getRegistrations");
    expect(source).not.toContain("serviceWorker.register");
  });
});
