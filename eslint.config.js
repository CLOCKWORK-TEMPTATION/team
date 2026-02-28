import js from "@eslint/js";
import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";
import globals from "globals";

/**
 * Flat ESLint config (ESLint v9+)
 * يفرض Boundaries على monorepo (apps/ vs packages/)
 * ويمنع الاختراقات المعمارية التي تفسد (7.5 Boundaries-Aware Merging)
 */
export default [
  js.configs.recommended,

  ...tseslint.config({
    files: ["**/*.{ts,tsx,mts,cts}"],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        // Project Service أفضل من project: [] في أغلب monorepos
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      boundaries,
    },
    settings: {
      // تعريف عناصر الحدود المعمارية (Simple Boundaries)
      "boundaries/include": ["apps/**", "packages/**"],
      "boundaries/elements": [
        { type: "app", pattern: "apps/*" },

        { type: "pkg-shared", pattern: "packages/shared" },
        { type: "pkg-schemas", pattern: "packages/schemas" },
        { type: "pkg-storage", pattern: "packages/storage" },
        { type: "pkg-tooling", pattern: "packages/tooling" },

        { type: "pkg-analysis", pattern: "packages/analysis" },
        { type: "pkg-harness", pattern: "packages/harness" },

        { type: "pkg-planning", pattern: "packages/planning" },
        { type: "pkg-refactor", pattern: "packages/refactor" },

        { type: "pkg-llm", pattern: "packages/llm" },
        { type: "pkg-engine", pattern: "packages/engine" },
      ],
    },
    rules: {
      // ---------- قواعد عامة ----------
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],

      // ---------- قواعد Boundaries (الخيار الثالث: Simple Boundaries) ----------
      "boundaries/no-unknown-files": "error",

      /**
       * قاعدة الحوكمة:
       * - apps يمكنها استيراد أي packages
       * - packages منخفضة المستوى (schemas/shared/storage) لا تستورد من المستوى الأعلى
       * - tooling لا يعتمد على analysis/planning/refactor/engine/llm/harness
       * - analysis لا يعتمد على planning/refactor/engine
       * - planning لا يعتمد على refactor/engine
       * - refactor لا يعتمد على analysis/planning/engine
       * - llm لا يعتمد على engine
       */
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            // apps: مسموح لها استيراد كل packages
            {
              from: "app",
              allow: [
                "app",
                "pkg-shared",
                "pkg-schemas",
                "pkg-storage",
                "pkg-tooling",
                "pkg-analysis",
                "pkg-harness",
                "pkg-planning",
                "pkg-refactor",
                "pkg-llm",
                "pkg-engine",
              ],
            },

            // Base leaf-ish
            { from: "pkg-schemas", allow: ["pkg-schemas"] },
            { from: "pkg-shared", allow: ["pkg-shared", "pkg-schemas"] },
            {
              from: "pkg-storage",
              allow: ["pkg-storage", "pkg-schemas", "pkg-shared"],
            },

            // tooling يعتمد فقط على base
            {
              from: "pkg-tooling",
              allow: ["pkg-tooling", "pkg-schemas", "pkg-shared", "pkg-storage"],
            },

            // analysis يعتمد على base + tooling فقط
            {
              from: "pkg-analysis",
              allow: [
                "pkg-analysis",
                "pkg-schemas",
                "pkg-shared",
                "pkg-storage",
                "pkg-tooling",
              ],
            },

            // harness يعتمد على base + tooling + analysis (لربط العقود/الإشارات)
            {
              from: "pkg-harness",
              allow: [
                "pkg-harness",
                "pkg-schemas",
                "pkg-shared",
                "pkg-storage",
                "pkg-tooling",
                "pkg-analysis",
              ],
            },

            // planning يعتمد على base + analysis + harness + tooling
            {
              from: "pkg-planning",
              allow: [
                "pkg-planning",
                "pkg-schemas",
                "pkg-shared",
                "pkg-storage",
                "pkg-tooling",
                "pkg-analysis",
                "pkg-harness",
                "pkg-llm",
              ],
            },

            // refactor يعتمد على base + tooling + llm (للـ Patch Author) + storage
            {
              from: "pkg-refactor",
              allow: [
                "pkg-refactor",
                "pkg-schemas",
                "pkg-shared",
                "pkg-storage",
                "pkg-tooling",
                "pkg-llm",
              ],
            },

            // llm يعتمد على schemas/shared فقط
            {
              from: "pkg-llm",
              allow: ["pkg-llm", "pkg-schemas", "pkg-shared"],
            },

            // engine: المستوى الأعلى الذي ينسق الجميع
            {
              from: "pkg-engine",
              allow: [
                "pkg-engine",
                "pkg-schemas",
                "pkg-shared",
                "pkg-storage",
                "pkg-tooling",
                "pkg-analysis",
                "pkg-harness",
                "pkg-planning",
                "pkg-refactor",
                "pkg-llm",
              ],
            },
          ],
        },
      ],
    },
  }),

  // تجاهل artifacts والـ dist
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/build/**", "artifacts/**"],
  },
];