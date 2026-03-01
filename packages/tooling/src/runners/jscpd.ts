import { execaCommand } from "execa";
import { logger } from "@pkg/shared";
import type { CloneCluster } from "@pkg/schemas";
import { generateId } from "@pkg/shared";

interface JscpdClone {
  format: string;
  foundDate: string;
  duplicationA: { sourceId: string; start: { line: number }; end: { line: number }; fragment: string };
  duplicationB: { sourceId: string; start: { line: number }; end: { line: number }; fragment: string };
}

export async function runJscpd(repoPath: string): Promise<CloneCluster[]> {
  try {
    const { stdout } = await execaCommand(
      `npx jscpd "${repoPath}" --reporters json --silent --ignore "node_modules,dist,build,.next,.git" --min-lines 5 --min-tokens 50 --format "typescript,javascript,tsx,jsx"`,
      { reject: false, timeout: 120_000 }
    );

    if (!stdout || !stdout.trim()) return [];

    const firstBrace = stdout.indexOf("{");
    const lastBrace = stdout.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) return [];

    const parsed = JSON.parse(stdout.substring(firstBrace, lastBrace + 1)) as {
      duplicates?: JscpdClone[];
    };

    if (!parsed.duplicates || parsed.duplicates.length === 0) return [];

    return parsed.duplicates.map((dup): CloneCluster => ({
      clusterId: generateId("clone_"),
      similarity: 1.0,
      occurrences: [
        {
          file: dup.duplicationA.sourceId,
          startLine: dup.duplicationA.start.line,
          endLine: dup.duplicationA.end.line,
        },
        {
          file: dup.duplicationB.sourceId,
          startLine: dup.duplicationB.start.line,
          endLine: dup.duplicationB.end.line,
        },
      ],
    }));
  } catch (err) {
    logger.warn({ err }, "jscpd run failed — continuing without clone data");
    return [];
  }
}
