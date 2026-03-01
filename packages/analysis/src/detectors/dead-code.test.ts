import { Project } from "ts-morph";
import { describe, it, expect } from "vitest";
import { detectDeadCode } from "./dead-code.js";
import { nodeId } from "../graphs/call-graph.js";

describe("detectDeadCode", () => {
  it("should return dead code candidates for unused exported functions", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/src/test.ts", `
      export function unused() { return 1; }
      function internalUnused() { return 2; }
    `);

    const importReverseGraph = new Map<string, string[]>();
    const callGraphData = {
      nodes: [],
      edges: []
    };
    const entrypoints = { runtime: [], test: [], tooling: [] };

    const candidates = detectDeadCode(project, importReverseGraph, callGraphData, entrypoints);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.evidence.target.symbol).toBe("unused");
    expect(candidates[0]?.evidence.target.file).toBe("/src/test.ts");
    expect(candidates[0]?.reason).toContain("unused");
  });

  it("should not return internal functions as dead code", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/src/test.ts", `
      function internal() {}
    `);

    const candidates = detectDeadCode(project, new Map(), { nodes: [], edges: [] }, { runtime: [], test: [], tooling: [] });
    expect(candidates).toHaveLength(0);
  });

  it("should not return exported functions if they have callers", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/src/test.ts", `
      export function used() {}
    `);

    const callGraphData = {
      nodes: [],
      edges: [{ source: nodeId("/src/other.ts", "caller"), target: nodeId("/src/test.ts", "used") }]
    };

    const candidates = detectDeadCode(project, new Map(), callGraphData, { runtime: [], test: [], tooling: [] });
    expect(candidates).toHaveLength(0);
  });

  it("should not return exported functions if their file has imports", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/src/test.ts", `
      export function usedFile() {}
    `);

    const importReverseGraph = new Map<string, string[]>([
      ["/src/test.ts", ["/src/other.ts"]]
    ]);

    const candidates = detectDeadCode(project, importReverseGraph, { nodes: [], edges: [] }, { runtime: [], test: [], tooling: [] });
    expect(candidates).toHaveLength(0);
  });

  it("should ignore entrypoints", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/src/main.ts", `
      export function main() {}
    `);

    const entrypoints = { runtime: ["/src/main.ts"], test: [], tooling: [] };
    const candidates = detectDeadCode(project, new Map(), { nodes: [], edges: [] }, entrypoints);
    
    expect(candidates).toHaveLength(0);
  });

  it("should return evidence with importGraph, callGraph, and exceptions for downstream evidenceSummary", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    project.createSourceFile("/src/utils.ts", `
      export function unusedUtil() { return 1; }
    `);

    const candidates = detectDeadCode(
      project,
      new Map(),
      { nodes: [], edges: [] },
      { runtime: [], test: [], tooling: [] }
    );

    expect(candidates).toHaveLength(1);
    const ev = candidates[0]!.evidence;
    expect(ev.evidence.importGraph).toBeDefined();
    expect(ev.evidence.importGraph?.inboundCount).toBe(0);
    expect(ev.evidence.importGraph?.inboundFiles).toEqual([]);
    expect(ev.evidence.callGraph).toBeDefined();
    expect(ev.evidence.callGraph?.callers).toEqual([]);
    expect(ev.exceptions).toBeDefined();
    expect(ev.exceptions.dynamicImportSuspicion).toBe(false);
    expect(ev.exceptions.sideEffectModule).toBe(false);
    expect(ev.exceptions.publicApiExposure).toBe(false);
    expect(ev.risk.reasons).toContain("No callers found");
    expect(ev.risk.reasons).toContain("No import references");
  });
});
