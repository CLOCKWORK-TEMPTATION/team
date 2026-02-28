import type { Project } from "ts-morph";
import type { DeadCodeCandidate, EvidencePacket } from "@pkg/schemas";
import { generateId } from "@pkg/shared";
import { getCallers, nodeId } from "../graphs/call-graph.js";
import { getImportEvidence } from "../graphs/import-graph.js";
import type { CallGraphData } from "@pkg/schemas";

export interface Entrypoints {
  runtime: string[];
  test: string[];
  tooling: string[];
}

function isEntrypoint(filePath: string, entrypoints: Entrypoints): boolean {
  const all = [...entrypoints.runtime, ...entrypoints.test, ...entrypoints.tooling];
  return all.some((ep) => filePath === ep || filePath.startsWith(ep));
}

export function detectDeadCode(
  project: Project,
  importReverseGraph: Map<string, string[]>,
  callGraphData: CallGraphData,
  entrypoints: Entrypoints
): DeadCodeCandidate[] {
  const candidates: DeadCodeCandidate[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    if (isEntrypoint(filePath, entrypoints)) continue;

    for (const fn of sourceFile.getFunctions()) {
      const name = fn.getName();
      if (!name || name.startsWith("_")) continue;

      const isExported = fn.isExported();
      if (!isExported) continue;

      const nid = nodeId(filePath, name);
      const callers = getCallers(callGraphData.edges, nid);

      if (callers.length > 0) continue;

      const importEvidence = getImportEvidence(importReverseGraph, filePath);
      if (importEvidence.inboundCount > 0) continue;

      const target: EvidencePacket["target"] = {
        file: filePath,
        symbol: name,
        range: fn.getStartLineNumber() > 0
          ? [fn.getStartLineNumber(), fn.getEndLineNumber()]
          : undefined,
      };

      const evidence: EvidencePacket["evidence"] = {
        importGraph: {
          inboundCount: 0,
          inboundFiles: [],
        },
        callGraph: {
          callers: [],
        },
      };

      const exceptions: EvidencePacket["exceptions"] = {
        dynamicImportSuspicion: false,
        sideEffectModule: false,
        publicApiExposure: false,
      };

      const risk: EvidencePacket["risk"] = {
        score: 50,
        band: "low",
        reasons: ["No callers found", "No import references"],
      };

      const packet: EvidencePacket = {
        id: generateId("ev_"),
        kind: "dead_code",
        target,
        evidence,
        exceptions,
        risk,
        recommendedAction: "delete",
        requiresHarness: false,
      };

      candidates.push({
        evidence: packet,
        reason: `Exported function '${name}' has no callers and no import references`,
      });
    }
  }

  return candidates;
}
