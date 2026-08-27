import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Vaikimisi Node: enamik contract- ja domeenteste loeb faile kettalt ning vajab
    // päris `URL`-i. DOM-i vajavad failid valivad happy-dom'i `@vitest-environment`
    // dokiplokiga (tests/unit/scheduler, tests/integration/longrun, tests/dom/*).
    environment: "node",
    include: ["tests/**/*.spec.ts"],
    // tests/e2e sisaldab Playwrighti teste, mida Vitest ei oska käivitada.
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    restoreMocks: true,
    clearMocks: true,
    unstubGlobals: true,
  },
});
