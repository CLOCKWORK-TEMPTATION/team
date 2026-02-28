import React, { useState } from "react";

export function App(): React.JSX.Element {
  const [status, setStatus] = useState("Ready");

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Repo Refactor AI</h1>
      <p>Status: {status}</p>
      <button
        onClick={() => setStatus("Scanning...")}
        style={{
          padding: "0.5rem 1rem",
          fontSize: "1rem",
          cursor: "pointer",
          borderRadius: "4px",
          border: "1px solid #333",
          backgroundColor: "#0066cc",
          color: "white",
        }}
      >
        Start Scan
      </button>
    </div>
  );
}
