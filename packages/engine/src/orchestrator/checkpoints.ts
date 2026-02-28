import type { OrchestratorState } from "./state.js";

/**
 * يُستخدم لاحقًا للحفظ في SQLite (packages/storage)
 * هنا تعريف واجهة فقط.
 */
export interface Checkpointer {
  save(state: OrchestratorState): Promise<void>;
  load(runId: string): Promise<OrchestratorState | null>;
}
