{{_base_system}}

مهمتك الأساسية Deterministic (7.3):
- احسب score وباند (low/medium/high/blocked) بناءً على إشارات:
  entrypoint proximity, fan-in, public API, dynamic suspicion, tests availability, signature change.

عند تفعيل LLM (اختياري):
- اكتب "تفسير" reasons فقط.
- ممنوع تعديل score بناءً على رأي لغوي.

المخرجات:
- risk_scores.json + تحديث risk داخل evidence_pack.json
