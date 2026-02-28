import type { Agent, AgentContext } from "./types.js";

export interface DeadCodeHunterInput {
  importGraphRelPath: string;
  callGraphRelPath: string;
  entrypointsRelPath: string;
}

export interface DeadCodeHunterOutput {
  deadCodeCandidatesRelPath: string; // JSON
  evidencePackRelPath: string; // يبدأ/يُضاف إليه Evidence Pack
}

export const DeadCodeHunterAgent: Agent<DeadCodeHunterInput, DeadCodeHunterOutput> = {
  name: "DeadCodeHunterAgent",

  async run(ctx: AgentContext, input: DeadCodeHunterInput): Promise<DeadCodeHunterOutput> {
    await Promise.resolve();
    void input;

    // التنفيذ الحقيقي داخل packages/analysis/src/detectors/dead-code.ts + evidence/*
    return {
      deadCodeCandidatesRelPath: `runs/${ctx.runId}/findings/dead_code_candidates.json`,
      evidencePackRelPath: `runs/${ctx.runId}/evidence/evidence_pack.json`,
    };
  },
};
