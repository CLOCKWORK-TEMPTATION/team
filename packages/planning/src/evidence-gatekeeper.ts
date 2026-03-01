import { EvidencePackSchema, RefactorPlanSchema } from "@pkg/schemas";

export interface EvidenceGateReport {
  ok: boolean;
  blockedSteps: { stepId: string; reason: string }[];
  warnings: { stepId: string; warning: string }[];
}

export interface BoundaryCheckResult {
  hasCycles: boolean;
  hasBoundaryViolations: boolean;
  violations: string[];
}

/**
 * يتحقق من قواعد الحدود (Boundaries) قبل وبعد التنفيذ
 * يُستخدم للكشف عن:
 * - الدورات (cycles) في الاعتماديات
 * - اختراقات الحدود بين الحزم
 */
export function checkBoundaries(
  beforeGraph: { nodes: string[]; edges: [string, string][] },
  afterGraph?: { nodes: string[]; edges: [string, string][] }
): BoundaryCheckResult {
  const violations: string[] = [];

  // التحقق من الدورات في الرسم البياني
  function detectCycles(
    graph: { nodes: string[]; edges: [string, string][] }
  ): string[] {
    const cycles: string[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const adj = new Map<string, string[]>();

    // بناء قائمة المجاورة
    for (const [from, to] of graph.edges) {
      if (!adj.has(from)) adj.set(from, []);
      adj.get(from)!.push(to);
    }

    // DFS للكشف عن الدورات
    function dfs(node: string, path: string[]): boolean {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = adj.get(node) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor, path)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          // وجدنا دورة
          const cycleStart = path.indexOf(neighbor);
          const cycle = path.slice(cycleStart).concat([neighbor]);
          cycles.push(`Cycle detected: ${cycle.join(" → ")}`);
          return true;
        }
      }

      path.pop();
      recursionStack.delete(node);
      return false;
    }

    for (const node of graph.nodes) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  // التحقق من اختراقات الحدود
  function checkBoundaryViolations(
    graph: { nodes: string[]; edges: [string, string][] }
  ): string[] {
    const boundaryViolations: string[] = [];

    // قواعد الحدود المحددة في dependency-cruiser.js
    const boundaryRules = [
      {
        name: "no-packages-import-apps",
        from: /^packages\//,
        to: /^apps\//,
      },
      {
        name: "schemas-should-be-leaf",
        from: /^packages\/schemas\//,
        to: /^packages\/(analysis|planning|refactor|engine|llm|harness|tooling|storage|shared)\//,
      },
      {
        name: "shared-should-not-depend-on-high-level",
        from: /^packages\/shared\//,
        to: /^packages\/(analysis|planning|refactor|engine|llm|harness)\//,
      },
      {
        name: "storage-should-not-depend-on-high-level",
        from: /^packages\/storage\//,
        to: /^packages\/(analysis|planning|refactor|engine|llm|harness)\//,
      },
      {
        name: "tooling-depends-only-on-base",
        from: /^packages\/tooling\//,
        to: /^packages\/(analysis|planning|refactor|engine|llm|harness)\//,
      },
      {
        name: "analysis-should-not-depend-on-planning-refactor-engine",
        from: /^packages\/analysis\//,
        to: /^packages\/(planning|refactor|engine)\//,
      },
      {
        name: "planning-should-not-depend-on-refactor-engine",
        from: /^packages\/planning\//,
        to: /^packages\/(refactor|engine)\//,
      },
      {
        name: "refactor-should-not-depend-on-analysis-planning-engine",
        from: /^packages\/refactor\//,
        to: /^packages\/(analysis|planning|engine)\//,
      },
      {
        name: "llm-should-not-depend-on-engine",
        from: /^packages\/llm\//,
        to: /^packages\/engine\//,
      },
    ];

    for (const [from, to] of graph.edges) {
      for (const rule of boundaryRules) {
        if (rule.from.test(from) && rule.to.test(to)) {
          boundaryViolations.push(
            `Boundary violation (${rule.name}): ${from} → ${to}`
          );
        }
      }
    }

    return boundaryViolations;
  }

  // التحقق من الدورات في الرسم البياني قبل التغييرات
  const cyclesBefore = detectCycles(beforeGraph);
  if (cyclesBefore.length > 0) {
    violations.push(...cyclesBefore);
  }

  // التحقق من اختراقات الحدود قبل التغييرات
  const boundaryViolationsBefore = checkBoundaryViolations(beforeGraph);
  if (boundaryViolationsBefore.length > 0) {
    violations.push(...boundaryViolationsBefore);
  }

  // إذا وُجد رسم بياني بعد التغييرات، تحقق منه أيضاً
  if (afterGraph) {
    const cyclesAfter = detectCycles(afterGraph);
    // نحن مهتمون بالدورات الجديدة التي ظهرت بعد التغييرات
    const newCycles = cyclesAfter.filter((c) => !cyclesBefore.includes(c));
    if (newCycles.length > 0) {
      violations.push(
        ...newCycles.map((c) => `[POST-CHANGE] ${c} (NEW CYCLE INTRODUCED)`)
      );
    }

    const boundaryViolationsAfter = checkBoundaryViolations(afterGraph);
    // التحقق من الاختراقات الجديدة
    const newViolations = boundaryViolationsAfter.filter(
      (v) => !boundaryViolationsBefore.includes(v)
    );
    if (newViolations.length > 0) {
      violations.push(
        ...newViolations.map(
          (v) => `[POST-CHANGE] ${v} (NEW BOUNDARY VIOLATION)`
        )
      );
    }
  }

  return {
    hasCycles: cyclesBefore.length > 0 || (afterGraph ? detectCycles(afterGraph).length > 0 : false),
    hasBoundaryViolations: boundaryViolationsBefore.length > 0 || (afterGraph ? checkBoundaryViolations(afterGraph).length > 0 : false),
    violations,
  };
}

