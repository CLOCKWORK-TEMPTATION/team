import type { Agent, AgentContext } from "./types.js";

export interface RiskScorerInput {
  evidencePackRelPath: string;
  entrypointsRelPath: string;
  contractsRelPath: string;
}

export interface RiskScorerOutput {
  riskScoresRelPath: string; // risk_scores.json
  evidencePackRelPath: string; // updated (bands/reasons)
}

export const RiskScorerAgent: Agent<RiskScorerInput, RiskScorerOutput> = {
  name: "RiskScorerAgent",

  async run(ctx: AgentContext, input: RiskScorerInput): Promise<RiskScorerOutput> {
    await Promise.resolve();
    void input;

    // التنفيذ الحقيقي داخل packages/analysis/src/risk/*
    // ويُحدِّث evidence_pack.json ليحتوي risk bands + requiresHarness
    return {
      riskScoresRelPath: `runs/${ctx.runId}/analysis/risk_scores.json`,
      evidencePackRelPath: `runs/${ctx.runId}/evidence/evidence_pack.json`,
    };
  },
};
