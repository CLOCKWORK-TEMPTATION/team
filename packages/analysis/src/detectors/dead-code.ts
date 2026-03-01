import type { SourceFile, Project } from "ts-morph";
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

function detectDynamicImportSuspicion(project: Project, sourceFile: SourceFile, symbol: string): boolean {
  const baseName = sourceFile.getBaseNameWithoutExtension();
  for (const sf of project.getSourceFiles()) {
    if (sf === sourceFile) continue;
    const text = sf.getFullText();
    // 1. بحث عن import()
    if (text.includes("import(") && text.includes(baseName)) return true;
    // 2. بحث عن require()
    if (text.includes("require(") && text.includes(baseName)) return true;
    // 3. بحث عن string references للـ symbol
    if (text.includes(`"${symbol}"`) || text.includes(`'${symbol}'`) || text.includes(`\`${symbol}\``)) {
      return true;
    }
  }
  return false;
}

function detectPublicApiExposure(
  filePath: string,
  entrypoints: Entrypoints,
  project: Project
): boolean {
  return entrypoints.runtime.some(ep => {
    if (ep === filePath || filePath.startsWith(ep)) return true;
    const epFile = project.getSourceFile(ep);
    if (!epFile) return false;
    return epFile.getExportDeclarations().some(
      (ed) => ed.getModuleSpecifierSourceFile()?.getFilePath() === filePath
    );
  });
}

function detectSideEffectModule(sourceFile: SourceFile, importReverseGraph: Map<string, string[]>, project: Project): boolean {
  const filePath = sourceFile.getFilePath();
  const importers = importReverseGraph.get(filePath) ?? [];
  for (const importer of importers) {
    const sf = project.getSourceFile(importer);
    if (!sf) continue;
    const imports = sf.getImportDeclarations();
    for (const imp of imports) {
      if (imp.getModuleSpecifierSourceFile()?.getFilePath() === filePath) {
        if (imp.getNamedImports().length === 0 && !imp.getDefaultImport() && !imp.getNamespaceImport()) {
          return true;
        }
      }
    }
  }
  return false;
}

function isSymbolReachable(
  symbol: string,
  filePath: string,
  reverseGraph: Map<string, string[]>,
  project: Project,
  visited = new Set<string>()
): boolean {
  if (visited.has(filePath)) return false;
  visited.add(filePath);

  const importers = reverseGraph.get(filePath) ?? [];
  for (const importer of importers) {
    const sf = project.getSourceFile(importer);
    if (!sf) continue;

    // هل الملف المستورد بيعمل re-export (barrel)?
    const isBarrel = sf.getExportDeclarations().some(
      (ed) => ed.getModuleSpecifierSourceFile()?.getFilePath() === filePath
    );

    if (isBarrel) {
      // تتبع السلسلة
      if (isSymbolReachable(symbol, importer, reverseGraph, project, visited)) {
        return true;
      }
    }

    // مستورد مباشر — فحص هل بيستخدم الـ symbol
    const imports = sf.getImportDeclarations();
    for (const imp of imports) {
      if (imp.getModuleSpecifierSourceFile()?.getFilePath() === filePath) {
        const namedImports = imp.getNamedImports();
        if (namedImports.some((ni) => ni.getName() === symbol)) return true;
        if (imp.getNamespaceImport()) return true;
        if (imp.getDefaultImport() && symbol === "default") return true;
      }
    }
  }
  return false;
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

    for (const [exportName, declarations] of sourceFile.getExportedDeclarations()) {
      if (!exportName || exportName.startsWith("_")) continue;

      const decl = declarations[0];
      if (!decl) continue;

      let internalName = exportName;
      if (exportName === "default") {
        const declWithName = decl as { getName?: () => string };
        if (typeof declWithName.getName === "function") {
          internalName = declWithName.getName() ?? "default";
        } else {
          internalName = "default";
        }
      }

      const nid = nodeId(filePath, internalName);
      const callers = getCallers(callGraphData.edges, nid);

      if (callers.length > 0) continue;

      const importEvidence = getImportEvidence(importReverseGraph, filePath);
      if (importEvidence.inboundCount > 0) {
        if (isSymbolReachable(exportName, filePath, importReverseGraph, project)) {
          continue;
        }
      }

      const dynamicImportSuspicion = detectDynamicImportSuspicion(project, sourceFile, exportName);
      const sideEffectModule = detectSideEffectModule(sourceFile, importReverseGraph, project);
      const publicApiExposure = detectPublicApiExposure(filePath, entrypoints, project);

      let riskScore = 50;
      let riskBand: "low" | "medium" | "high" | "critical" = "low";
      let requiresHarness = false;
      const reasons = ["No callers found", "No import references"];

      if (dynamicImportSuspicion || sideEffectModule || publicApiExposure) {
        riskScore = 90;
        riskBand = "high";
        requiresHarness = true;
        if (dynamicImportSuspicion) reasons.push("Dynamic import suspected");
        if (sideEffectModule) reasons.push("Module might be imported for side effects");
        if (publicApiExposure) reasons.push("Exposed via public API entrypoint");
      }

      const startLine = decl.getStartLineNumber();
      const endLine = decl.getEndLineNumber();

      const target: EvidencePacket["target"] = {
        file: filePath,
        symbol: exportName === "default" ? internalName : exportName,
        range: startLine > 0 ? [startLine, endLine] : undefined,
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
        dynamicImportSuspicion,
        sideEffectModule,
        publicApiExposure,
      };

      const risk: EvidencePacket["risk"] = {
        score: riskScore,
        band: riskBand,
        reasons,
      };

      const packet: EvidencePacket = {
        id: generateId("ev_"),
        kind: "dead_code",
        target,
        evidence,
        exceptions,
        risk,
        recommendedAction: "delete",
        requiresHarness,
      };

      candidates.push({
        evidence: packet,
        reason: `Exported symbol '${exportName}' has no callers and no import references`,
      });
    }
  }

  return candidates;
}
