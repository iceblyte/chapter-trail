/**
 * Strict quality gate: typecheck → biome → vitest → core purity.
 * Exits non-zero on the first failure; no pipe masking.
 */
import { spawnSync } from "node:child_process";
import process from "node:process";

const steps = [
  { name: "typecheck", cmd: ["pnpm", "exec", "tsc", "--noEmit"] },
  { name: "lint", cmd: ["pnpm", "exec", "biome", "check", "."] },
  { name: "test", cmd: ["pnpm", "exec", "vitest", "run"] },
  { name: "core purity", cmd: ["node", "scripts/check-core-purity.mjs"] },
];

for (const step of steps) {
  console.log(`\n=== gate: ${step.name} ===`);
  const result = spawnSync(step.cmd[0], step.cmd.slice(1), {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error(`\ngate FAILED at: ${step.name}`);
    process.exit(result.status ?? 1);
  }
}
console.log("\ngate: all green");
