---
name: Full Pipeline Overhaul
overview: "اصلاح جذري لخط أنابيب التحليل والتخطيط بالكامل — من الـ scan لحد الـ report. الفحص كشف أن التطبيق يعمل بكفاءة 10-15% من قدراته المصممة: detector وحيد (dead code) مكسور، 5 أنواع تحليل فارغة تماماً، LLM لا يُستدعى فعلياً، وتقارير بدون محتوى حقيقي."
todos:
  - id: fix-references
    content: "المرحلة 1.1: دمج findSymbolReferences في dead code detector لفلترة false positives"
    status: completed
  - id: fix-barrel
    content: "المرحلة 1.2: إصلاح isSymbolReachable لتتبع barrel re-exports كاملة"
    status: completed
  - id: fix-dynamic
    content: "المرحلة 1.3: إصلاح detectDynamicImportSuspicion — مطابقة مسار فعلي بدل basename"
    status: completed
  - id: fix-project-filter
    content: "المرحلة 1.4: فلترة createTsProject — استبعاد node_modules و .d.ts"
    status: completed
  - id: tooling-jscpd
    content: "المرحلة 2.1: jscpd wrapper في packages/tooling"
    status: completed
  - id: tooling-knip
    content: "المرحلة 2.2: knip wrapper في packages/tooling"
    status: completed
  - id: tooling-depcruise
    content: "المرحلة 2.3: dependency-cruiser wrapper في packages/tooling"
    status: completed
  - id: tooling-integrate
    content: "المرحلة 2.4: دمج Tooling في scan.ts وملء الحقول الفارغة"
    status: completed
  - id: llm-batch
    content: "المرحلة 3.1: Batching لـ ScanAugment بدل prompt واحد ضخم"
    status: completed
  - id: llm-plan
    content: "المرحلة 3.2: إصلاح Plan LLM — ملخص مضغوط + parsing أفضل"
    status: completed
  - id: llm-report
    content: "المرحلة 3.3: توليد report.md فعلي وحفظه في artifacts"
    status: completed
  - id: detector-duplicates
    content: "المرحلة 4.1: Duplicate Functions Detector"
    status: completed
  - id: detector-merge
    content: "المرحلة 4.2: Merge Candidates Detector"
    status: completed
  - id: todo-1772386671107-mgw19a9t6
    content: ""
    status: pending
isProject: false
---

# اصلاح جذري شامل لخط أنابيب التحليل

## الوضع الحالي: تشخيص المشاكل الجذرية

### المشكلة 1: الـ Scan يكتشف نوعاً واحداً فقط من 6

`[packages/engine/src/cli/scan.ts](packages/engine/src/cli/scan.ts)` — السطور 91-101:

```typescript
const findings = {
  deadCode: deadCodeWithLlm,
  textClones: [],        // فارغ دائماً
  semanticClones: [],     // فارغ دائماً
  duplicateFunctions: [], // فارغ دائماً
  mergeCandidates: [],    // فارغ دائماً
  boundaryViolations: [], // فارغ دائماً
};
```

5 من 6 أنواع التحليل هي **مصفوفات فارغة ثابتة**. لا يوجد كود يملأها.

`[packages/tooling/src/index.ts](packages/tooling/src/index.ts)` = `export {}` — حزمة Tooling **فارغة بالكامل**. لا knip، لا depcheck، لا jscpd، لا depcruise.

---

### المشكلة 2: Dead Code Detector مكسور — false positives كارثية

**آخر تشغيل (run_1dd826c2d8b6bed0):**

- 852 dead code candidate
- 82 منهم من ملف واحد (`components/index.ts`) — وهو barrel file يعمل re-export
- 166 من `extensions/index.ts`، 119 من `pipeline/index.ts`
- **جميع re-exports من barrel files تُصنّف dead code خطأً**

**السبب الجذري في** `[packages/analysis/src/detectors/dead-code.ts](packages/analysis/src/detectors/dead-code.ts)`:

1. **Call graph لا يتتبع barrel re-exports**: الـ detector يفحص `getCallers()` لكن re-exports لا تُسجّل كـ "calls" — فيُعتبر كل symbol بدون caller "ميت"
2. `**isSymbolReachable` قاصر**: يتتبع سلسلة الاستيراد المباشرة لكنه لا يرى أن المستهلك النهائي (مثلاً React component) يستورد من الـ barrel
3. `**detectDynamicImportSuspicion` مصنع false positives**: يبحث عن `import(` + basename في **كل ملف** — فأي ملف فيه dynamic import يُطلق الإنذار لكل symbol في أي ملف باسم مشابه. نتيجة: risk=90 لـ 80%+ من المرشحين
4. `**findSymbolReferences` موجودة لكن لا تُستخدم أبداً**: الملف `[packages/analysis/src/indexer/references.ts](packages/analysis/src/indexer/references.ts)` فيه أقوى أداة كشف (ts-morph findReferences) وهي غير مستدعاة

---

### المشكلة 3: LLM ScanAugment لا يعمل فعلياً

كل الـ 852 candidate لديهم `llmRationale: ""` (فارغ). الأسباب المحتملة:

- ارسال 852 عنصر في prompt واحد يتخطى حدود النموذج
- الـ JSON response parsing يفشل بصمت
- لا يوجد batching أو chunking

---

### المشكلة 4: Plan Generator يسقط دائماً في الـ fallback

`[packages/planning/src/planner.ts](packages/planning/src/planner.ts)` — السطر 347:

```typescript
} catch (err: unknown) {
    // Falls back to basic plan every time
```

الخطة الناتجة = 149 step كلها "delete dead code" بدون أي ذكاء. الـ LLM planner يُستدعى لكن:

- يُرسل له 852 dead code candidate (ضخم جداً)
- يُطلب منه 3 ملفات (plan + findings + report) لكن الكود يحاول يقرأ فقط steps array
- يفشل → يقع في fallback يولّد delete step لكل مجموعة ملفات

---

### المشكلة 5: لا يوجد Report حقيقي

الـ prompt يطلب report.md لكن:

- لا يوجد كود يستخرج أو يحفظ الـ report من رد الـ LLM
- لا يوجد ملف report في artifacts
- "التقرير" هو مجرد plan.json خام

---

### المشكلة 6: `createTsProject` لا يُفلتر الملفات

`[packages/analysis/src/indexer/ts-morph.ts](packages/analysis/src/indexer/ts-morph.ts)` — يحمّل من tsconfig.json بدون فلترة. قد يشمل:

- `node_modules` compilation artifacts
- `.d.ts` declaration files
- ملفات test (تُحلّل كأنها production code)

---

## خطة الإصلاح (مرتبة حسب الأولوية)

### المرحلة 1: إصلاح Dead Code Detector (الأعلى أولوية)

**الهدف**: تحويل الـ detector من مولّد false positives إلى أداة تحليل دقيقة.

**1.1 — دمج `findSymbolReferences` في الـ detector**

في `[dead-code.ts](packages/analysis/src/detectors/dead-code.ts)`، قبل اعتبار أي symbol "ميت"، يجب استدعاء `findSymbolReferences` من `[references.ts](packages/analysis/src/indexer/references.ts)`. إذا وُجدت references حقيقية → ليس dead code.

**1.2 — إصلاح تتبع Barrel Re-exports**

المشكلة: symbol يُصدّر من `utils/helper.ts` → يُعاد تصديره من `utils/index.ts` → يُستورد في `app.tsx` من `utils`. الـ detector لا يرى هذه السلسلة.

الإصلاح: تعديل `isSymbolReachable` ليتتبع سلسلة re-exports كاملة وصولاً للمستهلك النهائي، مع حساب namespace imports (`import * as Utils from './utils'`).

**1.3 — إصلاح `detectDynamicImportSuspicion`**

تضييق الفحص: بدل البحث عن basename في نص كل ملف (يولّد false positives)، يجب فحص dynamic imports الفعلية:

- `import('./path/to/actual-file')` — مطابقة المسار الكامل وليس الاسم
- `require('./path')` — نفس المبدأ

**1.4 — فلترة ملفات المشروع**

تعديل `[createTsProject](packages/analysis/src/indexer/ts-morph.ts)`:

- استبعاد `node_modules` صراحة
- استبعاد `*.d.ts`
- استبعاد `*.test.ts` و `*.spec.ts` من تحليل dead code (لكن ليس من call graph)

---

### المرحلة 2: تفعيل Tooling الحقيقي

**الهدف**: ملء حزمة `[packages/tooling](packages/tooling/src/index.ts)` بـ wrappers فعلية.

**2.1 — jscpd wrapper** (كشف text clones)

تشغيل jscpd على repo الهدف، تجميع النتائج في format يتوافق مع `textClones` في الـ schema.

**2.2 — knip wrapper** (dead exports/dependencies)

تشغيل knip وتحويل نتائجه لـ `toolHits.knip` في evidence packets — يعزز دقة dead code detection.

**2.3 — dependency-cruiser wrapper** (boundary violations)

تشغيل depcruise وتحويل violations لـ `boundaryViolations` في findings.

**2.4 — دمج Tooling في scan.ts**

تحديث `[scan.ts](packages/engine/src/cli/scan.ts)` لاستدعاء tool wrappers وملء الحقول الفارغة في findings بدل المصفوفات الثابتة.

---

### المرحلة 3: إصلاح LLM Integration

**3.1 — Batching لـ ScanAugment**

في `[scan.ts](packages/engine/src/cli/scan.ts)`: بدل ارسال 852 candidate في prompt واحد، تقسيمهم إلى batches (50-100 لكل batch)، وتجميع النتائج.

**3.2 — إصلاح Plan LLM**

في `[planner.ts](packages/planning/src/planner.ts)`:

- ارسال ملخص مضغوط لـ LLM (عدد candidates per file + أهم المخاطر) بدل كل الـ raw data
- تعديل الـ parsing ليستخرج الخطة فقط (ليس 3 ملفات)
- تحسين الـ fallback ليكون أذكى (تجميع حسب risk band، ترتيب حسب الأولوية)

**3.3 — توليد Report فعلي**

إضافة خطوة report generation:

- استدعاء LLM بملخص الخطة + الأدلة
- حفظ `report.md` في artifacts بجانب `plan.json`
- عرض الـ report في الـ desktop app

---

### المرحلة 4: Duplicate/Merge Detection (تأسيس)

**4.1 — Duplicate Functions Detector**

إنشاء `[packages/analysis/src/detectors/duplicates.ts](packages/analysis/src/detectors/duplicates.ts)`:

- مقارنة AST structure بين الدوال (structural similarity)
- كشف الدوال المتطابقة أو شبه المتطابقة

**4.2 — Merge Candidates Detector**

إنشاء `[packages/analysis/src/detectors/merge-candidates.ts](packages/analysis/src/detectors/merge-candidates.ts)`:

- تحليل coupling بين الملفات (ملفات تُستورد دائماً معاً)
- اقتراح دمج الملفات المتلازمة

---

## ترتيب التنفيذ

```
المرحلة 1 (حرج): Dead Code Detector  ← بدونه كل شيء بعده مبني على أساس خاطئ
المرحلة 2 (مهم): Tooling              ← يعزز دقة التحليل بأدوات خارجية مُثبتة
المرحلة 3 (مهم): LLM Integration      ← يحوّل البيانات الدقيقة لتقارير مفيدة
المرحلة 4 (تحسين): New Detectors      ← يوسّع نطاق التحليل
```

## ملخص الأثر المتوقع

- **قبل**: 852 false positive، 0 أنواع تحليل أخرى، report فارغ
- **بعد**: dead code حقيقي فقط (متوقع 50-100 بدل 852)، text clones + boundary violations + toolHits، report مفصّل بالعربية

