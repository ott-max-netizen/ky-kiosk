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

  it("sisaldab CSP meta-varuvarianti ka ilma PowerShelli serveri päiseta", () => {
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(html).toContain(
      "script-src 'self' https://script.google.com https://script.googleusercontent.com",
    );
    expect(html).toContain(
      "connect-src 'self' https://script.google.com https://script.googleusercontent.com",
    );
  });

  it("hoiab paneeli ajapõhise tick-elutsükli tüübilepingus", () => {
    const panel = readFileSync(new URL("../../src/ui/panels/panel.ts", import.meta.url), "utf8");
    expect(panel).toMatch(/tick\?\(now:\s*Date\):\s*void/);
  });

  it("ei registreeri service workerit", () => {
    const source = readFileSync(new URL("../../src/app/lifecycle.ts", import.meta.url), "utf8");
    expect(source).toContain("getRegistrations");
    expect(source).not.toContain("serviceWorker.register");
  });
});
