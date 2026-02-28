export interface OrchestratorState {
  runId: string;
  repoId: string;
  repoPath: string;
  artifactsDir: string;

  // مخرجات تدريجية
  repoProfile?: {
    repoPath: string;
    isGitRepo: boolean;
    gitHead?: string;
    hasUncommittedChanges: boolean;
    packageJsonPaths: string[];
  };
  stackFingerprint?: unknown;

  symbolDbRelPath?: string;
  indexMetaRelPath?: string;

  importGraphRelPath?: string;
  callGraphRelPath?: string;
  typeGraphRelPath?: string;
  entrypointsRelPath?: string;

  deadCodeCandidatesRelPath?: string;
  semanticCloneClustersRelPath?: string;
  duplicateFunctionsRelPath?: string;
  mergeCandidatesRelPath?: string;
  boundaryViolationsRelPath?: string;

  contractsRelPath?: string;
  riskScoresRelPath?: string;

  evidencePackRelPath?: string;

  findingsRelPath?: string;
  refactorPlanRelPath?: string;
  reportMdRelPath?: string;

  gatedPlanRelPath?: string;
  gateReportRelPath?: string;
}
