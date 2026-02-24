"use client";

/**
 * TemplatesMarketplace — Full client-side marketplace shell.
 * Receives initial SSR data; handles filtering, detail modal, and form modal.
 */

import { useState, useMemo, useCallback } from "react";
import type { TeamTemplate, TaskDomain } from "@repo/types";
import type { TemplateItem } from "@/lib/api";
import { TemplateFilter } from "@/components/template-filter";
import type { TemplateFilterState, SortOption } from "@/components/template-filter";
import { TemplateDetail } from "@/components/template-detail";
import { TemplateForm } from "@/components/template-form";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TemplatesMarketplaceProps {
  initialTemplates: TemplateItem[];
  total: number;
  fetchError: string | null;
}

type ModalState =
  | { type: "none" }
  | { type: "detail"; template: TeamTemplate }
  | { type: "create" }
  | { type: "edit"; template: TeamTemplate };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DOMAIN_LABELS: Record<TaskDomain, string> = {
  coding: "برمجة",
  research: "بحث",
  content: "محتوى",
  data: "بيانات",
  operations: "عمليات",
};

/** Convert a lightweight TemplateItem (from SSR list) into a full TeamTemplate shape.
 *  Roles are not included in the list endpoint — they show as empty until a detail fetch.
 *  For the marketplace we treat TemplateItem as a valid TeamTemplate with empty roles.
 */
function itemToTemplate(item: TemplateItem): TeamTemplate {
  return {
    id: item.id,
    name: item.name,
    version: item.version,
    description: item.description ?? "",
    domains: item.domains,
    roles: (item as unknown as TeamTemplate).roles ?? [],
  };
}

function filterTemplates(
  templates: TemplateItem[],
  state: TemplateFilterState
): TemplateItem[] {
  let result = [...templates];

  // Text search (name, description, id)
  const q = state.query.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
    );
  }

  // Domain filter
  if (state.domains.length > 0) {
    result = result.filter((t) =>
      t.domains.some((d) => state.domains.includes(d))
    );
  }

  // Sort
  result.sort((a, b) => {
    if (state.sort === "name") return a.name.localeCompare(b.name, "ar");
    if (state.sort === "version") return a.version.localeCompare(b.version);
    if (state.sort === "domain") {
      const da = a.domains[0] ?? "";
      const db = b.domains[0] ?? "";
      return da.localeCompare(db);
    }
    return 0;
  });

  return result;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DomainPills({ domains }: { domains: TaskDomain[] }) {
  if (domains.length === 0) return null;
  return (
    <div className="marketplace-card__domains">
      {domains.map((d) => (
        <span key={d} className={`pill pill-${d}`}>
          {DOMAIN_LABELS[d] ?? d}
        </span>
      ))}
    </div>
  );
}

interface TemplateCardProps {
  template: TemplateItem;
  animationDelay: number;
  onViewDetail: (template: TeamTemplate) => void;
  onEdit: (template: TeamTemplate) => void;
}

