import type { SourceFile, Project, ExportDeclaration } from "ts-morph";
import { SyntaxKind } from "ts-morph";
import type { DeadCodeCandidate, EvidencePacket } from "@pkg/schemas";
import { generateId } from "@pkg/shared";
import { getCallers, nodeId } from "../graphs/call-graph.js";
import { getImportEvidence } from "../graphs/import-graph.js";
import { findSymbolReferences } from "../indexer/references.js";
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

/**
 * Resolves dynamic import/require paths from AST nodes and checks
 * whether any of them point to the given source file.
 * Uses AST-based detection — NOT string matching on basenames.
 */
function detectDynamicImportSuspicion(project: Project, sourceFile: SourceFile, _symbol: string): boolean {
  const targetPath = sourceFile.getFilePath();

  for (const sf of project.getSourceFiles()) {
    if (sf === sourceFile) continue;

    for (const callExpr of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expr = callExpr.getExpression();

      const isImportCall = expr.getKind() === SyntaxKind.ImportKeyword;
      const isRequireCall = expr.getKind() === SyntaxKind.Identifier && expr.getText() === "require";

      if (!isImportCall && !isRequireCall) continue;

      const args = callExpr.getArguments();
      if (args.length === 0) continue;
      const arg = args[0]!;

      if (arg.getKind() !== SyntaxKind.StringLiteral) continue;

      const specifier = arg.getText().slice(1, -1);
      if (!specifier.startsWith(".")) continue;

      try {
        const resolved = sf.getDirectory().getSourceFile(specifier) ??
          sf.getDirectory().getSourceFile(specifier + ".ts") ??
          sf.getDirectory().getSourceFile(specifier + ".tsx") ??
          sf.getDirectory().getSourceFile(specifier + "/index.ts") ??
          sf.getDirectory().getSourceFile(specifier + "/index.tsx");
        if (resolved && resolved.getFilePath() === targetPath) return true;
      } catch {
        // resolution failure — skip
      }
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
    for (const imp of sf.getImportDeclarations()) {
      if (imp.getModuleSpecifierSourceFile()?.getFilePath() === filePath) {
        if (imp.getNamedImports().length === 0 && !imp.getDefaultImport() && !imp.getNamespaceImport()) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Checks whether a specific symbol is imported/used from filePath,
 * either directly or transitively through barrel re-exports.
 * Handles: named imports, namespace imports, default imports,
 * `export { X } from`, `export * from`, and recursive barrel chains.
 */
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

    // Check direct import usage
    for (const imp of sf.getImportDeclarations()) {
      if (imp.getModuleSpecifierSourceFile()?.getFilePath() !== filePath) continue;

      if (imp.getNamespaceImport()) return true;
      if (imp.getDefaultImport() && symbol === "default") return true;
      if (imp.getNamedImports().some((ni) => ni.getName() === symbol || ni.getAliasNode()?.getText() === symbol)) {
        return true;
      }
    }

    // Check re-export chains (barrel pattern)
    for (const exp of sf.getExportDeclarations()) {
      if (exp.getModuleSpecifierSourceFile()?.getFilePath() !== filePath) continue;

      const isGlobExport = !exp.getNamedExports().length && !exp.isNamespaceExport();
      const reExportsSymbol = exp.getNamedExports().some(
        (ne) => ne.getName() === symbol || ne.getAliasNode()?.getText() === symbol
      );

      if (isGlobExport || reExportsSymbol || exp.isNamespaceExport()) {
        if (isSymbolReachable(symbol, importer, reverseGraph, project, visited)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Uses ts-morph's TypeScript language service to find genuine references
 * to a declaration across the entire project. Filters out the declaration
 * site itself and same-file re-export lines.
 */
function hasExternalReferences(
  project: Project,
  filePath: string,
  symbol: string
): { found: boolean; refCount: number; refs: Array<{ file: string; line: number; col: number; kind: string }> } {
  try {
    const allRefs = findSymbolReferences(project, filePath, symbol);

    const externalRefs = allRefs.filter(r => {
      const refNormalized = r.file.replace(/\\/g, "/");
      const srcNormalized = filePath.replace(/\\/g, "/");
      return refNormalized !== srcNormalized;
    });

    return {
      found: externalRefs.length > 0,
      refCount: externalRefs.length,
      refs: externalRefs,
    };
  } catch {
    return { found: false, refCount: 0, refs: [] };
  }
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

    // Skip test/spec files from dead code detection
    const normalized = filePath.replace(/\\/g, "/");
    if (/\.(test|spec)\.(ts|tsx|js|jsx|mts|cts)$/.test(normalized)) continue;

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

      // Gate 1: Call graph — are there callers?
      const nid = nodeId(filePath, internalName);
      const callers = getCallers(callGraphData.edges, nid);
      if (callers.length > 0) continue;

      // Gate 2: Import graph — is the symbol reachable through imports/re-exports?
      const importEvidence = getImportEvidence(importReverseGraph, filePath);
      if (importEvidence.inboundCount > 0) {
        if (isSymbolReachable(exportName, filePath, importReverseGraph, project)) {
          continue;
        }
      }

      // Gate 3: TS References — does TypeScript's language service find real usages?
      const tsRefs = hasExternalReferences(project, filePath, exportName);
      if (tsRefs.found) {
        continue;
      }

      // All gates passed — this symbol appears genuinely unused
      const dynamicImportSuspicion = detectDynamicImportSuspicion(project, sourceFile, exportName);
      const sideEffectModule = detectSideEffectModule(sourceFile, importReverseGraph, project);
      const publicApiExposure = detectPublicApiExposure(filePath, entrypoints, project);

      let riskScore = 30;
      let riskBand: "low" | "medium" | "high" | "critical" = "low";
      let requiresHarness = false;
      const reasons: string[] = [];

      if (callers.length === 0) reasons.push("No callers in call graph");
      if (importEvidence.inboundCount === 0) reasons.push("No import references");
      if (tsRefs.refCount === 0) reasons.push("No TS references in project");

      if (dynamicImportSuspicion) {
        riskScore = 80;
        riskBand = "high";
        requiresHarness = true;
        reasons.push("Dynamic import/require detected pointing to this file");
      }
      if (sideEffectModule) {
        riskScore = Math.max(riskScore, 70);
        if (riskBand === "low") riskBand = "medium";
        requiresHarness = true;
        reasons.push("Module may be imported for side effects");
      }
      if (publicApiExposure) {
        riskScore = Math.max(riskScore, 90);
        riskBand = "high";
        requiresHarness = true;
        reasons.push("Exposed via public API entrypoint");
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
          inboundCount: importEvidence.inboundCount,
          inboundFiles: importEvidence.inboundFiles,
        },
        callGraph: {
          callers: [],
        },
        tsReferences: {
          refCount: tsRefs.refCount,
          refs: tsRefs.refs.map(r => ({ ...r, col: Math.max(r.col, 1) })),
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
        recommendedAction: dynamicImportSuspicion || publicApiExposure ? "propose_only" : "delete",
        requiresHarness,
      };

      candidates.push({
        evidence: packet,
        reason: `Exported symbol '${exportName}' passed all 3 gates: no callers, not reachable via imports, no TS references`,
      });
    }
  }

  return candidates;
}
