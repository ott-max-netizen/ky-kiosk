import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe("runtime-config", () => {
  it("ei sisalda buildis päris Apps Scripti URL-i ega tokenit", () => {
    const content = files("dist")
      .filter((path) => !path.endsWith("config.js") && !path.endsWith("config.example.js"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    expect(content).not.toMatch(/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}/);
    expect(content).not.toMatch(/[A-Fa-f0-9]{64}/);
    expect(content).not.toContain("PASTA_SIIA");
  });
});
