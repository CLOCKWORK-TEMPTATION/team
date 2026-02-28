import React, { useState } from "react";

// @ts-ignore
const repoRefactor = window.repoRefactor;

export function App() {
  const [repoPath, setRepoPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const handleSelectRepo = async () => {
    const path = await repoRefactor.selectRepo();
    if (path) setRepoPath(path);
  };

  const handleScan = async () => {
    if (!repoPath) return;
    setLoading(true);
    setLogs((prev) => [...prev, `Starting scan for: ${repoPath}...`]);
    const result = await repoRefactor.scan(repoPath);
    setLoading(false);
    if (result.success) {
      setLogs((prev) => [...prev, "Scan successful!", result.output]);
    } else {
      setLogs((prev) => [...prev, `Scan failed: ${result.error}`]);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, sans-serif", maxWidth: 800, margin: "0 auto" }}>
      <h1>Repo Refactor AI Dashboard</h1>
      
      <div style={{ marginBottom: 20 }}>
        <button onClick={handleSelectRepo} style={{ padding: "8px 16px", marginRight: 10 }}>
          Select Repository
        </button>
        {repoPath && <span>Selected: <strong>{repoPath}</strong></span>}
      </div>

      <div style={{ marginBottom: 20 }}>
        <button 
          onClick={handleScan} 
          disabled={!repoPath || loading}
          style={{ padding: "8px 16px" }}
        >
          {loading ? "Scanning..." : "Run Analysis Scan"}
        </button>
      </div>

      <div style={{
        background: "#1e1e1e",
        color: "#d4d4d4",
        padding: 16,
        borderRadius: 8,
        minHeight: 200,
        fontFamily: "monospace",
        whiteSpace: "pre-wrap",
        overflowY: "auto"
      }}>
        {logs.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
        {logs.length === 0 && <div style={{ color: "#666" }}>Logs will appear here...</div>}
      </div>
    </div>
  );
}
