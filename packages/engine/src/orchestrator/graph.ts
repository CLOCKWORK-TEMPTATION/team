import type { AgentContext } from "../agents/types.js";
import type { OrchestratorState } from "./state.js";
import { runScanAndPlan } from "./nodes.js";

/**
 * graph.ts: نقطة دخول واحدة للـ SCAN+PLAN
 * الـ APPLY لا يبدأ هنا إطلاقًا بدون approval (من Electron UI).
 */
export async function runGraphScanPlan(
  ctx: AgentContext,
  initial: OrchestratorState
): Promise<OrchestratorState> {
  return await runScanAndPlan(ctx, initial);
}
