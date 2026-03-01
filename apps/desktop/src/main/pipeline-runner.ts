import { execa } from "execa";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  setArtifactsRoot,
  getArtifactsRoot,
  ensureArtifactsStructure,
  runMigration,
  getPlanPath,
  getArtifactsPath,
} from "@pkg/storage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// مسار CLI
const cliPath = path.resolve(
  __dirname,
  "../../../../packages/engine/dist/cli/index.js"
);

/**
 * يُهيئ مسار الـ artifacts للـ Electron
 * Dev: مجلد artifacts في جذر المشروع
 * Prod: userData + "/artifacts"
 */
export function initializeArtifacts(userDataPath: string, isDev: boolean): void {
  const artifactsDir = isDev
    ? path.resolve(__dirname, "../../../../artifacts")
    : path.join(userDataPath, "artifacts");

  // تعيين المسار للحزم الأخرى
  setArtifactsRoot(artifactsDir);

  // التأكد من وجود البنية
  ensureArtifactsStructure();

  // تشغيل الترحيل إذا لزم الأمر
  const migrationResult = runMigration();
  if (migrationResult.migrated) {
    console.log("[pipeline-runner] Migration completed:", migrationResult.message);
  }

  console.log("[pipeline-runner] Artifacts initialized at:", artifactsDir);
}

/**
* يُنشئ record موافقة في SQLite
* يُستخدم عند الضغط على زر "Approve" في UI
*/
export function recordApproval(
  runId: string,
  approvedBy: string,
  notes?: string
): { success: boolean; error?: string } {
  try {
    const planPath = getPlanPath(runId);

    // تحديث ملف الخطة
    if (fs.existsSync(planPath)) {
      const planContent = fs.readFileSync(planPath, "utf8");
      const plan = JSON.parse(planContent);
      plan.approvalStatus = "APPROVED";
      plan.approvedAt = new Date().toISOString();
      plan.approvedBy = approvedBy;
      fs.writeFileSync(planPath, JSON.stringify(plan, null, 2), "utf8");
    }

    // TODO: إضافة record في SQLite (يتطلب import من storage package)
    console.log(`[pipeline-runner] Approval recorded for run ${runId} by ${approvedBy}`);

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMsg };
  }
}

/**
 * يتحقق من وجود موافقة صالحة
 */
export function checkApproval(runId: string): { approved: boolean; message: string } {
  try {
    const planPath = getPlanPath(runId);

    if (!fs.existsSync(planPath)) {
      return { approved: false, message: "Plan not found" };
    }

    const planContent = fs.readFileSync(planPath, "utf8");
    const plan = JSON.parse(planContent);

    if (plan.approvalStatus !== "APPROVED") {
      return {
        approved: false,
        message: `Plan status is ${plan.approvalStatus || "PENDING"}. Approval required before apply.`,
      };
    }

    return { approved: true, message: "Plan is approved" };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { approved: false, message: `Error checking approval: ${errorMsg}` };
  }
}

/**
 * يُنفذ أمر scan
 */
export async function runScan(repoPath: string): Promise<{
  success: boolean;
  output?: string;
  error?: string;
  runId?: string | undefined;
  llmUsedInStep1?: boolean;
}> {
  try {
    const { stdout, stderr } = await execa("node", ["--max-old-space-size=4096", cliPath, "scan", repoPath]);
    const fullOutput = [stdout, stderr].filter(Boolean).join("\n");

    const runIdMatch = fullOutput.match(/run[_-]?([a-f0-9]+)/i);
    const runId = runIdMatch?.[0];
    const llmUsedInStep1 = fullOutput.includes("[REPO_REFACTOR_LLM] STEP=1");

    return { success: true, output: fullOutput, runId, llmUsedInStep1 };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * يُنفذ أمر plan
 */
export async function runPlan(runId: string): Promise<{
  success: boolean;
  output?: string;
  error?: string;
  llmUsedInStep2?: boolean;
}> {
  try {
    const { stdout, stderr } = await execa("node", ["--max-old-space-size=4096", cliPath, "plan", runId]);
    const fullOutput = [stdout, stderr].filter(Boolean).join("\n");
    const llmUsedInStep2 = fullOutput.includes("[REPO_REFACTOR_LLM] STEP=2");
    return { success: true, output: fullOutput, llmUsedInStep2 };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * يقرأ خطة التعديل ويُرجعها كتقرير Markdown للعرض
 */
export function getPlanReport(runId: string): { success: boolean; report?: string; error?: string } {
  try {
    const reportPath = path.join(getArtifactsPath(runId, "plan"), "report.md");
    if (!fs.existsSync(reportPath)) {
      return { success: false, error: "Report artifact (report.md) not found" };
    }
    const reportContent = fs.readFileSync(reportPath, "utf8");
    return { success: true, report: reportContent };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMsg };
  }
}

/**
 * يُنفذ أمر apply (مع التحقق من الموافقة)
 */
export async function runApply(runId: string): Promise<{
  success: boolean;
  output?: string;
  error?: string;
}> {
  // التحقق من الموافقة قبل التنفيذ
  const approvalCheck = checkApproval(runId);
  if (!approvalCheck.approved) {
    return { success: false, error: approvalCheck.message };
  }

  try {
    const { stdout } = await execa("node", ["--max-old-space-size=4096", cliPath, "apply", runId]);
    return { success: true, output: stdout };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * يُنفذ أمر verify
 */
export async function runVerify(runId: string): Promise<{
  success: boolean;
  output?: string;
  error?: string;
}> {
  try {
    const { stdout } = await execa("node", [cliPath, "verify", runId]);
    return { success: true, output: stdout };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
