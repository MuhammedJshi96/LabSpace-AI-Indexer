import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    // Catalog/store fixtures are substantial. Bound worker fan-out so a local
    // browser audit cannot starve module loading on high-core-count machines.
    maxWorkers: 4,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/domain/**/*.ts", "server/repository.ts"],
    },
  },
});
