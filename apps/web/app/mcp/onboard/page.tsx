"use client";

/**
 * MCP Server Onboarding Wizard
 * Wizard لإضافة MCP server جديد
 */

import { useState, useCallback } from "react";
import type { McpServerConfig } from "@repo/types";

interface McpTestResult {
  success: boolean;
  message: string;
  toolsDetected?: number;
  errors?: string[];
}

interface WizardStep {
  id: string;
  title: string;
  description: string;
}

const WIZARD_STEPS: WizardStep[] = [
  {
    id: "basic",
    title: "معلومات أساسية",
    description: "أدخل اسم ووصف الخادم"
  },
  {
    id: "transport",
    title: "نوع الاتصال",
    description: "اختر طريقة الاتصال بالخادم"
  },
  {
    id: "config",
    title: "إعدادات الاتصال",
    description: "أدخل تفاصيل الاتصال"
  },
  {
    id: "auth",
    title: "المصادقة",
    description: "إعدادات الأمان والمصادقة"
  },
  {
    id: "test",
    title: "اختبار الاتصال",
    description: "تأكد من أن الخادم يعمل"
  },
  {
    id: "confirm",
    title: "التأكيد",
    description: "راجع و أكمل الإضافة"
  }
];

export default function McpOnboardPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [config, setConfig] = useState<Partial<McpServerConfig>>({
    transport: "stdio",
    authType: "none",
    enabled: true
  });
  const [testResult, setTestResult] = useState<McpTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateConfig = useCallback(<K extends keyof McpServerConfig>(
    key: K,
    value: McpServerConfig[K]
  ) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setError(null);
  }, []);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const response = await fetch("/api/v1/mcp/servers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });

      const data = await response.json();
      setTestResult(data.data || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الاختبار");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/mcp/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "فشل حفظ الخادم");
      }

      alert("تم إضافة الخادم بنجاح!");
      window.location.href = "/mcp";
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return config.name && config.name.length >= 2;
      case 1:
        return config.transport;
      case 2:
        if (config.transport === "stdio") {
          return config.endpoint && config.endpoint.length > 0;
        }
        return config.endpoint && /^https?:\/\/.+/.test(config.endpoint);
      case 3:
        return config.authType;
      case 4:
        return testResult?.success;
      default:
        return true;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="step-content">
            <div className="form-group">
              <label htmlFor="name">اسم الخادم *</label>
              <input
                id="name"
                type="text"
                value={config.name || ""}
                onChange={(e) => updateConfig("name", e.target.value)}
                placeholder="مثال: GitHub MCP Server"
                className="form-input"
              />
              <span className="help-text">اسم يصف وظيفة هذا الخادم</span>
            </div>

            <div className="form-group">
              <label htmlFor="id">معرف الخادم (ID)</label>
              <input
                id="id"
                type="text"
                value={config.id || ""}
                onChange={(e) => updateConfig("id", e.target.value)}
                placeholder="مثال: github-mcp"
                className="form-input"
              />
              <span className="help-text">معرف فريد (اختياري، سيتم توليده تلقائياً)</span>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="step-content">
            <div className="transport-options">
              <div
                className={`transport-card ${config.transport === "stdio" ? "selected" : ""}`}
                onClick={() => updateConfig("transport", "stdio")}
              >
                <div className="transport-icon">⚙️</div>
                <h4>STDIO (Local)</h4>
                <p>خادم محلي يعمل عبر stdin/stdout</p>
                <ul className="transport-features">
                  <li>أدوات سطر الأوامر</li>
                  <li>برامج Python/Node.js محلية</li>
                  <li>سكريبتات مخصصة</li>
                </ul>
              </div>

              <div
                className={`transport-card ${config.transport === "http" ? "selected" : ""}`}
                onClick={() => updateConfig("transport", "http")}
              >
                <div className="transport-icon">🌐</div>
                <h4>HTTP (Remote)</h4>
                <p>خادم بعيد يعمل عبر HTTP/REST</p>
                <ul className="transport-features">
                  <li>خدمات السحابة</li>
                  <li>APIs خارجية</li>
                  <li>خوادم مؤسسية</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="step-content">
            {config.transport === "stdio" ? (
              <>
                <div className="form-group">
                  <label htmlFor="command">الأمر *</label>
                  <input
                    id="command"
                    type="text"
                    value={config.endpoint || ""}
                    onChange={(e) => updateConfig("endpoint", e.target.value)}
                    placeholder="مثال: python -m github_mcp_server"
                    className="form-input"
                  />
                  <span className="help-text">الأمر لتشغيل الخادم</span>
                </div>

                <div className="form-group">
                  <label htmlFor="cwd">مجلد العمل (اختياري)</label>
                  <input
                    id="cwd"
                    type="text"
                    value={(config as any).cwd || ""}
                    onChange={(e) => updateConfig("cwd" as any, e.target.value)}
                    placeholder="/path/to/working/directory"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="env">متغيرات البيئة (اختياري)</label>
                  <textarea
                    id="env"
                    rows={4}
                    value={Object.entries((config as any).env || {})
                      .map(([k, v]) => `${k}=${v}`)
                      .join("\n")}
                    onChange={(e) => {
                      const envVars: Record<string, string> = {};
                      e.target.value.split("\n").forEach(line => {
                        const [k, v] = line.split("=");
                        if (k && v) envVars[k.trim()] = v.trim();
                      });
                      updateConfig("env" as any, envVars);
                    }}
                    placeholder="KEY=value\nAPI_KEY=secret"
                    className="form-input"
                  />
                  <span className="help-text">متغيرات البيئة (سطر لكل متغير)</span>
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label htmlFor="url">عنوان URL *</label>
                  <input
                    id="url"
                    type="url"
                    value={config.endpoint || ""}
                    onChange={(e) => updateConfig("endpoint", e.target.value)}
                    placeholder="https://api.example.com/mcp"
                    className="form-input"
                  />
                  <span className="help-text">عنوان URL لنقطة نهاية MCP</span>
                </div>

                <div className="form-group">
                  <label htmlFor="timeout">مهلة الاتصال (ثواني)</label>
                  <input
                    id="timeout"
                    type="number"
                    value={(config as any).timeout || 30}
                    onChange={(e) => updateConfig("timeout" as any, parseInt(e.target.value))}
                    min={1}
                    max={300}
                    className="form-input"
                  />
                </div>
              </>
            )}
          </div>
        );

      case 3:
        return (
          <div className="step-content">
            <div className="auth-options">
              <div
                className={`auth-card ${config.authType === "none" ? "selected" : ""}`}
                onClick={() => updateConfig("authType", "none")}
              >
                <div className="auth-icon">🔓</div>
                <h4>بدون مصادقة</h4>
                <p>لا يتطلب أي مفتاح أو توكن</p>
              </div>

              <div
                className={`auth-card ${config.authType === "api_key" ? "selected" : ""}`}
                onClick={() => updateConfig("authType", "api_key")}
              >
                <div className="auth-icon">🔑</div>
                <h4>API Key</h4>
                <p>مفتاح API ثابت</p>
              </div>

              <div
                className={`auth-card ${config.authType === "oauth" ? "selected" : ""}`}
                onClick={() => updateConfig("authType", "oauth")}
              >
                <div className="auth-icon">🔐</div>
                <h4>OAuth 2.0</h4>
                <p>مصادقة OAuth متقدمة</p>
              </div>
            </div>

            {config.authType === "api_key" && (
              <div className="form-group mt-4">
                <label htmlFor="apiKey">مفتاح API</label>
                <input
                  id="apiKey"
                  type="password"
                  value={(config as any).apiKey || ""}
                  onChange={(e) => updateConfig("apiKey" as any, e.target.value)}
                  placeholder="sk-..."
                  className="form-input"
                />
                <span className="help-text">سيتم تشفير هذا المفتاح وتخزينه بأمان</span>
              </div>
            )}

            {config.authType === "oauth" && (
              <div className="oauth-fields mt-4">
                <div className="form-group">
                  <label htmlFor="clientId">Client ID</label>
                  <input
                    id="clientId"
                    type="text"
                    value={(config as any).oauth?.clientId || ""}
                    onChange={(e) => updateConfig("oauth" as any, { ...(config as any).oauth, clientId: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="clientSecret">Client Secret</label>
                  <input
                    id="clientSecret"
                    type="password"
                    value={(config as any).oauth?.clientSecret || ""}
                    onChange={(e) => updateConfig("oauth" as any, { ...(config as any).oauth, clientSecret: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="step-content">
            <div className="test-section">
              <p>اختبر الاتصال بالخادم للتأكد من أن الإعدادات صحيحة</p>

              <button
                onClick={handleTest}
                disabled={testing}
                className="test-btn"
              >
                {testing ? "جاري الاختبار..." : "🔍 اختبار الاتصال"}
              </button>

              {testResult && (
                <div className={`test-result ${testResult.success ? "success" : "error"}`}>
                  <div className="result-icon">
                    {testResult.success ? "✅" : "❌"}
                  </div>
                  <div className="result-content">
                    <h4>{testResult.success ? "تم الاتصال بنجاح!" : "فشل الاتصال"}</h4>
                    <p>{testResult.message}</p>
                    {testResult.toolsDetected !== undefined && (
                      <p className="tools-count">
                        🛠️ عدد الأدوات المكتشفة: {testResult.toolsDetected}
                      </p>
                    )}
                    {testResult.errors && testResult.errors.length > 0 && (
                      <div className="errors-list">
                        {testResult.errors?.map((err: string, i: number) => (
                          <div key={i} className="error-item">• {err}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="step-content">
            <div className="summary-section">
              <h3>ملخص الإعدادات</h3>

              <div className="summary-item">
                <span className="label">الاسم:</span>
                <span className="value">{config.name}</span>
              </div>

              <div className="summary-item">
                <span className="label">نوع الاتصال:</span>
                <span className="value">{config.transport === "stdio" ? "STDIO (محلي)" : "HTTP (بعيد)"}</span>
              </div>

              <div className="summary-item">
                <span className="label">العنوان/الأمر:</span>
                <span className="value">{config.endpoint}</span>
              </div>

              <div className="summary-item">
                <span className="label">المصادقة:</span>
                <span className="value">
                  {config.authType === "none" && "بدون مصادقة"}
                  {config.authType === "api_key" && "API Key"}
                  {config.authType === "oauth" && "OAuth 2.0"}
                </span>
              </div>

              <div className="summary-item">
                <span className="label">نتيجة الاختبار:</span>
                <span className={`value ${testResult?.success ? "success" : "error"}`}>
                  {testResult?.success ? "✅ ناجح" : "❌ فاشل"}
                </span>
              </div>

              {testResult?.toolsDetected !== undefined && (
                <div className="summary-item">
                  <span className="label">الأدوات المتاحة:</span>
                  <span className="value">{testResult.toolsDetected} أداة</span>
                </div>
              )}
            </div>

            <div className="confirm-actions">
              <button
                onClick={handleSave}
                disabled={saving || !testResult?.success}
                className="save-btn"
              >
                {saving ? "جاري الحفظ..." : "✅ إضافة الخادم"}
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="wizard-container" dir="rtl">
      <div className="wizard-header">
        <h1>إضافة خادم MCP جديد</h1>
        <p>اتبع الخطوات لإعداد خادم MCP جديد</p>
      </div>

      {/* Progress Steps */}
      <div className="wizard-progress">
        {WIZARD_STEPS.map((step, index) => (
          <div
            key={step.id}
            className={`progress-step ${
              index === currentStep ? "active" : ""
            } ${index < currentStep ? "completed" : ""}`}
          >
            <div className="step-number">
              {index < currentStep ? "✓" : index + 1}
            </div>
            <div className="step-info">
              <span className="step-title">{step.title}</span>
              <span className="step-desc">{step.description}</span>
            </div>
            {index < WIZARD_STEPS.length - 1 && (
              <div className="step-connector" />
            )}
          </div>
        ))}
      </div>

      {/* Error Display */}
      {error !== null && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span>{error ?? ""}</span>
        </div>
      )}

      {/* Step Content */}
      <div className="wizard-content">
        <div className="step-header">
          <h2>{WIZARD_STEPS[currentStep].title}</h2>
          <p>{WIZARD_STEPS[currentStep].description}</p>
        </div>

        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="wizard-navigation">
        <button
          onClick={() => setCurrentStep(prev => prev - 1)}
          disabled={currentStep === 0}
          className="btn-secondary"
        >
          ← السابق
        </button>

        <div className="step-indicator">
          الخطوة {currentStep + 1} من {WIZARD_STEPS.length}
        </div>

        <button
          onClick={() => setCurrentStep(prev => prev + 1)}
          disabled={currentStep === WIZARD_STEPS.length - 1 || !canProceed()}
          className="btn-primary"
        >
          التالي →
        </button>
      </div>

      <style jsx>{`
        .wizard-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
        }

        .wizard-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .wizard-header h1 {
          font-size: 1.75rem;
          margin-bottom: 0.5rem;
        }

        .wizard-progress {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2rem;
          position: relative;
        }

        .progress-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
          position: relative;
        }

        .step-number {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #e0e0e0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .progress-step.active .step-number {
          background: #667eea;
          color: white;
        }

        .progress-step.completed .step-number {
          background: #4caf50;
          color: white;
        }

        .step-info {
          text-align: center;
        }

        .step-title {
          display: block;
          font-weight: 600;
          font-size: 0.875rem;
        }

        .step-desc {
          display: block;
          font-size: 0.75rem;
          color: #666;
        }

        .step-connector {
          position: absolute;
          top: 16px;
          right: calc(50% + 20px);
          left: calc(-50% + 20px);
          height: 2px;
          background: #e0e0e0;
          z-index: -1;
        }

        .progress-step.completed .step-connector {
          background: #4caf50;
        }

        .error-banner {
          background: #ffebee;
          color: #c62828;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .wizard-content {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 12px;
          padding: 2rem;
          margin-bottom: 1.5rem;
        }

        .step-header {
          margin-bottom: 1.5rem;
        }

        .step-header h2 {
          margin: 0 0 0.5rem;
        }

        .step-header p {
          color: #666;
          margin: 0;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
        }

        .form-input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 1rem;
        }

        .help-text {
          display: block;
          font-size: 0.875rem;
          color: #666;
          margin-top: 0.25rem;
        }

        .transport-options, .auth-options {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .transport-card, .auth-card {
          border: 2px solid #e0e0e0;
          border-radius: 12px;
          padding: 1.5rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .transport-card:hover, .auth-card:hover {
          border-color: #667eea;
        }

        .transport-card.selected, .auth-card.selected {
          border-color: #667eea;
          background: #f0f4ff;
        }

        .transport-icon, .auth-icon {
          font-size: 2rem;
          margin-bottom: 1rem;
        }

        .transport-card h4, .auth-card h4 {
          margin: 0 0 0.5rem;
        }

        .transport-card p, .auth-card p {
          color: #666;
          margin: 0 0 1rem;
          font-size: 0.875rem;
        }

        .transport-features {
          list-style: none;
          padding: 0;
          margin: 0;
          font-size: 0.875rem;
        }

        .transport-features li {
          padding: 0.25rem 0;
          color: #666;
        }

        .transport-features li::before {
          content: "✓ ";
          color: #4caf50;
        }

        .test-section {
          text-align: center;
          padding: 2rem;
        }

        .test-btn {
          padding: 1rem 2rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
        }

        .test-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .test-result {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          margin-top: 1.5rem;
          padding: 1.5rem;
          border-radius: 8px;
          text-align: right;
        }

        .test-result.success {
          background: #e8f5e9;
        }

        .test-result.error {
          background: #ffebee;
        }

        .result-icon {
          font-size: 2rem;
        }

        .result-content h4 {
          margin: 0 0 0.5rem;
        }

        .result-content p {
          margin: 0;
          color: #666;
        }

        .tools-count {
          margin-top: 0.5rem;
          font-weight: 500;
        }

        .errors-list {
          margin-top: 1rem;
        }

        .error-item {
          color: #c62828;
          font-size: 0.875rem;
        }

        .summary-section {
          background: #f5f5f5;
          padding: 1.5rem;
          border-radius: 8px;
        }

        .summary-section h3 {
          margin: 0 0 1rem;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          padding: 0.75rem 0;
          border-bottom: 1px solid #e0e0e0;
        }

        .summary-item:last-child {
          border-bottom: none;
        }

        .summary-item .label {
          color: #666;
        }

        .summary-item .value {
          font-weight: 500;
        }

        .summary-item .value.success {
          color: #4caf50;
        }

        .summary-item .value.error {
          color: #f44336;
        }

        .confirm-actions {
          margin-top: 1.5rem;
          text-align: center;
        }

        .save-btn {
          padding: 1rem 3rem;
          background: #4caf50;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
        }

        .save-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .wizard-navigation {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .btn-secondary, .btn-primary {
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          border: none;
        }

        .btn-secondary {
          background: #f0f0f0;
          color: #333;
        }

        .btn-secondary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #667eea;
          color: white;
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .step-indicator {
          color: #666;
          font-size: 0.875rem;
        }

        .mt-4 {
          margin-top: 1rem;
        }
      `}</style>
    </div>
  );
}
