# TASK-002 — Planner populate targetSymbols and targetRanges

## Overview
This design document outlines the changes required to ensure the **Planner** populates `targetSymbols` and `targetRanges` in every generated **PlanStep**. The **Apply Engine** currently relies on `(step as any).metadata?.symbol`, which is **undefined** because the **Planner** does not populate these fields. This causes the **Apply Engine** to fail in deleting the correct symbols or ranges, leading to unsafe or incomplete refactors.

## Schema Changes
### PlanStep Schema (`packages/schemas/src/plan.ts`)
The **PlanStep** schema has been updated to use a **discriminated union** based on `actions` to enforce requirements for `targetSymbols` and `targetRanges`:

- **Base Schema**: Common fields for all steps (`stepId`, `patchTitle`, `actions`, `targets`, `evidenceRefs`, etc.).
- **Symbol/Range Schema**: Extends the base schema to **require** `targetSymbols` and `targetRanges` for steps involving symbol or range deletions (e.g., `delete_dead`, `rename_symbol`, `extract_function`).
- **Non-Symbol/Range Schema**: Extends the base schema to **optional** `targetSymbols` and `targetRanges` for steps that do not require them (e.g., `merge_files`, `move_file`).

```typescript
// Define a base schema for all steps
const BasePlanStepSchema = z.object({
  stepId: z.string(),
  patchTitle: z.string(),
  actions: z.array(PlanActionSchema).min(1),
  targets: z.array(z.string()).min(1),
  evidenceRefs: z.array(z.string()).min(1),
  riskBand: RiskBandSchema,
  requiresHarness: z.boolean(),
  preChecks: z.array(z.string()).default([]),
  postChecks: z.array(z.string()).default([]),
  rollbackStrategy: z.enum(["git_revert_commit", "git_reset_hard"]).default("git_revert_commit"),
});

// Define a schema for steps that require targetSymbols and targetRanges
const SymbolRangePlanStepSchema = BasePlanStepSchema.extend({
  actions: z.array(z.enum(["delete_dead", "rename_symbol", "extract_function"])).min(1),
  targetSymbols: z.array(z.string()).min(1),
  targetRanges: z.array(z.tuple([z.number(), z.number()])).min(1),
});

// Define a schema for steps that do not require targetSymbols and targetRanges
const NonSymbolRangePlanStepSchema = BasePlanStepSchema.extend({
  actions: z.array(z.enum([
    "unify_duplicates",
    "extract_module",
    "merge_files",
    "move_file",
    "update_imports",
    "add_harness",
    "generate_baseline",
    "cleanup_harness",
    "format_fix",
  ])).min(1),
  targetSymbols: z.array(z.string()).optional(),
  targetRanges: z.array(z.tuple([z.number(), z.number()])).optional(),
});

// Use a discriminated union to enforce requirements based on action type
export const PlanStepSchema = z.discriminatedUnion("actions", [
  SymbolRangePlanStepSchema,
  NonSymbolRangePlanStepSchema,
]);
```

The `metadata` field has been **removed** from the schema to avoid confusion.

## EvidencePacket Integration
The **EvidencePacket** schema (`packages/schemas/src/evidence.ts`) already includes the necessary fields to support `targetSymbols` and `targetRanges`:

```typescript
export const EvidenceTargetSchema = z.object({
  file: z.string(),
  symbol: z.string().nullable().optional(),
  range: z.tuple([z.number().int().min(0), z.number().int().min(0)]).optional(),
});
```

### Extracting `targetSymbols` and `targetRanges`
The **Planner** extracts `targetSymbols` and `targetRanges` from the **EvidencePacket** as follows:

1. For **single-target steps**, the `symbol` and `range` fields are extracted directly from `EvidenceTargetSchema`.
2. For **multi-target steps**, symbols and ranges are grouped by file and aggregated into arrays.
3. If `symbol` or `range` is `null` or `undefined`, it is skipped.

```typescript
// Extract targetSymbols and targetRanges from the EvidencePacket
const targetSymbols: string[] = [];
const targetRanges: [number, number][] = [];

if (target.symbol) {
  targetSymbols.push(target.symbol);
}
if (target.range) {
  targetRanges.push(target.range);
}
```

## Planner Logic
### Populating `targetSymbols` and `targetRanges`
The **Planner** has been updated to populate `targetSymbols` and `targetRanges` for all steps involving symbol or range deletions:

1. **Single-Target Steps**: Extract `symbol` and `range` from the **EvidencePacket** and populate `targetSymbols` and `targetRanges`.
2. **Multi-Target Steps**: Group symbols and ranges by file and populate `targetSymbols` and `targetRanges` with the aggregated arrays.

