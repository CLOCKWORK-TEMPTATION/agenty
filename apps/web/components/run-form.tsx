"use client";

/**
 * RunForm — Form to create and submit a new multi-agent team run.
 * Fetches templates on mount, calls runTeam() on submit, then navigates
 * to /runs/[runId] on success.
 */

import { useEffect, useId, useReducer, useRef } from "react";
import { useRouter } from "next/navigation";
import type { TaskDomain, ApprovalMode } from "@repo/types";
import { fetchTemplates, runTeam } from "../lib/api";
import type { TemplateItem } from "../lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormState {
  projectId: string;
  userId: string;
  title: string;
  description: string;
  domain: TaskDomain;
  approvalMode: ApprovalMode;
  templateId: string;
}

type FormAction =
  | { type: "SET_FIELD"; field: keyof FormState; value: string }
  | { type: "RESET" };

interface PageState {
  form: FormState;
  templates: TemplateItem[];
  loadingTemplates: boolean;
  submitting: boolean;
  error: string | null;
}

type PageAction =
  | { type: "FORM"; action: FormAction }
  | { type: "TEMPLATES_LOADED"; templates: TemplateItem[] }
  | { type: "TEMPLATES_ERROR" }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_ERROR"; message: string }
  | { type: "SUBMIT_SUCCESS" };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

const INITIAL_FORM: FormState = {
  projectId: "",
  userId: "",
  title: "",
  description: "",
  domain: "coding",
  approvalMode: "approval",
  templateId: "",
};

function formReducer(state: FormState, action: FormAction): FormState {
  if (action.type === "SET_FIELD") {
    return { ...state, [action.field]: action.value };
  }
  if (action.type === "RESET") {
    return { ...INITIAL_FORM };
  }
  return state;
}

function pageReducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case "FORM":
      return { ...state, form: formReducer(state.form, action.action) };
    case "TEMPLATES_LOADED":
      return { ...state, templates: action.templates, loadingTemplates: false };
    case "TEMPLATES_ERROR":
      return { ...state, loadingTemplates: false };
    case "SUBMIT_START":
      return { ...state, submitting: true, error: null };
    case "SUBMIT_ERROR":
      return { ...state, submitting: false, error: action.message };
    case "SUBMIT_SUCCESS":
      return { ...state, submitting: false, error: null };
    default:
      return state;
  }
}

const INITIAL_STATE: PageState = {
  form: { ...INITIAL_FORM },
  templates: [],
  loadingTemplates: true,
  submitting: false,
  error: null,
};

// ---------------------------------------------------------------------------
// Domain and approval mode options
// ---------------------------------------------------------------------------

const DOMAIN_OPTIONS: Array<{ value: TaskDomain; label: string }> = [
  { value: "coding", label: "برمجة (Coding)" },
  { value: "research", label: "بحث (Research)" },
  { value: "content", label: "محتوى (Content)" },
  { value: "data", label: "بيانات (Data)" },
  { value: "operations", label: "عمليات (Operations)" },
];

