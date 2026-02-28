import { RefactorPlanSchema, type RefactorPlan } from "@pkg/schemas";

export function assertApproved(planJson: unknown): void {
  const plan = RefactorPlanSchema.parse(planJson);
  if (plan.approvalStatus !== "APPROVED") {
    throw new Error(
      `ApprovalGate: plan.approvalStatus is ${plan.approvalStatus}, execution is blocked.`
    );
  }
}

export function validateApproval(plan: RefactorPlan): boolean {
  return plan.approvalStatus === "APPROVED";
}

export function approvePlan(plan: RefactorPlan): RefactorPlan {
  return { ...plan, approvalStatus: "APPROVED" };
}

export function rejectPlan(plan: RefactorPlan): RefactorPlan {
  return { ...plan, approvalStatus: "REJECTED" };
}
