# Repo Refactor AI

A TypeScript/Node monorepo (ESM + NodeNext) utilizing `pnpm workspaces`. It features an Electron Desktop App and a robust pipeline refactor engine based on static analysis evidence (AST, Type refs, Import graph, Call graph, Tooling hits), orchestrated with AI.

## Project Architecture

The project consists of a hybrid architecture:
- **`apps/desktop`**: Electron-based desktop application providing the UI and IPC to interface with the core engine.
- **`packages/*`**: The core logic, separated into strict boundaries:
  - `schemas`: Zod schemas and Types.
  - `shared`: Logging, helpers, fs/glob.
  - `tooling`: External analysis tool wrappers (knip, depcheck, etc.).
  - `storage`: SQLite + artifact storage.
  - `analysis`: Evidence extraction, graph builders, entrypoints, and risk inputs.
  - `harness`: Behavioral Equivalence Harness using Vitest.
  - `planning`: Evidence gatekeeper, planner, report generation, and approval.
  - `refactor`: Codemods and Git patch executions.
  - `llm`: AI providers, prompts, and routing.
  - `engine`: Orchestrator, CLI, telemetry, and API for Electron.

## Prerequisites

- Node.js (v20 or higher)
- `pnpm` (v9/10+)

## Installation

Install dependencies across all workspaces:

```bash
pnpm install
```

## Setup & Configuration

Copy `.env.example` (from `packages/llm/.env.example` or similar) to `.env.development` or `.env` and fill in your API keys (e.g. `OPENAI_API_KEY`) if you're using LLM features.

## Available Scripts

### General Commands

- **Build everything:**
  ```bash
  pnpm build
  ```
- **Run Typecheck:**
  ```bash
  pnpm typecheck
  ```
- **Lint Code:**
  ```bash
  pnpm lint
  ```
- **Run Tests:**
  ```bash
  npx vitest run
  ```

### CLI Engine Commands

Run the engine tools directly from the command line:

- **Scan a target directory:**
  ```bash
  pnpm engine:scan --target ./path/to/repo
  ```
- **Plan refactoring:**
  ```bash
  pnpm engine:plan --target ./path/to/repo --run-id <id>
  ```
- **Apply plan:**
  ```bash
  pnpm engine:apply --target ./path/to/repo --run-id <id>
  ```
- **Verify with harness:**
  ```bash
  pnpm engine:verify --target ./path/to/repo --run-id <id>
  ```

### Desktop Application

To start the Electron Desktop App in development mode:

```bash
pnpm dev
```

This will run `apps/desktop` which includes the React/Vite renderer and Electron main process.

## Core Tenets

1. **Evidence First**: No code is deleted, merged, or refactored without a clear Evidence Packet (AST / Type Refs / Graphs).
2. **Approval Gate**: Code execution (apply) cannot happen unless `approvalStatus = APPROVED`.
3. **Atomic Patch Series**: Every execution step is a small change with an independent commit and verification.
4. **Noise Guard**: Unrelated cleanups and formatting changes are prohibited outside the patch's logical scope.
