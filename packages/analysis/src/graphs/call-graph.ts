import type { Project } from "ts-morph";
import type { CallGraphData, CallGraphNode, CallGraphEdge } from "@pkg/schemas";

const SyntaxKindCallExpression = 206;

const NODE_ID_SEP = "::";

export function nodeId(file: string, name: string): string {
  return `${file}${NODE_ID_SEP}${name}`;
}

export function buildCallGraph(project: Project): CallGraphData {
  const nodes: CallGraphNode[] = [];
  const edges: CallGraphEdge[] = [];
  const nodeIds = new Set<string>();

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();

    for (const fn of sourceFile.getFunctions()) {
      const name = fn.getName() ?? "(anonymous)";
      const id = nodeId(filePath, name);
      if (!nodeIds.has(id)) {
        nodeIds.add(id);
        const startLine = fn.getStartLineNumber();
        const startCol = fn.getStartLinePos();
        nodes.push({
          id,
          file: filePath,
          name,
          kind: fn.getKindName() === "ArrowFunction" ? "arrow_function" : "function",
          startLine: startLine > 0 ? startLine : undefined,
          startCol: startCol >= 0 ? startCol : undefined,
        });
      }

      for (const call of fn.getDescendantsOfKind(SyntaxKindCallExpression)) {
        const expr = (call as unknown as { getExpression(): { getText(): string } }).getExpression();
        const text = expr.getText();
        const targetId = nodeId(filePath, text);
        if (!nodeIds.has(targetId)) {
          nodeIds.add(targetId);
          nodes.push({ id: targetId, file: filePath, name: text, kind: "unknown" });
        }
        edges.push({ source: id, target: targetId, kind: "call" });
      }
    }

    for (const cls of sourceFile.getClasses()) {
      const name = cls.getName() ?? "(anonymous)";
      const id = nodeId(filePath, name);
      if (!nodeIds.has(id)) {
        nodeIds.add(id);
        const startLine = cls.getStartLineNumber();
        nodes.push({
          id,
          file: filePath,
          name,
          kind: "class",
          startLine: startLine > 0 ? startLine : undefined,
        });
      }

      for (const method of cls.getMethods()) {
        const methodName = method.getName();
        const methodId = nodeId(filePath, `${name}.${methodName}`);
        if (!nodeIds.has(methodId)) {
          nodeIds.add(methodId);
          nodes.push({
            id: methodId,
            file: filePath,
            name: methodName,
            kind: "method",
            startLine: method.getStartLineNumber() > 0 ? method.getStartLineNumber() : undefined,
          });
        }
        edges.push({ source: id, target: methodId, kind: "reference" });
      }
    }
  }

  return { nodes, edges };
}

export function getCallers(edges: CallGraphEdge[], targetNodeId: string): string[] {
  return edges.filter((e) => e.target === targetNodeId).map((e) => e.source);
}

export function getCallees(edges: CallGraphEdge[], sourceNodeId: string): string[] {
  return edges.filter((e) => e.source === sourceNodeId).map((e) => e.target);
}
