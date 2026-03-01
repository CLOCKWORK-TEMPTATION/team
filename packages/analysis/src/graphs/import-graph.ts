import type { Project } from "ts-morph";

function addEdge(graph: Map<string, string[]>, from: string, to: string) {
  let list = graph.get(from);
  if (!list) { list = []; graph.set(from, list); }
  if (!list.includes(to)) list.push(to);
}

export function buildImportGraph(project: Project) {
  const graph = new Map<string, string[]>();
  const reverseGraph = new Map<string, string[]>();

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    if (!graph.has(filePath)) graph.set(filePath, []);

    for (const imp of sourceFile.getImportDeclarations()) {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      if (!moduleSpecifier.startsWith(".")) continue;
      const resolved = imp.getModuleSpecifierSourceFile();
      if (resolved) {
        const resolvedPath = resolved.getFilePath();
        addEdge(graph, filePath, resolvedPath);
        addEdge(reverseGraph, resolvedPath, filePath);
      }
    }

    for (const exp of sourceFile.getExportDeclarations()) {
      const moduleSpecifier = exp.getModuleSpecifierValue();
      if (!moduleSpecifier || !moduleSpecifier.startsWith(".")) continue;
      const resolved = exp.getModuleSpecifierSourceFile();
      if (resolved) {
        const resolvedPath = resolved.getFilePath();
        addEdge(graph, filePath, resolvedPath);
        addEdge(reverseGraph, resolvedPath, filePath);
      }
    }
  }

  return { graph, reverseGraph };
}

export function getImportEvidence(reverseGraph: Map<string, string[]>, filePath: string) {
  const inboundFiles = reverseGraph.get(filePath) ?? [];
  return {
    inboundCount: inboundFiles.length,
    inboundFiles,
  };
}