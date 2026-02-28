export type RunPhase = "SCAN" | "PLAN" | "APPLY" | "VERIFY";

export interface AgentContext {
  runId: string;
  repoId: string;
  repoPath: string;

  phase: RunPhase;

  // مسار artifacts/runId (داخل مشروع الأداة)
  artifactsDir: string;

  // إعدادات تشغيلية عامة
  settings: {
    testRunner: "vitest";
    harnessInRepo: true;
    evidenceRequired: true; // قاعدة 4.2
    stopOnScopeExplosion: true;
    atomicCommits: true;
  };
}

export interface AgentIO<TIn = unknown, TOut = unknown> {
  input: TIn;
  output: TOut;
}

export interface Agent<TIn = unknown, TOut = unknown> {
  readonly name: string;
  run(ctx: AgentContext, input: TIn): Promise<TOut>;
}

// أدوات مساعدة لتوحيد أسماء الملفات داخل artifacts
export function artifactRelPath(runId: string, kind: string, filename: string): string {
  return `runs/${runId}/${kind}/${filename}`;
}
