"use client";

/**
 * TemplateFilter — Client component for filtering and searching templates.
 * Provides: text search, domain pills, and sort options.
 * All state is lifted to the parent via callbacks (controlled component).
 */

import type { TaskDomain } from "@repo/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SortOption = "name" | "version" | "domain";

export interface TemplateFilterState {
  query: string;
  domains: TaskDomain[];
  sort: SortOption;
}

interface TemplateFilterProps {
  value: TemplateFilterState;
  onChange: (next: TemplateFilterState) => void;
  /** Total number of templates currently shown (after filtering). */
  resultCount: number;
  /** Total number of templates before filtering. */
  totalCount: number;
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

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "name", label: "الاسم" },
  { value: "version", label: "الإصدار" },
  { value: "domain", label: "المجال" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateFilter({
  value,
  onChange,
  resultCount,
  totalCount,
}: TemplateFilterProps) {
  const toggleDomain = (domain: TaskDomain) => {
    const next = value.domains.includes(domain)
      ? value.domains.filter((d) => d !== domain)
      : [...value.domains, domain];
    onChange({ ...value, domains: next });
  };

  const clearAll = () => {
    onChange({ query: "", domains: [], sort: "name" });
  };

  const hasFilters = value.query.trim().length > 0 || value.domains.length > 0;

  return (
    <div className="template-filter" dir="rtl">
      {/* Search + sort row */}
      <div className="template-filter__top">
        <div className="template-filter__search-wrap">
          {/* Search icon */}
          <svg
            className="template-filter__search-icon"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M11 11l3 3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="search"
            className="template-filter__search"
            placeholder="ابحث في القوالب…"
            value={value.query}
            onChange={(e) => onChange({ ...value, query: e.target.value })}
            aria-label="بحث في القوالب"
          />
          {value.query.length > 0 && (
            <button
              type="button"
              className="template-filter__clear-query"
              onClick={() => onChange({ ...value, query: "" })}
              aria-label="مسح البحث"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path
                  d="M2 2l8 8M10 2l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Sort */}
        <div className="template-filter__sort-wrap">
          <span className="template-filter__sort-label">ترتيب:</span>
          <select
            className="template-filter__sort"
            value={value.sort}
            onChange={(e) => onChange({ ...value, sort: e.target.value as SortOption })}
            aria-label="ترتيب القوالب"
          >
            {SORT_OPTIONS.map(({ value: v, label }) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Domain pills row */}
      <div className="template-filter__domains" role="group" aria-label="تصفية حسب المجال">
        <span className="template-filter__domains-label">المجالات:</span>
        <div className="chip-group">
          {ALL_DOMAINS.map(({ value: domain, label, labelEn }) => {
            const active = value.domains.includes(domain);
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
                aria-label={`تصفية: ${label}`}
              >
                <span>{label}</span>
                <span className="chip-group__chip-en">{labelEn}</span>
              </button>
            );
          })}
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <button
            type="button"
            className="template-filter__clear-all"
            onClick={clearAll}
            aria-label="مسح جميع الفلاتر"
          >
            مسح الكل
          </button>
        )}
      </div>

      {/* Result count feedback */}
      <div className="template-filter__count" aria-live="polite" aria-atomic="true">
        {hasFilters ? (
          <>
            <span className="template-filter__count-number">{resultCount}</span>
            {" من "}
            <span>{totalCount}</span>
            {" نتيجة"}
          </>
        ) : (
          <>
            <span className="template-filter__count-number">{totalCount}</span>
            {" قالب متاح"}
          </>
        )}
      </div>

      <style>{`
        .template-filter {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        /* Top row */
        .template-filter__top {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        /* Search */
        .template-filter__search-wrap {
          position: relative;
          flex: 1;
          min-width: 200px;
        }

        .template-filter__search-icon {
          position: absolute;
          inset-inline-end: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--muted);
          pointer-events: none;
        }

        .template-filter__search {
          width: 100%;
          padding: 9px 40px 9px 36px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--card-border);
          border-radius: var(--radius-md);
          color: var(--text);
          font-size: 13px;
          font-family: inherit;
          outline: none;
          transition: border-color var(--transition), background var(--transition);
          direction: rtl;
        }

        .template-filter__search::placeholder {
          color: var(--muted);
          opacity: 0.65;
        }

        .template-filter__search:focus {
          border-color: var(--accent);
          background: rgba(255, 183, 3, 0.04);
        }

        /* Remove default search cancel button in WebKit */
        .template-filter__search::-webkit-search-cancel-button {
          display: none;
        }

        .template-filter__clear-query {
          position: absolute;
          inset-inline-start: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 2px;
          border-radius: 4px;
          transition: color var(--transition);
        }

        .template-filter__clear-query:hover {
          color: var(--text);
        }

        /* Sort */
        .template-filter__sort-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .template-filter__sort-label {
          font-size: 12px;
          color: var(--muted);
          white-space: nowrap;
        }

        .template-filter__sort {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--card-border);
          border-radius: var(--radius-md);
          color: var(--text);
          font-size: 13px;
          font-family: inherit;
          padding: 7px 32px 7px 12px;
          outline: none;
          appearance: none;
          cursor: pointer;
          direction: rtl;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23a3b7c7' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: left 10px center;
          transition: border-color var(--transition);
        }

        .template-filter__sort:focus {
          border-color: var(--accent);
        }

        .template-filter__sort option {
          background: #1b263b;
          color: var(--text);
        }

        /* Domain filter row */
        .template-filter__domains {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .template-filter__domains-label {
          font-size: 12px;
          color: var(--muted);
          flex-shrink: 0;
        }

        .template-filter__clear-all {
          background: none;
          border: 1px solid var(--card-border);
          color: var(--muted);
          font-size: 11px;
          font-family: inherit;
          padding: 4px 10px;
          border-radius: var(--radius-full);
          cursor: pointer;
          transition: color var(--transition), border-color var(--transition);
          white-space: nowrap;
          margin-inline-start: 4px;
        }

        .template-filter__clear-all:hover {
          color: var(--error);
          border-color: rgba(239, 68, 68, 0.4);
        }

        /* Result count */
        .template-filter__count {
          font-size: 12px;
          color: var(--muted);
          direction: rtl;
        }

        .template-filter__count-number {
          color: var(--accent);
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
