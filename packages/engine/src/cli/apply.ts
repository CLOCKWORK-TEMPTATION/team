import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { RefactorPlanSchema } from "@pkg/schemas";
import { getPlanPath } from "@pkg/storage";
import { assertApproved } from "@pkg/planning";
import { commitChanges, revertCommit } from "@pkg/refactor";
import { runCommand } from "@pkg/shared";
import { Project } from "ts-morph";

/**
 * خريطة أوامر preChecks/postChecks — تُترجم المفاتيح المنطقية إلى أوامر فعلية.
 * مطابق لـ AGENTS.md 9 و TECHNICAL_AUDIT TASK-003.
 */
const CHECK_COMMAND_MAP: Record<string, string> = {
  tsc_noEmit: "pnpm typecheck",
  eslint: "pnpm lint",
  import_graph_check: "pnpm exec depcruise -c dependency-cruiser.js .",
  vitest_run: "pnpm exec vitest run",
};

function resolveCheckCommand(logicalOrRaw: string): string {
  const mapped = CHECK_COMMAND_MAP[logicalOrRaw];
  return mapped ?? logicalOrRaw;
}

async function runCheck(checkCommand: string, repoPath: string) {
  const resolved = resolveCheckCommand(checkCommand);
  const parts = resolved.split(" ");
  const cmd = parts[0];
  if (!cmd) throw new Error(`Invalid check command: "${checkCommand}"`);
  return await runCommand(cmd, parts.slice(1), { cwd: repoPath });
}

/** Shared ts-morph Project instance, lazily initialized and reused across operations. */
let sharedProject: Project | null = null;

function getSharedProject(): Project {
  if (!sharedProject) {
    sharedProject = new Project({
      skipFileDependencyResolution: true,
      compilerOptions: { allowJs: true }
    });
  }
  return sharedProject;
}

/**
 * حذف symbol محدد من ملف TypeScript بدون مسح الملف كله
 * @param filePath المسار الكامل للملف
 * @param symbol اسم الـ symbol المراد حذفه
 * @param range نطاق الأسطر [start, end] (اختياري)
 */
async function deleteSymbolFromFile(
  filePath: string,
  symbol: string | undefined,
  range: [number, number] | undefined
): Promise<boolean> {
  try {
    const project = getSharedProject();
    const sf = project.addSourceFileAtPath(filePath);

    if (symbol) {
      // محاولة العثور على الـ symbol وحذفه
      const exportedDecls = sf.getExportedDeclarations();
      const declarations = exportedDecls.get(symbol);
      
      if (declarations && declarations.length > 0) {
        for (const decl of declarations) {
          if ("remove" in decl && typeof (decl as { remove: () => void }).remove === "function") {
            (decl as { remove: () => void }).remove();
          }
        }
        await sf.save();
        console.log(`  ✅ Deleted symbol '${symbol}' from ${path.basename(filePath)}`);
        return true;
      } else {
        console.warn(`  ⚠️ Symbol '${symbol}' not found in ${path.basename(filePath)}`);
        return false;
      }
    } else if (range) {
      // حذف بناءً على النطاق (fallback)
      const [startLine, endLine] = range;
      const fullText = sf.getFullText();
      const lines = fullText.split("\n");
      
      // حذف الأسطر المحددة (line numbers are 1-based)
      if (startLine >= 1 && endLine <= lines.length) {
        const newLines = [
          ...lines.slice(0, startLine - 1),
          ...lines.slice(endLine)
        ];
        sf.replaceWithText(newLines.join("\n"));
        await sf.save();
        console.log(`  ✅ Deleted lines ${startLine}-${endLine} from ${path.basename(filePath)}`);
        return true;
      } else {
        console.warn(`  ⚠️ Invalid range ${startLine}-${endLine} for ${path.basename(filePath)}`);
        return false;
      }
    } else {
      console.warn(`  ⚠️ No symbol or range specified for ${path.basename(filePath)}`);
      return false;
    }
  } catch (error) {
    console.error(`  ❌ Failed to delete symbol from ${filePath}:`, error);
    return false;
  }
}

/**
 * فحص هل الملف كله dead (كل الـ symbols فيه dead)
 * @param filePath المسار الكامل للملف
 * @param evidenceRefs مراجع الأدلة
 * @param plan الخطة الكاملة للحصول على بيانات الأدلة
 */
