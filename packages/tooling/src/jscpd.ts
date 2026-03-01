import { execa } from "execa";
import { resolve, join } from "node:path";
import { readFile, rm } from "node:fs/promises";
import { generateId } from "@pkg/shared";
import type { CloneCluster } from "@pkg/schemas";

export async function runJscpd(repoPath: string): Promise<CloneCluster[]> {
  const outDir = join(repoPath, ".refactor-harness", "jscpd");
  try {
    await execa("npx", [
      "jscpd",
      repoPath,
      "--reporters", "json",
      "--output", outDir,
      "--ignore", "**/node_modules/**,**/dist/**,**/build/**",
      "--silent"
    ], { cwd: repoPath });
  } catch (err: any) {
    // jscpd exits with 1 if clones are found! This is expected.
    // We just ignore the error if it's because of found clones.
  }

  try {
    const reportPath = join(outDir, "jscpd-report.json");
    const data = await readFile(reportPath, "utf-8");
    const report = JSON.parse(data);

    // Convert to CloneCluster[]
    const clusters: CloneCluster[] = [];
    if (report.duplicates) {
      for (const dup of report.duplicates) {
        clusters.push({
          clusterId: generateId("clone_"),
          similarity: 1.0, // jscpd finds exact/near exact clones
          occurrences: [
            {
              file: dup.firstFile.name,
              startLine: dup.firstFile.start,
              endLine: dup.firstFile.end,
            },
            {
              file: dup.secondFile.name,
              startLine: dup.secondFile.start,
              endLine: dup.secondFile.end,
            }
          ]
        });
      }
    }
    return clusters;
  } catch (err) {
    return [];
  } finally {
    // Cleanup
    await rm(outDir, { recursive: true, force: true }).catch(() => {});
  }
}
