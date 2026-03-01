import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import os from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// متغير يحمل مسار الـ artifacts المخصص (يتم تعيينه من Electron أو CLI)
let customArtifactsRoot: string | null = null;
let electronArtifactsRoot: string | null = null;

/**
 * يعين مسار الـ artifacts بشكل صريح (يُستخدم من Electron)
 */
export function setArtifactsRoot(root: string): void {
  customArtifactsRoot = root;
}

/**
 * يعين مسار الـ artifacts لبيئة Electron (يتم استدعاؤه من main process)
 */
export function setElectronArtifactsRoot(root: string): void {
  electronArtifactsRoot = root;
}

/**
 * يحدد جذر الـ Artifacts بناءً على البيئة:
 * - إذا تم تعيينه صراحةً (من Electron): استخدمه
 * - Dev: مجلد artifacts في جذر المشروع
 * - Prod: مجلد artifacts في userData
 */
export function getArtifactsRoot(): string {
  // إذا تم تعيينه صراحةً
  if (customArtifactsRoot) {
    return customArtifactsRoot;
  }

  // إذا تم تعيينه من Electron
  if (electronArtifactsRoot) {
    return electronArtifactsRoot;
  }

  // Dev mode: استخدم متغير بيئة أو مسار آمن
  const envRoot = process.env.REPO_REFACTOR_ARTIFACTS_ROOT;
  if (envRoot) {
    return path.resolve(envRoot);
  }

  // من dist: packages/storage/dist/artifacts -> 4 مستويات = جذر المشروع (team)
  // من src: packages/storage/src/artifacts -> 4 مستويات = جذر المشروع
  const projectRoot = path.resolve(__dirname, "../../../..");
  const artifactsDir = path.join(projectRoot, "artifacts");

  // التأكد من أننا داخل المشروع (تجنب E:\artifacts إذا كان projectRoot = E:\)
  const normalized = path.normalize(artifactsDir);
  if (normalized === path.join(path.parse(projectRoot).root, "artifacts")) {
    // fallback: استخدم مجلد المستخدم
    return path.join(os.homedir(), ".repo-refactor-ai", "artifacts");
  }

  return artifactsDir;
}

/**
 * يحدد جذر الـ Artifacts لبيئة الإنتاج (Electron userData)
 */
export function getUserDataArtifactsRoot(): string {
  return path.join(os.homedir(), ".repo-refactor-ai", "artifacts");
}

/**
 * يحدد مسار قاعدة البيانات
 */
export function getDbPath(): string {
  return path.join(getArtifactsRoot(), "db", "main.sqlite");
}

/**
 * يحدد مسار مجلد الـ runs
 */
export function getRunsRoot(): string {
  return path.join(getArtifactsRoot(), "runs");
}

/**
 * يحدد مسار مجلد الـ logs
 */
export function getLogsRoot(): string {
  return path.join(getArtifactsRoot(), "logs");
}

/**
 * يبني مسار artifact لـ run محدد
 */
export function getArtifactsPath(runId: string, kind: string): string {
  return path.join(getRunsRoot(), runId, kind);
}

/**
 * يحدد مسار ملف plan لـ run محدد
 * يدعم plan.json (من engine CLI) و refactor_plan.json
 */
export function getPlanPath(runId: string): string {
  return path.join(getRunsRoot(), runId, "plan", "plan.json");
}


/**
 * يحدد مسار ملف log لـ run محدد
 */
export function getLogPath(runId: string): string {
  return path.join(getLogsRoot(), `${runId}.log`);
}

/**
 * يضمن وجود مجلدات الـ artifacts المطلوبة
 */
export function ensureArtifactsStructure(): void {
  const root = getArtifactsRoot();
  fs.mkdirSync(path.join(root, "db"), { recursive: true });
  fs.mkdirSync(path.join(root, "runs"), { recursive: true });
  fs.mkdirSync(path.join(root, "logs"), { recursive: true });
}

/**
 * يتحقق إذا كان هناك marker migration موجود
 */
export function hasMigrationMarker(): boolean {
  const markerPath = path.join(getArtifactsRoot(), ".migrated");
  return fs.existsSync(markerPath);
}

/**
 * يكتب marker migration
 */
export function writeMigrationMarker(): void {
  const markerPath = path.join(getArtifactsRoot(), ".migrated");
  fs.writeFileSync(markerPath, new Date().toISOString(), "utf8");
}
