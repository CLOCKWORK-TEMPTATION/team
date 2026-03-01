import React, { useState, useEffect } from "react";
import "./styles.css";

// @ts-ignore
const repoRefactor = window.repoRefactor;

export function App() {
  const [repoPath, setRepoPath] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<"idle" | "scanning" | "planning" | "approving" | "applying">("idle");
  const [scanResult, setScanResult] = useState<{ success: boolean; runId?: string; error?: string; output?: string; llmUsedInStep1?: boolean } | null>(null);
  const [planReport, setPlanReport] = useState<string | null>(null);
  const [planResult, setPlanResult] = useState<{ success: boolean; output?: string; error?: string; llmUsedInStep2?: boolean } | null>(null);
  const llmStep1Confirmed = Boolean(scanResult?.llmUsedInStep1 ?? scanResult?.output?.includes("[REPO_REFACTOR_LLM] STEP=1"));
  const llmStep2Confirmed = Boolean(planResult?.llmUsedInStep2 ?? planResult?.output?.includes("[REPO_REFACTOR_LLM] STEP=2"));

  // رسالة ترحيب عند البداية
  useEffect(() => {
    addLog("👋 مرحباً بك في Repo Refactor AI");
    addLog("📋 الخطوات: 1) اختر مستودع → 2) Scan → 3) Plan → 4) Approve → 5) Apply");
    addLog("");
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString("ar-SA");
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  // اختيار المجلد عبر الحوار
  const handleSelectRepo = async () => {
    const path = await repoRefactor.selectRepo();
    if (path) {
      setRepoPath(path);
      addLog(`📁 تم اختيار المستودع: ${path}`);
    }
  };

  // إدخال يدوي للمسار
  const handleManualPathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRepoPath(e.target.value);
  };

  const confirmManualPath = () => {
    if (repoPath.trim()) {
      addLog(`📁 المسار المُدخل: ${repoPath}`);
    }
  };

  // تشغيل Scan
  const handleScan = async () => {
    if (!repoPath.trim()) {
      addLog("❌ الرجاء إدخال مسار المستودع أولاً");
      return;
    }

    setLoading(true);
    setCurrentStep("scanning");
    addLog(`🔍 جاري تحليل المستودع: ${repoPath}...`);

    const result = await repoRefactor.scan(repoPath);
    setScanResult(result);
    setLoading(false);

    if (result.success) {
      addLog(`✅ Scan ناجح! Run ID: ${result.runId}`);
      if (result.llmUsedInStep1 ?? result.output?.includes("[REPO_REFACTOR_LLM] STEP=1")) {
        addLog("🤖 تأكيد: النموذج اللغوي شارك في الخطوة 1 (التحليل)");
      } else if (result.runId) {
        addLog("ℹ️ لم يُستدَع النموذج في الخطوة 1 (لا مرشحين dead code)");
      }
      addLog("📋 الخطوة التالية: اضغط 'Generate Plan' لتوليد خطة التعديل");
    } else {
      addLog(`❌ فشل Scan: ${result.error}`);
    }

    setCurrentStep("idle");
  };

  // تشغيل Plan
  const handlePlan = async () => {
    if (!scanResult?.runId) {
      addLog("❌ الرجاء تشغيل Scan أولاً");
      return;
    }

    setLoading(true);
    setCurrentStep("planning");
    addLog(`📝 جاري توليد خطة التعديل...`);

    const result = await repoRefactor.plan(scanResult.runId);
    setPlanResult(result);
    setLoading(false);

    if (result.success) {
      addLog(`✅ Plan تم إنشاؤه بنجاح!`);
      if (result.llmUsedInStep2 ?? result.output?.includes("[REPO_REFACTOR_LLM] STEP=2")) {
        addLog("🤖 تأكيد: النموذج اللغوي شارك في الخطوة 2 (التخطيط)");
      } else {
        addLog("ℹ️ الخطة من المسار الاحتياطي (fallback) بدون استدعاء النموذج");
      }
      addLog("📋 الخطوة التالية: راجع التقرير ثم اضغط 'Approve' للموافقة");
      // جلب وعرض التقرير
      const reportResult = await repoRefactor.getPlanReport(scanResult.runId!);
      if (reportResult.success && reportResult.report) {
        setPlanReport(reportResult.report);
      }
    } else {
      addLog(`❌ فشل Plan: ${result.error}`);
    }

    setCurrentStep("idle");
  };

  // الموافقة
  const handleApprove = async () => {
    if (!scanResult?.runId) return;

    setCurrentStep("approving");
    addLog("✅ جاري تسجيل الموافقة...");

    const result = await repoRefactor.approve(scanResult.runId, "user", "تمت الموافقة عبر UI");

    if (result.success) {
      addLog("✅ تمت الموافقة! يمكنك الآن تطبيق التعديلات");
    } else {
      addLog(`❌ فشل تسجيل الموافقة: ${result.error}`);
    }

    setCurrentStep("idle");
  };

  // تطبيق التعديلات
  const handleApply = async () => {
    if (!scanResult?.runId) return;

    // التحقق من الموافقة أولاً
    const approvalCheck = await repoRefactor.checkApproval(scanResult.runId);
    if (!approvalCheck.approved) {
      addLog(`❌ لا يمكن التطبيق: ${approvalCheck.message}`);
      return;
    }

    setLoading(true);
    setCurrentStep("applying");
    addLog("🔧 جاري تطبيق التعديلات...");

    const result = await repoRefactor.apply(scanResult.runId);
    setLoading(false);

    if (result.success) {
      addLog("✅ تم تطبيق التعديلات بنجاح!");
      addLog("📝 ملاحظة: تم إنشاء commits لكل خطوة");
    } else {
      addLog(`❌ فشل التطبيق: ${result.error}`);
    }

    setCurrentStep("idle");
  };

  // مسح السجل
  const clearLogs = () => {
    setLogs([]);
    setPlanReport(null);
    setPlanResult(null);
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <h1>🔄 Repo Refactor AI</h1>
        <p className="subtitle">أداة ذكية لإعادة هيكلة الكود باستخدام AI</p>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {/* Step 1: Repository Selection */}
        <section className="step-section">
          <h2>📁 الخطوة 1: اختيار المستودع</h2>

          <div className="input-group">
            <label>مسار المستودع:</label>
            <div className="path-input-wrapper">
              <input
                type="text"
                value={repoPath}
                onChange={handleManualPathChange}
                placeholder="E:\my-project أو اضغط 'Browse'"
                className="path-input"
              />
              <button onClick={confirmManualPath} className="btn-confirm">✓</button>
            </div>
          </div>

          <div className="button-group">
            <button onClick={handleSelectRepo} className="btn-primary">
              📂 Browse...
            </button>
            <button
              onClick={handleScan}
              disabled={!repoPath.trim() || loading}
              className={`btn-action ${currentStep === "scanning" ? "btn-loading" : ""}`}
            >
              {currentStep === "scanning" ? "⏳ جاري التحليل..." : "🔍 Run Scan"}
            </button>
          </div>
        </section>

        {/* تأكيد مشاركة النموذج */}
        {(llmStep1Confirmed || llmStep2Confirmed) && (
          <section className="step-section llm-confirm">
            <h3>🤖 تأكيد مشاركة النموذج اللغوي</h3>
            <ul className="llm-confirm-list">
              {llmStep1Confirmed && <li>الخطوة 1 (التحليل): النموذج شارك ✓</li>}
              {llmStep2Confirmed && <li>الخطوة 2 (التخطيط): النموذج شارك ✓</li>}
            </ul>
          </section>
        )}

        {/* Step 2: Generate Plan */}
        <section className={`step-section ${!scanResult?.success ? "step-disabled" : ""}`}>
          <h2>📝 الخطوة 2: توليد خطة التعديل</h2>
          <p className="step-description">يحلل AI الكود ويقترح تعديلات محسّنة</p>

          <button
            onClick={handlePlan}
            disabled={!scanResult?.success || loading}
            className={`btn-action ${currentStep === "planning" ? "btn-loading" : ""}`}
          >
            {currentStep === "planning" ? "⏳ جاري التخطيط..." : "📝 Generate Plan"}
          </button>

          {/* عرض التقرير عند نجاح Plan */}
          {planReport && (
            <div className="report-section">
              <h3>📄 تقرير خطة التعديل</h3>
              <div className="report-content">
                <pre className="report-markdown">{planReport}</pre>
              </div>
            </div>
          )}
        </section>

        {/* Step 3: Approve */}
        <section className={`step-section ${!scanResult?.success ? "step-disabled" : ""}`}>
          <h2>✅ الخطوة 3: الموافقة على التعديلات</h2>
          <p className="step-description">راجع التقرير والمخاطر قبل التنفيذ</p>

          <div className="approval-buttons">
            <button
              onClick={handleApprove}
              disabled={!scanResult?.success || loading}
              className="btn-approve"
            >
              ✅ Approve Plan
            </button>
          </div>
        </section>

        {/* Step 4: Apply */}
        <section className={`step-section ${!scanResult?.success ? "step-disabled" : ""}`}>
          <h2>🔧 الخطوة 4: تطبيق التعديلات</h2>
          <p className="step-description">تنفيذ التعديلات فعلياً مع حماية Git</p>

          <button
            onClick={handleApply}
            disabled={!scanResult?.success || loading}
            className={`btn-action btn-apply ${currentStep === "applying" ? "btn-loading" : ""}`}
          >
            {currentStep === "applying" ? "⏳ جاري التطبيق..." : "🔧 Apply Changes"}
          </button>
        </section>

        {/* Logs Section */}
        <section className="logs-section">
          <div className="logs-header">
            <h3>📋 سجل العمليات</h3>
            <button onClick={clearLogs} className="btn-clear">🗑 Clear</button>
          </div>
          <div className="logs-container">
            {logs.length === 0 ? (
              <div className="logs-empty">السجل فارغ...</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={`log-line ${getLogClass(log)}`}>
                  {log}
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>v0.1.0 | Built with Electron + React + TypeScript</p>
      </footer>
    </div>
  );
}

// تحديد لون السجل بناءً على المحتوى
function getLogClass(log: string): string {
  if (log.includes("❌")) return "log-error";
  if (log.includes("✅")) return "log-success";
  if (log.includes("⚠️")) return "log-warning";
  if (log.includes("🔍") || log.includes("📝") || log.includes("🔧")) return "log-action";
  return "";
}