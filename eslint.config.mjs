import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "out-marketing/**",
    "build/**",
    "next-env.d.ts",
    // vitest coverage 出力 (HTML レポート + 自動生成 js)
    "coverage/**",
    // Playwright test results (axe attachments など)
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
