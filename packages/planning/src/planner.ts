import { type Findings, type RefactorPlan, PlanStepSchema, type EvidenceSummary } from "@pkg/schemas";
import { generateId, logger } from "@pkg/shared";
import { askPlanner } from "@pkg/llm";
import { z } from "zod";
import * as path from "path";
import { Project } from "ts-morph";

type DeadCodeCandidate = Findings["deadCode"][number];

/**
 * Determines the appropriate risk band based on evidence.
 * Uses the evidence's risk.band if available, otherwise calculates based on evidence.
 */
function determineRiskBand(deadCode: DeadCodeCandidate): "low" | "medium" | "high" | "critical" | "blocked" {
  // Use the risk band from evidence if available
  if (deadCode.evidence.risk?.band) {
    return deadCode.evidence.risk.band;
  }

  // Calculate risk based on evidence presence
  const hasImportGraph = deadCode.evidence.evidence?.importGraph !== undefined;
  const hasCallGraph = deadCode.evidence.evidence?.callGraph !== undefined;
  const hasTsReferences = deadCode.evidence.evidence?.tsReferences !== undefined;
  const hasToolHits = deadCode.evidence.evidence?.toolHits !== undefined;

  // If we have multiple evidence sources, it's more certain = lower risk
  const evidenceCount = [hasImportGraph, hasCallGraph, hasTsReferences, hasToolHits].filter(Boolean).length;

  if (evidenceCount >= 3) return "low";
  if (evidenceCount >= 2) return "medium";
  if (evidenceCount >= 1) return "medium";
  return "high";
}

/**
 * Determines if harness is required based on evidence.
 */
function determineRequiresHarness(deadCode: DeadCodeCandidate): boolean {
  // Use the evidence's requiresHarness if available
  if (deadCode.evidence.requiresHarness !== undefined) {
    return deadCode.evidence.requiresHarness;
  }

  // Check if it's a critical file that might need testing
  const filePath = deadCode.evidence.target.file.toLowerCase();
  const isPipelineFile = filePath.includes("pipeline") || filePath.includes("orchestrator");
  const isQualityFile = filePath.includes("quality") || filePath.includes("validator");

  return isPipelineFile || isQualityFile;
}

/**
 * Generates pre-checks and post-checks for a dead code step.
 * Post-checks include all pre-checks plus vitest_run for pipeline/quality files.
 */
function generateStepChecks(deadCode: DeadCodeCandidate): { preChecks: string[]; postChecks: string[] } {
  const baseChecks = ["tsc_noEmit", "eslint"];

  if (deadCode.evidence.evidence?.importGraph) {
    baseChecks.push("import_graph_check");
  }

  const postChecks = [...baseChecks];
  const filePath = deadCode.evidence.target.file.toLowerCase();
  if (filePath.includes("pipeline") || filePath.includes("quality")) {
    postChecks.push("vitest_run");
  }

  return {
    preChecks: baseChecks,
    postChecks,
  };
}

/**
 * Builds a detailed patch title with file, symbol, and range information.
 */
function buildDetailedPatchTitle(deadCode: DeadCodeCandidate): string {
  const target = deadCode.evidence.target;
  const risk = deadCode.evidence.risk;

  // Get file basename
  const fileName = path.basename(target.file);

  // Build symbol label with backticks if available
  const symbolLabel = target.symbol ? ` \`${target.symbol}\`` : "";

  // Build range label if available
  const rangeLabel = target.range ? ` (L${target.range[0]}-L${target.range[1]})` : "";

  // Determine what type of code this is
  const codeType = target.symbol ? "function" : "code";

  // Add risk reason if available
  let reasonSuffix = "";
  if (risk?.reasons && risk.reasons.length > 0) {
    const mainReason = risk.reasons[0];
    if (mainReason) {
      // Truncate long reasons
      const shortReason = mainReason.length > 40 ? mainReason.substring(0, 40) + "..." : mainReason;
      reasonSuffix = ` — ${shortReason}`;
    }
  }

  return `Delete dead ${codeType}: ${fileName}${symbolLabel}${rangeLabel}${reasonSuffix}`;
}

/**
 * Builds a full evidence summary from dead code candidates.
 * Aggregates importGraph, callGraph, toolHits, exceptions, and risk reasons.
 */
