# AGENTS.md

ده ملف توجيهات إلزامي لأي AI Agent / Code Agent شغال على مشروع **repo-refactor-ai**.

المشروع Monorepo TypeScript/Node (ESM + NodeNext) باستخدام **pnpm workspaces**، وفيه **Electron Desktop App** + Pipeline refactor engine قائم على **أدلة تحليل ساكن** (مش LLM لوحده).

## 0) مبدأ حاكم (غير قابل للتفاوض)

- **قاعدة 4.2 (Evidence First)**
  - ممنوع أي حذف/دمج/نقل/توحيد/إعادة تسمية إلا لما يبقى فيه **Evidence Packet** واضح (AST/Type refs/Import graph/Call graph/Tooling hits) + **Risk score** + **Entry points**.
  - الـ LLM دوره: تحكيم + تخطيط + كتابة باتشات… بس بعد الدليل.

- **Approval Gate إلزامي**
  - التنفيذ الفعلي (apply) ما يبدأش غير لما `approvalStatus = APPROVED`.

- **Atomic Patch Series**
  - كل خطوة تنفيذ = تغيير صغير + Commit مستقل + تحقق بعده.
  - لو فشل التحقق: Rollback (prefer `git_revert_commit`) + إعادة تخطيط.

- **Noise Guard**
  - ممنوع “تنضيف شامل” أو formatting واسع خارج نطاق الباتش المنطقي.

## 1) ستاك المشروع (Fingerprint)

- **Package manager**: `pnpm` (المتوقع `pnpm@9`)
- **Node**: `>= 20`
- **TypeScript**: strict + `module: NodeNext` + `moduleResolution: NodeNext`
- **ESLint**: Flat config (`eslint.config.js`) + Boundaries rules
- **Prettier**: `prettier.config.cjs`
- **Dependency rules**: `dependency-cruiser.js` (منع cycles + منع اختراق الحدود)

## 2) خريطة المشروع السريعة

- **الجذر**
  - `package.json`: سكريبتات تشغيل عليا
  - `pnpm-workspace.yaml`: `apps/*` و `packages/*`
  - `tsconfig.base.json`, `tsconfig.node.json`
  - `eslint.config.js`, `prettier.config.cjs`
  - `artifacts/`: مخرجات تشغيل (غالبًا متجاهلة)

- **apps/desktop** (Electron)
  - Main: `apps/desktop/src/main/*`
  - Preload: `apps/desktop/src/preload/*`
  - Renderer (React + Vite): `apps/desktop/src/renderer/*`
  - مبدأ IPC: الـ preload يعرّف API واحد بس: `window.repoRefactor`، وكل الاستدعاءات تمر عبر Engine API.

