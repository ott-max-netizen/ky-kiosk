import { existsSync } from "node:fs";
import { build } from "vite";

/**
 * Build-lepingu testid (tests/build, tests/contract/smoke) loevad `dist/` kausta.
 * Puhtas checkout'is seda veel ei ole, mistõttu `npm test` ja `npm run check`
 * (mis jooksutas testid enne buildi) kukkusid läbi ENOENT-iga. Kui build puudub,
 * tehakse see siin; olemasolevat `dist/` ei kirjutata üle (nt `build:fallback` väljund).
 */
export default async function ensureDist(): Promise<void> {
  if (existsSync(new URL("../../dist/index.html", import.meta.url))) return;
  await build({ logLevel: "warn" });
}
