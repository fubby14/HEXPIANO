import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const defaultOutput = path.join(projectRoot, "dist", "hexpiano-otad.html");
const outputPath = path.resolve(process.argv[2] || defaultOutput);

const sourceFiles = [
  "src/tuning.js",
  "src/concert-voicing.js",
  "src/engine.js",
  "src/arp-patterns.js",
  "src/constellation-app.js",
];

function stripImports(source) {
  return source.replace(/import\s+[\s\S]*?\s+from\s+["'][^"']+["'];\s*/g, "");
}

function stripExports(source) {
  return source.replace(/\bexport\s+(?=(?:const|function|class)\s)/g, "");
}

const [htmlSource, cssSource, ...javascriptSources] = await Promise.all([
  readFile(path.join(projectRoot, "index.html"), "utf8"),
  readFile(path.join(projectRoot, "release.css"), "utf8"),
  ...sourceFiles.map((file) => readFile(path.join(projectRoot, file), "utf8")),
]);

const bundledCss = cssSource
  .replace(/^@import[^\r\n]*\r?\n+/, "")
  .concat(`

.otad-mark {
  justify-self: end;
  font-family: var(--mono);
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

html.otad-embed .site-header,
html.otad-embed .intro,
html.otad-embed footer {
  display: none;
}

html.otad-embed main {
  width: 100%;
  padding: 0;
}

html.otad-embed .instrument-shell {
  border: 0;
}

html.otad-embed .constellation-wrap {
  min-height: 430px;
  padding: 0;
}

html.otad-embed .hex-field {
  width: min(540px, 100%);
}

html.otad-embed .control-deck,
html.otad-embed .tuning-strip {
  margin-inline: 14px;
}
`);

const bundledJavascript = javascriptSources
  .map((source) => stripExports(stripImports(source)).trim())
  .join("\n\n");

const packagedHtml = htmlSource
  .replace("<title>HEXPIANO — Constellation</title>", "<title>HEXPIANO: Constellation — One Thing a Day 20</title>")
  .replace('<link rel="stylesheet" href="./release.css" />', `<style>\n${bundledCss}\n    </style>`)
  .replace(
    /<nav aria-label="Project views">[\s\S]*?<\/nav>/,
    '<div class="otad-mark">Day 20 / 31</div>',
  )
  .replace("Constellation instrument · 01", "One Thing a Day · 20 / 31")
  .replace("HEXPIANO / Constellation", "One Thing a Day / July 20")
  .replace('<script type="module" src="./src/constellation-app.js"></script>', `<script>\n"use strict";\n(() => {\nif (window.self !== window.top) document.documentElement.classList.add("otad-embed");\n\n${bundledJavascript}\n})();\n    </script>`)
  .replace(
    "<!doctype html>",
    `<!doctype html>
<!--
Title: HEXPIANO: Constellation
OTaD day: 20 / 31
Package: self-contained HTML; no network or runtime dependencies
Tweak knob: --pink: #ff2f87 -> #ff4f9a
-->`,
  );

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, packagedHtml, "utf8");

console.log(`Packaged ${path.relative(projectRoot, outputPath) || outputPath}`);
