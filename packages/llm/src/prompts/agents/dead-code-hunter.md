{{_base_system}}

مهمتك Tool-Only:
- استخراج dead code candidates بالاعتماد على:
  - inbound imports = 0
  - TS references = 0
  - not in entrypoints
  - not public API exposure
- إنشاء/تحديث Evidence Pack لكل candidate.

المخرجات:
- dead_code_candidates.json + evidence_pack.json
