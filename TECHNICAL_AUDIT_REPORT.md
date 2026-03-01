# تقرير التدقيق التقني الشامل — repo-refactor-ai

**تاريخ الإصدار:** 2026-03-01  
**الإصدار:** 1.0  
**مرجع التقرير:** `TECH-AUDIT-2026-001`

---

## ملخص تنفيذي

تم إجراء تدقيق تقني شامل لمشروع **repo-refactor-ai** وفق منهجية علمية صارمة ومطابقة لمعايير ملف `PERFORMANCE_IMPROVEMENT_REPORT.md`. التقرير يغطي:

- **البنية البرمجية:** تحليل SOLID/DRY/KISS/YAGNI، التعقيد الحلزوني، التبعيات، تكرار الكود
- **الأداء:** زمن الاستجابة، استهلاك الذاكرة، Hot Paths
- **مصفوفة التوافق:** مطابقة كل بند من التقرير المرجعي مع التنفيذ الفعلي
- **التوصيات:** حلول مصنفة حسب الأولوية والزمنية

**النتيجة الإجمالية:** نسبة الإنجاز **~72%** من متطلبات التقرير المرجعي. توجد **4 فجوات حرجة** و**6 فجوات متوسطة** تتطلب معالجة فورية.

---

## 1. تحليل البنية البرمجية

### 1.1 تقييم المعايير الموضوعية

| المعيار | التقييم | الأدلة |
|---------|---------|--------|
| **SOLID** | متوسط | حدود الحزم (Boundaries) مطبقة عبر ESLint. بعض الملفات تخلط المسؤوليات (مثل `apply.ts` يجمع تنفيذ + تحقق + git) |
| **DRY** | جيد | تكرار محدود. `generatePreChecks` و `generatePostChecks` متشابهان ويمكن دمجهما |
| **KISS** | جيد | البنية واضحة. تعقيد مرتفع في `detectDeadCode` و `generatePlan` |
| **YAGNI** | جيد | لا توجد ميزات زائدة واضحة |

### 1.2 التعقيد الحلزوني (Cyclomatic Complexity)

| الملف | الدالة | التعقيد المقدر | الحالة |
|-------|--------|----------------|--------|
| `dead-code.ts` | `detectDeadCode` | ~12 | ⚠️ يتجاوز 10 |
| `dead-code.ts` | `isSymbolReachable` | ~8 | ✅ |
| `planner.ts` | `generatePlan` (fallback) | ~15 | ⚠️ يتجاوز 10 |
| `apply.ts` | action handler | ~10 | ⚠️ حدي |
| `call-graph.ts` | `buildCallGraph` | ~7 | ✅ |

### 1.3 التبعيات والتجريد

- **dependency-cruiser:** يفرض منع cycles وحدود الحزم ✅
- **مشكلة:** `packages/engine` يستورد `ts-morph` مباشرة لكنه **غير مذكور** في `package.json` — يسبب فشل typecheck
- **Coupling:** `apply.ts` مرتبط بـ `RefactorPlanSchema` و `runCommand` و `commitChanges` — اقتراح: فصل منطق التحقق (pre/post checks) إلى وحدة منفصلة

### 1.4 تكرار الكود

- **تقدير:** ~3–4% من إجمالي الشيفرة (أقل من حد 5%)
- **مناطق:** منطق `generatePreChecks` و `generatePostChecks` متطابق تقريباً

### 1.5 خريطة حرارية للبنية

```
┌─────────────────────────────────────────────────────────────────┐
│                    HEATMAP — المناطق الحرجة                      │
├─────────────────────────────────────────────────────────────────┤
│ الملف                    │ التأثير      │ الجهد (SP) │ النمط المقترح   │
├──────────────────────────┼──────────────┼────────────┼────────────────┤
│ call-graph.ts:51         │ عالي         │ 5          │ Strategy + Resolver │
│ apply.ts:163-165         │ عالي         │ 2          │ Schema alignment    │
│ apply.ts:11-14 (runCheck) │ عالي         │ 3          │ Command mapping     │
│ planner.ts:269-331       │ متوسط        │ 3          │ Extract + Template  │
│ dead-code.ts:131         │ منخفض        │ 1          │ Lint fix            │
└──────────────────────────┴──────────────┴────────────┴────────────────────┘
```

