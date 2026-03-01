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

cd apps/desktop
pnpm dev:vite


cd apps/desktop
pnpm dev:electron

أو لبناء حزمة محددة:
```bash
pnpm --filter @pkg/engine build
pnpm --filter @app/desktop build
```
🔍 جاري تحليل المستودع: E:\mo7rer...
[٢:٤٤:٣٨ ص] ❌ فشل Scan: Command failed with exit code 1: node "E:\team\packages\engine\dist\cli\index.js" scan "E:\mo7rer" node:internal/modules/cjs/loader:1661\r return process.dlopen(module, path.toNamespacedPath(filename));\r ^\r \r Error: The module '\\?\E:\team\node_modules\.pnpm\better-sqlite3@11.10.0\node_modules\better-sqlite3\build\Release\better_sqlite3.node'\r was compiled against a different Node.js version using\r NODE_MODULE_VERSION 133. This version of Node.js requires\r NODE_MODULE_VERSION 115. Please try re-compiling or re-installing\r the module (for instance, using `npm rebuild` or `npm install`).\r at Module._extensions..node (node:internal/modules/cjs/loader:1661:18)\r at Module.load (node:internal/modules/cjs/loader:1266:32)\r at Module._load (node:internal/modules/cjs/loader:1091:12)\r at Module.require (node:internal/modules/cjs/loader:1289:19)\r at require (node:internal/modules/helpers:182:18)\r at bindings (E:\team\node_modules\.pnpm\bindings@1.5.0\node_modules\bindings\bindings.js:112:48)\r at new Database (E:\team\node_modules\.pnpm\better-sqlite3@11.10.0\node_modules\better-sqlite3\lib\database.js:48:64)\r at getDbClient (file:///E:/team/packages/storage/dist/db/client.js:14:16)\r at Command.<anonymous> (file:///E:/team/packages/engine/dist/cli/scan.js:18:16)\r at Command.listener [as _actionHandler] (E:\team\node_modules\.pnpm\commander@12.1.0\node_modules\commander\lib\command.js:542:17) {\r code: 'ERR_DLOPEN_FAILED'\r }\r \r Node.js v20.19.5 [02:44:38.196] INFO (82960): Starting repository scan runId: "run_16e522e1915988ce" repoPath: "E:\mo7rer"
v0.1.0 | Built with Electr
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