function buildEvidenceSummary(deadCodeItems: DeadCodeCandidate[]): NonNullable<EvidenceSummary> {
  const allReasons = new Set<string>();
  let dynamicImportSuspicion = false;
  let sideEffectModule = false;
  let publicApiExposure = false;

  const allInboundFiles = new Set<string>();
  let maxInboundCount = 0;
  const allCallers = new Set<string>();
  const allCallees = new Set<string>();

  let knip: string | null = null;
  let depcheck: string | null = null;
  let jscpd: string | null = null;
  let depcruise: string | null = null;

  for (const item of deadCodeItems) {
    const { evidence, exceptions, risk } = item.evidence;

    for (const r of risk.reasons) allReasons.add(r);
    dynamicImportSuspicion = dynamicImportSuspicion || exceptions.dynamicImportSuspicion;
    sideEffectModule = sideEffectModule || exceptions.sideEffectModule;
    publicApiExposure = publicApiExposure || exceptions.publicApiExposure;

    if (evidence.importGraph) {
      maxInboundCount = Math.max(maxInboundCount, evidence.importGraph.inboundCount);
      for (const f of evidence.importGraph.inboundFiles) allInboundFiles.add(f);
    }
    if (evidence.callGraph) {
      for (const c of evidence.callGraph.callers) allCallers.add(c);
      for (const c of evidence.callGraph.callees ?? []) allCallees.add(c);
    }
    if (evidence.toolHits) {
      if (evidence.toolHits.knip != null) knip = evidence.toolHits.knip;
      if (evidence.toolHits.depcheck != null) depcheck = evidence.toolHits.depcheck;
      if (evidence.toolHits.jscpd != null) {
        jscpd =
          typeof evidence.toolHits.jscpd === "object"
            ? JSON.stringify(evidence.toolHits.jscpd)
            : String(evidence.toolHits.jscpd);
      }
      if (evidence.toolHits.depcruise != null) depcruise = evidence.toolHits.depcruise;
    }
  }

  const parts: string[] = [];
  if (allCallers.size === 0) parts.push("No callers found");
  else parts.push(`${allCallers.size} caller(s) found`);
  if (maxInboundCount === 0 && allInboundFiles.size === 0) parts.push("No import references", "0 inbound files");
  else parts.push(`${allInboundFiles.size} inbound file(s)`);
  const description = parts.join(". ");

  return {
    description,
    importGraph: { inboundCount: maxInboundCount, inboundFiles: [...allInboundFiles] },
    callGraph: { callers: [...allCallers], callees: [...allCallees] },
    toolHits:
      knip != null || depcheck != null || jscpd != null || depcruise != null
        ? { knip, depcheck, jscpd, depcruise }
        : undefined,
    exceptions: {
      dynamicImportSuspicion,
      sideEffectModule,
      publicApiExposure,
    },
    riskReasons: [...allReasons],
  };
}

/**
 * Groups dead code findings by file for smarter reporting.
 */
function groupDeadCodeByFile(findings: Findings["deadCode"]): Map<string, DeadCodeCandidate[]> {
  const groups = new Map<string, DeadCodeCandidate[]>();

  for (const deadCode of findings) {
    const filePath = deadCode.evidence.target.file;
    const existing = groups.get(filePath) ?? [];
    existing.push(deadCode);
    groups.set(filePath, existing);
  }

  return groups;
}

/**
 * Creates a shared ts-morph Project for barrel integrity checks.
 * Reused across all calls to avoid loading the entire repo AST multiple times.
 */
function createBarrelCheckProject(repoPath: string): Project | null {
  try {
    const project = new Project({
      skipFileDependencyResolution: true,
      compilerOptions: {
        allowJs: true,
      },
    });
    project.addSourceFilesAtPaths([
      `${repoPath}/**/index.ts`,
      `${repoPath}/**/index.tsx`,
      `!${repoPath}/**/*.d.ts`,
      `!${repoPath}/**/node_modules/**`
    ]);
    return project;
  } catch (error) {
    logger.warn({ error }, "Failed to create barrel check project");
    return null;
  }
}

/**
 * فحص هل الملف مُعاد تصديره من barrel file (index.ts)
 * وحذفه هيكسر الـ barrel file
 * @param targetFile الملف المستهدف
 * @param project كائن ts-morph Project مُشترك (لتجنب إعادة تحميل الـ AST)
 */
