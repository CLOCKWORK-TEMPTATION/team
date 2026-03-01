import type { Project, CallExpression, Node } from "ts-morph";
import { SyntaxKind } from "ts-morph";
import type { CallGraphData, CallGraphNode, CallGraphEdge } from "@pkg/schemas";

const NODE_ID_SEP = "::";

export function nodeId(file: string, name: string): string {
  return `${file}${NODE_ID_SEP}${name}`;
}

/**
 * Resolve call target to its definition file and symbol name (cross-file resolution).
 * Returns null if resolution fails (e.g. dynamic calls, external libs).
 */
function resolveCallTarget(expression: Node): { targetFile: string; targetName: string } | null {
  try {
    const symbol = expression.getSymbol();
    if (!symbol) return null;

    const declarations = symbol.getDeclarations();
    if (!declarations || declarations.length === 0) return null;

    const decl = declarations[0];
    if (!decl) return null;

    const declFile = decl.getSourceFile();
    if (!declFile) return null;

    const targetFile = declFile.getFilePath();
    const declName = symbol.getName();

    // For method declarations, use ClassName.methodName to match our node format
    const declKind = decl.getKind();
    if (declKind === SyntaxKind.MethodDeclaration || declKind === SyntaxKind.MethodSignature) {
      const parent = decl.getParent();
      if (parent?.getKind() === SyntaxKind.ClassDeclaration && "getName" in parent) {
        const className = (parent as { getName: () => string }).getName() ?? "(anonymous)";
        return { targetFile, targetName: `${className}.${declName}` };
      }
    }

    return { targetFile, targetName: declName };
  } catch {
    return null;
  }
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

      // Use getDescendants() and filter for CallExpression
      const descendants = fn.getDescendants();
      for (const desc of descendants) {
        if (desc.getKind() === SyntaxKind.CallExpression) {
          const callExpr = desc as CallExpression;
          const expression = callExpr.getExpression();
          const kind = expression.getKind();

          if (kind !== SyntaxKind.Identifier && kind !== SyntaxKind.PropertyAccessExpression) {
            continue;
          }

          const resolved = resolveCallTarget(expression);
          const targetFile = resolved?.targetFile ?? filePath;
          const targetName = resolved?.targetName ?? expression.getText();

          if (!targetName) continue;

          const targetId = nodeId(targetFile, targetName);
          if (!nodeIds.has(targetId)) {
            nodeIds.add(targetId);
            nodes.push({ id: targetId, file: targetFile, name: targetName, kind: "unknown" });
          }
          edges.push({ source: id, target: targetId, kind: "call" });
        }
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
