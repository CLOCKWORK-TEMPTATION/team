import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

export function getDbClient(dbPath: string): Database.Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath, {
    // verbose: console.log
  });

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  
  return db;
}
