import fs from "node:fs";
import path from "node:path";
import type { Agent, AgentContext } from "./types.js";

export interface TSStackProfilerInput {
  packageJsonPaths: string[];
}

export interface StackFingerprintOutput {
  nodeProjectType: "single" | "monorepo";
  usesTypeScript: boolean;
  usesVite: boolean;
  usesNext: boolean;
  usesNest: boolean;
  usesVitest: boolean;
  usesJest: boolean;
  detectedWorkspaces: boolean;
  entryHints: {
    hasBin: boolean;
    hasExports: boolean;
    hasMain: boolean;
  };
}

function readJson(p: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const TSStackProfilerAgent: Agent<TSStackProfilerInput, StackFingerprintOutput> = {
  name: "TSStackProfilerAgent",

  async run(ctx: AgentContext, input: TSStackProfilerInput): Promise<StackFingerprintOutput> {
    await Promise.resolve();
    const roots = input.packageJsonPaths.map((p) => ({ p, json: readJson(p) })).filter((x) => x.json);

    const rootPkg =
      roots.find((x) => path.dirname(x.p) === ctx.repoPath)?.json ?? roots[0]?.json ?? {};

    const deps: Record<string, string> = {
      ...(typeof rootPkg.dependencies === "object" && rootPkg.dependencies ? rootPkg.dependencies : {}),
      ...(typeof rootPkg.devDependencies === "object" && rootPkg.devDependencies ? rootPkg.devDependencies : {}),
      ...(typeof rootPkg.peerDependencies === "object" && rootPkg.peerDependencies ? rootPkg.peerDependencies : {}),
    };

    const hasTSConfig =
      fs.existsSync(path.join(ctx.repoPath, "tsconfig.json")) ||
      roots.some((x) => fs.existsSync(path.join(path.dirname(x.p), "tsconfig.json")));

    const detectedWorkspaces =
      Boolean(rootPkg.workspaces) || fs.existsSync(path.join(ctx.repoPath, "pnpm-workspace.yaml"));

    const usesTypeScript = hasTSConfig || "typescript" in deps;
    const usesVite = "vite" in deps;
    const usesNext = "next" in deps;
    const usesNest = "@nestjs/core" in deps || "@nestjs/common" in deps;
    const usesVitest = "vitest" in deps;
    const usesJest = "jest" in deps || "@jest/globals" in deps;

    const entryHints = {
      hasBin: Boolean(rootPkg.bin),
      hasExports: Boolean(rootPkg.exports),
      hasMain: Boolean(rootPkg.main),
    };

    const nodeProjectType: "single" | "monorepo" = detectedWorkspaces ? "monorepo" : "single";

    return {
      nodeProjectType,
      usesTypeScript,
      usesVite,
      usesNext,
      usesNest,
      usesVitest,
      usesJest,
      detectedWorkspaces,
      entryHints,
    };
  },
};
