import type { Project, Node, ReferencedSymbol } from "ts-morph";

export interface SymbolReference {
  file: string;
  line: number;
  col: number;
  kind: string;
}

export function findSymbolReferences(project: Project, filePath: string, symbol: string): SymbolReference[] {
  const sourceFile = project.getSourceFile(filePath);
  if (!sourceFile) return [];

  const refs: SymbolReference[] = [];

  const exportedDecls = sourceFile.getExportedDeclarations();
  const targetDecls = exportedDecls.get(symbol);

  if (!targetDecls || targetDecls.length === 0) return [];

  for (const decl of targetDecls) {
    if (!("findReferences" in decl) || typeof (decl as unknown as Record<string, unknown>).findReferences !== "function") {
      continue;
    }

    try {
      const referencedSymbols = (decl as unknown as { findReferences(): ReferencedSymbol[] }).findReferences();
      for (const refSymbol of referencedSymbols) {
        for (const ref of refSymbol.getReferences()) {
          const node: Node = ref.getNode();
          const source = node.getSourceFile();
          const line = node.getStartLineNumber();
          const col = node.getStart() - node.getStartLinePos() + 1;
          refs.push({
            file: source.getFilePath(),
            line,
            col: Math.max(col, 1),
            kind: ref.isDefinition() ? "definition" : "reference",
          });
        }
      }
    } catch {
      // findReferences can throw on some node types — skip
    }
  }

  return refs;
}
