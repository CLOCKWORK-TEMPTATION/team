import { Command } from "commander";
import * as p from "@clack/prompts";
import { getDbClient, readJsonArtifact, writeJsonArtifact } from "@pkg/storage";
import { generatePlan, approvePlan, rejectPlan } from "@pkg/planning";
import { logger } from "@pkg/shared";
import type { Findings } from "@pkg/schemas";

export const planCommand = new Command("plan")
  .description("Generate refactor plan from findings")
  .argument("<runId>", "ID of the run to plan for")
  .option("-i, --interactive", "Show interactive approval prompt")
  .action(async (runId: string, opts: { interactive?: boolean }) => {
    logger.info({ runId }, "Planning refactor...");

    const db = getDbClient();

    logger.info("Reading latest findings...");
    const findings = await readJsonArtifact<Findings>(db, runId, "findings", "findings.json");

    if (!findings) {
      logger.error({ runId }, "No findings found for this run. Please run 'scan' first.");
      db.close();
      process.exit(1);
    }

    logger.info("Generating refactor plan...");
    let plan = await generatePlan(findings);

    if (plan.steps.length === 0) {
      logger.info("No refactoring steps generated.");
      await writeJsonArtifact(db, runId, "plan", "plan.json", plan);
      db.close();
      return;
    }

    if (opts.interactive) {
      p.intro("Refactor Plan");
      p.log.info(`Found ${plan.steps.length} suggestion(s) to modify the code.`);
      for (const step of plan.steps) {
        p.log.step(step.patchTitle);
      }
      const approved = await p.confirm({
        message: "Do you approve this plan?",
        initialValue: true,
      });
      if (p.isCancel(approved)) {
        p.cancel("Operation cancelled.");
        db.close();
        process.exit(0);
      }
      plan = approved ? approvePlan(plan) : rejectPlan(plan);
      p.outro(approved ? "Plan approved. Run 'apply' to execute." : "Plan rejected.");
    }

    logger.info("Saving refactor plan...");
    await writeJsonArtifact(db, runId, "plan", "plan.json", plan);

    db.prepare(`UPDATE runs SET status = ? WHERE run_id = ?`).run("PLANNED", runId);

    logger.info({ runId, planId: plan.planId, approvalStatus: plan.approvalStatus }, "Plan saved.");
    db.close();
  });