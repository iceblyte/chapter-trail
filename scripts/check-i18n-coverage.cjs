// Plain-JS i18n coverage scan (run: node scripts/check-i18n-coverage.cjs)
const fs = require("node:fs");
const path = require("node:path");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

// keys are the left-hand sides at the top object level of zh.ts —
// biome keeps quotes only when required, so accept both forms
const zhSrc = fs.readFileSync("src/i18n/zh.ts", "utf8");
const keyLine = /^\s{2}(?:"((?:[^"\\]|\\.)*)"|([A-Za-z0-9_$\u4e00-\u9fff]+))\s*:/gm;
const zhKeys = new Set([...zhSrc.matchAll(keyLine)].map((m) => m[1] ?? m[2] ?? "").filter(Boolean));

const call = /(?<![A-Za-z0-9_$.])t\(\s*"((?:[^"\\]|\\.)*)"/g;
const used = new Map();
for (const file of walk("src")) {
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(call)) {
    const key = m[1];
    if (!used.has(key)) used.set(key, []);
    used.get(key).push(path.relative(".", file));
  }
}

const missing = [...used.entries()].filter(([k]) => !zhKeys.has(k));
console.log(`used: ${used.size} | zh: ${zhKeys.size} | missing: ${missing.length}`);
for (const [k, files] of missing)
  console.log(`MISSING: ${JSON.stringify(k)} -> ${files.join(", ")}`);
if (missing.length > 0) process.exitCode = 1;
