import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../", import.meta.url);
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const snapshotDir = new URL("../tests/e2e/snapshots/", import.meta.url);
const required = [
  "demo-with-notices.png",
  "demo-without-notices.png",
  "demo-night.png",
  "cache-only.png",
  "stale-banner.png",
  "max-content.png",
];
for (const name of required) {
  const path = new URL(name, snapshotDir);
  if (!existsSync(path)) throw new Error(`Visuaalbaseline puudub: ${name}`);
}
writeFileSync(new URL("build-version.txt", snapshotDir), `${packageJson.version}\n`, "utf8");
copyFileSync(new URL("demo-with-notices.png", snapshotDir), new URL("../demo-1920x1080.png", import.meta.url));
copyFileSync(new URL("demo-without-notices.png", snapshotDir), new URL("../demo-no-notices-1920x1080.png", import.meta.url));
console.log(`Visuaalbaseline'id märgitud versioonile ${packageJson.version}.`);
