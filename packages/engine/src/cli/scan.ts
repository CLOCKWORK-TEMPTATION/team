import { Command } from "commander";
import { resolve } from "node:path";
import { getDbClient, runMigration, writeJsonArtifact } from "@pkg/storage";
import {
  createTsProject,
  buildImportGraph,
  buildCallGraph,
  extractEntrypoints,
  detectDeadCode,
  detectDuplicateFunctions,
  detectMergeCandidates,
} from "@pkg/analysis";
import { runJscpd, runKnip, runDepcruise } from "@pkg/tooling";
import { invokeAgent } from "@pkg/llm";
import { generateId, logger } from "@pkg/shared";

interface LlmAugmentItem {
  evidenceId: string;
  llmRationale: string;
}

const LLM_BATCH_SIZE = 60;

async function augmentWithLlm(
  deadCode: Array<{ evidence: any; reason: string }>
): Promise<Map<string, string>> {
  const rationales = new Map<string, string>();
  if (deadCode.length === 0) return rationales;

  const batches: typeof deadCode[] = [];
  for (let i = 0; i < deadCode.length; i += LLM_BATCH_SIZE) {
    batches.push(deadCode.slice(i, i + LLM_BATCH_SIZE));
  }

  logger.info(`Running LLM analysis in ${batches.length} batch(es) for ${deadCode.length} candidates...`);
  console.log("[REPO_REFACTOR_LLM] STEP=1");

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx]!;
    const summaryForLlm = JSON.stringify(
      batch.map((d) => ({
        evidenceId: d.evidence.id,
        target: d.evidence.target,
        reason: d.reason,
        risk: d.evidence.risk,
      }))
    );

    try {
      const llmResponse = await invokeAgent(
        "ScanAugmentAgent",
        `مدخلات التحليل الساكن (deadCode batch ${batchIdx + 1}/${batches.length}):\n${summaryForLlm}\n\nأرجع مصفوفة JSON بالشكل [{ "evidenceId": "...", "llmRationale": "..." }] لكل عنصر.`
      );

      const jsonStr = llmResponse.trim().replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim();
      const firstBracket = jsonStr.indexOf("[");
      const lastBracket = jsonStr.lastIndexOf("]");
      if (firstBracket !== -1 && lastBracket !== -1) {
        const parsed = JSON.parse(jsonStr.substring(firstBracket, lastBracket + 1)) as LlmAugmentItem[];
        for (const p of parsed) {
          if (p.evidenceId && p.llmRationale) {
            rationales.set(p.evidenceId, p.llmRationale);
          }
        }
      }
    } catch (err) {
      logger.warn({ err, batch: batchIdx + 1 }, "LLM batch failed — skipping batch");
    }
  }

  logger.info(`LLM augmentation complete: ${rationales.size}/${deadCode.length} rationales obtained`);
  return rationales;
}

