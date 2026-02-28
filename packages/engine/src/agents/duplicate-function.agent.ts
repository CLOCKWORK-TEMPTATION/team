import type { Agent, AgentContext } from "./types.js";

export interface DuplicateFunctionInput {
  semanticCloneClustersRelPath: string;
  importGraphRelPath: string;
}

export interface DuplicateFunctionOutput {
  duplicateFunctionsRelPath: string;
  evidencePackRelPath: string;
}

export const DuplicateFunctionAgent: Agent<DuplicateFunctionInput, DuplicateFunctionOutput> = {
  name: "DuplicateFunctionAgent",

  async run(ctx: AgentContext, input: DuplicateFunctionInput): Promise<DuplicateFunctionOutput> {
    await Promise.resolve();
    void input;

    // التنفيذ الحقيقي داخل packages/analysis/src/detectors/duplicates.ts
    return {
      duplicateFunctionsRelPath: `runs/${ctx.runId}/findings/duplicate_functions.json`,
      evidencePackRelPath: `runs/${ctx.runId}/evidence/evidence_pack.json`,
    };
  },
};
