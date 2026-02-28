import { z } from "zod";
import { FindingsSchema } from "./findings.js";
import { RefactorPlanSchema } from "./plan.js";

export const ReportSchema = z.object({
  repoId: z.string(),
  runId: z.string(),
  createdAt: z.string(),
  findings: FindingsSchema,
  plan: RefactorPlanSchema,
  riskSummary: z.object({
    low: z.number().int().min(0),
    medium: z.number().int().min(0),
    high: z.number().int().min(0),
    blocked: z.number().int().min(0),
  }),
  notes: z.array(z.string()).default([]),
});
export type Report = z.infer<typeof ReportSchema>;
