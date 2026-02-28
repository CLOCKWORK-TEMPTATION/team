## Cursor Cloud specific instructions

This is a pnpm workspace monorepo (`pnpm-workspace.yaml`) with packages under `packages/` and apps under `apps/`.

- **Package manager**: pnpm 9.x (declared via `packageManager` in root `package.json`).
- **Node**: >= 20 required.
- **Build**: `pnpm -r build` builds all packages. The `apps/desktop` Electron app build currently has a pre-existing TS composite/declaration config issue—package builds under `packages/*` work fine.
- **Lint**: `pnpm -r lint` (each package has its own `lint` script using eslint).
- **Typecheck**: `pnpm -r typecheck`.
- **Test**: `vitest run` at root (config in `vitest.config.ts`).
- **Schemas package** (`@pkg/schemas`) is the leaf dependency for most packages—build it first if doing incremental builds.
