import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDbClientAtPath } from "./client.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("getDbClientAtPath", () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "db-client-test-"));
    dbPath = path.join(tempDir, "test.db");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should create a database file if it does not exist", () => {
    const db = getDbClientAtPath(dbPath);
    expect(fs.existsSync(dbPath)).toBe(true);
    db.close();
  });

  it("should apply correct pragmas", () => {
    const db = getDbClientAtPath(dbPath);

    const journalMode = db.pragma("journal_mode", { simple: true });
    expect(journalMode).toBe("wal");

    const foreignKeys = db.pragma("foreign_keys", { simple: true });
    expect(foreignKeys).toBe(1);

    db.close();
  });

  it("should create the runs table", () => {
    const db = getDbClientAtPath(dbPath);
    
    const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='runs'");
    const row = stmt.get() as { name: string } | undefined;
    
    expect(row).toBeDefined();
    expect(row?.name).toBe("runs");
    
    db.close();
  });
});
