import { execa } from "execa";

export interface KnipResult {
  unusedFiles: string[];
  unusedExports: Array<{ file: string; symbol: string }>;
  unusedDependencies: string[];
  rawOutput: string;
}

export async function runKnip(repoPath: string): Promise<KnipResult> {
  const result: KnipResult = {
    unusedFiles: [],
    unusedExports: [],
    unusedDependencies: [],
    rawOutput: "",
  };

  try {
    const { stdout } = await execa("npx", [
      "knip",
      "--reporter", "json"
    ], { cwd: repoPath });
    
    result.rawOutput = stdout;
    parseKnipOutput(stdout, result);

  } catch (err: any) {
    if (err.stdout) {
      result.rawOutput = err.stdout;
      parseKnipOutput(err.stdout, result);
    }
  }

  return result;
}

function parseKnipOutput(stdout: string, result: KnipResult) {
  try {
    const report = JSON.parse(stdout);
    
    // Unused files
    if (Array.isArray(report.files)) {
      result.unusedFiles = report.files;
    }

    // Unused exports
    if (Array.isArray(report.exports)) {
      for (const exp of report.exports) {
        // According to knip json reporter, exp format might have: { name, file } or { identifier, file } or similar
        const file = exp.file || exp.identifier?.file;
        const symbol = exp.name || exp.identifier?.name || exp.identifier;
        if (typeof file === "string" && typeof symbol === "string") {
          result.unusedExports.push({ file, symbol });
        }
      }
    }

    // Knip often puts things in categories like 'exports', 'types', 'unresolved', 'dependencies'
    if (Array.isArray(report.dependencies)) {
      for (const dep of report.dependencies) {
        if (typeof dep.name === "string") {
          result.unusedDependencies.push(dep.name);
        } else if (typeof dep === "string") {
          result.unusedDependencies.push(dep);
        }
      }
    }

  } catch (err) {
    // Parsing error, skip
  }
}
