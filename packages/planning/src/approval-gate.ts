import type { RefactorPlan } from "@pkg/schemas";

export function validateApproval(plan: RefactorPlan): boolean {
  return plan.approvalStatus === "APPROVED";
}

export function approvePlan(plan: RefactorPlan): RefactorPlan {
  return { ...plan, approvalStatus: "APPROVED" };
}

export function rejectPlan(plan: RefactorPlan): RefactorPlan {
  return { ...plan, approvalStatus: "REJECTED" };
}
