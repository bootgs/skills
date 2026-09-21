import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Behaviour cases are prompts for `claude plugin eval`, not vitest files.
    exclude: ["**/node_modules/**", "tests/skills/**/behaviour/**"],
  },
  resolve: {
    alias: {
      "@testkit": resolve(import.meta.dirname, "scripts/testkit"),
    },
  },
});
