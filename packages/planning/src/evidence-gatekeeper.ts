import { EvidencePackSchema, RefactorPlanSchema } from "@pkg/schemas";

export interface EvidenceGateReport {
  ok: boolean;
  blockedSteps: { stepId: string; reason: string }[];
  warnings: { stepId: string; warning: string }[];
}

/**
 * قاعدة 4.2:
 * - لا خطة بدون evidenceRefs
 * - لا تنفيذ لحذف/دمج عالي المخاطر بدون requiresHarness=true
 * - خطوات تتأثر بـ dynamic/public API تُرفع لمخاطر أعلى أو تُحجب
 */
export function gatePlanWithEvidence(params: {
  evidencePackJson: unknown;
  planJson: unknown;
}): { gatedPlanJson: unknown; report: EvidenceGateReport } {
  const evidencePack = EvidencePackSchema.parse(params.evidencePackJson);
  const plan = RefactorPlanSchema.parse(params.planJson);

  const packetsById = new Map(evidencePack.packets.map((p) => [p.id, p]));

  const blockedSteps: EvidenceGateReport["blockedSteps"] = [];
  const warnings: EvidenceGateReport["warnings"] = [];

  const gatedSteps = plan.steps.map((step) => {
    // شرط evidenceRefs
    if (!step.evidenceRefs?.length) {
      blockedSteps.push({ stepId: step.stepId, reason: "Missing evidenceRefs (Rule 4.2)" });
      return { ...step, riskBand: "blocked" as const };
    }

    // تحقق وجود كل evidenceRef
    for (const id of step.evidenceRefs) {
      if (!packetsById.has(id)) {
        blockedSteps.push({ stepId: step.stepId, reason: `EvidenceRef not found: ${id}` });
        return { ...step, riskBand: "blocked" as const };
      }
    }

    // قواعد المخاطر المرتبطة بالديناميكية وpublic API
    let requiresHarness = step.requiresHarness;
    let riskBand = step.riskBand;

    for (const id of step.evidenceRefs) {
      const p = packetsById.get(id)!;

      if (p.exceptions.dynamicImportSuspicion) {
        warnings.push({ stepId: step.stepId, warning: `Dynamic suspicion in ${id}: force harness.` });
        requiresHarness = true;
        if (riskBand === "low") riskBand = "medium";
      }

      if (p.exceptions.publicApiExposure) {
        warnings.push({
          stepId: step.stepId,
          warning: `Public API exposure in ${id}: elevate risk + force harness.`,
        });
        requiresHarness = true;
        riskBand = "high";
      }

      if (p.recommendedAction === "propose_only") {
        blockedSteps.push({ stepId: step.stepId, reason: `Evidence ${id} is propose_only.` });
        return { ...step, riskBand: "blocked" as const };
      }
    }

    // شرط: high risk ⇒ harness إلزامي
    if (riskBand === "high" && !requiresHarness) {
      blockedSteps.push({ stepId: step.stepId, reason: "High risk step without harness requirement." });
      return { ...step, riskBand: "blocked" as const };
    }

    return { ...step, requiresHarness, riskBand };
  });

  const gatedPlanJson = {
    ...plan,
    steps: gatedSteps,
  };

  const ok = blockedSteps.length === 0;

  return {
    gatedPlanJson,
    report: { ok, blockedSteps, warnings },
  };
}
