import { defineConfig } from "oxlint";
import {
  NEXTJS_RULES,
  RECOMMENDED_RULES,
  TANSTACK_QUERY_RULES,
} from "oxlint-plugin-react-doctor";

export default defineConfig({
  plugins: ["typescript", "unicorn", "oxc"],
  categories: {
    correctness: "error",
  },
  ignorePatterns: [
    ".agents/skills/**",
    "**/node_modules/**",
    "**/.next/**",
    "**/dist/**",
    "**/coverage/**",
    "**/*.tsbuildinfo",
    "pnpm-lock.yaml",
  ],
  overrides: [
    {
      files: ["apps/web/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
      plugins: ["typescript", "unicorn", "oxc", "nextjs", "react", "jsx-a11y"],
      jsPlugins: ["oxlint-plugin-react-doctor"],
      env: {
        browser: true,
        node: true,
      },
      rules: {
        ...RECOMMENDED_RULES,
        ...NEXTJS_RULES,
        ...TANSTACK_QUERY_RULES,
        // correctnessに含まれない、React Compilerが最適化できない構文も検出する。
        "react/unsupported-syntax": "error",
      },
    },
    {
      files: ["apps/api/**/*.{js,mjs,cjs,ts}"],
      env: {
        node: true,
      },
    },
  ],
  settings: {
    next: {
      rootDir: "apps/web/",
    },
    "react-doctor": {
      capabilities: ["react-compiler"],
      // CLIと同じ既定値で、Next.jsのexport規約やJSXの深さを判定する。
      portedRuleMode: "curated",
    },
  },
});
