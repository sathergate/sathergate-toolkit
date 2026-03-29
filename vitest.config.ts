import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/*/src/__tests__/**/*.test.ts",
      "tests/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 15_000,
    reporters: process.env.EVAL_COLLECT ? ["default", "./tests/eval-infra/eval-reporter.ts"] : ["default"],
  },
});
