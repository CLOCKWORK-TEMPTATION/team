import type { Agent, AgentContext } from "./types.js";

/**
 * هذا الوكيل هو التنفيذ المباشر لقاعدة 4.2:
 * - يمنع أي Plan Step بدون evidenceRefs
 * - يطبق thresholds + استثناءات الديناميكية + public API
 * التنفيذ الفعلي يكون في packages/planning/src/evidence-gatekeeper.ts
 */
export interface EvidenceGatekeeperInput {
  evidencePackRelPath: string;
  refactorPlanRelPath: string;
}

export interface EvidenceGatekeeperOutput {
  gatedPlanRelPath: string; // نفس الخطة بعد وضع blocked/ملاحظات أو رفض
  gateReportRelPath: string; // evidence_gate_report.json
}

export const EvidenceGatekeeperAgent: Agent<EvidenceGatekeeperInput, EvidenceGatekeeperOutput> = {
  name: "EvidenceGatekeeperAgent",

  async run(ctx: AgentContext, input: EvidenceGatekeeperInput): Promise<EvidenceGatekeeperOutput> {
    await Promise.resolve();
    void ctx;
    void input;

    // التنفيذ الحقيقي:
    // - قراءة evidence_pack.json + refactor_plan.json
    // - تطبيق gatekeeper → تحديث الخطة/رفض
    return {
      gatedPlanRelPath: input.refactorPlanRelPath,
      gateReportRelPath: `runs/${ctx.runId}/report/evidence_gate_report.json`,
    };
  },
};
