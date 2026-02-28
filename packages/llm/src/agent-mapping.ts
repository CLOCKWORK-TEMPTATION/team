import type { ModelProfileId } from "./profiles.js";

export type LlmMode = "none" | "optional" | "required";

export interface AgentLlmSpec {
  agentName: string;
  llmMode: LlmMode;
  profile?: ModelProfileId;
  promptPath: string;
}

export const AGENT_LLM_SPECS: AgentLlmSpec[] = [
  {
    agentName: "IntakeAgent",
    llmMode: "none",
    promptPath: "prompts/agents/intake.md",
  },
  {
    agentName: "TSStackProfilerAgent",
    llmMode: "none",
    promptPath: "prompts/agents/ts-stack-profiler.md",
  },
  {
    agentName: "IndexerAgent",
    llmMode: "none",
    promptPath: "prompts/agents/indexer.md",
  },
  {
    agentName: "GraphBuilderAgent",
    llmMode: "none",
    promptPath: "prompts/agents/graph-builder.md",
  },
  {
    agentName: "DeadCodeHunterAgent",
    llmMode: "none",
    promptPath: "prompts/agents/dead-code-hunter.md",
  },
  {
    agentName: "SemanticCloneClusteringAgent",
    llmMode: "none",
    promptPath: "prompts/agents/semantic-clone-clustering.md",
  },
  {
    agentName: "DuplicateFunctionAgent",
    llmMode: "none",
    promptPath: "prompts/agents/duplicate-function.md",
  },
  {
    agentName: "BoundariesMergeAgent",
    llmMode: "none",
    promptPath: "prompts/agents/boundaries-merge.md",
  },
  {
    agentName: "ContractMinerAgent",
    llmMode: "optional",
    profile: "CONTRACTS_AUGMENT",
    promptPath: "prompts/agents/contract-miner.md",
  },
  {
    agentName: "RiskScorerAgent",
    llmMode: "optional",
    profile: "RISK_EXPLAIN",
    promptPath: "prompts/agents/risk-scorer.md",
  },
  {
    agentName: "RefactorPlannerReportAgent",
    llmMode: "required",
    profile: "PLANNING",
    promptPath: "prompts/agents/refactor-planner-report.md",
  },
  {
    agentName: "EvidenceGatekeeperAgent",
    llmMode: "none",
    promptPath: "prompts/agents/evidence-gatekeeper.md",
  },
  {
    agentName: "PatchAuthor",
    llmMode: "required",
    profile: "CODING",
    promptPath: "prompts/agents/patch-author.md",
  },
];
