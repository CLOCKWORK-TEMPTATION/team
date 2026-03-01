import { execa } from "execa";
import { resolve } from "node:path";
import type { BoundaryViolation } from "@pkg/schemas";

export async function runDepcruise(repoPath: string): Promise<BoundaryViolation[]> {
  try {
    // Run dependency-cruiser with json output
    // It will use the project's .dependency-cruiser.js if available
    const { stdout } = await execa("npx", [
      "depcruise",
      "src",
      "packages",
      "apps",
      "--output-type", "json"
    ], { cwd: repoPath });

    const report = JSON.parse(stdout);
    return extractViolations(report);
  } catch (err: any) {
    // depcruise returns exit code > 0 if violations are found
    if (err.stdout) {
      try {
        const report = JSON.parse(err.stdout);
        return extractViolations(report);
      } catch (parseErr) {
        return [];
      }
    }
    return [];
  }
}

function extractViolations(report: any): BoundaryViolation[] {
  const violations: BoundaryViolation[] = [];

  if (report.summary && report.summary.violations) {
    for (const v of report.summary.violations) {
      const rule = v.rule.name;
      const fromFile = v.from;
      const toFile = v.to;
      violations.push({
        fromFile,
        toFile,
        rule
      });
    }
  }

  return violations;
}
