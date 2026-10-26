/**
 * Bundles test/harness/harness.tsx (React + services + FakeVault) into
 * test/harness/harness.js and copies the plugin styles next to it.
 * Usage: node scripts/build-harness.mjs
 */

import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const harnessDir = join(here, "..", "test", "harness");

await build({
  entryPoints: [join(harnessDir, "harness.tsx")],
  bundle: true,
  format: "iife",
  target: "es2022",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { obsidian: join(harnessDir, "..", "obsidian-mock.ts") },
  outfile: join(harnessDir, "harness.js"),
  logLevel: "info",
});

copyFileSync(join(harnessDir, "..", "..", "styles.css"), join(harnessDir, "styles.css"));
console.log("harness built");
