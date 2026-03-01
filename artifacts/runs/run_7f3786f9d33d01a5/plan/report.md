# تقرير تحليل المستودع

## ملخص تنفيذي

تم تحليل المستودع باستخدام ثلاث بوابات تحقق (call graph, import graph, TS references) وأدوات خارجية (jscpd, knip, depcruise).
كُشف **198** عنصر dead code، **0** نسخة مكررة، و**0** انتهاك حدود.

## توزيع المخاطر

| المستوى | العدد |
|---------|-------|
| Low | 195 |
| Medium | 0 |
| High | 3 |
| Critical | 0 |

## خطة التنفيذ

تتضمن **72** خطوة مرتبة من الأقل خطورة.

1. [low] Delete dead code in fonts.ts — 2 symbols (FontOption, TextSizeOption)
2. [low] Delete dead code in formats.ts — 2 symbols (ScreenplayFormatId, ScreenplayFormat)
3. [low] Delete dead code in insert-menu.ts — 2 symbols (InsertBehavior, InsertMenuItemDefinition)
4. [low] Delete dead function: page.ts `PPI` (L11-L11) — No callers in call graph
5. [low] Delete dead code in arabic-patterns.ts — 14 symbols (BASE_ACTION_VERBS, DIALECT_PATTERNS, NEGATION_PATTERNS...)
6. [low] Delete dead function: Arabic-Screenplay-Classifier-Agent.ts `ProcessFileResult` (L37-L40) — No callers in call graph
7. [low] Delete dead function: character.ts `ParsedInlineCharacterDialogue` (L27-L31) — No callers in call graph
8. [low] Delete dead function: classification-core.ts `ReviewerConfig` (L35-L41) — No callers in call graph
9. [low] Delete dead code in classification-decision.ts — 2 symbols (ResolvedNarrativeType, NarrativeDecision)
10. [low] Delete dead function: classification-sequence-rules.ts `ClassificationSequenceSuggestionFeatures` (L88-L95) — No callers in call graph
11. [low] Delete dead function: classification-types.ts `LegacyElementType` (L44-L52) — No callers in call graph
12. [low] Delete dead code in context-memory-manager.ts — 6 symbols (DialogueBlock, LineRelation, ClassificationRecord...)
13. [low] Delete dead function: hybrid-classifier.ts `HybridResult` (L40-L44) — No callers in call graph
14. [low] Delete dead code in paste-classifier.ts — 4 symbols (PasteClassifierOptions, ApplyPasteClassifierFlowOptions, ClassifyLinesContext...)
15. [low] Delete dead function: scene-header-top-line.ts `SceneHeaderTopLineParts` (L26-L29) — No callers in call graph
16. [low] Delete dead code in text-utils.ts — 3 symbols (INVISIBLE_CHARS_RE, STARTS_WITH_BULLET_RE, LEADING_BULLETS_RE)
17. [low] Delete dead code in use-history.ts — 2 symbols (HistoryController, useHistory)
18. [low] Delete dead function: use-toast.ts `useToast` (L138-L143) — No callers in call graph
19. [low] Delete dead code in types.ts — 6 symbols (OcrPageResult, OcrResult, NormalizationOptions...)
20. [low] Delete dead code in command-engine.ts — 8 symbols (ImportOperationState, CommandApplyTelemetry, DiscardReason...)

... و 52 خطوة إضافية

## التوصيات

1. ابدأ بعناصر Low risk — الأكثر أماناً.
2. عناصر High risk تحتاج مراجعة يدوية.
3. أصلح انتهاكات الحدود قبل الدمج.

## التراجع

كل خطوة = commit مستقل. `git revert <hash>` للتراجع.