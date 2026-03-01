# تقرير استخراج الـ Prompts من المستودع

**المستودع:** repo-refactor-ai  
**تاريخ الفحص:** 2025-02-28  
**المسار:** `e:\team`

---

## ملخص تنفيذي

تم العثور على **2 prompts** مكتوبة في ملفات المشروع، وكلاهما في حزمة `packages/llm`:

| # | الاسم | الملف | الوظيفة |
|---|-------|-------|---------|
| 1 | Planner Prompt | `packages/llm/src/prompts/planner-prompt.ts` | تخطيط إعادة الهيكلة |
| 2 | Patch Author Prompt | `packages/llm/src/router.ts` | كتابة الباتشات/الكود |

---

## 1. Planner Prompt (مخطط إعادة الهيكلة)

**الملف:** `packages/llm/src/prompts/planner-prompt.ts`  
**الدالة:** `generatePlannerPrompt(findingsSummary: string)`  
**الاستخدام:** يُستدعى عبر `askPlanner()` في `packages/llm/src/router.ts`، ويُستخدم من `packages/planning/src/planner.ts` لتوليد خطة إعادة الهيكلة.

### نص الـ Prompt الكامل

```
You are a strict, expert Refactoring Planner AI.
Your task is to analyze the provided static analysis "Findings" and generate a safe, risk-scored "Refactor Plan" as a strictly formatted JSON array of steps.

CRITICAL RULES:
1. "Evidence First" - you must reference evidenceId in evidenceRefs.
2. Output ONLY raw JSON. No markdown backticks, no explanations. It should be parsed directly.
3. Your output must match this schema for the "steps" array:
[
  {
    "stepId": "step_xxx",
    "patchTitle": "A short descriptive title",
    "actions": ["delete_dead" | "unify_duplicates" | "extract_function" | "rename_symbol"],
    "targets": ["path/to/file.ts"],
    "evidenceRefs": ["ev_xxx"],
    "riskBand": "low" | "medium" | "high" | "critical",
    "requiresHarness": boolean,
    "preChecks": ["tsc_noEmit", "eslint"],
    "postChecks": ["tsc_noEmit", "eslint"],
    "rollbackStrategy": "git_revert_commit"
  }
]

Here are the Findings summary in JSON format:
${findingsSummary}

Generate the steps JSON array now:
```

### المتغيرات الديناميكية

- `${findingsSummary}`: ملخص نتائج التحليل الساكن (deadCode, duplicateFunctions, mergeCandidates) بصيغة JSON.

---

## 2. Patch Author Prompt (كاتب الباتشات)

**الملف:** `packages/llm/src/router.ts`  
**الدالة:** `askPatchAuthor(task: string)`  
**الاستخدام:** مُعرّفة في الـ router، ولا يبدو أنها مُستدعاة حاليًا من أي مكان آخر في المشروع.

### نص الـ Prompt الكامل

```
You are a patch author. Write code for this task:

${task}
```

### المتغيرات الديناميكية

- `${task}`: وصف المهمة أو المطلوب تنفيذه.

---

## البنية التقنية

### تدفق الـ Prompts

```
packages/planning/planner.ts
    └── askPlanner(findingsSummary)
            └── generatePlannerPrompt(findingsSummary)
                    └── promptOpenAI(prompt, "gpt-4o")

packages/llm/router.ts
    └── askPatchAuthor(task)
            └── promptOpenAI(prompt, "gpt-4o")
```

### مزود الـ API

- **الملف:** `packages/llm/src/providers/openai.ts`
- **الدالة:** `promptOpenAI(prompt: string, model = "gpt-4o")`
- **النموذج الافتراضي:** `gpt-4o`
- **طريقة الإرسال:** `messages: [{ role: "user", content: prompt }]` — جميع الـ prompts تُرسل كرسائل `user` فقط، ولا يوجد `system` message منفصل.

---

## ملاحظات

1. **Planner Prompt** هو الوحيد المستخدم فعليًا في الـ pipeline (من خلال `generatePlan` في `packages/planning`).
2. **Patch Author Prompt** مُعرّف في الـ router لكن لا يوجد استدعاء له في الكود الحالي.
3. جميع الـ prompts تُرسل حاليًا إلى OpenAI (`gpt-4o`) عبر `promptOpenAI`.
4. لا توجد prompts منفصلة لـ `system` أو `assistant` — كل المحتوى يُرسل كـ `user` message.

---

## الملفات ذات الصلة

| الملف | الدور |
|-------|------|
| `packages/llm/src/prompts/planner-prompt.ts` | تعريف Planner Prompt |
| `packages/llm/src/router.ts` | تعريف Patch Author Prompt + استدعاء الـ LLM |
| `packages/llm/src/providers/openai.ts` | إرسال الـ prompts إلى OpenAI |
| `packages/planning/src/planner.ts` | استدعاء `askPlanner` لتوليد الخطة |
