import { z } from "zod";

export const CallGraphNodeSchema = z.object({
  id: z.string(),
  file: z.string(),
  name: z.string(),
  kind: z.enum(["function", "method", "class", "arrow_function", "unknown"]).default("unknown").optional(),
  startLine: z.number().int().min(1).optional(),
  startCol: z.number().int().min(1).optional(),
  endLine: z.number().int().min(1).optional(),
  endCol: z.number().int().min(1).optional(),
});
export type CallGraphNode = z.infer<typeof CallGraphNodeSchema>;

export const CallGraphEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  kind: z.enum(["call", "instantiate", "reference"]).default("call").optional(),
});
export type CallGraphEdge = z.infer<typeof CallGraphEdgeSchema>;

export const CallGraphDataSchema = z.object({
  nodes: z.array(CallGraphNodeSchema),
  edges: z.array(CallGraphEdgeSchema),
});
export type CallGraphData = z.infer<typeof CallGraphDataSchema>;