function isEntireFileDead(
  filePath: string,
  evidenceRefs: string[] | undefined,
  _plan: unknown
): boolean {
  // لو مفيش evidence refs، نفترض إن الملف كله dead
  if (!evidenceRefs || evidenceRefs.length === 0) {
    return true;
  }

  try {
    const project = getSharedProject();
    const sf = project.addSourceFileAtPath(filePath);
    const exportedCount = Array.from(sf.getExportedDeclarations().keys()).length;
    
    // لو عدد الأدلة = عدد الـ exports، يبقى الملف كله dead
    return evidenceRefs.length >= exportedCount;
  } catch {
    return false;
  }
}

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
      const repoPath = process.cwd();

      for (const step of plan.steps) {
        console.log(`\n--- Executing step: ${step.patchTitle} [${step.stepId}] ---`);
        
        // Pre-checks
        let preCheckFailed = false;
        for (const check of step.preChecks) {
          console.log(`  Running pre-check: ${check}`);
          const result = await runCheck(check, repoPath);
          if (result.exitCode !== 0) {
            console.error(`  ❌ Pre-check ${check} failed for step ${step.stepId}`);
            console.error(result.stderr || result.stdout);
            preCheckFailed = true;
            break;
          }
        }
        
        if (preCheckFailed) {
          console.log(`  ⏭️ Skipping step ${step.stepId} due to pre-check failure.`);
          continue;
        }

        // Execute Actions
        for (const action of step.actions) {
          if (action === "delete_dead") {
            for (const target of step.targets) {
              const resolvedTarget = path.resolve(repoPath, target);

              // فحص: هل الملف كله dead؟
              if (isEntireFileDead(resolvedTarget, step.evidenceRefs, plan)) {
                // حذف الملف كله
                console.log(`  🗑️ Deleting entire file ${target}...`);
                await fs.unlink(resolvedTarget).catch((e) =>
                  console.error(`  ⚠️ Failed to delete ${target}:`, e)
                );
              } else if ((step.targetSymbols && step.targetSymbols.length > 0) || (step.targetRanges && step.targetRanges.length > 0)) {
                // حذف symbol محدد أو range
                console.log(`  🗑️ Deleting ${step.targetSymbols?.length ? `symbols ${step.targetSymbols.join(", ")}` : `ranges ${step.targetRanges?.map(r => `${r[0]}-${r[1]}`).join(", ")}`} from ${target}...`);
                // Process all symbols and ranges
                let success = true;
                for (const sym of step.targetSymbols ?? []) {
                  const result = await deleteSymbolFromFile(resolvedTarget, sym, undefined);
                  if (!result) success = false;
                }
                for (const rng of step.targetRanges ?? []) {
                  const result = await deleteSymbolFromFile(resolvedTarget, undefined, rng);
                  if (!result) success = false;
                }
                if (!success) {
                  console.error(`  ⚠️ Failed to delete symbol/range from ${target}, skipping...`);
                }
              } else {
                console.warn(`  ⚠️ Cannot delete ${target}: no targetSymbols or targetRanges specified and file is not entirely dead. Skipping for safety.`);
              }
            }
          }
        }

        // Atomic commit
        await commitChanges(repoPath, `refactor: ${step.patchTitle} [${step.stepId}]`);

        // Post-checks
        let postCheckFailed = false;
        for (const check of step.postChecks) {
          console.log(`  Running post-check: ${check}`);
          const result = await runCheck(check, repoPath);
          if (result.exitCode !== 0) {
            console.error(`  ❌ Post-check ${check} failed, reverting step ${step.stepId}`);
            console.error(result.stderr || result.stdout);
            postCheckFailed = true;
            await revertCommit(repoPath);
            break;
          }
        }

        if (postCheckFailed) {
          console.log(`  ↩️ Reverted step ${step.stepId} due to post-check failure.`);
        } else {
          console.log(`  ✅ Step ${step.stepId} completed successfully.`);
        }
      }
      
      console.log("\n🎉 Apply completed successfully!");
    } catch (e) {
      console.error("Error applying plan:", e);
      process.exit(1);
    }
  });