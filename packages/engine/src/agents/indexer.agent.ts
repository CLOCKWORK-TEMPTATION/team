import type { Agent, AgentContext } from "./types.js";

/**
 * هذا الوكيل يبني قاعدة رموز/فهرس.
 * التنفيذ الحقيقي سيكون في packages/analysis/src/indexer/*
 * هنا نكتفي بعقدة ربط تُرجع artifact pointers.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- يمكن تمرير إعدادات إضافية لاحقًا
export interface IndexerInput {}

export interface IndexerOutput {
  symbolDbRelPath: string; // artifacts/runs/<runId>/index/symbol_index.sqlite (أو ما شابه)
  indexMetaRelPath: string; // JSON
}

export const IndexerAgent: Agent<IndexerInput, IndexerOutput> = {
  name: "IndexerAgent",

  async run(ctx: AgentContext): Promise<IndexerOutput> {
    await Promise.resolve();
    // مسارات artifacts
    const symbolDbRelPath = `runs/${ctx.runId}/index/symbol_index.sqlite`;
    const indexMetaRelPath = `runs/${ctx.runId}/index/index_meta.json`;

    // الربط الفعلي:
    // - استدعاء packages/analysis Indexer لبناء symbol DB
    // - حفظه في artifactsDir + rel paths
    return { symbolDbRelPath, indexMetaRelPath };
  },
};