const APPROVAL_OPTIONS: Array<{ value: ApprovalMode; label: string }> = [
  { value: "approval", label: "موافقة يدوية (Manual Approval)" },
  { value: "auto", label: "تلقائي (Auto)" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface RunFormProps {
  /** Pre-populate projectId if available from context. */
  defaultProjectId?: string;
  /** Pre-populate userId if available from context. */
  defaultUserId?: string;
}

export function RunForm({ defaultProjectId = "", defaultUserId = "" }: RunFormProps) {
  const router = useRouter();
  const formId = useId();

  const [state, dispatch] = useReducer(pageReducer, {
    ...INITIAL_STATE,
    form: {
      ...INITIAL_FORM,
      projectId: defaultProjectId,
      userId: defaultUserId,
    },
  });

  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // Load templates on mount
  useEffect(() => {
    let cancelled = false;
    fetchTemplates().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        dispatch({ type: "TEMPLATES_LOADED", templates: result.data.items });
      } else {
        dispatch({ type: "TEMPLATES_ERROR" });
      }
    });
    return () => { cancelled = true; };
  }, []);

  const setField = (field: keyof FormState, value: string) => {
    dispatch({ type: "FORM", action: { type: "SET_FIELD", field, value } });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { form } = state;

    // Client-side validation
    if (!form.projectId.trim()) {
      dispatch({ type: "SUBMIT_ERROR", message: "معرّف المشروع مطلوب" });
      return;
    }
    if (!form.userId.trim()) {
      dispatch({ type: "SUBMIT_ERROR", message: "معرّف المستخدم مطلوب" });
      return;
    }
    if (!form.title.trim()) {
      dispatch({ type: "SUBMIT_ERROR", message: "عنوان المهمة مطلوب" });
      return;
    }
    if (!form.description.trim()) {
      dispatch({ type: "SUBMIT_ERROR", message: "وصف المهمة مطلوب" });
      return;
    }

    dispatch({ type: "SUBMIT_START" });

    const result = await runTeam({
      projectId: form.projectId.trim(),
      userId: form.userId.trim(),
      title: form.title.trim(),
      description: form.description.trim(),
      domain: form.domain,
      approvalMode: form.approvalMode,
      templateId: form.templateId || undefined,
    });

    if (result.ok) {
      dispatch({ type: "SUBMIT_SUCCESS" });
      router.push(`/runs/${result.data.runId}`);
    } else {
      dispatch({ type: "SUBMIT_ERROR", message: result.message });
    }
  };

  const { form, templates, loadingTemplates, submitting, error } = state;

  return (
    <form
      id={formId}
      className="run-form"
      onSubmit={handleSubmit}
      noValidate
      dir="rtl"
      aria-label="إنشاء تشغيل فريق جديد"
    >
      <div className="run-form__grid">
        {/* Project ID */}
        <div className="run-form__field">
          <label htmlFor={`${formId}-projectId`} className="run-form__label">
            معرّف المشروع <span className="run-form__required">*</span>
          </label>
          <input
            id={`${formId}-projectId`}
            type="text"
            className="run-form__input"
            value={form.projectId}
            onChange={(e) => setField("projectId", e.target.value)}
            placeholder="proj_..."
            required
            disabled={submitting}
            autoComplete="off"
            dir="ltr"
          />
        </div>

        {/* User ID */}
        <div className="run-form__field">
          <label htmlFor={`${formId}-userId`} className="run-form__label">
            معرّف المستخدم <span className="run-form__required">*</span>
          </label>
          <input
            id={`${formId}-userId`}
            type="text"
            className="run-form__input"
            value={form.userId}
            onChange={(e) => setField("userId", e.target.value)}
            placeholder="usr_..."
            required
            disabled={submitting}
            autoComplete="off"
            dir="ltr"
          />
        </div>

        {/* Title — full width */}
        <div className="run-form__field run-form__field--full">
          <label htmlFor={`${formId}-title`} className="run-form__label">
            عنوان المهمة <span className="run-form__required">*</span>
          </label>
          <input
            id={`${formId}-title`}
            type="text"
            className="run-form__input"
            value={form.title}
            onChange={(e) => setField("title", e.target.value)}
            placeholder="وصف مختصر للمهمة"
            required
            disabled={submitting}
            maxLength={200}
          />
        </div>

        {/* Description — full width */}
        <div className="run-form__field run-form__field--full">
          <label htmlFor={`${formId}-description`} className="run-form__label">
            وصف المهمة <span className="run-form__required">*</span>
          </label>
          <textarea
            id={`${formId}-description`}
            ref={descriptionRef}
            className="run-form__textarea"
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            placeholder="اكتب وصفاً تفصيلياً للمهمة المطلوبة من الفريق..."
            required
            disabled={submitting}
            rows={4}
            maxLength={4000}
          />
          <span className="run-form__char-count">
            {form.description.length} / 4000
          </span>
        </div>

        {/* Domain */}
        <div className="run-form__field">
          <label htmlFor={`${formId}-domain`} className="run-form__label">
            المجال
          </label>
          <select
            id={`${formId}-domain`}
            className="run-form__select"
            value={form.domain}
            onChange={(e) => setField("domain", e.target.value as TaskDomain)}
            disabled={submitting}
          >
            {DOMAIN_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Approval mode */}
        <div className="run-form__field">
          <label htmlFor={`${formId}-approvalMode`} className="run-form__label">
            وضع الموافقة
          </label>
          <select
            id={`${formId}-approvalMode`}
            className="run-form__select"
            value={form.approvalMode}
            onChange={(e) =>
              setField("approvalMode", e.target.value as ApprovalMode)
            }
            disabled={submitting}
          >
            {APPROVAL_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Template — full width */}
        <div className="run-form__field run-form__field--full">
          <label htmlFor={`${formId}-template`} className="run-form__label">
            القالب{" "}
            <span className="run-form__hint">(اختياري — يُحدّد تلقائياً إذا لم تختر)</span>
          </label>
          <select
            id={`${formId}-template`}
            className="run-form__select"
            value={form.templateId}
            onChange={(e) => setField("templateId", e.target.value)}
            disabled={submitting || loadingTemplates}
          >
            <option value="">
              {loadingTemplates ? "جارٍ التحميل…" : "— تحديد تلقائي —"}
            </option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} v{t.version}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="run-form__error" role="alert" aria-live="assertive">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="#ff4757" strokeWidth="1.5" />
            <path d="M8 5v3.5" stroke="#ff4757" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="11.5" r="0.75" fill="#ff4757" />
          </svg>
          {error}
        </div>
      )}

      {/* Submit */}
      <div className="run-form__footer">
        <button
          type="submit"
          className="run-form__submit"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? (
            <>
              <span className="run-form__spinner" aria-hidden="true" />
              جارٍ إنشاء الفريق…
            </>
          ) : (
            "تشغيل الفريق"
          )}
        </button>
      </div>

      <style>{`
        .run-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .run-form__grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .run-form__field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .run-form__field--full {
          grid-column: 1 / -1;
        }

        .run-form__label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
        }

        .run-form__required {
          color: #ff4757;
          margin-inline-start: 2px;
        }

        .run-form__hint {
          font-size: 11px;
          font-weight: 400;
          color: var(--muted);
        }

        .run-form__input,
        .run-form__select,
        .run-form__textarea {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--card-border);
          border-radius: 8px;
          color: var(--text);
          font-size: 13px;
          padding: 9px 12px;
          outline: none;
          transition: border-color 140ms ease, background 140ms ease;
          font-family: inherit;
          width: 100%;
          box-sizing: border-box;
        }

        .run-form__input::placeholder,
        .run-form__textarea::placeholder {
          color: var(--muted);
          opacity: 0.7;
        }

        .run-form__input:focus,
        .run-form__select:focus,
        .run-form__textarea:focus {
          border-color: var(--accent);
          background: rgba(255, 183, 3, 0.04);
        }

        .run-form__input:disabled,
        .run-form__select:disabled,
        .run-form__textarea:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .run-form__select {
          appearance: none;
          cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23a3b7c7' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: left 12px center;
          padding-inline-end: 32px;
        }

        .run-form__select option {
          background: #1b263b;
          color: var(--text);
        }

        .run-form__textarea {
          resize: vertical;
          min-height: 90px;
          line-height: 1.55;
        }

        .run-form__char-count {
          font-size: 10px;
          color: var(--muted);
          text-align: left;
          opacity: 0.6;
        }

        /* Error */
        .run-form__error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 8px;
          background: rgba(255, 71, 87, 0.08);
          border: 1px solid rgba(255, 71, 87, 0.25);
          color: #ff4757;
          font-size: 13px;
          font-weight: 500;
          direction: rtl;
        }

        /* Footer & submit */
        .run-form__footer {
          display: flex;
          justify-content: flex-start;
        }

        .run-form__submit {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 28px;
          border-radius: 10px;
          border: none;
          background: var(--accent);
          color: #0d1b2a;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 140ms ease, transform 140ms ease;
          direction: rtl;
        }

        .run-form__submit:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .run-form__submit:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }

        .run-form__spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(13, 27, 42, 0.35);
          border-top-color: #0d1b2a;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 560px) {
          .run-form__grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </form>
  );
}