- **packages/** (قلب النظام)
  - `packages/schemas`: Zod schemas + Types (مصدر الحقيقة للـ shapes)
  - `packages/shared`: logging + helpers + fs/glob
  - `packages/tooling`: تشغيل أدوات التحليل (knip/depcheck/jscpd/depcruise/tsc/eslint) *بدون قرارات*
  - `packages/storage`: SQLite + artifact store
  - `packages/analysis`: استخراج الأدلة/graphs/contracts/risk inputs *بدون تعديل للـ repo الهدف*
  - `packages/harness`: Behavioral Equivalence Harness (Vitest داخل repo الهدف)
  - `packages/planning`: Evidence gatekeeper + planner + report writer + approval gate
  - `packages/refactor`: تنفيذ الخطة (codemods + git) *بدون إنتاج findings جديدة*
  - `packages/llm`: providers + router + prompts
  - `packages/engine`: orchestrator + CLI + telemetry + API للـ Electron

## 3) حدود مسئوليات الحزم (Hard Boundaries)

أي Agent لازم يلتزم بالحدود دي. لو طلبك يتعارض، ارفع Warning واطلب توضيح.

- **packages/analysis**
  - **مسموح**: استخراج Evidence/Graphs/Detectors/Entry points/Contracts/Risk inputs
  - **ممنوع**: تنفيذ تعديل فعلي على repo هدف

- **packages/tooling**
  - **مسموح**: wrappers لتشغيل الأدوات وتجميع نتائجها
  - **ممنوع**: اتخاذ قرار حذف/دمج/نقل

- **packages/planning**
  - **مسموح**: تحويل Evidence -> Plan + Report + enforce gatekeeping
  - **ممنوع**: تنفيذ refactor حقيقي

- **packages/refactor**
  - **مسموح**: تنفيذ plan steps + تحديث imports + git commits
  - **ممنوع**: إنتاج findings جديدة أو تغيير قواعد التخطيط

- **packages/harness**
  - **مسموح**: توليد Harness داخل repo الهدف + baseline + verify (Vitest)
  - **ممنوع**: اقتراح refactor جديد (ده دور planning)

- **packages/engine**
  - **مسموح**: orchestration + CLI + telemetry + wiring
  - **ممنوع**: منطق تحليل تفصيلي بدل analysis

- **apps/desktop**
  - **مسموح**: UI/IPC/عرض التقارير والتحكم في approval/execute
  - **ممنوع**: تحليل أو تعديل repo الهدف مباشرة

## 4) قواعد Boundaries (7.5) — لازم تتطبق

- ممنوع cycles في dependency graph.
- ممنوع `packages/*` تستورد من `apps/*`.
- `packages/schemas` لازم تفضل leaf (ما تعتمدش على حزم أعلى).
- `shared` و `storage` منخفضين المستوى (ما يعتمدوش على analysis/planning/refactor/engine/llm/harness).
- `tooling` يعتمد على base فقط.

**ملفات مصدر القواعد**:
- `eslint.config.js` (Flat config + boundaries)
- `dependency-cruiser.js`

## 5) Evidence Packet — الحد الأدنى المطلوب قبل أي Action

أي Candidate لازم يبقى مرتبط بـ `EvidencePacket` متوافق مع `@pkg/schemas` ويحتوي على الأقل:

- **Import Graph evidence**
  - `inboundCount` + `inboundFiles`
- **Call graph evidence**
  - `callers` (أو تفسير صريح لو callgraph مش متاح)
- **TS References evidence**
  - `refCount` + `refs[]`
- **Tool hits**
  - knip/depcheck/jscpd/depcruise outputs (حتى لو string references)
- **Entry points classification**
  - runtime/test/tooling entrypoints
- **Exception flags**
  - `dynamicImportSuspicion`
  - `sideEffectModule`
  - `publicApiExposure`
- **Risk**
  - `score` + `band` + `reasons[]`

### استثناءات الديناميكية
لو فيه أي شبهة ديناميكية (dynamic import / plugin registries / string dispatch / DI tokens):
- لازم `dynamicImportSuspicion = true`
- يترفع الـ risk
- **ممنوع حذف تلقائي** إلا بدليل أقوى + غالبًا Harness

## 6) Entry Points (النواقص الإلزامية)

لازم يتعمل extractor لنقاط الدخول من:
- `package.json` (`main`, `exports`, `bin`, `types`)
- configs (vite/next/jest/vitest/tsconfig)
- مسارات تشغيل CLI

وتتقسم لـ:
- `runtime_entrypoints`
- `test_entrypoints`
- `tooling_entrypoints`

## 7) Harness (7.2) — سياسة التشغيل داخل repo الهدف

الـ Harness بيتكتب **داخل المستودع الهدف** في:
- `<target-repo>/.refactor-harness/*`

ومحرك الاختبار الافتراضي:
- **Vitest**

قواعد مهمة:
- لو Vitest موجود في الهدف: استخدمه.
- لو مش موجود: اقترح باتش مستقل يضيفه (devDependency) ويتعرض للموافقة.
- `generate_baseline` ينشئ fixtures في:
  - `.refactor-harness/fixtures/baseline/*.json`
- `verify` يشغل:
  - `vitest -c .refactor-harness/vitest.config.ts`

## 8) Workflow تشغيل (Developer / Agent)

### أوامر أساسية على مستوى المونوريبو
- `pnpm -r build`
- `pnpm -r typecheck`
- `pnpm -r lint`

### تشغيل الـ Engine (CLI)
من الجذر:
- `pnpm engine:scan`
- `pnpm engine:plan`
- `pnpm engine:apply`
- `pnpm engine:verify`

### تشغيل تطبيق الديسكتوب
- `pnpm dev` (يشغل `apps/desktop`)

## 9) قواعد كتابة الباتشات (Patch Author Rules)

أي تعديل كود لازم يمشي بالقواعد دي:

- **مافيش تنفيذ قبل موافقة**
  - لو الـ UI/flow بيتطلب موافقة: stop.

- **باتش صغير ومحدد الهدف**
  - ما تلمّسش ملفات unrelated.
  - ما تعملش “تنسيق مشروع كامل”.

- **Pre-checks لكل خطوة** (اختار حسب نوع الخطوة)
  - `pnpm -r typecheck`
  - `pnpm -r lint`
  - depcruise check (لو موجود سكريبت)

- **Post-checks لكل خطوة**
  - نفس الـ pre-checks
  - + Harness verify لو `requiresHarness=true`

- **لو أي خطوة هتكسر Boundaries**
  - وقف وارجع للـ Planner: لازم تعديل الخطة أو تعديل الحدود بشكل صريح (مش implicit).

## 10) معايير قبول (Acceptance) لأي Feature/Fix

- الكود يبني بدون errors.
- `typecheck` ينجح.
- `lint` ينجح.
- مافيش cycles جديدة.
- لو التغيير high risk: Harness baseline + verify ناجحين.
- تقرير (report) يوضح:
  - الأدلة
  - المخاطر
  - ليه الإجراء آمن
  - وخطة rollback

## 11) إرشادات خاصة بـ LLM Providers

- مفاتيح الـ API ممنوع تتكتب في الكود.
- استخدم `.env` / `.env.example` (زي الموجود في `packages/llm/.env.example`).
- router يقسم الأدوار:
  - planning/judging
  - coding/patch-author
  - summarize/report

## 12) لما تكون النية مش واضحة

لو الطلب فيه ضمير أو مرجع مبهم (زي: “عدّل ده” / “صلّحها”):
- لازم تسأل: المقصود أنهي ملف/جزء؟ والسلوك الحالي إيه والمتوقع إيه؟

---

## TL;DR (للوكيل)

- ما تنفّذش تعديل غير لما يبقى فيه Evidence Packet.
- ما تبدأش apply غير بعد Approval.
- التزم بحدود الحزم (analysis ≠ refactor).
- حافظ على Boundaries ومنع cycles.
- خليك في باتشات صغيرة + تحقق بعد كل باتش.