export const scanCommand = new Command("scan")
  .description("Scan target repository and generate findings")
  .argument("<repoPath>", "Path to the target repository")
  .action(async (repoPathArg: string) => {
    const repoPath = resolve(repoPathArg);
    const runId = generateId("run_");
    logger.info({ runId, repoPath }, "Starting repository scan");

    const migrationResult = runMigration();
    if (migrationResult.migrated) {
      logger.info("Migration completed: " + migrationResult.message);
    }

    const db = getDbClient();

    db.prepare(`INSERT INTO runs (run_id, repo_id, repo_path, created_at, status) VALUES (?, ?, ?, ?, ?)`).run(
      runId,
      "local_repo",
      repoPath,
      new Date().toISOString(),
      "SCANNED"
    );

    // --- Phase 1: AST Analysis ---
    logger.info("Extracting entrypoints...");
    const entrypoints = await extractEntrypoints(repoPath);

    logger.info("Parsing TypeScript project...");
    const project = createTsProject(repoPath);
    const sourceFileCount = project.getSourceFiles().length;
    logger.info({ sourceFileCount }, "Source files loaded (after filtering)");

    const { graph: importGraph, reverseGraph } = buildImportGraph(project);
    const callGraphData = buildCallGraph(project);
    logger.info({ nodes: callGraphData.nodes.length, edges: callGraphData.edges.length }, "Call graph built");

    logger.info("Detecting dead code (3-gate verification)...");
    const deadCode = detectDeadCode(project, reverseGraph, callGraphData, entrypoints);
    logger.info({ deadCodeCount: deadCode.length }, "Dead code detection complete");

    logger.info("Detecting duplicate functions...");
    const duplicateFunctions = detectDuplicateFunctions(project);
    logger.info({ duplicateCount: duplicateFunctions.length }, "Duplicate function detection complete");

    logger.info("Detecting merge candidates...");
    const mergeCandidates = detectMergeCandidates(importGraph, reverseGraph);
    logger.info({ mergeCount: mergeCandidates.length }, "Merge candidate detection complete");

    // --- Phase 2: External Tooling (parallel) ---
    logger.info("Running external analysis tools...");
    const [textClones, knipResult, boundaryViolations] = await Promise.all([
      runJscpd(repoPath).catch((err) => { logger.warn({ err }, "jscpd failed"); return []; }),
      runKnip(repoPath).catch((err) => { logger.warn({ err }, "knip failed"); return { unusedFiles: [], unusedExports: [], unusedDependencies: [], rawOutput: "" }; }),
      runDepcruise(repoPath).catch((err) => { logger.warn({ err }, "depcruise failed"); return []; }),
    ]);

    logger.info({
      textClones: textClones.length,
      knipUnusedFiles: knipResult.unusedFiles.length,
      knipUnusedExports: knipResult.unusedExports.length,
      boundaryViolations: boundaryViolations.length,
    }, "External tools complete");

    // --- Phase 3: LLM Augmentation (batched) ---
    const llmRationales = await augmentWithLlm(deadCode);

    const deadCodeWithLlm = deadCode.map((d) => ({
      ...d,
      llmRationale: llmRationales.get(d.evidence.id),
    }));

    // Enrich evidence packets with knip tool hits
    const knipExportsByFile = new Map<string, Set<string>>();
    for (const exp of knipResult.unusedExports) {
      let set = knipExportsByFile.get(exp.file);
      if (!set) { set = new Set(); knipExportsByFile.set(exp.file, set); }
      set.add(exp.symbol);
    }

    const evidencePackets = deadCodeWithLlm.map((d) => {
      const packet = { ...d.evidence };
      const fileKnipHits = knipExportsByFile.get(packet.target.file);
      if (fileKnipHits && packet.target.symbol && fileKnipHits.has(packet.target.symbol)) {
        packet.evidence = {
          ...packet.evidence,
          toolHits: {
            ...packet.evidence.toolHits,
            knip: `Confirmed unused by knip: ${packet.target.symbol}`,
          },
        };
      }
      return packet;
    });

    const findings = {
      runId,
      repoId: "local_repo",
      evidencePackets,
      deadCode: deadCodeWithLlm,
      textClones,
      semanticClones: [] as never[],
      duplicateFunctions,
      mergeCandidates,
      boundaryViolations,
      notes: [
        `Source files analyzed: ${sourceFileCount}`,
        `Dead code candidates (3-gate): ${deadCode.length}`,
        `Duplicate functions: ${duplicateFunctions.length}`,
        `Merge candidates: ${mergeCandidates.length}`,
        `Text clones (jscpd): ${textClones.length}`,
        `Boundary violations (depcruise): ${boundaryViolations.length}`,
        `Knip unused files: ${knipResult.unusedFiles.length}`,
        `Knip unused exports: ${knipResult.unusedExports.length}`,
        `LLM rationales obtained: ${llmRationales.size}/${deadCode.length}`,
      ],
    };

    await writeJsonArtifact(db, runId, "findings", "findings.json", findings);

    logger.info({
      runId,
      deadCodeCount: deadCode.length,
      duplicateFunctions: duplicateFunctions.length,
      mergeCandidates: mergeCandidates.length,
      textClones: textClones.length,
      violations: boundaryViolations.length,
    }, "Scan completed successfully.");
    db.close();
  });