```typescript
plan.steps.push({
  stepId: generateId("step_"),
  patchTitle: buildDetailedPatchTitle(deadCodeItem),
  actions: ["delete_dead"],
  targets: [target.file],
  targetSymbols, // Populated from EvidencePacket
  targetRanges,  // Populated from EvidencePacket
  evidenceRefs: [deadCodeItem.evidence.id],
  riskBand: determineRiskBand(deadCodeItem),
  requiresHarness: determineRequiresHarness(deadCodeItem),
  preChecks: generatePreChecks(deadCodeItem),
  postChecks: generatePostChecks(deadCodeItem),
  rollbackStrategy: "git_revert_commit",
});
```

### Backward Compatibility
Steps that do not require `targetSymbols` and `targetRanges` (e.g., `merge_files`, `move_file`) remain unchanged. The schema allows these fields to be optional for such steps.

## Apply Engine Changes
The **Apply Engine** (`packages/engine/src/cli/apply.ts`) has been updated to consume `targetSymbols` and `targetRanges` instead of relying on `metadata`:

1. **Symbol and Range Extraction**: Replace `(step as any).metadata?.symbol` and `(step as any).metadata?.range` with `step.targetSymbols` and `step.targetRanges`.
2. **Multi-Symbol/Range Handling**: Update the `deleteSymbolFromFile` logic to process all symbols and ranges in `targetSymbols` and `targetRanges`.

```typescript
// استخراج symbol و range من targetSymbols و targetRanges
const symbol = step.targetSymbols?.[0];
const range = step.targetRanges?.[0];

// Process all symbols and ranges
for (const sym of step.targetSymbols || []) {
  const result = await deleteSymbolFromFile(resolvedTarget, sym, undefined);
  if (!result) success = false;
}
for (const rng of step.targetRanges || []) {
  const result = await deleteSymbolFromFile(resolvedTarget, undefined, rng);
  if (!result) success = false;
}
```

## Pseudo-Code Implementation
### Planner Logic
```typescript
function generatePlanSteps(findings: Findings): PlanStep[] {
  const steps: PlanStep[] = [];
  
  // Group dead code by file
  const groupedDeadCode = groupDeadCodeByFile(findings.deadCode);
  
  for (const [filePath, deadCodeList] of groupedDeadCode) {
    if (deadCodeList.length === 1) {
      // Single-target step
      const deadCodeItem = deadCodeList[0];
      const target = deadCodeItem.evidence.target;
      
      // Extract symbols and ranges
      const targetSymbols = target.symbol ? [target.symbol] : [];
      const targetRanges = target.range ? [target.range] : [];
      
      // Create step
      steps.push({
        stepId: generateId("step_"),
        patchTitle: buildDetailedPatchTitle(deadCodeItem),
        actions: ["delete_dead"],
        targets: [target.file],
        targetSymbols,
        targetRanges,
        evidenceRefs: [deadCodeItem.evidence.id],
        riskBand: determineRiskBand(deadCodeItem),
        requiresHarness: determineRequiresHarness(deadCodeItem),
        preChecks: generatePreChecks(deadCodeItem),
        postChecks: generatePostChecks(deadCodeItem),
        rollbackStrategy: "git_revert_commit",
      });
    } else {
      // Multi-target step
      const symbols: string[] = [];
      const ranges: [number, number][] = [];
      
      for (const dc of deadCodeList) {
        if (dc.evidence.target.symbol) {
          symbols.push(dc.evidence.target.symbol);
        }
        if (dc.evidence.target.range) {
          ranges.push(dc.evidence.target.range);
        }
      }
      
      // Create step
      steps.push({
        stepId: generateId("step_"),
        patchTitle: `Delete dead code in ${path.basename(filePath)} — ${deadCodeList.length} symbols`,
        actions: ["delete_dead"],
        targets: [filePath],
        targetSymbols: symbols,
        targetRanges: ranges,
        evidenceRefs: deadCodeList.map(dc => dc.evidence.id),
        riskBand: determineHighestRisk(deadCodeList),
        requiresHarness: deadCodeList.some(dc => determineRequiresHarness(dc)),
        preChecks: ["tsc_noEmit", "eslint", "import_graph_check"],
        postChecks: ["tsc_noEmit", "eslint", "import_graph_check", "vitest_run"],
        rollbackStrategy: "git_revert_commit",
      });
    }
  }
  
  return steps;
}
```

## Checklist of Files to Modify
| File | Purpose |
|------|---------|
| [`packages/schemas/src/plan.ts`](packages/schemas/src/plan.ts) | Update the **PlanStep** schema to enforce `targetSymbols` and `targetRanges` for relevant steps. |
| [`packages/planning/src/planner.ts`](packages/planning/src/planner.ts) | Update the **Planner** to populate `targetSymbols` and `targetRanges` from the **EvidencePacket**. |
| [`packages/engine/src/cli/apply.ts`](packages/engine/src/cli/apply.ts) | Update the **Apply Engine** to consume `targetSymbols` and `targetRanges` instead of `metadata`. |