function checkBarrelIntegrity(
  targetFile: string,
  project: Project | null
): { willBreakBarrel: boolean; barrelFiles: string[]; warnings: string[] } {
  if (!project) {
    return { willBreakBarrel: false, barrelFiles: [], warnings: [] };
  }

  try {
    const barrelFiles: string[] = [];
    const warnings: string[] = [];

    // البحث عن barrel files بتعمل re-export للملف
    const allSourceFiles = project.getSourceFiles();

    for (const sf of allSourceFiles) {
      const fileName = path.basename(sf.getFilePath());

      // فحص لو الملف barrel (index.ts/index.tsx)
      if (fileName === "index.ts" || fileName === "index.tsx") {
        const exportDecls = sf.getExportDeclarations();

        for (const exportDecl of exportDecls) {
          const moduleSpecifier = exportDecl.getModuleSpecifierSourceFile();

          if (moduleSpecifier?.getFilePath() === targetFile) {
            barrelFiles.push(sf.getFilePath());

            // فحص نوع الـ re-export
            const namedExports = exportDecl.getNamedExports();
            if (!namedExports?.length) {
              // export * from "./file" - حذف أي symbol هيكسر الـ barrel
              warnings.push(
                `${path.basename(sf.getFilePath())} uses 'export *' from ${path.basename(targetFile)} - deletion will break barrel exports`
              );
            } else {
              // export { specific } from "./file" - لازم نتأكد هل الـ symbol المحدد مُصدَّر
              const exportedNames = namedExports?.map((ne) => ne.getName()) ?? [];
              warnings.push(
                `${path.basename(sf.getFilePath())} re-exports ${exportedNames.join(", ")} from ${path.basename(targetFile)}`
              );
            }
          }
        }
      }
    }

    return {
      willBreakBarrel: barrelFiles.length > 0,
      barrelFiles,
      warnings
    };
  } catch (error) {
    logger.warn({ error, targetFile }, "Failed to check barrel integrity");
    return {
      willBreakBarrel: false,
      barrelFiles: [],
      warnings: []
    };
  }
}

