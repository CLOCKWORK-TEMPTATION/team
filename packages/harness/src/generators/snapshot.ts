import fs from "node:fs/promises";
import path from "node:path";

export async function generateBaselineHarness(repoPath: string) {
  const harnessDir = path.join(repoPath, ".refactor-harness");
  await fs.mkdir(path.join(harnessDir, "src"), { recursive: true });
  await fs.mkdir(path.join(harnessDir, "tests"), { recursive: true });
  await fs.mkdir(path.join(harnessDir, "fixtures", "baseline"), { recursive: true });

  await fs.writeFile(
    path.join(harnessDir, "vitest.config.ts"),
    `import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: [".refactor-harness/tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/build/**"],
    alias: {
      "@harness": path.resolve(process.cwd(), ".refactor-harness/src"),
    },
  },
});`
  );

  await fs.writeFile(
    path.join(harnessDir, "tsconfig.json"),
    `{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "types": ["vitest/globals", "node"],
    "noEmit": true
  },
  "include": [".refactor-harness/**/*.ts", ".refactor-harness/**/*.test.ts"]
}`
  );

  await fs.writeFile(
    path.join(harnessDir, "harness.config.ts"),
    `export type HarnessCase =
  | {
      id: string;
      kind: "moduleExportCall";
      modulePath: string;
      exportName: string;
      inputs: unknown[];
    }
  | {
      id: string;
      kind: "moduleDefaultCall";
      modulePath: string;
      inputs: unknown[];
    };

export interface HarnessConfig {
  baselineDir: string;
  cases: HarnessCase[];
}

export const harnessConfig: HarnessConfig = {
  baselineDir: ".refactor-harness/fixtures/baseline",
  cases: [],
};`
  );

  await fs.writeFile(
    path.join(harnessDir, "src", "run-case.ts"),
    `import path from "node:path";
import { pathToFileURL } from "node:url";
import type { HarnessCase } from "../harness.config.js";

export async function runCase(c: HarnessCase): Promise<unknown> {
  const abs = path.resolve(process.cwd(), c.modulePath);
  const mod = await import(pathToFileURL(abs).href);

  if (c.kind === "moduleExportCall") {
    const fn = mod?.[c.exportName];
    if (typeof fn !== "function") {
      throw new Error(
        \`Harness: export "\${c.exportName}" not found or not a function in \${c.modulePath}\`
      );
    }
    return await fn(...c.inputs);
  }

  if (c.kind === "moduleDefaultCall") {
    const fn = mod?.default;
    if (typeof fn !== "function") {
      throw new Error(\`Harness: default export not a function in \${c.modulePath}\`);
    }
    return await fn(...c.inputs);
  }

  const _exhaustive: never = c;
  return _exhaustive;
}`
  );

  await fs.writeFile(
    path.join(harnessDir, "src", "fixtures.ts"),
    `import fs from "node:fs";
import path from "node:path";

export function readJson(absPath: string): unknown {
  const raw = fs.readFileSync(absPath, "utf8");
  return JSON.parse(raw);
}

export function writeJson(absPath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, JSON.stringify(value, null, 2), "utf8");
}

export function baselinePath(baselineDir: string, caseId: string): string {
  return path.resolve(process.cwd(), baselineDir, \`\${caseId}.json\`);
}`
  );

  await fs.writeFile(
    path.join(harnessDir, "tests", "equivalence.test.ts"),
    `import fs from "node:fs";
import { describe, it, expect } from "vitest";
import { harnessConfig } from "../harness.config.js";
import { runCase } from "@harness/run-case";
import { baselinePath, readJson } from "@harness/fixtures";

describe("Refactor Equivalence Harness", () => {
  it("all cases match baseline", async () => {
    for (const c of harnessConfig.cases) {
      const expectedPath = baselinePath(harnessConfig.baselineDir, c.id);

      if (!fs.existsSync(expectedPath)) {
        throw new Error(
          \`Missing baseline fixture for case "\${c.id}". Expected: \${expectedPath}\`
        );
      }

      const expected = readJson(expectedPath);
      const actual = await runCase(c);

      expect(actual).toEqual(expected);
    }
  });
});`
  );

  await fs.writeFile(
    path.join(harnessDir, "README.md"),
    `# .refactor-harness

هذا مجلد يُدار آليًا بواسطة أداة repo-refactor-ai.

## ما هو؟
حزام أمان سلوكي (Behavioral Equivalence Harness) يضمن أن الريفكتور لا يغيّر المخرجات مقارنةً بـ baseline.

## كيف يعمل؟
- الأداة تكتب baseline fixtures في:
  .refactor-harness/fixtures/baseline/*.json
- ثم تشغل:
  vitest -c .refactor-harness/vitest.config.ts

## ملاحظات
- لا تعدّل الملفات يدويًا إلا إذا كنت تريد تغيير سياسة المقارنة (غير موصى به أثناء التشغيل الآلي).
- الحالات (cases) تُولّد تلقائيًا حسب المخاطر والعقود.`
  );
}