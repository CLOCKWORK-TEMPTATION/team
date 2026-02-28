import type { Agent, AgentContext } from "./types.js";

export interface GraphBuilderInput {
  symbolDbRelPath: string;
}

export interface GraphBuilderOutput {
  importGraphRelPath: string;
  callGraphRelPath: string;
  typeGraphRelPath: string;
  entrypointsRelPath: string;
}

export const GraphBuilderAgent: Agent<GraphBuilderInput, GraphBuilderOutput> = {
  name: "GraphBuilderAgent",

  async run(ctx: AgentContext, input: GraphBuilderInput): Promise<GraphBuilderOutput> {
    await Promise.resolve();
    void input;

    // التنفيذ الحقيقي داخل packages/analysis/src/graphs + repo/entrypoints
    return {
      importGraphRelPath: `runs/${ctx.runId}/graphs/import-graph.json`,
      callGraphRelPath: `runs/${ctx.runId}/graphs/call-graph.json`,
      typeGraphRelPath: `runs/${ctx.runId}/graphs/type-graph.json`,
      entrypointsRelPath: `runs/${ctx.runId}/graphs/entrypoints.json`,
    };
  },
};
