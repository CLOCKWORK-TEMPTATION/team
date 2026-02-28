import type { AgentContext } from "../agents/types.js";
import type { OrchestratorState } from "./state.js";

import { IntakeAgent } from "../agents/intake.agent.js";
import { TSStackProfilerAgent } from "../agents/ts-stack-profiler.agent.js";
import { IndexerAgent } from "../agents/indexer.agent.js";
import { GraphBuilderAgent } from "../agents/graph-builder.agent.js";
import { DeadCodeHunterAgent } from "../agents/dead-code-hunter.agent.js";
import { SemanticCloneClusteringAgent } from "../agents/semantic-clone-clustering.agent.js";
import { DuplicateFunctionAgent } from "../agents/duplicate-function.agent.js";
import { BoundariesMergeAgent } from "../agents/boundaries-merge.agent.js";
import { ContractMinerAgent } from "../agents/contract-miner.agent.js";
import { RiskScorerAgent } from "../agents/risk-scorer.agent.js";
import { RefactorPlannerReportAgent } from "../agents/refactor-planner-report.agent.js";
import { EvidenceGatekeeperAgent } from "../agents/evidence-gatekeeper.agent.js";

export async function runScanAndPlan(
  ctx: AgentContext,
  s: OrchestratorState
): Promise<OrchestratorState> {
  // 1) Intake
  s.repoProfile = await IntakeAgent.run(ctx, {});
  s.stackFingerprint = await TSStackProfilerAgent.run(ctx, {
    packageJsonPaths: s.repoProfile.packageJsonPaths,
  });

  // 2) Indexing
  const indexOut = await IndexerAgent.run(ctx, {});
  s.symbolDbRelPath = indexOut.symbolDbRelPath;
  s.indexMetaRelPath = indexOut.indexMetaRelPath;

  // 3) Graphs + Entrypoints
  const symbolDb = s.symbolDbRelPath;
  if (!symbolDb) throw new Error("Indexer did not produce symbolDbRelPath");
  const graphsOut = await GraphBuilderAgent.run(ctx, { symbolDbRelPath: symbolDb });
  s.importGraphRelPath = graphsOut.importGraphRelPath;
  s.callGraphRelPath = graphsOut.callGraphRelPath;
  s.typeGraphRelPath = graphsOut.typeGraphRelPath;
  s.entrypointsRelPath = graphsOut.entrypointsRelPath;

  // 4) Fan-out (تحليل متوازي منطقيًا – هنا متسلسل لتبسيط التنفيذ)
  const imp = s.importGraphRelPath;
  const call = s.callGraphRelPath;
  const ep = s.entrypointsRelPath;
  if (!imp || !call || !ep) throw new Error("GraphBuilder did not produce required paths");
  const deadOut = await DeadCodeHunterAgent.run(ctx, {
    importGraphRelPath: imp,
    callGraphRelPath: call,
    entrypointsRelPath: ep,
  });
  s.deadCodeCandidatesRelPath = deadOut.deadCodeCandidatesRelPath;
  s.evidencePackRelPath = deadOut.evidencePackRelPath;

  const semOut = await SemanticCloneClusteringAgent.run(ctx, {});
  s.semanticCloneClustersRelPath = semOut.semanticCloneClustersRelPath;
  s.evidencePackRelPath = semOut.evidencePackRelPath;

  const semClusters = s.semanticCloneClustersRelPath;
  if (!semClusters) throw new Error("SemanticCloneClustering did not produce clusters path");
  const dupOut = await DuplicateFunctionAgent.run(ctx, {
    semanticCloneClustersRelPath: semClusters,
    importGraphRelPath: imp,
  });
  s.duplicateFunctionsRelPath = dupOut.duplicateFunctionsRelPath;
  s.evidencePackRelPath = dupOut.evidencePackRelPath;

  const bmOut = await BoundariesMergeAgent.run(ctx, {
    importGraphRelPath: imp,
    entrypointsRelPath: ep,
  });
  s.mergeCandidatesRelPath = bmOut.mergeCandidatesRelPath;
  s.boundaryViolationsRelPath = bmOut.boundaryViolationsRelPath;
  s.evidencePackRelPath = bmOut.evidencePackRelPath;

  // 5) Contracts + Risk
  const contractsOut = await ContractMinerAgent.run(ctx, {
    symbolDbRelPath: symbolDb,
    entrypointsRelPath: ep,
  });
  s.contractsRelPath = contractsOut.contractsRelPath;

  const evPack = s.evidencePackRelPath;
  const contracts = s.contractsRelPath;
  if (!evPack || !contracts) throw new Error("Missing evidencePack or contracts path");
  const riskOut = await RiskScorerAgent.run(ctx, {
    evidencePackRelPath: evPack,
    entrypointsRelPath: ep,
    contractsRelPath: contracts,
  });
  s.riskScoresRelPath = riskOut.riskScoresRelPath;
  s.evidencePackRelPath = riskOut.evidencePackRelPath;

  // 6) Plan + Report
  const deadCand = s.deadCodeCandidatesRelPath;
  const dupFunc = s.duplicateFunctionsRelPath;
  const mergeCand = s.mergeCandidatesRelPath;
  const boundViol = s.boundaryViolationsRelPath;
  const riskScores = s.riskScoresRelPath;
  if (!deadCand || !dupFunc || !mergeCand || !boundViol || !riskScores) {
    throw new Error("Missing paths for RefactorPlannerReport");
  }
  const planOut = await RefactorPlannerReportAgent.run(ctx, {
    evidencePackRelPath: evPack,
    deadCodeCandidatesRelPath: deadCand,
    semanticCloneClustersRelPath: semClusters,
    duplicateFunctionsRelPath: dupFunc,
    mergeCandidatesRelPath: mergeCand,
    boundaryViolationsRelPath: boundViol,
    contractsRelPath: contracts,
    riskScoresRelPath: riskScores,
  });
  s.findingsRelPath = planOut.findingsRelPath;
  s.refactorPlanRelPath = planOut.refactorPlanRelPath;
  s.reportMdRelPath = planOut.reportMdRelPath;

  // 7) Evidence Gatekeeper (قاعدة 4.2)
  const refPlan = s.refactorPlanRelPath;
  if (!refPlan) throw new Error("RefactorPlannerReport did not produce plan path");
  const gateOut = await EvidenceGatekeeperAgent.run(ctx, {
    evidencePackRelPath: evPack,
    refactorPlanRelPath: refPlan,
  });
  s.gatedPlanRelPath = gateOut.gatedPlanRelPath;
  s.gateReportRelPath = gateOut.gateReportRelPath;

  return s;
}
