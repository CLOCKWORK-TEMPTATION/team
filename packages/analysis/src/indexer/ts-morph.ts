import { Project, type ProjectOptions } from "ts-morph";
import path from "node:path";
import fs from "node:fs";

function shouldExcludeFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.includes("/node_modules/")) return true;
  if (normalized.includes("/dist/")) return true;
  if (normalized.includes("/build/")) return true;
  if (normalized.includes("/artifacts/")) return true;
  if (normalized.includes("/out/")) return true;
  if (normalized.includes("/.next/")) return true;
  if (normalized.endsWith(".d.ts") || normalized.endsWith(".d.tsx") || normalized.endsWith(".d.mts") || normalized.endsWith(".d.cts")) return true;
  if (normalized.includes(".test.") || normalized.includes(".spec.") || normalized.includes("__tests__")) return true;
  return false;
}

export function createTsProject(repoPath: string): Project {
  const tsConfigFilePath = path.join(repoPath, "tsconfig.json");

  const options: ProjectOptions = {};

  if (fs.existsSync(tsConfigFilePath)) {
    options.tsConfigFilePath = tsConfigFilePath;
  } else {
    options.compilerOptions = {
      allowJs: true,
      resolveJsonModule: true,
    };
  }

  const project = new Project(options);

  if (!fs.existsSync(tsConfigFilePath)) {
    project.addSourceFilesAtPaths([
      `${repoPath}/**/*.{ts,tsx,js,jsx,mts,cts}`,
      `!${repoPath}/**/node_modules/**`,
      `!${repoPath}/**/*.d.ts`,
    ]);
  }

  const filesToRemove = project.getSourceFiles().filter(sf => shouldExcludeFile(sf.getFilePath()));
  for (const sf of filesToRemove) {
    project.removeSourceFile(sf);
  }

  return project;
}
