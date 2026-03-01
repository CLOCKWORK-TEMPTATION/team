import { execaCommand } from "execa";
import { logger } from "@pkg/shared";
import type { BoundaryViolation } from "@pkg/schemas";

interface DepcruiseViolation {
  from: string;
  to: string;
  rule: { name: string; severity: string };
}

export async function runDepcruise(repoPath: string): Promise<BoundaryViolation[]> {
  try {
    const { stdout } = await execaCommand(
      `npx depcruise --output-type json "${repoPath}/src"`,
      { reject: false, timeout: 120_000, cwd: repoPath }
    );

    if (!stdout || !stdout.trim()) return [];

    const firstBrace = stdout.indexOf("{");
    const lastBrace = stdout.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) return [];

    const parsed = JSON.parse(stdout.substring(firstBrace, lastBrace + 1)) as {
      output?: { modules?: Array<{ source: string; dependencies?: Array<{ resolved: string; valid: boolean; rules?: Array<{ name: string; severity: string }> }> }> };
    };

    const violations: BoundaryViolation[] = [];
    const modules = parsed.output?.modules ?? [];

    for (const mod of modules) {
      for (const dep of mod.dependencies ?? []) {
        if (dep.valid === false && dep.rules) {
          for (const rule of dep.rules) {
            violations.push({
              fromFile: mod.source,
              toFile: dep.resolved,
              rule: `${rule.name} (${rule.severity})`,
            });
          }
        }
      }
    }

    return violations;
  } catch (err) {
    logger.warn({ err }, "dependency-cruiser run failed — continuing without boundary data");
    return [];
  }
}
