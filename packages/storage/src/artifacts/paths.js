import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import os from "node:os";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// متغير يحمل مسار الـ artifacts المخصص (يتم تعيينه من Electron أو CLI)
let customArtifactsRoot = null;
let electronArtifactsRoot = null;
/**
 * يعين مسار الـ artifacts بشكل صريح (يُستخدم من Electron)
 */
export function setArtifactsRoot(root) {
    customArtifactsRoot = root;
}
/**
 * يعين مسار الـ artifacts لبيئة Electron (يتم استدعاؤه من main process)
 */
export function setElectronArtifactsRoot(root) {
    electronArtifactsRoot = root;
}
/**
 * يحدد جذر الـ Artifacts بناءً على البيئة:
 * - إذا تم تعيينه صراحةً (من Electron): استخدمه
 * - Dev: مجلد artifacts في جذر المشروع
 * - Prod: مجلد artifacts في userData
 */
export function getArtifactsRoot() {
    // إذا تم تعيينه صراحةً
    if (customArtifactsRoot) {
        return customArtifactsRoot;
    }
    // إذا تم تعيينه من Electron
    if (electronArtifactsRoot) {
        return electronArtifactsRoot;
    }
    // Dev mode: استخدم جذر المشروع
    // ننتقل من packages/storage/src/artifacts/ إلى جذر المشروع
    const projectRoot = path.resolve(__dirname, "../../../../..");
    return path.join(projectRoot, "artifacts");
}
/**
 * يحدد جذر الـ Artifacts لبيئة الإنتاج (Electron userData)
 */
export function getUserDataArtifactsRoot() {
    return path.join(os.homedir(), ".repo-refactor-ai", "artifacts");
}
/**
 * يحدد مسار قاعدة البيانات
 */
export function getDbPath() {
    return path.join(getArtifactsRoot(), "db", "main.sqlite");
}
/**
 * يحدد مسار مجلد الـ runs
 */
export function getRunsRoot() {
    return path.join(getArtifactsRoot(), "runs");
}
/**
 * يحدد مسار مجلد الـ logs
 */
export function getLogsRoot() {
    return path.join(getArtifactsRoot(), "logs");
}
/**
 * يبني مسار artifact لـ run محدد
 */
export function getArtifactsPath(runId, kind) {
    return path.join(getRunsRoot(), runId, kind);
}
/**
 * يحدد مسار ملف plan.json لـ run محدد
 */
export function getPlanPath(runId) {
    return path.join(getRunsRoot(), runId, "plan", "refactor_plan.json");
}
/**
 * يحدد مسار ملف log لـ run محدد
 */
export function getLogPath(runId) {
    return path.join(getLogsRoot(), `${runId}.log`);
}
/**
 * يضمن وجود مجلدات الـ artifacts المطلوبة
 */
export function ensureArtifactsStructure() {
    const root = getArtifactsRoot();
    fs.mkdirSync(path.join(root, "db"), { recursive: true });
    fs.mkdirSync(path.join(root, "runs"), { recursive: true });
    fs.mkdirSync(path.join(root, "logs"), { recursive: true });
}
/**
 * يتحقق إذا كان هناك marker migration موجود
 */
export function hasMigrationMarker() {
    const markerPath = path.join(getArtifactsRoot(), ".migrated");
    return fs.existsSync(markerPath);
}
/**
 * يكتب marker migration
 */
export function writeMigrationMarker() {
    const markerPath = path.join(getArtifactsRoot(), ".migrated");
    fs.writeFileSync(markerPath, new Date().toISOString(), "utf8");
}
