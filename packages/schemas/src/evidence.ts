import { z } from "zod";

export const CandidateKindSchema = z.enum(["dead_code", "merge", "dedupe", "move", "rename", "extract"]);
export type CandidateKind = z.infer<typeof CandidateKindSchema>;

export const RiskBandSchema = z.enum(["low", "medium", "high", "blocked"]);
export type RiskBand = z.infer<typeof RiskBandSchema>;

export const ToolHitsSchema = z.object({
  knip: z.string().nullable().optional(),
  depcheck: z.string().nullable().optional(),
  jscpd: z
    .object({
      clusterId: z.string(),
      similarity: z.number().min(0).max(1),
    })
    .nullable()
    .optional(),
  depcruise: z.string().nullable().optional(),
});

export const ImportGraphEvidenceSchema = z.object({
  inboundCount: z.number().int().min(0),
  inboundFiles: z.array(z.string()),
});

export const CallGraphEvidenceSchema = z.object({
  callers: z.array(z.string()),
});

export const TSReferencesEvidenceSchema = z.object({
  refCount: z.number().int().min(0),
  refs: z.array(
    z.object({
      file: z.string(),
      line: z.number().int().min(1),
      col: z.number().int().min(1),
      kind: z.string(),
    }),
  ),
});

export const EvidenceTargetSchema = z.object({
  file: z.string(),
  symbol: z.string().nullable().optional(),
  range: z.tuple([z.number().int().min(0), z.number().int().min(0)]).optional(),
});

export const EvidenceExceptionsSchema = z.object({
  dynamicImportSuspicion: z.boolean(),
  sideEffectModule: z.boolean(),
  publicApiExposure: z.boolean(),
});

export const RiskSchema = z.object({
  score: z.number().int().min(0).max(1000),
  band: RiskBandSchema,
  reasons: z.array(z.string()),
});

export const EvidencePacketSchema = z.object({
  id: z.string(),
  kind: CandidateKindSchema,
  target: EvidenceTargetSchema,
  evidence: z.object({
    importGraph: ImportGraphEvidenceSchema.optional(),
    callGraph: CallGraphEvidenceSchema.optional(),
    tsReferences: TSReferencesEvidenceSchema.optional(),
    toolHits: ToolHitsSchema.optional(),
  }),
  exceptions: EvidenceExceptionsSchema,
  risk: RiskSchema,
  recommendedAction: z.enum(["delete", "extract", "merge", "unify", "move", "rename", "keep", "propose_only"]),
  requiresHarness: z.boolean(),
});
export type EvidencePacket = z.infer<typeof EvidencePacketSchema>;

export const EvidencePackSchema = z.object({
  repoId: z.string(),
  runId: z.string(),
  generatedAt: z.string(),
  packets: z.array(EvidencePacketSchema),
});
export type EvidencePack = z.infer<typeof EvidencePackSchema>;
