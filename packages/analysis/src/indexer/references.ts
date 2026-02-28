import type { Project } from "ts-morph";

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
  
  // This is a simplified extraction. A real implementation would walk the AST to find the exact symbol node.
  const exportedDecls = sourceFile.getExportedDeclarations();
  const targetDecls = exportedDecls.get(symbol);
  
  if (!targetDecls || targetDecls.length === 0) return [];
  
  for (const decl of targetDecls) {
    // get references to the declaration
    if ('findReferences' in decl) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const referencedSymbols = (decl as any).findReferences();
      for (const refSymbol of referencedSymbols) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        for (const ref of refSymbol.getReferences()) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
          const node = ref.getNode();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
          const source = node.getSourceFile();
          refs.push({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
            file: source.getFilePath(),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
            line: node.getStartLineNumber(),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
            col: node.getStartLinePos(),
            kind: "reference",
          });
        }
      }
    }
  }

  return refs;
}
