/* Hard guarantee for the layering rule (DESIGN.md §2.1): src/core must never
 * import from 'obsidian'. Biome has no per-directory import restriction, so
 * this script is the second safety net next to the directory convention.
 * Exits non-zero with the offending file:line list.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const coreDir = new URL("../src/core", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

if (!existsSync(coreDir)) {
  console.log("core purity OK — src/core does not exist yet");
  process.exit(0);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name);
    if (name.isDirectory()) out.push(...walk(full));
    else if (/\.ts$/.test(name.name)) out.push(full);
  }
  return out;
}

const offenders = [];
for (const file of walk(coreDir)) {
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (/from\s+['"]obsidian['"]/.test(lines[i]) || /require\(['"]obsidian['"]\)/.test(lines[i])) {
      offenders.push(`${file}:${i + 1}`);
    }
  }
}

if (offenders.length > 0) {
  console.error("src/core must not import 'obsidian':");
  for (const line of offenders) console.error(`  ${line}`);
  process.exit(1);
}
console.log("core purity OK — no obsidian imports in src/core");
