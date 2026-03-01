import { type Findings, type RefactorPlan } from "@pkg/schemas";
import { invokeAgent } from "./router.js";
import * as path from "path";

function createReportPrompt(plan: RefactorPlan, findings: Findings): string {
  const deadByRisk = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const dc of findings.deadCode) {
    const band = dc.evidence.risk?.band ?? "low";
    if (band in deadByRisk) deadByRisk[band as keyof typeof deadByRisk]++;
  }

  const fileGroups = new Map<string, number>();
  for (const dc of findings.deadCode) {
    const f = path.basename(dc.evidence.target.file);
    fileGroups.set(f, (fileGroups.get(f) ?? 0) + 1);
  }
  const topFiles = [...fileGroups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  const llmRationales = findings.deadCode
    .filter(dc => dc.llmRationale)
    .slice(0, 15)
    .map(dc => `- ${dc.evidence.target.symbol ?? path.basename(dc.evidence.target.file)}: ${dc.llmRationale}`);

  const violationSample = findings.boundaryViolations
    .slice(0, 8)
    .map(v => `- ${v.fromFile} -> ${v.toFile}: ${v.rule}`);

  const stepsByRisk = { low: 0, medium: 0, high: 0, critical: 0, blocked: 0 };
  for (const s of plan.steps) {
    if (s.riskBand in stepsByRisk) stepsByRisk[s.riskBand as keyof typeof stepsByRisk]++;
  }

  return `أنت كاتب تقارير تقنية محترف. أنشئ تقريراً شاملاً بالعربية بتنسيق Markdown عن نتائج تحليل المستودع.

## بيانات التحليل:

### ملخص:
- إجمالي dead code: ${findings.deadCode.length}
- توزيع المخاطر: low=${deadByRisk.low}, medium=${deadByRisk.medium}, high=${deadByRisk.high}, critical=${deadByRisk.critical}
- Text clones (jscpd): ${findings.textClones.length}
- Boundary violations: ${findings.boundaryViolations.length}
- Duplicate functions: ${findings.duplicateFunctions.length}
- Merge candidates: ${findings.mergeCandidates.length}

### أكثر الملفات تأثراً:
${topFiles.map(([f, c]) => `- ${f}: ${c} عنصر`).join("\n")}

### خطة التنفيذ (${plan.steps.length} خطوة):
- Low: ${stepsByRisk.low}, Medium: ${stepsByRisk.medium}, High: ${stepsByRisk.high}, Critical: ${stepsByRisk.critical}

### عينة تفسيرات النموذج اللغوي:
${llmRationales.length > 0 ? llmRationales.join("\n") : "لا توجد تفسيرات"}

${violationSample.length > 0 ? "### عينة انتهاكات الحدود:\n" + violationSample.join("\n") : ""}

${findings.notes ? "### ملاحظات:\n" + findings.notes.join("\n") : ""}

## المطلوب:
اكتب تقريراً مهنياً يتضمن:
1. **ملخص تنفيذي** (3-4 أسطر)
2. **نتائج التحليل** — ما وُجد مع سياق
3. **تقييم المخاطر** — ما يحتاج حذر
4. **التوصيات** — مرتبة بالأولوية
5. **خطة التراجع**

اكتب بالعربية. Markdown فقط.`;
}

function buildFallbackReport(plan: RefactorPlan, findings: Findings): string {
  const deadByRisk = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const dc of findings.deadCode) {
    const band = dc.evidence.risk?.band ?? "low";
    if (band in deadByRisk) deadByRisk[band as keyof typeof deadByRisk]++;
  }

  return [
    "# تقرير تحليل المستودع",
    "",
    "## ملخص تنفيذي",
    "",
    `تم تحليل المستودع باستخدام ثلاث بوابات تحقق (call graph, import graph, TS references) وأدوات خارجية (jscpd, knip, depcruise).`,
    `كُشف **${findings.deadCode.length}** عنصر dead code، **${findings.textClones.length}** نسخة مكررة، و**${findings.boundaryViolations.length}** انتهاك حدود.`,
    "",
    "## توزيع المخاطر",
    "",
    "| المستوى | العدد |",
    "|---------|-------|",
    `| Low | ${deadByRisk.low} |`,
    `| Medium | ${deadByRisk.medium} |`,
    `| High | ${deadByRisk.high} |`,
    `| Critical | ${deadByRisk.critical} |`,
    "",
    "## خطة التنفيذ",
    "",
    `تتضمن **${plan.steps.length}** خطوة مرتبة من الأقل خطورة.`,
    "",
    ...plan.steps.slice(0, 20).map((s, i) => `${i + 1}. [${s.riskBand}] ${s.patchTitle}`),
    plan.steps.length > 20 ? `\n... و ${plan.steps.length - 20} خطوة إضافية` : "",
    "",
    "## التوصيات",
    "",
    "1. ابدأ بعناصر Low risk — الأكثر أماناً.",
    "2. عناصر High risk تحتاج مراجعة يدوية.",
    "3. أصلح انتهاكات الحدود قبل الدمج.",
    "",
    "## التراجع",
    "",
    "كل خطوة = commit مستقل. `git revert <hash>` للتراجع.",
  ].join("\n");
}

export async function generateReport(plan: RefactorPlan, findings: Findings): Promise<string> {
  try {
    const prompt = createReportPrompt(plan, findings);
    const report = await invokeAgent("RefactorPlannerReportAgent", prompt);
    return report.trim().replace(/^```markdown/i, "").replace(/```$/, "").trim();
  } catch {
    return buildFallbackReport(plan, findings);
  }
}
