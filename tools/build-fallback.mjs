import { createRequire } from "node:module";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = resolve(import.meta.dirname, "..");
const out = join(root, "dist");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

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

for (const file of walk(join(root, "src"))) {
  const rel = relative(root, file);
  if (file.endsWith(".ts")) {
    const target = join(out, rel.replace(/\.ts$/, ".js"));
    mkdirSync(dirname(target), { recursive: true });
    let code = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
        importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      },
      fileName: file,
    }).outputText;
    code = code.replace(/^import\s+["'][^"']+\.css["'];?\s*$/gm, "");
    code = code.replace(/(from\s+["'])(\.\.?\/[^"']+)(["'])/g, (_, a, b, c) => `${a}${modulePath(b)}${c}`);
    code = code.replace(/(import\s*\(\s*["'])(\.\.?\/[^"']+)(["']\s*\))/g, (_, a, b, c) => `${a}${modulePath(b)}${c}`);
    code = code.replace(/(import\s+["'])(\.\.?\/[^"']+)(["'];?)/g, (_, a, b, c) => `${a}${modulePath(b)}${c}`);
    writeFileSync(target, code);
  } else if (file.endsWith(".css")) {
    const target = join(out, rel);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(file, target);
  }
}

let html = readFileSync(join(root, "index.html"), "utf8")
  .replaceAll("%BASE_URL%", "./")
  .replace('src="/src/main.ts"', 'src="./src/main.js"');
const cssLinks = [
  "tokens.css", "base.css", "layout.css", "panels/notices.css", "panels/market.css",
  "panels/buses.css", "panels/weather.css", "panels/house.css", "panels/waste.css",
  "panels/contacts.css", "panels/status.css", "night.css",
].map((path) => `  <link rel="stylesheet" href="./src/styles/${path}">`).join("\n");
html = html.replace("</head>", `${cssLinks}\n</head>`);
writeFileSync(join(out, "index.html"), html);

const configExample = join(root, "config.example.js");
if (existsSync(configExample)) cpSync(configExample, join(out, "config.example.js"));
const sampleData = join(root, "public", "sample-data.json");
if (existsSync(sampleData)) cpSync(sampleData, join(out, "sample-data.json"));
console.log(`Fallback build valmis: ${out}`);
