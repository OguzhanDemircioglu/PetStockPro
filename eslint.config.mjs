import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Legacy/static HTML mockups + JSX canvas (Sprint 12'de React'e taşınacak)
    "preview/**",
    // Vendored assets
    "assets/**",
    // Coverage reports
    "coverage/**",
    // Playwright artifacts
    "playwright-report/**",
    "test-results/**",
  ]),
  {
    rules: {
      // _ prefix'li unused vars'ları ignore et (next-auth callback'leri, Sprint 0 placeholder'lar)
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
    },
  },
]);

export default eslintConfig;
