import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // the npm obsidian package ships types only; tests use this stub
      obsidian: new URL("./test/obsidian-mock.ts", import.meta.url).pathname.replace(
        /^\/([A-Za-z]:)/,
        "$1",
      ),
    },
  },
  test: {
    include: ["test/unit/**/*.test.ts", "test/integration/**/*.test.ts", "test/ui/**/*.test.tsx"],
    environment: "node",
    globals: false,
  },
});