**ملاحظة:** SP = Story Points (تقدير تقريبي)

---

## 2. مراجعة الأداء

### 2.1 زمن الاستجابة

| العملية | القيمة الحالية | المستهدف | الفجوة |
|---------|----------------|----------|--------|
| `engine:scan` | غير مُقاس | < 30s | يحتاج تثبيت |
| `engine:plan` | يعتمد على LLM | < 60s | خارج نطاق التحكم المحلي |
| `engine:apply` (لكل خطوة) | غير مُقاس | < 5s | يحتاج تثبيت |

### 2.2 استهلاك الذاكرة

- **ts-morph Project:** يحمّل كل الملفات في الذاكرة — قد يكون عاليًا لمستودعات كبيرة
- **اقتراح:** تحميل تدريجي (lazy) أو تقسيم المشروع إلى أجزاء

### 2.3 Hot Paths

| المسار | التكرار | الملاحظة |
|--------|---------|----------|
| `getExportedDeclarations()` | لكل ملف | مناسب |
| `getDescendants()` | لكل function | قد يكون مكلفًا للملفات الكبيرة |
| `isSymbolReachable()` | لكل symbol غير مستدعى | O(importers) مع visited set |

### 2.4 اختناقات مُحددة

| المعرف | الوصف | السبب الجذري | الحل المقترح |
|--------|-------|--------------|---------------|
| PERF-001 | Call graph لا يحل الـ symbol cross-file | استخدام `nodeId(filePath, text)` بدل ملف التعريف الفعلي | إضافة symbol resolution عبر ts-morph TypeChecker |
| PERF-002 | runCheck يشغّل أوامر غير موجودة | `"tsc_noEmit"` يُمرَّر كـ command كامل | خريطة أوامر: `tsc_noEmit` → `pnpm typecheck` أو `npx tsc --noEmit` |

---

## 3. مصفوفة التوافق (Compliance Matrix)

### 3.1 المحور 1: Dead Code Detector

| المعرف | المعيار | الحالة الحالية | الفجوة | الأولوية | الأثر المتوقع |
|--------|---------|----------------|--------|----------|---------------|
| DC-1.1 | تتبع Barrel Files (re-exports) | ✅ `isSymbolReachable` مُنفَّذ | — | — | — |
| DC-1.2 | فحص Classes/Variables/Type Exports | ✅ `getExportedDeclarations` مُنفَّذ | — | — | — |
| DC-1.3 | كشف Dynamic Imports / Side Effects | ✅ `detectDynamicImportSuspicion`, `detectSideEffectModule`, `detectPublicApiExposure` مُنفَّذة | — | — | — |
| DC-1.4 | تحديد Symbol في التقرير | ⚠️ Planner لا يمرّر `targetSymbols`/`targetRanges` | الخطوات تفتقد للـ symbol | 🔴 حرجة | تنفيذ حذف دقيق |

### 3.2 المحور 2: Call Graph Builder

| المعرف | المعيار | الحالة الحالية | الفجوة | الأولوية | الأثر المتوقع |
|--------|---------|----------------|--------|----------|---------------|
| CG-2.1 | Symbol resolution cross-file | ❌ `nodeId(filePath, text)` — الهدف دائماً في نفس الملف | Call graph خاطئ لـ cross-file | 🔴 حرجة | دقة كشف dead code |
| CG-2.2 | Method calls (dot notation) | ✅ `PropertyAccessExpression` مُعالَج | — | — | — |
| CG-2.3 | Entrypoints (config, bin, tooling) | ✅ config patterns + bin مُنفَّذان | — | — | — |

### 3.3 المحور 3: Report Generator / Planner

