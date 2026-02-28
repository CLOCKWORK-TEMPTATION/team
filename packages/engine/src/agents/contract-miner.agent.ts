import type { Agent, AgentContext } from "./types.js";

export interface ContractMinerInput {
  // يعتمد على symbol index عمليًا
  symbolDbRelPath: string;
  entrypointsRelPath: string;
}

export interface ContractMinerOutput {
  contractsRelPath: string; // contracts.json
}

export const ContractMinerAgent: Agent<ContractMinerInput, ContractMinerOutput> = {
  name: "ContractMinerAgent",

  async run(ctx: AgentContext, input: ContractMinerInput): Promise<ContractMinerOutput> {
    await Promise.resolve();
    void input;
    // التنفيذ الحقيقي داخل packages/analysis/src/contracts/*
    return {
      contractsRelPath: `runs/${ctx.runId}/analysis/contracts.json`,
    };
  },
};
