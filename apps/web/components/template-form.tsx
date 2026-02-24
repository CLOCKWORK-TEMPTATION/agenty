"use client";

/**
 * TemplateForm — Create or edit a team template.
 * Fields: id, name, version, description, domains (multi-select chips),
 *         roles (dynamic list with add/remove).
 * Calls createTemplate or updateTemplate via the API client.
 */

import { useId, useReducer } from "react";
import type { TeamTemplate, TaskDomain, RoleBlueprint } from "@repo/types";
import { createTemplate, updateTemplate } from "../lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RoleFormEntry {
  /** Internal UI key for stable list rendering (not sent to API). */
  _key: string;
  id: string;
  name: string;
  objective: string;
  requiredCapabilities: string;
  sensitiveTools: boolean;
}

interface FormState {
  id: string;
  name: string;
  version: string;
  description: string;
  domains: TaskDomain[];
  roles: RoleFormEntry[];
}

type FormAction =
  | { type: "SET"; field: keyof Omit<FormState, "domains" | "roles">; value: string }
  | { type: "TOGGLE_DOMAIN"; domain: TaskDomain }
  | { type: "ADD_ROLE" }
  | { type: "REMOVE_ROLE"; key: string }
  | { type: "SET_ROLE"; key: string; field: keyof Omit<RoleFormEntry, "_key" | "sensitiveTools">; value: string }
  | { type: "TOGGLE_ROLE_SENSITIVE"; key: string }
  | { type: "RESET"; payload: FormState };

interface PageState {
  form: FormState;
  submitting: boolean;
  error: string | null;
  successMessage: string | null;
}

type PageAction =
  | { type: "FORM"; action: FormAction }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS"; message: string }
  | { type: "SUBMIT_ERROR"; message: string }
  | { type: "CLEAR_FEEDBACK" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRoleKey(): string {
  return `role_${Math.random().toString(36).slice(2, 10)}`;
}

function emptyRole(): RoleFormEntry {
  return {
    _key: makeRoleKey(),
    id: "",
    name: "",
    objective: "",
    requiredCapabilities: "",
    sensitiveTools: false,
  };
}

function templateToForm(template: TeamTemplate): FormState {
  return {
    id: template.id,
    name: template.name,
    version: template.version,
    description: template.description ?? "",
    domains: [...template.domains],
    roles: template.roles.map((r) => ({
      _key: makeRoleKey(),
      id: r.id,
      name: r.name,
      objective: r.objective,
      requiredCapabilities: r.requiredCapabilities.join(", "),
      sensitiveTools: r.sensitiveTools ?? false,
    })),
  };
}

const BLANK_FORM: FormState = {
  id: "",
  name: "",
  version: "1.0.0",
  description: "",
  domains: [],
  roles: [emptyRole()],
};

// ---------------------------------------------------------------------------
// Reducers
// ---------------------------------------------------------------------------

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET":
      return { ...state, [action.field]: action.value };

    case "TOGGLE_DOMAIN": {
      const has = state.domains.includes(action.domain);
      return {
        ...state,
        domains: has
          ? state.domains.filter((d) => d !== action.domain)
          : [...state.domains, action.domain],
      };
    }

    case "ADD_ROLE":
      return { ...state, roles: [...state.roles, emptyRole()] };

    case "REMOVE_ROLE":
      return {
        ...state,
        roles: state.roles.filter((r) => r._key !== action.key),
      };

    case "SET_ROLE":
      return {
        ...state,
        roles: state.roles.map((r) =>
          r._key === action.key ? { ...r, [action.field]: action.value } : r
        ),
      };

    case "TOGGLE_ROLE_SENSITIVE":
      return {
        ...state,
        roles: state.roles.map((r) =>
          r._key === action.key ? { ...r, sensitiveTools: !r.sensitiveTools } : r
        ),
      };

    case "RESET":
      return { ...action.payload };

    default:
      return state;
  }
}

function pageReducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case "FORM":
      return { ...state, form: formReducer(state.form, action.action) };
    case "SUBMIT_START":
      return { ...state, submitting: true, error: null, successMessage: null };
    case "SUBMIT_SUCCESS":
      return { ...state, submitting: false, successMessage: action.message, error: null };
    case "SUBMIT_ERROR":
      return { ...state, submitting: false, error: action.message };
    case "CLEAR_FEEDBACK":
      return { ...state, error: null, successMessage: null };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_DOMAINS: Array<{ value: TaskDomain; label: string; labelEn: string }> = [
  { value: "coding", label: "برمجة", labelEn: "Coding" },
  { value: "research", label: "بحث", labelEn: "Research" },
  { value: "content", label: "محتوى", labelEn: "Content" },
  { value: "data", label: "بيانات", labelEn: "Data" },
  { value: "operations", label: "عمليات", labelEn: "Operations" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TemplateFormProps {
  /** When provided, the form operates in edit mode pre-populated from this template. */
  template?: TeamTemplate;
  onSuccess?: (saved: TeamTemplate) => void;
  onCancel?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateForm({ template, onSuccess, onCancel }: TemplateFormProps) {
  const isEdit = template !== undefined;
  const formId = useId();

  const [state, dispatch] = useReducer(pageReducer, {
    form: template ? templateToForm(template) : { ...BLANK_FORM, roles: [emptyRole()] },
    submitting: false,
    error: null,
    successMessage: null,
  });

  const { form, submitting, error, successMessage } = state;

  // ---------------------------------------------------------------------------
  // Dispatch shorthands
  // ---------------------------------------------------------------------------

  const set = (field: keyof Omit<FormState, "domains" | "roles">, value: string) =>
    dispatch({ type: "FORM", action: { type: "SET", field, value } });

  const toggleDomain = (domain: TaskDomain) =>
    dispatch({ type: "FORM", action: { type: "TOGGLE_DOMAIN", domain } });

  const addRole = () => dispatch({ type: "FORM", action: { type: "ADD_ROLE" } });

  const removeRole = (key: string) =>
    dispatch({ type: "FORM", action: { type: "REMOVE_ROLE", key } });

  const setRole = (
    key: string,
    field: keyof Omit<RoleFormEntry, "_key" | "sensitiveTools">,
    value: string
  ) => dispatch({ type: "FORM", action: { type: "SET_ROLE", key, field, value } });

  const toggleSensitive = (key: string) =>
    dispatch({ type: "FORM", action: { type: "TOGGLE_ROLE_SENSITIVE", key } });

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  function validate(): string | null {
    if (!form.id.trim()) return "معرّف القالب مطلوب";
    if (!/^[a-z0-9_-]+$/.test(form.id.trim())) {
      return "معرّف القالب: أحرف صغيرة وأرقام وشرطة فقط (a-z, 0-9, -, _)";
    }
    if (!form.name.trim()) return "اسم القالب مطلوب";
    if (!form.version.trim()) return "الإصدار مطلوب";
    if (form.domains.length === 0) return "يجب اختيار مجال واحد على الأقل";
    for (const role of form.roles) {
      if (!role.id.trim()) return "معرّف الدور مطلوب لكل دور";
      if (!/^[a-z0-9_-]+$/.test(role.id.trim())) {
        return `معرّف الدور "${role.id}": أحرف صغيرة وأرقام وشرطة فقط`;
      }
      if (!role.name.trim()) return "اسم الدور مطلوب لكل دور";
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Build payload
  // ---------------------------------------------------------------------------

  function buildRoles(): RoleBlueprint[] {
    return form.roles.map((r) => ({
      id: r.id.trim(),
      name: r.name.trim(),
      objective: r.objective.trim(),
      requiredCapabilities: r.requiredCapabilities
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      sensitiveTools: r.sensitiveTools,
    }));
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const validationError = validate();
    if (validationError) {
      dispatch({ type: "SUBMIT_ERROR", message: validationError });
      return;
    }

    dispatch({ type: "SUBMIT_START" });

    const payload = {
      name: form.name.trim(),
      version: form.version.trim(),
      description: form.description.trim(),
      domains: form.domains,
      roles: buildRoles(),
    };

    let result;
    if (isEdit) {
      result = await updateTemplate(form.id.trim(), payload);
    } else {
      result = await createTemplate({ id: form.id.trim(), ...payload });
    }

    if (result.ok) {
      const savedTemplate = result.data;
      dispatch({
        type: "SUBMIT_SUCCESS",
        message: isEdit
          ? `تم تحديث القالب "${savedTemplate.name}" بنجاح`
          : `تم إنشاء القالب "${savedTemplate.name}" بنجاح`,
      });
      if (!isEdit) {
        // Reset to blank form on create success
        dispatch({
          type: "FORM",
          action: { type: "RESET", payload: { ...BLANK_FORM, roles: [emptyRole()] } },
        });
      }
      onSuccess?.(savedTemplate);
    } else {
      dispatch({ type: "SUBMIT_ERROR", message: result.message });
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <form
      id={formId}
      className="template-form"
      onSubmit={handleSubmit}
      noValidate
      dir="rtl"
      aria-label={isEdit ? "تعديل القالب" : "إنشاء قالب جديد"}
    >
      {/* Section: Basic info */}
      <fieldset className="template-form__section">
        <legend className="template-form__section-legend">المعلومات الأساسية</legend>

        <div className="template-form__row">
          {/* Template ID */}
          <div className="template-form__field">
            <label htmlFor={`${formId}-id`} className="template-form__label">
              معرّف القالب <span className="template-form__required">*</span>
              <span className="template-form__hint">أحرف صغيرة وأرقام وشرطة فقط</span>
            </label>
            <input
              id={`${formId}-id`}
              type="text"
              className="template-form__input"
              value={form.id}
              onChange={(e) => set("id", e.target.value)}
              placeholder="my-template"
              required
              disabled={submitting || isEdit}
              autoComplete="off"
              spellCheck={false}
              dir="ltr"
              maxLength={64}
            />
            {isEdit && (
              <span className="template-form__field-note">المعرّف لا يمكن تغييره بعد الإنشاء</span>
            )}
          </div>

          {/* Version */}
          <div className="template-form__field">
            <label htmlFor={`${formId}-version`} className="template-form__label">
              الإصدار <span className="template-form__required">*</span>
            </label>
            <input
              id={`${formId}-version`}
              type="text"
              className="template-form__input"
              value={form.version}
              onChange={(e) => set("version", e.target.value)}
              placeholder="1.0.0"
              required
              disabled={submitting}
              dir="ltr"
              maxLength={20}
            />
          </div>
        </div>

        {/* Name — full width */}
        <div className="template-form__field">
          <label htmlFor={`${formId}-name`} className="template-form__label">
            الاسم <span className="template-form__required">*</span>
          </label>
          <input
            id={`${formId}-name`}
            type="text"
            className="template-form__input"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="مثال: فريق تطوير البرمجيات"
            required
            disabled={submitting}
            maxLength={120}
          />
        </div>

        {/* Description */}
        <div className="template-form__field">
          <label htmlFor={`${formId}-description`} className="template-form__label">
            الوصف
          </label>
          <textarea
            id={`${formId}-description`}
            className="template-form__textarea"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="وصف مختصر لغرض هذا القالب وكيفية استخدامه…"
            disabled={submitting}
            rows={3}
            maxLength={1000}
          />
          <span className="template-form__char-count">
            {form.description.length} / 1000
          </span>
        </div>
      </fieldset>

      {/* Section: Domains */}
      <fieldset className="template-form__section">
        <legend className="template-form__section-legend">
          المجالات <span className="template-form__required">*</span>
        </legend>
        <div className="chip-group" role="group" aria-label="اختيار المجالات">
          {ALL_DOMAINS.map(({ value: domain, label, labelEn }) => {
            const active = form.domains.includes(domain);
            return (
              <button
                key={domain}
                type="button"
                className={[
                  "chip-group__chip",
                  `chip-group__chip--${domain}`,
                  active ? "chip-group__chip--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => toggleDomain(domain)}
                aria-pressed={active}
                disabled={submitting}
              >
                <span>{label}</span>
                <span className="chip-group__chip-en">{labelEn}</span>
              </button>
            );
          })}
        </div>
        {form.domains.length === 0 && (
          <span className="template-form__domains-hint">
            اختر مجالاً واحداً على الأقل
          </span>
        )}
      </fieldset>

      {/* Section: Roles */}
      <fieldset className="template-form__section">
        <legend className="template-form__section-legend">
          الأدوار
          <span className="template-form__role-count-badge">
            {form.roles.length}
          </span>
        </legend>

        <div className="role-editor">
          {form.roles.map((role, idx) => (
            <div key={role._key} className="role-editor__item">
              {/* Role header */}
              <div className="role-editor__item-header">
                <span className="role-editor__item-num">دور {idx + 1}</span>
                {form.roles.length > 1 && (
                  <button
                    type="button"
                    className="role-editor__remove-btn"
                    onClick={() => removeRole(role._key)}
                    disabled={submitting}
                    aria-label={`حذف الدور ${idx + 1}`}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M2 2l8 8M10 2l-8 8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    حذف
                  </button>
                )}
              </div>

              {/* Role fields */}
              <div className="role-editor__fields">
                {/* Role ID */}
                <div className="template-form__field">
                  <label
                    htmlFor={`${formId}-role-${role._key}-id`}
                    className="template-form__label"
                  >
                    معرّف الدور <span className="template-form__required">*</span>
                  </label>
                  <input
                    id={`${formId}-role-${role._key}-id`}
                    type="text"
                    className="template-form__input"
                    value={role.id}
                    onChange={(e) => setRole(role._key, "id", e.target.value)}
                    placeholder="role-id"
                    required
                    disabled={submitting}
                    autoComplete="off"
                    spellCheck={false}
                    dir="ltr"
                    maxLength={64}
                  />
                </div>

                {/* Role name */}
                <div className="template-form__field">
                  <label
                    htmlFor={`${formId}-role-${role._key}-name`}
                    className="template-form__label"
                  >
                    اسم الدور <span className="template-form__required">*</span>
                  </label>
                  <input
                    id={`${formId}-role-${role._key}-name`}
                    type="text"
                    className="template-form__input"
                    value={role.name}
                    onChange={(e) => setRole(role._key, "name", e.target.value)}
                    placeholder="مثال: مطور رئيسي"
                    required
                    disabled={submitting}
                    maxLength={80}
                  />
                </div>

                {/* Objective — full width */}
                <div className="template-form__field template-form__field--full">
                  <label
                    htmlFor={`${formId}-role-${role._key}-objective`}
                    className="template-form__label"
                  >
                    هدف الدور
                  </label>
                  <textarea
                    id={`${formId}-role-${role._key}-objective`}
                    className="template-form__textarea template-form__textarea--sm"
                    value={role.objective}
                    onChange={(e) => setRole(role._key, "objective", e.target.value)}
                    placeholder="ما هو هدف هذا الدور وما المهام التي يؤديها؟"
                    disabled={submitting}
                    rows={2}
                    maxLength={500}
                  />
                </div>

                {/* Required capabilities — full width */}
                <div className="template-form__field template-form__field--full">
                  <label
                    htmlFor={`${formId}-role-${role._key}-caps`}
                    className="template-form__label"
                  >
                    القدرات المطلوبة
                    <span className="template-form__hint">مفصولة بفاصلة</span>
                  </label>
                  <input
                    id={`${formId}-role-${role._key}-caps`}
                    type="text"
                    className="template-form__input"
                    value={role.requiredCapabilities}
                    onChange={(e) =>
                      setRole(role._key, "requiredCapabilities", e.target.value)
                    }
                    placeholder="code_generation, code_review, testing"
                    disabled={submitting}
                    dir="ltr"
                  />
                  {/* Preview parsed chips */}
                  {role.requiredCapabilities.trim().length > 0 && (
                    <div className="template-form__caps-preview">
                      {role.requiredCapabilities
                        .split(",")
                        .map((c) => c.trim())
                        .filter(Boolean)
                        .map((cap) => (
                          <span key={cap} className="template-form__cap-chip">
                            {cap}
                          </span>
                        ))}
                    </div>
                  )}
                </div>

                {/* Sensitive tools checkbox */}
                <div className="template-form__field template-form__field--inline">
                  <label
                    htmlFor={`${formId}-role-${role._key}-sensitive`}
                    className="template-form__checkbox-label"
                  >
                    <input
                      id={`${formId}-role-${role._key}-sensitive`}
                      type="checkbox"
                      className="template-form__checkbox"
                      checked={role.sensitiveTools}
                      onChange={() => toggleSensitive(role._key)}
                      disabled={submitting}
                    />
                    <span className="template-form__checkbox-custom" aria-hidden="true" />
                    <span>يستخدم أدوات حساسة</span>
                    <span className="template-form__hint">(يتطلب موافقة بشرية)</span>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add role button */}
        <button
          type="button"
          className="role-editor__add-btn"
          onClick={addRole}
          disabled={submitting}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M7 2v10M2 7h10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          إضافة دور
        </button>
      </fieldset>

      {/* Feedback banners */}
      {error && (
        <div className="template-form__feedback template-form__feedback--error" role="alert" aria-live="assertive">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
          </svg>
          {error}
        </div>
      )}

      {successMessage && (
        <div className="template-form__feedback template-form__feedback--success" role="status" aria-live="polite">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M5 8l2 2 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {successMessage}
        </div>
      )}

      {/* Footer actions */}
      <div className="template-form__footer">
        {onCancel && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={submitting}
          >
            إلغاء
          </button>
        )}
        <button
          type="submit"
          className="template-form__submit"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? (
            <>
              <span className="template-form__spinner" aria-hidden="true" />
              {isEdit ? "جارٍ التحديث…" : "جارٍ الإنشاء…"}
            </>
          ) : isEdit ? (
            "حفظ التعديلات"
          ) : (
            "إنشاء القالب"
          )}
        </button>
      </div>

      <style>{`
        /* Form container */
        .template-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* Section fieldset */
        .template-form__section {
          border: 1px solid var(--card-border);
          border-radius: var(--radius-lg);
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          background: rgba(255, 255, 255, 0.02);
        }

        .template-form__section-legend {
          font-size: 13px;
          font-weight: 700;
          color: var(--muted);
          letter-spacing: 0.5px;
          text-transform: uppercase;
          padding: 0 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .template-form__role-count-badge {
          font-size: 11px;
          font-weight: 600;
          background: rgba(142, 202, 230, 0.15);
          color: var(--accent-2);
          padding: 1px 7px;
          border-radius: var(--radius-full);
          text-transform: none;
          letter-spacing: 0;
        }

        /* Two-column row */
        .template-form__row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        /* Field */
        .template-form__field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .template-form__field--full {
          grid-column: 1 / -1;
        }

        .template-form__field--inline {
          justify-content: center;
        }

        /* Label */
        .template-form__label {
          font-size: 12px;
          font-weight: 600;
          color: var(--muted);
          display: flex;
          align-items: baseline;
          gap: 6px;
          flex-wrap: wrap;
        }

        .template-form__required {
          color: var(--error);
        }

        .template-form__hint {
          font-size: 11px;
          font-weight: 400;
          color: var(--muted);
          opacity: 0.7;
        }

        .template-form__field-note {
          font-size: 11px;
          color: var(--warning);
          opacity: 0.8;
        }

        /* Inputs */
        .template-form__input,
        .template-form__textarea {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--card-border);
          border-radius: var(--radius-md);
          color: var(--text);
          font-size: 13px;
          font-family: inherit;
          padding: 9px 12px;
          outline: none;
          transition: border-color var(--transition), background var(--transition);
          width: 100%;
          box-sizing: border-box;
        }

        .template-form__input::placeholder,
        .template-form__textarea::placeholder {
          color: var(--muted);
          opacity: 0.6;
        }

        .template-form__input:focus,
        .template-form__textarea:focus {
          border-color: var(--accent);
          background: rgba(255, 183, 3, 0.04);
        }

        .template-form__input:disabled,
        .template-form__textarea:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .template-form__textarea {
          resize: vertical;
          min-height: 72px;
          line-height: 1.55;
        }

        .template-form__textarea--sm {
          min-height: 56px;
        }

        .template-form__char-count {
          font-size: 10px;
          color: var(--muted);
          text-align: left;
          opacity: 0.55;
        }

        /* Domains hint */
        .template-form__domains-hint {
          font-size: 12px;
          color: var(--warning);
          opacity: 0.8;
        }

        /* Capabilities preview chips */
        .template-form__caps-preview {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 4px;
        }

        .template-form__cap-chip {
          font-size: 11px;
          font-family: monospace;
          color: var(--accent-2);
          background: rgba(142, 202, 230, 0.1);
          border: 1px solid rgba(142, 202, 230, 0.2);
          padding: 2px 8px;
          border-radius: var(--radius-full);
        }

        /* Checkbox */
        .template-form__checkbox-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 13px;
          color: var(--text);
          position: relative;
          user-select: none;
        }

        .template-form__checkbox {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }

        .template-form__checkbox-custom {
          width: 16px;
          height: 16px;
          border: 1.5px solid var(--card-border);
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.06);
          flex-shrink: 0;
          transition: background var(--transition), border-color var(--transition);
          position: relative;
        }

        .template-form__checkbox:checked + .template-form__checkbox-custom {
          background: var(--accent);
          border-color: var(--accent);
        }

        .template-form__checkbox:checked + .template-form__checkbox-custom::after {
          content: "";
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -60%) rotate(45deg);
          width: 4px;
          height: 7px;
          border-right: 1.5px solid #0d1b2a;
          border-bottom: 1.5px solid #0d1b2a;
        }

        /* Feedback banners */
        .template-form__feedback {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: var(--radius-md);
          font-size: 13px;
          font-weight: 500;
          direction: rtl;
        }

        .template-form__feedback--error {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: var(--error);
        }

        .template-form__feedback--success {
          background: rgba(34, 197, 94, 0.08);
          border: 1px solid rgba(34, 197, 94, 0.2);
          color: var(--success);
        }

        /* Footer */
        .template-form__footer {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 10px;
          flex-direction: row-reverse;
          flex-wrap: wrap;
        }

        /* Submit button */
        .template-form__submit {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;
          border-radius: var(--radius-md);
          border: none;
          background: var(--accent);
          color: #0d1b2a;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity var(--transition), transform var(--transition);
          font-family: inherit;
          direction: rtl;
        }

        .template-form__submit:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .template-form__submit:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }

        /* Spinner */
        .template-form__spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(13, 27, 42, 0.3);
          border-top-color: #0d1b2a;
          border-radius: 50%;
          animation: tf-spin 0.7s linear infinite;
          flex-shrink: 0;
        }

        @keyframes tf-spin {
          to { transform: rotate(360deg); }
        }

        /* Responsive */
        @media (max-width: 560px) {
          .template-form__row {
            grid-template-columns: 1fr;
          }
          .template-form__footer {
            flex-direction: column;
            align-items: stretch;
          }
          .template-form__submit {
            justify-content: center;
          }
        }
      `}</style>
    </form>
  );
}