export async function generatePlan(findings: Findings, repoPath: string = process.cwd()): Promise<RefactorPlan> {
  const plan: RefactorPlan = {
    planId: generateId("plan_"),
    repoId: findings.repoId,
    runId: findings.runId,
    generatedAt: new Date().toISOString(),
    approvalStatus: "PENDING",
    steps: [],
    policies: {
      evidenceRequired: true,
      atomicCommits: true,
      stopOnScopeExplosion: true,
      harnessInRepo: true,
      testRunner: "vitest",
    },
    scopeLimits: {
      maxChangedFilesPerStep: 50,
      maxChangedLinesPerStep: 2000,
    },
  };

  try {
    // Create a compressed summary for the LLM
    const groupedByFile = groupDeadCodeByFile(findings.deadCode);
    const fileSummaries = Array.from(groupedByFile.entries()).map(([file, candidates]) => {
      const riskBands = candidates.map(determineRiskBand);
      const highestRisk = (riskBands.includes("critical") ? "critical" :
                         riskBands.includes("high") ? "high" :
                         riskBands.includes("medium") ? "medium" : "low") as "low" | "medium" | "high" | "critical" | "blocked";
      return {
        file,
        candidateCount: candidates.length,
        highestRisk,
        symbols: candidates.map(c => c.evidence.target.symbol).filter(Boolean),
      };
    });

    const findingsSummary = JSON.stringify({
      deadCodeFiles: fileSummaries,
      totalDeadCode: findings.deadCode.length,
      textClones: findings.textClones.length,
      boundaryViolations: findings.boundaryViolations.length,
      duplicateFunctions: findings.duplicateFunctions.length,
      mergeCandidates: findings.mergeCandidates.length,
      notes: findings.notes,
    });

    logger.info("Calling LLM to generate plan steps...");
    console.log("[REPO_REFACTOR_LLM] STEP=2");
    const llmResponse = await askPlanner(findingsSummary);

    // Naive parsing of LLM response, looking for array []
    let jsonStr = llmResponse.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```/, "").replace(/```$/, "").trim();
    }

    // Find the first '[' and last ']' just in case there is trailing text
    const firstBracket = jsonStr.indexOf("[");
    const lastBracket = jsonStr.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket !== -1) {
      jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
    }

    const parsedSteps = JSON.parse(jsonStr) as unknown;

    // Validate with Zod
    const stepsArraySchema = z.array(PlanStepSchema);
    const validatedSteps = stepsArraySchema.parse(parsedSteps);

    plan.steps = validatedSteps;
    logger.info({ stepCount: plan.steps.length }, "Plan generated successfully");

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({ err: errorMsg }, "Failed to generate plan from LLM, falling back to detailed basic plan");

    // Group dead code by file for smarter reporting
    const groupedDeadCode = groupDeadCodeByFile(findings.deadCode);

    // Create a SINGLE shared Project for all barrel integrity checks
    const sharedProject = createBarrelCheckProject(repoPath);

    // Generate detailed fallback plan steps based on findings
    for (const [filePath, deadCodeList] of groupedDeadCode) {
      const fileName = path.basename(filePath);

      // Create a summary step for this file with all its dead code entries
      if (deadCodeList.length === 1) {
        // Single entry - create detailed step
        const deadCodeItem = deadCodeList[0];
        if (!deadCodeItem) continue;

        const target = deadCodeItem.evidence.target;

        // TASK-005: Check barrel integrity when target may be re-exported
        const resolvedTargetFile = path.isAbsolute(target.file) ? target.file : path.resolve(repoPath, target.file);
        const barrelCheck = checkBarrelIntegrity(resolvedTargetFile, sharedProject);
        if (barrelCheck.willBreakBarrel) {
          for (const w of barrelCheck.warnings) {
            logger.warn({ targetFile: target.file, barrelFiles: barrelCheck.barrelFiles }, w);
          }
        }

        let riskBand = determineRiskBand(deadCodeItem);
        if (barrelCheck.willBreakBarrel && riskBand === "low") {
          riskBand = "medium";
        }

        // Extract targetSymbols and targetRanges from the EvidencePacket
        const targetSymbols: string[] = target.symbol ? [target.symbol] : [];
        const targetRanges: [number, number][] = target.range ? [target.range] : [];

        plan.steps.push({
          stepId: generateId("step_"),
          patchTitle: buildDetailedPatchTitle(deadCodeItem),
          actions: ["delete_dead"],
          targets: [target.file],
          targetSymbols,
          targetRanges,
          evidenceRefs: [deadCodeItem.evidence.id],
          riskBand,
          requiresHarness: determineRequiresHarness(deadCodeItem),
          ...generateStepChecks(deadCodeItem),
          rollbackStrategy: "git_revert_commit",
          evidenceSummary: buildEvidenceSummary([deadCodeItem]),
        });
      } else {
        // Multiple entries in same file - create grouped step
        const symbols: string[] = deadCodeList
          .map(dc => dc.evidence.target.symbol)
          .filter((symbol): symbol is string => symbol !== undefined);

        const ranges: [number, number][] = deadCodeList
          .map(dc => dc.evidence.target.range)
          .filter((range): range is [number, number] => range !== undefined);

        // Use the highest risk from the group
        const riskBands: ("low" | "medium" | "high" | "critical" | "blocked")[] = [];
        for (const dc of deadCodeList) {
          riskBands.push(determineRiskBand(dc));
        }
        const highestRisk = (riskBands.includes("critical") ? "critical" :
                           riskBands.includes("high") ? "high" :
                           riskBands.includes("medium") ? "medium" : "low") as "low" | "medium" | "high" | "critical" | "blocked";

        // Check if any requires harness
        const anyRequiresHarness = deadCodeList.some(dc => determineRequiresHarness(dc));

        // TASK-005: Check barrel integrity when target may be re-exported
        const resolvedFilePath = path.isAbsolute(filePath) ? filePath : path.resolve(repoPath, filePath);
        const barrelCheck = checkBarrelIntegrity(resolvedFilePath, sharedProject);
        if (barrelCheck.willBreakBarrel) {
          for (const w of barrelCheck.warnings) {
            logger.warn({ targetFile: filePath, barrelFiles: barrelCheck.barrelFiles }, w);
          }
        }

        let finalRiskBand: "low" | "medium" | "high" | "critical" | "blocked" = highestRisk;
        if (barrelCheck.willBreakBarrel && finalRiskBand === "low") {
          finalRiskBand = "medium";
        }

        plan.steps.push({
          stepId: generateId("step_"),
          patchTitle: `Delete dead code in ${fileName} — ${deadCodeList.length} symbols (${symbols.slice(0, 3).join(", ")}${symbols.length > 3 ? "..." : ""})`,
          actions: ["delete_dead"],
          targets: [filePath],
          targetSymbols: symbols,
          targetRanges: ranges,
          evidenceRefs: deadCodeList.map(dc => dc.evidence.id),
          riskBand: finalRiskBand,
          requiresHarness: anyRequiresHarness,
          ...generateStepChecks(deadCodeList[0]!),
          rollbackStrategy: "git_revert_commit",
          evidenceSummary: buildEvidenceSummary(deadCodeList),
        });
      }
    }
  }

  // Sort plan steps: low risk first (safe changes before risky ones)
  const riskOrder: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3, blocked: 4 };
  plan.steps.sort((a, b) => (riskOrder[a.riskBand] ?? 99) - (riskOrder[b.riskBand] ?? 99));

  return plan;
}

