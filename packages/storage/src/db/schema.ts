import type Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readSchemaSql(): string {
  const schemaPath = path.resolve(__dirname, "schema.sql");
  return fs.readFileSync(schemaPath, "utf8");
}

/**
 * Ensures the basic tables exist. Idempotent because schema.sql uses IF NOT EXISTS.
 */
export function ensureDbSchema(db: Database.Database): void {
  const sql = readSchemaSql();
  db.exec(sql);
}
