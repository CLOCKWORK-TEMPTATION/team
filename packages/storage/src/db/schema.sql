PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Runs: كل تشغيل scan/plan/apply/verify له runId
CREATE TABLE IF NOT EXISTS runs (
  run_id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL,
  repo_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL, -- CREATED | SCANNED | PLANNED | APPROVED | APPLIED | VERIFIED | FAILED
  meta_json TEXT
);

-- Artifacts: تخزين مسارات الملفات الناتجة + نوعها
CREATE TABLE IF NOT EXISTS artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  kind TEXT NOT NULL,             -- evidence_pack | findings | plan | report | log | telemetry | verification | harness_template | etc
  rel_path TEXT NOT NULL,         -- relative under artifacts/runs/<run_id> OR absolute in target repo for harness
  created_at TEXT NOT NULL,
  json_sha256 TEXT,
  size_bytes INTEGER,
  FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE CASCADE
);

-- Approvals: بوابة الموافقة قبل التنفيذ
CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  approved_by TEXT,               -- local user label (اختياري)
  approved_at TEXT,
  status TEXT NOT NULL,           -- PENDING | APPROVED | REJECTED
  report_rel_path TEXT NOT NULL,  -- where report.md lives
  plan_rel_path TEXT NOT NULL,    -- where refactor_plan.json lives
  notes TEXT,
  FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE CASCADE
);

-- Telemetry events
CREATE TABLE IF NOT EXISTS telemetry_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  at TEXT NOT NULL,
  level TEXT NOT NULL,            -- debug|info|warn|error
  name TEXT NOT NULL,
  data_json TEXT,
  FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_artifacts_run_kind ON artifacts(run_id, kind);
CREATE INDEX IF NOT EXISTS idx_telemetry_run ON telemetry_events(run_id);