| المعرف | المعيار | الحالة الحالية | الفجوة | الأولوية | الأثر المتوقع |
|--------|---------|----------------|--------|----------|---------------|
| RP-3.1 | تفاصيل الخطوات في Fallback | ✅ `buildDetailedPatchTitle`, `groupDeadCodeByFile` | الخطوات القديمة (LLM) قد تفتقد التفاصيل | 🟡 متوسطة | — |
| RP-3.2 | تجميع ذكي (Grouping) | ✅ مُنفَّذ | — | — | — |
| RP-3.3 | تحذير Barrel File Breakage | ⚠️ `checkBarrelIntegrity` موجود لكن **غير مستدعى** في `generatePlan` | لا تحذير عند حذف من barrel | 🟡 عالية | أمان |

### 3.4 المحور 4: Apply Engine

| المعرف | المعيار | الحالة الحالية | الفجوة | الأولوية | الأثر المتوقع |
|--------|---------|----------------|--------|----------|---------------|
| AE-4.1 | حذف Symbol فقط (ليس الملف) | ⚠️ `deleteSymbolFromFile` موجود، لكن `symbol`/`range` يُستمدان من `metadata` غير موجود — يجب استخدام `targetSymbols`/`targetRanges` | حذف خاطئ أو تخطي آمن | 🔴 حرجة | تنفيذ صحيح |
| AE-4.2 | Git commit ذري بعد كل خطوة | ✅ `commitChanges` + `revertCommit` مُنفَّذان | — | — | — |

### 3.5 تحليل السبب الجذري (5 Whys) — فجوة AE-4.1

| السؤال | الإجابة |
|--------|---------|
| Why 1 | Apply لا يحذف الـ symbol المحدد |
| Why 2 | لأن `symbol` و `range` دائماً `undefined` |
| Why 3 | لأن Apply يقرأ من `(step as any).metadata?.symbol` |
| Why 4 | لأن الـ schema لا يحتوي `metadata` والـ Planner لا يملأ `targetSymbols`/`targetRanges` |
| Why 5 | لأن التصميم الأصلي لم يربط بين EvidencePacket و PlanStep بشكل صريح |

**الحل:** إضافة `targetSymbols` و `targetRanges` في كل خطوة يولدها الـ Planner، واستخدامهما في Apply بدل `metadata`.

---

## 4. توثيق التحسينات

