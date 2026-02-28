import { z } from "zod";
import { RiskBandSchema } from "./evidence.js";

export const ApprovalStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const PlanActionSchema = z.enum([
  "delete_dead",
  "unify_duplicates",
  "extract_function",
  "extract_module",
  "merge_files",
  "move_file",
  "rename_symbol",
  "update_imports",
  "add_harness",
  "generate_baseline",
  "cleanup_harness",
  "format_fix",
]);

export const PlanStepSchema = z.object({
  stepId: z.string(),
  patchTitle: z.string(),
  actions: z.array(PlanActionSchema).min(1),
  targets: z.array(z.string()).min(1),
  evidenceRefs: z.array(z.string()).min(1),
  riskBand: RiskBandSchema,
  requiresHarness: z.boolean(),
  preChecks: z.array(z.string()).default([]),
  postChecks: z.array(z.string()).default([]),
  rollbackStrategy: z.enum(["git_revert_commit", "git_reset_hard"]).default("git_revert_commit"),
});
export type PlanStep = z.infer<typeof PlanStepSchema>;

export const RefactorPlanSchema = z.object({
  planId: z.string(),
  repoId: z.string(),
  runId: z.string(),
  generatedAt: z.string(),

  approvalStatus: ApprovalStatusSchema.default("PENDING"),
  steps: z.array(PlanStepSchema).min(0),

  // سياسات تشغيلية
  policies: z.object({
    evidenceRequired: z.literal(true),
    atomicCommits: z.literal(true),
    stopOnScopeExplosion: z.literal(true),
    harnessInRepo: z.literal(true),
    testRunner: z.literal("vitest"),
  }),

  // حدود الانفجار
  scopeLimits: z.object({
    maxChangedFilesPerStep: z.number().int().min(1).default(50),
    maxChangedLinesPerStep: z.number().int().min(1).default(2000),
  }),
});
export type RefactorPlan = z.infer<typeof RefactorPlanSchema>;