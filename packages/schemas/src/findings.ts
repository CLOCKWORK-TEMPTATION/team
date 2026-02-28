import { z } from "zod";
import { EvidencePacketSchema } from "./evidence.js";

export const DeadCodeCandidateSchema = z.object({
  evidenceId: z.string(),
  reason: z.string(),
});
export type DeadCodeCandidate = z.infer<typeof DeadCodeCandidateSchema>;

export const TextCloneOccurrenceSchema = z.object({
  file: z.string(),
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1),
});

export const CloneClusterSchema = z.object({
  clusterId: z.string(),
  similarity: z.number().min(0).max(1),
  occurrences: z.array(TextCloneOccurrenceSchema).min(2),
});
export type CloneCluster = z.infer<typeof CloneClusterSchema>;

export const SemanticCloneNodeSchema = z.object({
  file: z.string(),
  symbol: z.string().nullable().optional(),
  astHash: z.string(),
  startLine: z.number().int().min(1).optional(),
  endLine: z.number().int().min(1).optional(),
});
export const SemanticCloneClusterSchema = z.object({
  clusterId: z.string(),
  confidence: z.number().min(0).max(1),
  nodes: z.array(SemanticCloneNodeSchema).min(2),
  suggestedRefactor: z.enum(["extract_function", "extract_module", "strategy", "template_method", "unify_util"]),
});
export type SemanticCloneCluster = z.infer<typeof SemanticCloneClusterSchema>;

export const DuplicateFunctionSchema = z.object({
  evidenceId: z.string(),
  signature: z.string(),
  candidates: z.array(
    z.object({
      file: z.string(),
      symbol: z.string(),
      score: z.number().min(0).max(1),
    }),
  ),
  suggestedUnification: z.enum(["rename_and_reuse", "extract_common_core", "replace_with_shared_util"]),
});
export type DuplicateFunction = z.infer<typeof DuplicateFunctionSchema>;

export const MergeCandidateSchema = z.object({
  evidenceId: z.string(),
  kind: z.enum(["merge_files", "merge_modules", "extract_shared", "split_module"]),
  rationale: z.string(),
  targets: z.array(z.string()).min(1),
  notes: z.array(z.string()).optional(),
});
export type MergeCandidate = z.infer<typeof MergeCandidateSchema>;

export const BoundaryViolationSchema = z.object({
  fromFile: z.string(),
  toFile: z.string(),
  rule: z.string(),
});
export type BoundaryViolation = z.infer<typeof BoundaryViolationSchema>;

export const FindingsSchema = z.object({
  runId: z.string(),
  repoId: z.string(),
  evidencePackets: z.array(EvidencePacketSchema),

  deadCode: z.array(DeadCodeCandidateSchema),
  textClones: z.array(CloneClusterSchema),
  semanticClones: z.array(SemanticCloneClusterSchema),
  duplicateFunctions: z.array(DuplicateFunctionSchema),
  mergeCandidates: z.array(MergeCandidateSchema),
  boundaryViolations: z.array(BoundaryViolationSchema),

  notes: z.array(z.string()).optional(),
});
export type Findings = z.infer<typeof FindingsSchema>;
