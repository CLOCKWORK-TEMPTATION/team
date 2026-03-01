/* global console */

import path from "node:path";
import fs from "node:fs";
import {
  getArtifactsRoot,
  getRunsRoot,
  getLogsRoot,
  hasMigrationMarker,
  writeMigrationMarker,
} from "../artifacts/paths.js";

/**
 * يُنفذ ترحيل تلقائي للبيانات القديمة من packages/engine/artifacts
 * إلى الموقع الجديد الموحد (root artifacts أو userData artifacts)
 */
export function runMigration(): { migrated: boolean; message: string } {
  // التحقق إذا كان الترحيل قد تم بالفعل
  if (hasMigrationMarker()) {
    return { migrated: false, message: "Migration already completed (marker found)." };
  }

  const projectRoot = path.resolve(getArtifactsRoot(), "../../..");
  const oldArtifactsPath = path.join(projectRoot, "packages", "engine", "artifacts");

  // التحقق من وجود البيانات القديمة
  if (!fs.existsSync(oldArtifactsPath)) {
    writeMigrationMarker();
    return { migrated: false, message: "No old artifacts found, nothing to migrate." };
  }

  try {
    const newArtifactsRoot = getArtifactsRoot();

    // إنشاء البنية الجديدة
    fs.mkdirSync(path.join(newArtifactsRoot, "db"), { recursive: true });
    fs.mkdirSync(getRunsRoot(), { recursive: true });
    fs.mkdirSync(getLogsRoot(), { recursive: true });

    // ترحيل قاعدة البيانات
    const oldDbPath = path.join(oldArtifactsPath, "db", "refactor.sqlite");
    const newDbPath = path.join(newArtifactsRoot, "db", "main.sqlite");

    if (fs.existsSync(oldDbPath)) {
      fs.copyFileSync(oldDbPath, newDbPath);
      console.log(`[migrate] Database migrated: ${oldDbPath} -> ${newDbPath}`);
    }

    // ترحيل الـ runs
    const oldRunsPath = path.join(oldArtifactsPath, "runs");
    if (fs.existsSync(oldRunsPath)) {
      const runs = fs.readdirSync(oldRunsPath);
      for (const runId of runs) {
        const oldRunPath = path.join(oldRunsPath, runId);
        const newRunPath = path.join(getRunsRoot(), runId);

        if (fs.statSync(oldRunPath).isDirectory()) {
          fs.mkdirSync(newRunPath, { recursive: true });
          copyDirectoryRecursive(oldRunPath, newRunPath);
          console.log(`[migrate] Run migrated: ${runId}`);
        }
      }
    }

    // ترحيل الـ logs (إن وجدت)
    const oldLogsPath = path.join(oldArtifactsPath, "logs");
    if (fs.existsSync(oldLogsPath)) {
      copyDirectoryRecursive(oldLogsPath, getLogsRoot());
      console.log(`[migrate] Logs migrated`);
    }

    // كتابة marker
    writeMigrationMarker();

    return {
      migrated: true,
      message: `Migration completed successfully. Old artifacts at: ${oldArtifactsPath}`,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      migrated: false,
      message: `Migration failed: ${errorMsg}`,
    };
  }
}

/**
 * ينسخ محتويات مجلد بشكل متكرر
 */
function copyDirectoryRecursive(source: string, destination: string): void {
  fs.mkdirSync(destination, { recursive: true });
  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
