import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const buildConfig = join(root, "tools", "tsconfig.build.json");

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function modulePath(specifier) {
  if (!specifier.startsWith(".")) return specifier;
  return extname(specifier) ? specifier : `${specifier}.js`;
}

/**
 * Emits src/**\/*.ts as plain ESM under `<out>/src` using the pinned TypeScript
 * compiler, then rewrites extensionless relative imports so Node and the browser
 * can load the files directly. TypeScript 7 no longer ships a JavaScript
 * compiler API (`ts.transpileModule` is gone), so the emit goes through the tsc
 * CLI rather than an in-process transpile.
 */
export function buildModules(out, { css = true } = {}) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  execFileSync(
    process.execPath,
    [join(root, "node_modules", "typescript", "lib", "tsc.js"), "-p", buildConfig, "--outDir", out],
    { cwd: root, stdio: "inherit" },
  );

  for (const file of walk(join(out, "src"))) {
    if (!file.endsWith(".js")) continue;
    let code = readFileSync(file, "utf8");
    code = code.replace(/^import\s+["'][^"']+\.css["'];?\s*$/gm, "");
    code = code.replace(/(from\s+["'])(\.\.?\/[^"']+)(["'])/g, (_, a, b, c) => `${a}${modulePath(b)}${c}`);
    code = code.replace(
      /(import\s*\(\s*["'])(\.\.?\/[^"']+)(["']\s*\))/g,
      (_, a, b, c) => `${a}${modulePath(b)}${c}`,
    );
    code = code.replace(
      /(import\s+["'])(\.\.?\/[^"']+)(["'];?)/g,
      (_, a, b, c) => `${a}${modulePath(b)}${c}`,
    );
    writeFileSync(file, code);
  }

  if (css) {
    for (const file of walk(join(root, "src"))) {
      if (!file.endsWith(".css")) continue;
      const target = join(out, relative(root, file));
      mkdirSync(dirname(target), { recursive: true });
      cpSync(file, target);
    }
  }
  return out;
}

export function buildFallback(out = join(root, "dist")) {
  buildModules(out);
  let html = readFileSync(join(root, "index.html"), "utf8")
    .replaceAll("%BASE_URL%", "./")
    .replace('src="/src/main.ts"', 'src="./src/main.js"');
  const cssLinks = [
    "tokens.css",
    "base.css",
    "layout.css",
    "panels/notices.css",
    "panels/market.css",
    "panels/buses.css",
    "panels/weather.css",
    "panels/house.css",
    "panels/waste.css",
    "panels/contacts.css",
    "panels/status.css",
    "night.css",
  ]
    .map((path) => `  <link rel="stylesheet" href="./src/styles/${path}">`)
    .join("\n");
  html = html.replace("</head>", `${cssLinks}\n</head>`);
  writeFileSync(join(out, "index.html"), html);

  const configExample = join(root, "config.example.js");
  if (existsSync(configExample)) cpSync(configExample, join(out, "config.example.js"));
  const sampleData = join(root, "public", "sample-data.json");
  if (existsSync(sampleData)) cpSync(sampleData, join(out, "sample-data.json"));
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  console.log(`Fallback build valmis: ${buildFallback()}`);
}
