import { Project, type ProjectOptions } from "ts-morph";
import path from "node:path";
import fs from "node:fs";

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

  return new Project(options);
}
