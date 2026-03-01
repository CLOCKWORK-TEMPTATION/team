import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { findFiles } from "@pkg/shared";

async function parsePackageJson(pkgPath: string, repoPath: string, runtime: string[]) {
  try {
    const content = await fs.readFile(pkgPath, "utf-8");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const pkgJson = JSON.parse(content);
    const dir = path.dirname(pkgPath);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (pkgJson.main) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      runtime.push(path.resolve(dir, pkgJson.main));
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (pkgJson.bin) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (typeof pkgJson.bin === "string") {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        runtime.push(path.resolve(dir, pkgJson.bin));
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        for (const binPath of Object.values(pkgJson.bin)) {
          if (typeof binPath === "string") {
            runtime.push(path.resolve(dir, binPath));
          }
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (pkgJson.exports) {
      // Very naive extraction of exports
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      for (const val of Object.values(pkgJson.exports)) {
        if (typeof val === "string") runtime.push(path.resolve(dir, val));
        else if (typeof val === "object" && val !== null) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
          const v = val as any;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
          if (v.import) runtime.push(path.resolve(dir, v.import));
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
          if (v.require) runtime.push(path.resolve(dir, v.require));
        }
      }
    }
  } catch {
    // ignore
  }
}

export async function extractEntrypoints(repoPath: string) {
  const runtime: string[] = [];
  const test: string[] = [];
  const tooling: string[] = [];

  // Parse root package.json
  await parsePackageJson(path.join(repoPath, "package.json"), repoPath, runtime);

  // Check for workspaces
  try {
    let hasWorkspaces = false;
    const rootPkgPath = path.join(repoPath, "package.json");
    if (existsSync(rootPkgPath)) {
      const rootPkgContent = await fs.readFile(rootPkgPath, "utf-8");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const rootPkg = JSON.parse(rootPkgContent);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (rootPkg.workspaces) {
        hasWorkspaces = true;
      }
    }
    
    if (!hasWorkspaces && existsSync(path.join(repoPath, "pnpm-workspace.yaml"))) {
      hasWorkspaces = true;
    }

    if (hasWorkspaces) {
      const pkgFiles = await findFiles(repoPath, ["**/package.json"], ["node_modules"]);
      for (const file of pkgFiles) {
        if (file !== "package.json") {
          await parsePackageJson(path.join(repoPath, file), repoPath, runtime);
        }
      }
    }
  } catch {
    // ignore errors reading root package json for workspace detection
  }

  const configPatterns = [
    "vite.config.*", "vitest.config.*", "next.config.*",
    "jest.config.*", "tsconfig.json", "tsconfig.*.json",
    "eslint.config.*", ".eslintrc.*", "prettier.config.*",
    "tailwind.config.*", "postcss.config.*"
  ];
  const configFiles = await findFiles(repoPath, configPatterns, ["node_modules"]);
  configFiles.forEach(f => tooling.push(path.resolve(repoPath, f)));

  const testFiles = await findFiles(repoPath, ["**/*.test.ts", "**/*.spec.ts", "test/**/*.ts"], ["node_modules"]);
  testFiles.forEach(f => test.push(path.resolve(repoPath, f)));

  return { runtime, test, tooling };
}