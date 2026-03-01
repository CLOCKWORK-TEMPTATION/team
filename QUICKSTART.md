# دليل تشغيل Repo Refactor AI

## المتطلبات الأساسية

1. **Node.js**: الإصدار 20 أو أحدث
2. **pnpm**: مثبت عالمياً (`npm install -g pnpm`)
3. **مفاتيح API** للـ LLM Providers (أحدها على الأقل)

---

## الخطوة 1: إعداد مفاتيح API

انسخ ملف `.env.example` (إن وجد) أو أنشئ ملف `.env` في جذر المشروع:

```bash
# اختر أحد المزودين (أو كلهم للـ fallback)

# OpenAI (مُفضّل للـ CODING و PLANNING)
OPENAI_API_KEY=sk-your-openai-key-here

# Anthropic (Claude - مُفضّل للـ PLANNING)
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# Google (Gemini)
GOOGLE_API_KEY=your-google-key-here

# Mistral
MISTRAL_API_KEY=your-mistral-key-here

# OpenAI Compatible (للـ custom endpoints مثل Ollama)
OPENAI_COMPAT_BASE_URL=http://localhost:11434/v1
OPENAI_COMPAT_API_KEY=ollama
```

**ملاحظة**: التطبيق يعمل بنظام fallback - إذا فشل مزود، ينتقل للمزود التالي تلقائياً.

---

## الخطوة 2: تثبيت الاعتماديات

```bash
pnpm install
```

---

## الخطوة 3: بناء المشروع

```bash
pnpm build
```

أو لبناء حزمة محددة:
```bash
pnpm --filter @pkg/engine build
pnpm --filter @app/desktop build
```

---

## الخطوة 4: التشغيل

### أ) وضع التطوير (Electron Desktop App)

```bash
pnpm dev
```

يفتح نافذة Electron مع:
- UI للاختيار والتحكم
- مسار Artifacts تلقائي: `./artifacts`

### ب) وضع CLI (للاختبار السريع)

**Scan**: تحليل الريبو
```bash
pnpm engine:scan ./fixtures/dummy-project
```

**Plan**: توليد خطة التعديل
```bash
# استبدل <runId> بالقيمة من خطوة scan
pnpm engine:plan <runId>
```

**Apply**: تطبيق التعديلات (تحتاج موافقة)
```bash
pnpm engine:apply <runId>
```

---

## الخطوة 5: الموافقة والتنفيذ

### عبر CLI التفاعلي:
```bash
pnpm -C packages/engine cli:plan <runId> --interactive
```

### عبر Electron UI:
1. شغّل `pnpm dev`
2. اختر مجلد الريبو المستهدف
3. اضغط Scan
4. اضغط Plan
5. راجع التقرير
6. اضغط **Approve**
7. اضغط **Apply**

---

## أماكن حفظ البيانات

| البيئة | مسار Artifacts | قاعدة البيانات |
|--------|---------------|---------------|
| Dev | `./artifacts/` | `./artifacts/db/main.sqlite` |
| Electron Prod | `~/.repo-refactor-ai/artifacts/` | `~/.repo-refactor-ai/artifacts/db/main.sqlite` |

---

## استكشاف الأخطاء

### 1. التحقق من مفاتيح API
```bash
# اختبار OpenAI
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# اختبار Anthropic
curl https://api.anthropic.com/v1/models \
  -H "x-api-key: $ANTHROPIC_API_KEY"
```

### 2. التحقق من البنية
```bash
pnpm -r typecheck  # فحص TypeScript
pnpm -r lint       # فحص ESLint
```

### 3. مشاكل better-sqlite3
```bash
pnpm approve-builds  # للموافقة على build scripts
```

### 4. إعادة بناء نظيفة
```bash
pnpm -r clean  # إن وجد
rm -rf artifacts/  # حذف البيانات القديمة
pnpm build
```

---

## اختبار سريع

لاختبار التطبيق بسرعة على `dummy-project`:

```bash
# 1. Scan
node packages/engine/dist/cli/index.js scan ./fixtures/dummy-project

# 2. Plan (تفاعلي مع موافقة)
node packages/engine/dist/cli/index.js plan <runId> --interactive

# 3. Apply (بعد الموافقة)
node packages/engine/dist/cli/index.js apply <runId>
```

**ملاحظة**: استبدل `<runId>` بالقيمة المطبوعة في خطوة Scan (مثال: `run_abc123`)

---

## دعم

- `config/models.json`: تعديل إعدادات النماذج
- `packages/engine/artifacts/`: محذوف - لا تستخدم
- `fixtures/dummy-project/`: للاختبار المحلي