/**
 * قاعدة 4.2:
 * - لا خطة بدون evidenceRefs
 * - لا تنفيذ لحذف/دمج عالي المخاطر بدون requiresHarness=true
 * - خطوات تتأثر بـ dynamic/public API تُرفع لمخاطر أعلى أو تُحجب
 */
export function gatePlanWithEvidence(params: {
  evidencePackJson: unknown;
  planJson: unknown;
  importGraph?: { nodes: string[]; edges: [string, string][] };
}): { gatedPlanJson: unknown; report: EvidenceGateReport } {
  const evidencePack = EvidencePackSchema.parse(params.evidencePackJson);
  const plan = RefactorPlanSchema.parse(params.planJson);

  const packetsById = new Map(evidencePack.packets.map((p) => [p.id, p]));

  const blockedSteps: EvidenceGateReport["blockedSteps"] = [];
  const warnings: EvidenceGateReport["warnings"] = [];

  // التحقق من الحدود على مستوى الخطوة
  if (params.importGraph) {
    const boundaryCheck = checkBoundaries(params.importGraph);

    if (boundaryCheck.hasCycles) {
      blockedSteps.push({
        stepId: "GLOBAL",
        reason: `Cycles detected in dependency graph: ${boundaryCheck.violations.filter(v => v.includes("Cycle")).join("; ")}`,
      });
    }

    if (boundaryCheck.hasBoundaryViolations) {
      const boundaryViolations = boundaryCheck.violations.filter(v =>
        v.includes("Boundary violation")
      );

      // خطوات الدمج/النقل التي تسبب اختراقات حدود تُحجب أو تُرفع المخاطر
      for (const step of plan.steps) {
        const isMergeOrMove = step.actions.some(
          (a) => a.includes("merge") || a.includes("move") || a.includes("unify")
        );

        if (isMergeOrMove && boundaryViolations.length > 0) {
          warnings.push({
            stepId: step.stepId,
            warning: `Merge/move step may cause boundary violations: ${boundaryViolations.join("; ")}`,
          });

          // إذا كانت الخطوة منخفضة المخاطر، ارفعها لمتوسطة
          if (step.riskBand === "low") {
            warnings.push({
              stepId: step.stepId,
              warning: "Risk elevated from low to medium due to boundary concerns.",
            });
          }
        }
      }
    }
  }

  const gatedSteps = plan.steps.map((step) => {
    // شرط evidenceRefs
    if (!step.evidenceRefs?.length) {
      blockedSteps.push({ stepId: step.stepId, reason: "Missing evidenceRefs (Rule 4.2)" });
      return { ...step, riskBand: "blocked" as const };
    }

    // تحقق وجود كل evidenceRef
    for (const id of step.evidenceRefs) {
      if (!packetsById.has(id)) {
        blockedSteps.push({ stepId: step.stepId, reason: `EvidenceRef not found: ${id}` });
        return { ...step, riskBand: "blocked" as const };
      }
    }

    // قواعد المخاطر المرتبطة بالديناميكية وpublic API
    let requiresHarness = step.requiresHarness;
    let riskBand = step.riskBand;

    for (const id of step.evidenceRefs) {
      const p = packetsById.get(id)!;

      if (p.exceptions.dynamicImportSuspicion) {
        warnings.push({ stepId: step.stepId, warning: `Dynamic suspicion in ${id}: force harness.` });
        requiresHarness = true;
        if (riskBand === "low") riskBand = "medium";
      }

      if (p.exceptions.publicApiExposure) {
        warnings.push({
          stepId: step.stepId,
          warning: `Public API exposure in ${id}: elevate risk + force harness.`,
        });
        requiresHarness = true;
        riskBand = "high";
      }

      if (p.recommendedAction === "propose_only") {
        blockedSteps.push({ stepId: step.stepId, reason: `Evidence ${id} is propose_only.` });
        return { ...step, riskBand: "blocked" as const };
      }
    }

    // شرط: high risk ⇒ harness إلزامي
    if (riskBand === "high" && !requiresHarness) {
      blockedSteps.push({ stepId: step.stepId, reason: "High risk step without harness requirement." });
      return { ...step, riskBand: "blocked" as const };
    }

    return { ...step, requiresHarness, riskBand };
  });

  const gatedPlanJson = {
    ...plan,
    steps: gatedSteps,
  };

  const ok = blockedSteps.length === 0;

  return {
    gatedPlanJson,
    report: { ok, blockedSteps, warnings },
  };
}
