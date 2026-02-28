import { z } from "zod";

export const TelemetryEventSchema = z.object({
  at: z.string(),
  name: z.string(),
  level: z.enum(["debug", "info", "warn", "error"]).default("info"),
  data: z.record(z.unknown()).optional(),
});

export const TelemetrySchema = z.object({
  runId: z.string(),
  repoId: z.string(),
  events: z.array(TelemetryEventSchema),
  counters: z.record(z.number()).default({}),
});
export type Telemetry = z.infer<typeof TelemetrySchema>;