function TemplateCard({
  template,
  animationDelay,
  onViewDetail,
  onEdit,
}: TemplateCardProps) {
  const full = itemToTemplate(template);

  return (
    <article
      className="template-card marketplace-card"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Top: name + version */}
      <div className="marketplace-card__top">
        <div className="marketplace-card__name-row">
          <span className="template-card-name">{template.name}</span>
          <span className="template-card-version">v{template.version}</span>
        </div>
      </div>

      {/* Domain pills */}
      <DomainPills domains={template.domains} />

      {/* Description */}
      {template.description && (
        <p className="template-card-desc">{template.description}</p>
      )}

      {/* Role count indicator */}
      {(full.roles.length > 0) && (
        <div className="marketplace-card__roles-indicator">
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          {full.roles.length} أدوار
        </div>
      )}

      {/* Footer */}
      <div className="template-card-meta marketplace-card__footer">
        <span className="marketplace-card__id-badge">{template.id}</span>
        <div className="marketplace-card__actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onEdit(full)}
            aria-label={`تعديل القالب ${template.name}`}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M11 2l3 3-9 9H2v-3l9-9z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            تعديل
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm marketplace-card__view-btn"
            onClick={() => onViewDetail(full)}
            aria-label={`عرض تفاصيل القالب ${template.name}`}
          >
            عرض التفاصيل
          </button>
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Main marketplace component
// ---------------------------------------------------------------------------

export function TemplatesMarketplace({
  initialTemplates,
  total: _total,
  fetchError,
}: TemplatesMarketplaceProps) {
  // Filter/sort state
  const [filterState, setFilterState] = useState<TemplateFilterState>({
    query: "",
    domains: [],
    sort: "name" as SortOption,
  });

  // Local template list (can grow after creates/edits)
  const [templates, setTemplates] = useState<TemplateItem[]>(initialTemplates);

  // Modal state
  const [modal, setModal] = useState<ModalState>({ type: "none" });

  // Filtered & sorted templates
  const filtered = useMemo(
    () => filterTemplates(templates, filterState),
    [templates, filterState]
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const openDetail = useCallback((t: TeamTemplate) => {
    setModal({ type: "detail", template: t });
  }, []);

  const openEdit = useCallback((t: TeamTemplate) => {
    setModal({ type: "edit", template: t });
  }, []);

  const openCreate = useCallback(() => {
    setModal({ type: "create" });
  }, []);

  const closeModal = useCallback(() => {
    setModal({ type: "none" });
  }, []);

  /** Merge a saved template back into the local list. */
  const handleFormSuccess = useCallback((saved: TeamTemplate) => {
    setTemplates((prev) => {
      const exists = prev.some((t) => t.id === saved.id);
      if (exists) {
        return prev.map((t) =>
          t.id === saved.id
            ? {
                id: saved.id,
                name: saved.name,
                version: saved.version,
                description: saved.description,
                domains: saved.domains,
              }
            : t
        );
      }
      return [
        {
          id: saved.id,
          name: saved.name,
          version: saved.version,
          description: saved.description,
          domains: saved.domains,
        },
        ...prev,
      ];
    });
    // Close after a short delay so the success message is visible briefly
    setTimeout(closeModal, 1200);
  }, [closeModal]);

  const handleDetailEdit = useCallback(
    (t: TeamTemplate) => {
      setModal({ type: "edit", template: t });
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div dir="rtl">
      {/* ─── Page header ──────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1>سوق القوالب</h1>
          <p>
            {templates.length > 0
              ? `${templates.length} قالب لتصميم فرق الوكلاء`
              : "لا توجد قوالب متاحة حالياً"}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={openCreate}
          aria-label="إنشاء قالب جديد"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M7 2v10M2 7h10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          إنشاء قالب جديد
        </button>
      </div>

      {/* ─── API fetch error ───────────────────────────────────────── */}
      {fetchError && (
        <div className="empty-state" role="alert">
          <span className="empty-state-icon" aria-hidden="true">
            <svg
              width="36"
              height="36"
              viewBox="0 0 36 36"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="18"
                cy="18"
                r="16"
                stroke="var(--error)"
                strokeWidth="1.5"
                opacity="0.5"
              />
              <path
                d="M18 11v8"
                stroke="var(--error)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="18" cy="24.5" r="1.5" fill="var(--error)" />
            </svg>
          </span>
          <span className="empty-state-title">تعذّر تحميل القوالب</span>
          <span className="empty-state-desc">{fetchError}</span>
        </div>
      )}

      {/* ─── Filter / Search ──────────────────────────────────────── */}
      {!fetchError && (
        <div className="marketplace-header">
          <TemplateFilter
            value={filterState}
            onChange={setFilterState}
            resultCount={filtered.length}
            totalCount={templates.length}
          />
        </div>
      )}

      {/* ─── Template grid ────────────────────────────────────────── */}
      {!fetchError && filtered.length > 0 && (
        <div className="grid marketplace-grid">
          {filtered.map((template, idx) => (
            <TemplateCard
              key={template.id}
              template={template}
              animationDelay={idx * 35}
              onViewDetail={openDetail}
              onEdit={openEdit}
            />
          ))}
        </div>
      )}

      {/* ─── Empty state (no results after filtering) ─────────────── */}
      {!fetchError && templates.length > 0 && filtered.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon" aria-hidden="true">
            <svg
              width="36"
              height="36"
              viewBox="0 0 36 36"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="16"
                cy="16"
                r="11"
                stroke="var(--muted)"
                strokeWidth="1.5"
                opacity="0.4"
              />
              <path
                d="M25 25l7 7"
                stroke="var(--muted)"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity="0.4"
              />
            </svg>
          </span>
          <span className="empty-state-title">لا توجد نتائج مطابقة</span>
          <span className="empty-state-desc">
            جرّب تعديل كلمات البحث أو إزالة بعض الفلاتر.
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginTop: 8 }}
            onClick={() => setFilterState({ query: "", domains: [], sort: "name" })}
          >
            مسح الفلاتر
          </button>
        </div>
      )}

      {/* ─── Empty state (no templates at all) ────────────────────── */}
      {!fetchError && templates.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon" aria-hidden="true">📋</span>
          <span className="empty-state-title">لا توجد قوالب بعد</span>
          <span className="empty-state-desc">
            أنشئ أول قالب لفريق الوكلاء لبدء تنسيق المهام بكفاءة أعلى.
          </span>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 8 }}
            onClick={openCreate}
          >
            إنشاء قالب جديد
          </button>
        </div>
      )}

      {/* ─── Detail Modal ─────────────────────────────────────────── */}
      {modal.type === "detail" && (
        <TemplateDetail
          template={modal.template}
          onClose={closeModal}
          onEdit={handleDetailEdit}
        />
      )}

      {/* ─── Create Modal ─────────────────────────────────────────── */}
      {modal.type === "create" && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="إنشاء قالب جديد"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          dir="rtl"
        >
          <div className="modal-content">
            <div className="modal-content__header">
              <h2 className="modal-content__title">إنشاء قالب جديد</h2>
              <button
                type="button"
                className="modal-content__close"
                onClick={closeModal}
                aria-label="إغلاق"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 3l12 12M15 3L3 15"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div className="modal-content__body">
              <TemplateForm onSuccess={handleFormSuccess} onCancel={closeModal} />
            </div>
          </div>
        </div>
      )}

      {/* ─── Edit Modal ───────────────────────────────────────────── */}
      {modal.type === "edit" && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`تعديل القالب: ${modal.template.name}`}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          dir="rtl"
        >
          <div className="modal-content">
            <div className="modal-content__header">
              <div>
                <h2 className="modal-content__title">تعديل القالب</h2>
                <p className="modal-content__subtitle">{modal.template.name}</p>
              </div>
              <button
                type="button"
                className="modal-content__close"
                onClick={closeModal}
                aria-label="إغلاق"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 3l12 12M15 3L3 15"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div className="modal-content__body">
              <TemplateForm
                template={modal.template}
                onSuccess={handleFormSuccess}
                onCancel={closeModal}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* Card extras */
        .marketplace-card {
          cursor: default;
        }

        .marketplace-card__top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }

        .marketplace-card__name-row {
          display: flex;
          align-items: baseline;
          gap: 8px;
          flex-wrap: wrap;
          min-width: 0;
        }

        .marketplace-card__domains {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }

        .marketplace-card__roles-indicator {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: var(--muted);
        }

        .marketplace-card__footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: auto;
        }

        .marketplace-card__id-badge {
          font-size: 10px;
          color: var(--muted);
          background: rgba(0, 0, 0, 0.2);
          padding: 2px 8px;
          border-radius: var(--radius-sm);
          font-family: monospace;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .marketplace-card__actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .marketplace-card__view-btn {
          color: var(--accent-2);
          border-color: rgba(142, 202, 230, 0.3);
        }

        .marketplace-card__view-btn:hover {
          background: rgba(142, 202, 230, 0.1);
          color: var(--accent-2);
          border-color: rgba(142, 202, 230, 0.45);
        }

        /* Modal shared close button inside header */
        .modal-content__header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 22px 24px 18px;
          border-bottom: 1px solid var(--card-border);
          flex-shrink: 0;
        }

        .modal-content__title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text);
          letter-spacing: -0.3px;
          margin: 0;
        }

        .modal-content__subtitle {
          font-size: 13px;
          color: var(--muted);
          margin: 4px 0 0;
        }

        .modal-content__close {
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

        .modal-content__close:hover {
          background: rgba(239, 68, 68, 0.12);
          color: var(--error);
          border-color: rgba(239, 68, 68, 0.3);
        }

        .modal-content__body {
          padding: 20px 24px 24px;
          overflow-y: auto;
          flex: 1;
        }

        .modal-content__body::-webkit-scrollbar {
          width: 5px;
        }

        .modal-content__body::-webkit-scrollbar-track {
          background: transparent;
        }

        .modal-content__body::-webkit-scrollbar-thumb {
          background: var(--card-border);
          border-radius: var(--radius-full);
        }

        /* Marketplace grid – slightly larger min size than base */
        .marketplace-grid {
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        }
      `}</style>
    </div>
  );
}
