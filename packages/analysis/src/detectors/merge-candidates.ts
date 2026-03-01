import type { MergeCandidate } from "@pkg/schemas";
import { generateId } from "@pkg/shared";

/**
 * Analyzes import co-occurrence to find files that are always imported together,
 * suggesting they could be merged into a single module.
 */
export function detectMergeCandidates(
  importGraph: Map<string, string[]>,
  reverseGraph: Map<string, string[]>
): MergeCandidate[] {
  const candidates: MergeCandidate[] = [];
  const processed = new Set<string>();

  const allFiles = new Set([...importGraph.keys(), ...reverseGraph.keys()]);

  for (const fileA of allFiles) {
    if (processed.has(fileA)) continue;
    const importersA = new Set(reverseGraph.get(fileA) ?? []);
    if (importersA.size < 2) continue;

    for (const fileB of allFiles) {
      if (fileB <= fileA) continue;
      if (processed.has(fileB)) continue;

      const importersB = new Set(reverseGraph.get(fileB) ?? []);
      if (importersB.size < 2) continue;

      const intersection = [...importersA].filter(f => importersB.has(f));
      const union = new Set([...importersA, ...importersB]);

      const jaccardIndex = union.size > 0 ? intersection.length / union.size : 0;

      if (jaccardIndex >= 0.7 && intersection.length >= 3) {
        const pairKey = [fileA, fileB].sort().join("|");
        if (!processed.has(pairKey)) {
          processed.add(pairKey);
          candidates.push({
            evidenceId: generateId("merge_"),
            kind: "merge_files",
            rationale: `Files are co-imported in ${intersection.length}/${union.size} consumers (Jaccard=${jaccardIndex.toFixed(2)})`,
            targets: [fileA, fileB],
            notes: [
              `Co-importers: ${intersection.slice(0, 5).join(", ")}${intersection.length > 5 ? "..." : ""}`,
              `Jaccard similarity: ${jaccardIndex.toFixed(2)}`,
            ],
          });
        }
      }
    }
  }

  return candidates;
}
