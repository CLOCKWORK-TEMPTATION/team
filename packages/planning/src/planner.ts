import { type Findings, type RefactorPlan, PlanStepSchema } from "@pkg/schemas";
import { generateId, logger } from "@pkg/shared";
import { askPlanner } from "@pkg/llm";
import { z } from "zod";

export async function generatePlan(findings: Findings): Promise<RefactorPlan> {
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
    const findingsSummary = JSON.stringify(
      {
        deadCode: findings.deadCode,
        duplicateFunctions: findings.duplicateFunctions,
        mergeCandidates: findings.mergeCandidates,
      },
      null,
      2
    );

    logger.info("Calling LLM to generate plan steps...");
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
    logger.error({ err: errorMsg }, "Failed to generate plan from LLM, falling back to basic mocking");
    
    // Fallback to basic mock plan steps based on findings
    for (const deadCode of findings.deadCode) {
      plan.steps.push({
        stepId: generateId("step_"),
        patchTitle: `Delete dead code: ${deadCode.evidence.id}`,
        actions: ["delete_dead"],
        targets: [deadCode.evidence.target.file],
        evidenceRefs: [deadCode.evidence.id],
        riskBand: "low",
        requiresHarness: false,
        preChecks: ["tsc_noEmit", "eslint"],
        postChecks: ["tsc_noEmit", "eslint"],
        rollbackStrategy: "git_revert_commit",
      });
    }
  }

  return plan;
}
