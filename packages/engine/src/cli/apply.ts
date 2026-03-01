import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { RefactorPlanSchema } from "@pkg/schemas";
import { getPlanPath } from "@pkg/storage";
import { assertApproved } from "@pkg/planning";

export const applyCommand = new Command("apply")
  .description("Apply refactor plan to target repository")
  .argument("<runId>", "The ID of the run to apply")
  .action(async (runIdArg: string) => {
    const runId = String(runIdArg);
    console.log(`Applying refactor plan for ${runId}...`);

    // التحقق من صحة runId
    if (!/^[a-zA-Z0-9_]+$/.test(runId)) {
      console.error("Invalid runId: must be alphanumeric with underscores only");
      process.exit(1);
    }

    // Find the plan file using the unified path system
    const planPath = getPlanPath(runId);

    try {
      const planContent = await fs.readFile(planPath, "utf8");
      const plan = RefactorPlanSchema.parse(JSON.parse(planContent));

      // التحقق من وجود موافقة صالحة
      try {
        assertApproved(plan);
      } catch (error) {
        console.error("Approval check failed:", error instanceof Error ? error.message : String(error));
        process.exit(1);
      }

      console.log(`Found ${plan.steps.length} steps. Executing...`);
      for (const step of plan.steps) {
        console.log(`Executing step: ${step.patchTitle}`);
        for (const action of step.actions) {
          if (action === "delete_dead") {
            for (const target of step.targets) {
              console.log(`Deleting ${target}...`);
              await fs.unlink(path.resolve(target)).catch((e) =>
                console.error(`Failed to delete ${target}:`, e)
              );
            }
          }
        }
      }
      console.log("Apply completed successfully!");
    } catch (e) {
      console.error("Error applying plan:", e);
      process.exit(1);
    }
  });