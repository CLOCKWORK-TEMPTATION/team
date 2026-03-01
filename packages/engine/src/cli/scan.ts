import { Command } from "commander";
import { resolve } from "node:path";
import { getDbClient, runMigration, writeJsonArtifact } from "@pkg/storage";
import {
  createTsProject,
  buildImportGraph,
  buildCallGraph,
  extractEntrypoints,
  detectDeadCode,
} from "@pkg/analysis";
import { generateId, logger } from "@pkg/shared";

export const scanCommand = new Command("scan")
  .description("Scan target repository and generate findings")
  .argument("<repoPath>", "Path to the target repository")
  .action(async (repoPathArg: string) => {
    const repoPath = resolve(repoPathArg);
    const runId = generateId("run_");
    logger.info({ runId, repoPath }, "Starting repository scan");

    // تشغيل الترحيل إذا لزم الأمر
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

    // 1. Intake & Entrypoints
    logger.info("Extracting entrypoints...");
    const entrypoints = await extractEntrypoints(repoPath);

    // 2. Parse AST & Graphs
    logger.info("Parsing TypeScript project...");
    const project = createTsProject(repoPath);
    console.log("DEBUG: Source files found:", project.getSourceFiles().length);
    console.log("DEBUG: Entrypoints:", entrypoints);
    const { reverseGraph } = buildImportGraph(project);
    const callGraphData = buildCallGraph(project);

    // 3. Detect Dead Code
    logger.info("Detecting dead code...");
    const deadCode = detectDeadCode(project, reverseGraph, callGraphData, entrypoints);

    const evidencePackets = deadCode.map((d) => d.evidence);

    const findings = {
      runId,
      repoId: "local_repo",
      evidencePackets,
      deadCode,
      textClones: [],
      semanticClones: [],
      duplicateFunctions: [],
      mergeCandidates: [],
      boundaryViolations: [],
    };

    await writeJsonArtifact(db, runId, "findings", "findings.json", findings);

    logger.info({ runId, deadCodeCount: deadCode.length }, "Scan completed successfully.");
    db.close();
  });