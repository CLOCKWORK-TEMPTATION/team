import fs from "node:fs/promises";
import path from "node:path";
import { findFiles } from "@pkg/shared";

export async function extractEntrypoints(repoPath: string) {
  const runtime: string[] = [];
  const test: string[] = [];
  const tooling: string[] = [];

  try {
    const pkgJsonPath = path.join(repoPath, "package.json");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, "utf-8"));
    
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (pkgJson.main) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      runtime.push(path.resolve(repoPath, pkgJson.main));
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (pkgJson.exports) {
      // Very naive extraction of exports
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      for (const val of Object.values(pkgJson.exports)) {
        if (typeof val === "string") runtime.push(path.resolve(repoPath, val));
        else if (typeof val === "object" && val !== null) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
          const v = val as any;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
          if (v.import) runtime.push(path.resolve(repoPath, v.import));
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
          if (v.require) runtime.push(path.resolve(repoPath, v.require));
        }
      }
    }
  } catch {
    // ignore
  }

  const testFiles = await findFiles(repoPath, ["**/*.test.ts", "**/*.spec.ts", "test/**/*.ts"], ["node_modules"]);
  testFiles.forEach(f => test.push(path.resolve(repoPath, f)));

  return { runtime, test, tooling };
}