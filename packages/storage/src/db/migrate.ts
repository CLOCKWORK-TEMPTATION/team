import { getDbClient } from "./client.js";
import fs from "node:fs";
import path from "node:path";

export function runMigrations(dbPath: string) {
  const db = getDbClient(dbPath);
  const schemaPath = path.join(import.meta.dirname, "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");
  db.exec(schemaSql);
  db.close();
}
