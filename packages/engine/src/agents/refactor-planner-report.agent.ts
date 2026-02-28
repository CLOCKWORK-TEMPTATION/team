import type { Agent, AgentContext } from "./types.js";

export interface RefactorPlannerReportInput {
  evidencePackRelPath: string;
  deadCodeCandidatesRelPath: string;
  semanticCloneClustersRelPath: string;
  duplicateFunctionsRelPath: string;
  mergeCandidatesRelPath: string;
  boundaryViolationsRelPath: string;
  contractsRelPath: string;
  riskScoresRelPath: string;
}

export interface RefactorPlannerReportOutput {
  findingsRelPath: string; // findings.json
  refactorPlanRelPath: string; // refactor_plan.json (approvalStatus=PENDING)
  reportMdRelPath: string; // report.md
}

export const RefactorPlannerReportAgent: Agent<
  RefactorPlannerReportInput,
  RefactorPlannerReportOutput
> = {
  name: "RefactorPlannerReportAgent",

  async run(
    ctx: AgentContext,
    input: RefactorPlannerReportInput
  ): Promise<RefactorPlannerReportOutput> {
    await Promise.resolve();
    void input;

    // التنفيذ الحقيقي:
    // - packages/planning/src/planner.ts
    // - packages/planning/src/markdown-report.ts
    return {
      findingsRelPath: `runs/${ctx.runId}/report/findings.json`,
      refactorPlanRelPath: `runs/${ctx.runId}/report/refactor_plan.json`,
      reportMdRelPath: `runs/${ctx.runId}/report/report.md`,
    };
  },
};
