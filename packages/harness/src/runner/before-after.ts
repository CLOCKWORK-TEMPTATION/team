import { runCommand } from "@pkg/shared";

export async function runHarnessTests(repoPath: string) {
  const result = await runCommand("npx", ["vitest", "run", "-c", ".refactor-harness/vitest.config.ts"], {
    cwd: repoPath,
  });
  
  return {
    success: result.exitCode === 0,
    output: result.stdout || result.stderr,
  };
}