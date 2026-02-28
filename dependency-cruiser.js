/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // منع الدوائر في كل المشروع
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true }
    },

    // apps لا يُستورد داخل packages
    {
      name: "no-packages-import-apps",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" }
    },

    // schemas يجب أن تكون leaf
    {
      name: "schemas-should-be-leaf",
      severity: "error",
      from: { path: "^packages/schemas/" },
      to: { path: "^packages/(analysis|planning|refactor|engine|llm|harness|tooling|storage|shared)/" }
    },

    // shared منخفض المستوى
    {
      name: "shared-should-not-depend-on-high-level",
      severity: "error",
      from: { path: "^packages/shared/" },
      to: { path: "^packages/(analysis|planning|refactor|engine|llm|harness)/" }
    },

    // storage منخفض المستوى
    {
      name: "storage-should-not-depend-on-high-level",
      severity: "error",
      from: { path: "^packages/storage/" },
      to: { path: "^packages/(analysis|planning|refactor|engine|llm|harness)/" }
    },

    // tooling يعتمد فقط على base
    {
      name: "tooling-depends-only-on-base",
      severity: "error",
      from: { path: "^packages/tooling/" },
      to: { path: "^packages/(analysis|planning|refactor|engine|llm|harness)/" }
    },

    // analysis لا يعتمد على planning/refactor/engine
    {
      name: "analysis-should-not-depend-on-planning-refactor-engine",
      severity: "error",
      from: { path: "^packages/analysis/" },
      to: { path: "^packages/(planning|refactor|engine)/" }
    },

    // planning لا يعتمد على refactor/engine
    {
      name: "planning-should-not-depend-on-refactor-engine",
      severity: "error",
      from: { path: "^packages/planning/" },
      to: { path: "^packages/(refactor|engine)/" }
    },

    // refactor لا يعتمد على analysis/planning/engine
    {
      name: "refactor-should-not-depend-on-analysis-planning-engine",
      severity: "error",
      from: { path: "^packages/refactor/" },
      to: { path: "^packages/(analysis|planning|engine)/" }
    },

    // llm لا يعتمد على engine
    {
      name: "llm-should-not-depend-on-engine",
      severity: "error",
      from: { path: "^packages/llm/" },
      to: { path: "^packages/engine/" }
    }
  ],

  options: {
    doNotFollow: {
      path: "node_modules|dist|build|out|artifacts"
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node"]
    },
    tsConfig: {
      fileName: "tsconfig.base.json"
    }
  }
};