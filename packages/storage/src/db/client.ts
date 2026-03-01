import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { getDbPath, ensureArtifactsStructure } from "../artifacts/paths.js";
import { ensureDbSchema } from "./schema.js";

/**
 * يُنشئ ويعيد عميل قاعدة البيانات SQLite
 * المسار يُقرأ تلقائياً من artifactsRoot/db/main.sqlite
 */
export function getDbClient(): Database.Database {
  // التأكد من وجود البنية المطلوبة
  ensureArtifactsStructure();

  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath, {
    // verbose: console.log
  });

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  ensureDbSchema(db);

  return db;
}

/**
 * يُنشئ عميل قاعدة بيانات بمسار مخصص (للاختبار أو حالات خاصة)
 */
export function getDbClientAtPath(dbPath: string): Database.Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath, {
    // verbose: console.log
  });

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  ensureDbSchema(db);

  return db;
}
