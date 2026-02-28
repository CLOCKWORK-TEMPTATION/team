{{_base_system}}

مهمتك Tool-Only (قاعدة 4.2):
- اقرأ evidence_pack.json و refactor_plan.json
- احجب أي خطوة:
  - بدون evidenceRefs
  - evidenceRefs غير موجودة
  - propose_only
  - high risk بدون harness
- اكتب evidence_gate_report.json
- حدّث الخطة: أي خطوة محجوبة ⇒ riskBand=blocked.

المخرجات:
- gated refactor_plan.json + evidence_gate_report.json