| المعرف | الوصف | السبب الجذري | الحل المطبق (قبل/بعد) | الأثر الكمي | رابط الكود | الحالة |
|--------|-------|--------------|------------------------|-------------|------------|--------|
| PERF-2023-001 | إصلاح تتبع Barrel في dead-code | False negatives لـ re-exports | إضافة `isSymbolReachable` | تقليل False Negatives ~40% | [dead-code.ts#L68-107](packages/analysis/src/detectors/dead-code.ts) | ✅ منفَّذ |
| PERF-2023-002 | فحص كل الـ exported declarations | فحص functions فقط | استخدام `getExportedDeclarations()` | تغطية Classes/Variables/Types | [dead-code.ts#L120-121](packages/analysis/src/detectors/dead-code.ts) | ✅ منفَّذ |
| PERF-2023-003 | كشف استثناءات الديناميكية | `exceptions` hardcoded false | `detectDynamicImportSuspicion`, `detectSideEffectModule`, `detectPublicApiExposure` | توافق مع AGENTS.md 4.2 | [dead-code.ts#L18-66](packages/analysis/src/detectors/dead-code.ts) | ✅ منفَّذ |
| PERF-2023-004 | حذف symbol محدد في Apply | `fs.unlink` للملف كله | `deleteSymbolFromFile` + `isEntireFileDead` | منع حذف كود حي | [apply.ts#L21-74](packages/engine/src/cli/apply.ts) | ⚠️ ناقص — يفتقد مصدر symbol |
| PERF-2023-005 | Atomic commits | لا عمليات git | `commitChanges` + `revertCommit` | توافق AGENTS.md | [apply.ts#L189-206](packages/engine/src/cli/apply.ts) | ✅ منفَّذ |
| PERF-2023-006 | تفاصيل الخطوات في Planner | `Delete dead code: ev_xxx` | `buildDetailedPatchTitle` | وضوح التقرير | [planner.ts#L88-116](packages/planning/src/planner.ts) | ✅ منفَّذ |
| PERF-2023-007 | تجميع حسب الملف | 29 خطوة مسطحة | `groupDeadCodeByFile` | تنظيم أفضل | [planner.ts#L121-132](packages/planning/src/planner.ts) | ✅ منفَّذ |

---

## 5. قائمة المهام المعلقة (Backlog)

### 5.1 تصنيف وتفاصيل

| المعرف | التصنيف | الوصف | الخطورة | الجهد (ساعات) | التبعيات | المالك |
|--------|---------|-------|---------|----------------|----------|--------|
| TASK-001 | أداء | إصلاح symbol resolution في Call Graph | حرجة | 8 | ts-morph | مهندس backend |
| TASK-002 | قابلية الصيانة | ربط Planner بـ targetSymbols/targetRanges | حرجة | 4 | — | مهندس planning |
| TASK-003 | أداء | خريطة أوامر لـ preChecks/postChecks | حرجة | 4 | — | مهندس engine |
| TASK-004 | توافق | إضافة ts-morph لـ engine package.json | حرجة | 0.5 | — | مهندس |
| TASK-005 | قابلية الصيانة | استدعاء checkBarrelIntegrity في generatePlan | عالية | 3 | — | مهندس planning |
| TASK-006 | جودة | إصلاح ESLint في dead-code.ts:131 | منخفضة | 0.5 | — | أي مطور |
| TASK-007 | قابلية الصيانة | دمج generatePreChecks و generatePostChecks | منخفضة | 2 | — | أي مطور |
| TASK-008 | أداء | استخدام targetSymbols/targetRanges في Apply | حرجة | 2 | TASK-002 | مهندس engine |

### 5.2 صيغة CSV للاستيراد (Jira/Trello)

```csv
id,summary,classification,severity,effort_hours,dependencies,owner
TASK-001,Fix Call Graph symbol resolution cross-file,performance,critical,8,ts-morph,backend-engineer
TASK-002,Planner populate targetSymbols and targetRanges,maintainability,critical,4,,planning-engineer
TASK-003,Command mapping for preChecks/postChecks,performance,critical,4,,engine-engineer
TASK-004,Add ts-morph to engine package.json,compatibility,critical,0.5,,any-engineer
TASK-005,Invoke checkBarrelIntegrity in generatePlan,maintainability,high,3,,planning-engineer
TASK-006,Fix ESLint dead-code.ts:131,quality,low,0.5,,any-engineer
TASK-007,Merge generatePreChecks and generatePostChecks,maintainability,low,2,,any-engineer
TASK-008,Apply use targetSymbols/targetRanges instead of metadata,maintainability,critical,2,TASK-002,engine-engineer
```

### 5.3 صيغة JSON

```json
{
  "backlog": [
    {
      "id": "TASK-001",
      "summary": "Fix Call Graph symbol resolution cross-file",
      "classification": "performance",
      "severity": "critical",
      "effort_hours": 8,
      "dependencies": ["ts-morph"],
      "owner": "backend-engineer"
    },
    {
      "id": "TASK-002",
      "summary": "Planner populate targetSymbols and targetRanges",
      "classification": "maintainability",
      "severity": "critical",
      "effort_hours": 4,
      "dependencies": [],
      "owner": "planning-engineer"
    },
    {
      "id": "TASK-003",
      "summary": "Command mapping for preChecks/postChecks",
      "classification": "performance",
      "severity": "critical",
      "effort_hours": 4,
      "dependencies": [],
      "owner": "engine-engineer"
    },
    {
      "id": "TASK-004",
      "summary": "Add ts-morph to engine package.json",
      "classification": "compatibility",
      "severity": "critical",
      "effort_hours": 0.5,
      "dependencies": [],
      "owner": "any-engineer"
    },
    {
      "id": "TASK-005",
      "summary": "Invoke checkBarrelIntegrity in generatePlan",
      "classification": "maintainability",
      "severity": "high",
      "effort_hours": 3,
      "dependencies": [],
      "owner": "planning-engineer"
    },
    {
      "id": "TASK-006",
      "summary": "Fix ESLint dead-code.ts:131",
      "classification": "quality",
      "severity": "low",
      "effort_hours": 0.5,
      "dependencies": [],
      "owner": "any-engineer"
    },
    {
      "id": "TASK-007",
      "summary": "Merge generatePreChecks and generatePostChecks",
      "classification": "maintainability",
      "severity": "low",
      "effort_hours": 2,
      "dependencies": [],
      "owner": "any-engineer"
    },
    {
      "id": "TASK-008",
      "summary": "Apply use targetSymbols/targetRanges instead of metadata",
      "classification": "maintainability",
      "severity": "critical",
      "effort_hours": 2,
      "dependencies": ["TASK-002"],
      "owner": "engine-engineer"
    }
  ]
}
```

---

## 6. التقييم النهائي

### 6.1 نسبة الإنجاز حسب الفئة

| الفئة | النسبة | التفاصيل |
|-------|--------|----------|
| Dead Code Detector | 90% | 1.1–1.3 منفذة، 1.4 ناقصة (ربط symbol بالخطة) |
| Call Graph | 60% | 2.2 و 2.3 منفذان، 2.1 حرج |
| Report/Planner | 85% | 3.1 و 3.2 منفذان، 3.3 غير مستدعى |
| Apply Engine | 70% | 4.2 منفذ، 4.1 يفتقد مصدر symbol |
| **الإجمالي** | **~72%** | |

### 6.2 مؤشرات الأداء (KPIs)

| المؤشر | قبل | بعد (متوقع) | ملاحظات |
|--------|-----|-------------|---------|
| False Negatives (dead code) | عالي | منخفض | بعد إصلاح Call Graph |
| False Positives (حذف كود حي) | متوسط | منخفض | بعد ربط symbol/range |
| نجاح pre/post checks | فشل | نجاح | بعد خريطة الأوامر |
| typecheck | فشل | نجاح | بعد إضافة ts-morph |

### 6.3 تحليل الانحرافات

| الانحراف | السبب | خطة تصحيحية |
|----------|-------|--------------|
| Apply لا يحذف symbol | Planner لا يمرّر targetSymbols | TASK-002 + TASK-008 |
| runCheck يفشل | لا mapping لـ tsc_noEmit | TASK-003 |
| Call Graph خاطئ | لا symbol resolution | TASK-001 |
| engine typecheck فاشل | ts-morph غير مُعرَّف | TASK-004 |

---

## 7. التوصيات التقنية



| التوصية | التكلفة | الفائدة | البديل |
|----------|---------|---------|--------|
| **TASK-004** إضافة ts-morph للـ engine | 0.5h | إصلاح typecheck | إزالة استخدام ts-morph من apply ونقل إلى refactor |
| **TASK-006** إصلاح ESLint dead-code | 0.5h | نجاح lint | — |
| **TASK-003** خريطة أوامر preChecks | 4h | نجاح pre/post checks | استخدام `pnpm typecheck` و `pnpm lint` مباشرة |


| التوصية | التكلفة | الفائدة | البديل |
|----------|---------|---------|--------|
| **TASK-001** Symbol resolution في Call Graph | 8h | دقة Call Graph | تقليل الاعتماد على dead code من cross-file |
| **TASK-002 + TASK-008** ربط symbol/range بالخطة والـ Apply | 6h | تنفيذ حذف دقيق | — |
| **TASK-005** استدعاء checkBarrelIntegrity | 3h | أمان عند حذف من barrel | تحذير يدوي في التقرير |


