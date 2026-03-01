import fs from "node:fs/promises";
import path from "node:path";
import { getArtifactsPath } from "./paths.js";
import type { Database } from "better-sqlite3";

export async function writeArtifact(
  db: Database,
  runId: string,
  kind: string,
  filename: string,
  content: string
): Promise<string> {
  const dirPath = getArtifactsPath(runId, kind);
  await fs.mkdir(dirPath, { recursive: true });

  const filePath = path.join(dirPath, filename);
  await fs.writeFile(filePath, content, "utf-8");

  // حساب SHA256 (بدون الاعتماد على @pkg/shared لتجنب مشاكل التبعيات)
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const relPath = path.join(runId, kind, filename).replace(/\\/g, "/");

  const stmt = db.prepare(`
    INSERT INTO artifacts (run_id, kind, rel_path, created_at, json_sha256, size_bytes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(runId, kind, relPath, new Date().toISOString(), hash, Buffer.byteLength(content, "utf8"));

  return filePath;
}

export async function writeJsonArtifact(
  db: Database,
  runId: string,
  kind: string,
  filename: string,
  data: unknown
): Promise<string> {
  return writeArtifact(db, runId, kind, filename, JSON.stringify(data, null, 2));
}
