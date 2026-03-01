import fs from "node:fs/promises";
import path from "node:path";
import type { Database } from "better-sqlite3";
import { getRunsRoot } from "./paths.js";

export async function readArtifact(
  db: Database,
  runId: string,
  kind: string,
  filename: string
): Promise<string | null> {
  const stmt = db.prepare(`
    SELECT rel_path FROM artifacts
    WHERE run_id = ? AND kind = ? AND rel_path LIKE ?
    ORDER BY id DESC LIMIT 1
  `);

  const row = stmt.get(runId, kind, `%${filename}%`) as { rel_path: string } | undefined;
  if (!row) return null;

  const filePath = path.join(getRunsRoot(), row.rel_path);
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

export async function readJsonArtifact<T>(
  db: Database,
  runId: string,
  kind: string,
  filename: string
): Promise<T | null> {
  const content = await readArtifact(db, runId, kind, filename);
  if (!content) return null;
  return JSON.parse(content) as T;
}
