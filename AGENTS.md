## Cursor Cloud specific instructions

This is a pnpm workspace monorepo (`pnpm-workspace.yaml`) with packages under `packages/` and apps under `apps/`.

- **Package manager**: pnpm (declared via `packageManager` in root `package.json`).
- **Node**: >= 20 required.
- **Build**: `pnpm -r build` builds all 11 workspace packages (topological order handled by pnpm).
- **Lint**: `pnpm -r lint` runs ESLint across all packages.
- **Typecheck**: `pnpm -r typecheck` runs `tsc --noEmit` across all packages.
- **Test**: `pnpm test` (runs `vitest run` at root; config in `vitest.config.ts`, picks up `packages/**/src/**/*.test.ts`).
- **Dev server (renderer)**: `pnpm dev` starts the Vite dev server for `apps/desktop` renderer on `http://localhost:5173/`.
- **Schemas package** (`@pkg/schemas`) is the leaf dependency for most packages; build it first if doing incremental builds.
- The original repository contains only JSON specification documents (Arabic) describing the full architecture. The scaffolded TypeScript project was created from those specs.
- No external databases are required; SQLite (`better-sqlite3`) is embedded in `@pkg/storage`.
- LLM API keys (OpenAI, Anthropic, Google, Mistral) are optional and only needed when running the full pipeline with LLM-powered planning/coding agents.
