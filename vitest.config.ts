import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/unit/**/*.test.ts", "test/integration/**/*.test.ts", "test/ui/**/*.test.tsx"],
    environment: "node",
    globals: false,
    bench: {
      include: ["test/bench/**/*.bench.ts"],
    },
  },
});
