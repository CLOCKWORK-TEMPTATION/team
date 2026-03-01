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

/** ملخص كامل للأدلة (importGraph, callGraph, toolHits, exceptions, risk reasons) */
export const EvidenceSummarySchema = z
  .object({
    /** ملخص نصي مقروء */
    description: z.string(),
    /** تفاصيل Import Graph */
    importGraph: z
      .object({
        inboundCount: z.number().int().min(0),
        inboundFiles: z.array(z.string()),
      })
      .optional(),
    /** تفاصيل Call Graph */
    callGraph: z
      .object({
        callers: z.array(z.string()),
        callees: z.array(z.string()),
      })
      .optional(),
    /** نتائج أدوات التحليل */
    toolHits: z
      .object({
        knip: z.string().nullable(),
        depcheck: z.string().nullable(),
        jscpd: z.string().nullable(),
        depcruise: z.string().nullable(),
      })
      .optional(),
    /** استثناءات مكتشفة */
    exceptions: z
      .object({
        dynamicImportSuspicion: z.boolean(),
        sideEffectModule: z.boolean(),
        publicApiExposure: z.boolean(),
      })
      .optional(),
    /** كل أسباب المخاطر */
    riskReasons: z.array(z.string()).default([]),
  })
  .optional();
export type EvidenceSummary = z.infer<typeof EvidenceSummarySchema>;

// Define a base schema for all steps
const BasePlanStepSchema = z.object({
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
  evidenceSummary: EvidenceSummarySchema,
});

// Define a schema for symbol and range targets
const TargetSymbolSchema = z.array(z.string()).min(1);

// TASK-008: delete_dead, rename_symbol, and extract_function require at least one of targetSymbols or targetRanges.
// Use a discriminated union to enforce requirements based on action type.
const SymbolRangePlanStepSchema = BasePlanStepSchema.extend({
  actions: z.array(z.enum(["delete_dead", "rename_symbol", "extract_function"])).min(1),
  targetSymbols: TargetSymbolSchema,
  targetRanges: z.array(z.tuple([z.number(), z.number()])).default([]),
}).refine(
  (data) => data.targetSymbols.length > 0 || data.targetRanges.length > 0,
  { message: "At least one of targetSymbols or targetRanges must be provided for delete_dead, rename_symbol, or extract_function actions." }
);

const NonSymbolRangePlanStepSchema = BasePlanStepSchema.extend({
  actions: z.array(z.enum([
    "unify_duplicates",
    "extract_module",
    "merge_files",
    "move_file",
    "update_imports",
    "add_harness",
    "generate_baseline",
    "cleanup_harness",
    "format_fix",
  ])).min(1),
  targetSymbols: z.array(z.string()).optional().default([]),
  targetRanges: z.array(z.tuple([z.number(), z.number()])).optional().default([]),
});

// Use a discriminated union to enforce requirements based on action type
export const PlanStepSchema = z.union([
  SymbolRangePlanStepSchema,
  NonSymbolRangePlanStepSchema,
]);
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