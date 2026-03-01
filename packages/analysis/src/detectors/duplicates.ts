import type { Project } from "ts-morph";
import { SyntaxKind } from "ts-morph";
import type { DuplicateFunction } from "@pkg/schemas";
import { generateId } from "@pkg/shared";
import { createHash } from "node:crypto";

interface FunctionFingerprint {
  file: string;
  symbol: string;
  paramCount: number;
  bodyHash: string;
  bodyLength: number;
  startLine: number;
}

function normalizeBody(text: string): string {
  return text
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/["'`]/g, '"')
    .trim();
}

function hashBody(normalizedBody: string): string {
  return createHash("sha256").update(normalizedBody).digest("hex").substring(0, 16);
}

function extractFunctionFingerprints(project: Project): FunctionFingerprint[] {
  const fingerprints: FunctionFingerprint[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();

    for (const fn of sourceFile.getFunctions()) {
      const name = fn.getName();
      if (!name) continue;
      const body = fn.getBody();
      if (!body) continue;

      const bodyText = body.getText();
      if (bodyText.length < 40) continue;

      const normalized = normalizeBody(bodyText);
      fingerprints.push({
        file: filePath,
        symbol: name,
        paramCount: fn.getParameters().length,
        bodyHash: hashBody(normalized),
        bodyLength: normalized.length,
        startLine: fn.getStartLineNumber(),
      });
    }

    for (const cls of sourceFile.getClasses()) {
      const className = cls.getName() ?? "(anonymous)";
      for (const method of cls.getMethods()) {
        const body = method.getBody();
        if (!body) continue;

        const bodyText = body.getText();
        if (bodyText.length < 40) continue;

        const normalized = normalizeBody(bodyText);
        fingerprints.push({
          file: filePath,
          symbol: `${className}.${method.getName()}`,
          paramCount: method.getParameters().length,
          bodyHash: hashBody(normalized),
          bodyLength: normalized.length,
          startLine: method.getStartLineNumber(),
        });
      }
    }

    for (const varDecl of sourceFile.getVariableDeclarations()) {
      const init = varDecl.getInitializer();
      if (!init) continue;
      if (init.getKind() !== SyntaxKind.ArrowFunction && init.getKind() !== SyntaxKind.FunctionExpression) continue;

      const bodyText = init.getText();
      if (bodyText.length < 40) continue;

      const normalized = normalizeBody(bodyText);
      fingerprints.push({
        file: filePath,
        symbol: varDecl.getName(),
        paramCount: 0,
        bodyHash: hashBody(normalized),
        bodyLength: normalized.length,
        startLine: varDecl.getStartLineNumber(),
      });
    }
  }

  return fingerprints;
}

export function detectDuplicateFunctions(project: Project): DuplicateFunction[] {
  const fingerprints = extractFunctionFingerprints(project);

  const byHash = new Map<string, FunctionFingerprint[]>();
  for (const fp of fingerprints) {
    let group = byHash.get(fp.bodyHash);
    if (!group) { group = []; byHash.set(fp.bodyHash, group); }
    group.push(fp);
  }

  const results: DuplicateFunction[] = [];

  for (const [, group] of byHash) {
    if (group.length < 2) continue;

    const uniqueFiles = new Set(group.map(g => g.file));
    if (uniqueFiles.size < 2 && group.length < 3) continue;

    const primary = group[0]!;
    results.push({
      evidenceId: generateId("dup_"),
      signature: `${primary.symbol}(${primary.paramCount} params, ${primary.bodyLength} chars)`,
      candidates: group.map(g => ({
        file: g.file,
        symbol: g.symbol,
        score: 1.0,
      })),
      suggestedUnification: uniqueFiles.size >= 2 ? "extract_common_core" : "rename_and_reuse",
    });
  }

  return results;
}
