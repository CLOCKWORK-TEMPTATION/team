import type { Project } from "ts-morph";

export function buildImportGraph(project: Project) {
  const graph = new Map<string, string[]>(); // File -> imported files
  const reverseGraph = new Map<string, string[]>(); // File -> imported by

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    if (!graph.has(filePath)) graph.set(filePath, []);
    
    const imports = sourceFile.getImportDeclarations();
    for (const imp of imports) {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      if (!moduleSpecifier.startsWith(".")) continue; // skip externals

      const resolvedSourceFile = imp.getModuleSpecifierSourceFile();
      if (resolvedSourceFile) {
        const resolvedPath = resolvedSourceFile.getFilePath();
        graph.get(filePath)!.push(resolvedPath);

        if (!reverseGraph.has(resolvedPath)) reverseGraph.set(resolvedPath, []);
        reverseGraph.get(resolvedPath)!.push(filePath);
      }
    }
  }

  return { graph, reverseGraph };
}

export function getImportEvidence(reverseGraph: Map<string, string[]>, filePath: string) {
  const inboundFiles = reverseGraph.get(filePath) ?? [];
  return {
    inboundCount: inboundFiles.length,
    inboundFiles
  };
}