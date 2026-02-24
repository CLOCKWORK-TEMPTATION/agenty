"use client";

/**
 * TemplateDetail — Modal/expanded view for a single team template.
 * Shows: name, version, description, domain badges, full role list.
 * Actions: "Use in Run" (navigates to dashboard with templateId), "Edit" (callback).
 */

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { TeamTemplate, TaskDomain } from "@repo/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOMAIN_LABELS: Record<TaskDomain, string> = {
  coding: "برمجة",
  research: "بحث",
  content: "محتوى",
  data: "بيانات",
  operations: "عمليات",
};

const DOMAIN_EN: Record<TaskDomain, string> = {
  coding: "Coding",
  research: "Research",
  content: "Content",
  data: "Data",
  operations: "Operations",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TemplateDetailProps {
  template: TeamTemplate;
  onClose: () => void;
  onEdit?: (template: TeamTemplate) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateDetail({ template, onClose, onEdit }: TemplateDetailProps) {
  const router = useRouter();

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    // Prevent body scroll while modal is open
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  const handleUseInRun = () => {
    onClose();
    router.push(`/?templateId=${encodeURIComponent(template.id)}`);
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`تفاصيل القالب: ${template.name}`}
      onClick={handleOverlayClick}
      dir="rtl"
    >
      <div className="modal-content template-detail">
        {/* Header */}
        <div className="template-detail__header">
          <div className="template-detail__title-row">
            <div>
              <h2 className="template-detail__name">{template.name}</h2>
              <span className="template-detail__version">v{template.version}</span>
            </div>
            <button
              type="button"
              className="template-detail__close"
              onClick={onClose}
              aria-label="إغلاق"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path
                  d="M3 3l12 12M15 3L3 15"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Domains */}
          {template.domains.length > 0 && (
            <div className="template-detail__domains">
              {template.domains.map((d) => (
                <span key={d} className={`pill pill-${d}`}>
                  {DOMAIN_LABELS[d] ?? d}
                  <span className="pill-en">{DOMAIN_EN[d]}</span>
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {template.description && (
            <p className="template-detail__description">{template.description}</p>
          )}

          {/* ID badge */}
          <div className="template-detail__id-row">
            <span className="template-detail__id-label">ID:</span>
            <code className="template-detail__id-value">{template.id}</code>
          </div>
        </div>

        {/* Roles */}
        <div className="template-detail__body">
          <h3 className="template-detail__section-title">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            الأدوار
            <span className="template-detail__role-count">
              {template.roles.length}
            </span>
          </h3>

          {template.roles.length === 0 ? (
            <p className="template-detail__no-roles">لا توجد أدوار محددة لهذا القالب.</p>
          ) : (
            <div className="template-detail__roles">
              {template.roles.map((role) => (
                <div key={role.id} className="template-detail__role">
                  <div className="template-detail__role-header">
                    <div className="template-detail__role-name-row">
                      <span className="template-detail__role-name">{role.name}</span>
                      {role.sensitiveTools && (
                        <span
                          className="template-detail__sensitive-badge"
                          title="يستخدم أدوات حساسة"
                          aria-label="يستخدم أدوات حساسة"
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 16 16"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M8 2L2 6v4c0 3 2.5 5 6 6 3.5-1 6-3 6-6V6L8 2z"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinejoin="round"
                            />
                          </svg>
                          حساس
                        </span>
                      )}
                    </div>
                    <code className="template-detail__role-id">{role.id}</code>
                  </div>

                  {role.objective && (
                    <p className="template-detail__role-objective">{role.objective}</p>
                  )}

                  {role.requiredCapabilities.length > 0 && (
                    <div className="template-detail__caps">
                      <span className="template-detail__caps-label">القدرات المطلوبة:</span>
                      <div className="template-detail__caps-list">
                        {role.requiredCapabilities.map((cap) => (
                          <span key={cap} className="template-detail__cap-chip">
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="template-detail__footer">
          {onEdit && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onEdit(template)}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M11 2l3 3-9 9H2v-3l9-9z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
              تعديل
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            إغلاق
          </button>
          <button type="button" className="btn btn-primary" onClick={handleUseInRun}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <polygon
                points="4,2 14,8 4,14"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
            استخدام في تشغيل
          </button>
        </div>
      </div>

      <style>{`
        /* Pill English sub-label */
        .pill-en {
          display: none;
        }

        /* Template detail modal content */
        .template-detail {
          display: flex;
          flex-direction: column;
          gap: 0;
          max-height: 85dvh;
          overflow: hidden;
        }

        .template-detail__header {
          padding: 24px 24px 20px;
          border-bottom: 1px solid var(--card-border);
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex-shrink: 0;
        }

        .template-detail__title-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .template-detail__name {
          font-size: 20px;
          font-weight: 700;
          color: var(--text);
          line-height: 1.25;
          letter-spacing: -0.3px;
        }

        .template-detail__version {
          display: inline-block;
          margin-top: 4px;
          font-size: 12px;
          font-weight: 600;
          color: var(--accent);
          background: rgba(255, 183, 3, 0.12);
          padding: 2px 8px;
          border-radius: var(--radius-full);
          letter-spacing: 0.3px;
        }

        .template-detail__close {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--card-border);
          border-radius: var(--radius-md);
          color: var(--muted);
          cursor: pointer;
          padding: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background var(--transition), color var(--transition);
          flex-shrink: 0;
        }

        .template-detail__close:hover {
          background: rgba(239, 68, 68, 0.12);
          color: var(--error);
          border-color: rgba(239, 68, 68, 0.3);
        }

        .template-detail__domains {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .template-detail__description {
          font-size: 14px;
          color: var(--muted);
          line-height: 1.65;
          margin: 0;
        }

        .template-detail__id-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .template-detail__id-label {
          font-size: 11px;
          color: var(--muted);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .template-detail__id-value {
          font-size: 11px;
          color: var(--muted);
          background: rgba(0, 0, 0, 0.25);
          padding: 2px 8px;
          border-radius: var(--radius-sm);
          font-family: monospace;
          letter-spacing: 0.3px;
          word-break: break-all;
        }

        /* Body (scrollable) */
        .template-detail__body {
          padding: 20px 24px;
          overflow-y: auto;
          flex: 1;
        }

        .template-detail__body::-webkit-scrollbar {
          width: 5px;
        }

        .template-detail__body::-webkit-scrollbar-track {
          background: transparent;
        }

        .template-detail__body::-webkit-scrollbar-thumb {
          background: var(--card-border);
          border-radius: var(--radius-full);
        }

        .template-detail__section-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .template-detail__role-count {
          font-size: 12px;
          font-weight: 600;
          background: rgba(142, 202, 230, 0.15);
          color: var(--accent-2);
          padding: 1px 8px;
          border-radius: var(--radius-full);
          margin-inline-start: 2px;
        }

        .template-detail__no-roles {
          font-size: 13px;
          color: var(--muted);
        }

        .template-detail__roles {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .template-detail__role {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--card-border);
          border-radius: var(--radius-md);
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          transition: border-color var(--transition);
        }

        .template-detail__role:hover {
          border-color: rgba(142, 202, 230, 0.3);
        }

        .template-detail__role-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }

        .template-detail__role-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .template-detail__role-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--accent-2);
        }

        .template-detail__sensitive-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 600;
          color: var(--warning);
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.25);
          padding: 2px 7px;
          border-radius: var(--radius-full);
          letter-spacing: 0.3px;
        }

        .template-detail__role-id {
          font-size: 10px;
          color: var(--muted);
          background: rgba(0, 0, 0, 0.2);
          padding: 2px 7px;
          border-radius: var(--radius-sm);
          font-family: monospace;
          opacity: 0.7;
          flex-shrink: 0;
        }

        .template-detail__role-objective {
          font-size: 13px;
          color: var(--muted);
          line-height: 1.55;
          margin: 0;
        }

        .template-detail__caps {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          flex-wrap: wrap;
        }

        .template-detail__caps-label {
          font-size: 11px;
          color: var(--muted);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          flex-shrink: 0;
          padding-top: 2px;
        }

        .template-detail__caps-list {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }

        .template-detail__cap-chip {
          font-size: 11px;
          font-family: monospace;
          color: var(--accent-2);
          background: rgba(142, 202, 230, 0.1);
          border: 1px solid rgba(142, 202, 230, 0.2);
          padding: 2px 8px;
          border-radius: var(--radius-full);
          letter-spacing: 0.2px;
        }

        /* Footer */
        .template-detail__footer {
          padding: 16px 24px;
          border-top: 1px solid var(--card-border);
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-shrink: 0;
          background: rgba(0, 0, 0, 0.1);
          flex-wrap: wrap;
        }
      `}</style>
    </div>
  );
}
