"use client";

/**
 * ArtifactList — Client component that renders the artifact collection for a run.
 *
 * Features:
 *  - MIME-type-based icon
 *  - Human-readable file size
 *  - Localised creation date (ar-SA)
 *  - Direct download link (streams raw bytes from the API)
 *  - Delete button with an inline confirmation step
 *  - Empty state when no artifacts are present
 */

import { useState, useTransition } from "react";
import type { ArtifactMeta } from "@repo/types";
import { deleteArtifact, downloadArtifactUrl } from "../lib/api";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ArtifactListProps {
  runId: string;
  artifacts: ArtifactMeta[];
  /** Called after a successful deletion so the parent can refresh state. */
  onDelete?: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Derive a descriptive icon character and a colour token from a MIME type.
 * Returns a plain text symbol so no icon library is required.
 */
function mimeIcon(mimeType: string): { symbol: string; colorClass: string } {
  if (mimeType.startsWith("image/")) {
    return { symbol: "🖼", colorClass: "artifact-icon--image" };
  }
  if (mimeType.startsWith("video/")) {
    return { symbol: "🎬", colorClass: "artifact-icon--video" };
  }
  if (mimeType.startsWith("audio/")) {
    return { symbol: "🎵", colorClass: "artifact-icon--audio" };
  }
  if (mimeType === "application/pdf") {
    return { symbol: "📄", colorClass: "artifact-icon--pdf" };
  }
  if (
    mimeType === "application/zip" ||
    mimeType === "application/x-tar" ||
    mimeType === "application/gzip" ||
    mimeType === "application/x-7z-compressed"
  ) {
    return { symbol: "🗜", colorClass: "artifact-icon--archive" };
  }
  if (
    mimeType === "text/csv" ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType.includes("spreadsheet")
  ) {
    return { symbol: "📊", colorClass: "artifact-icon--data" };
  }
  if (mimeType.startsWith("text/") || mimeType === "application/json") {
    return { symbol: "📝", colorClass: "artifact-icon--text" };
  }
  if (
    mimeType.includes("javascript") ||
    mimeType.includes("typescript") ||
    mimeType === "application/x-python" ||
    mimeType === "text/x-python"
  ) {
    return { symbol: "💻", colorClass: "artifact-icon--code" };
  }
  return { symbol: "📎", colorClass: "artifact-icon--generic" };
}

// ---------------------------------------------------------------------------
// ArtifactRow — individual row with inline delete confirmation
// ---------------------------------------------------------------------------

interface ArtifactRowProps {
  artifact: ArtifactMeta;
  onDelete: (id: string) => void;
}

function ArtifactRow({ artifact, onDelete }: ArtifactRowProps) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const { symbol, colorClass } = mimeIcon(artifact.mimeType);
  const downloadUrl = downloadArtifactUrl(artifact.id);

  const handleDeleteClick = () => {
    setConfirming(true);
    setError(null);
  };

  const handleCancelConfirm = () => {
    setConfirming(false);
  };

  const handleConfirmDelete = () => {
    startTransition(async () => {
      const result = await deleteArtifact(artifact.id);
      if (!result.ok) {
        setError(result.message);
        setConfirming(false);
        return;
      }
      onDelete(artifact.id);
    });
  };

  return (
    <div className="artifact-row" role="listitem">
      {/* Icon */}
      <span className={`artifact-icon ${colorClass}`} aria-hidden="true">
        {symbol}
      </span>

      {/* Info */}
      <div className="artifact-info">
        <span className="artifact-name" title={artifact.name}>
          {artifact.name}
        </span>
        <span className="artifact-meta">
          <span className="artifact-meta-item artifact-mime" title={artifact.mimeType}>
            {artifact.mimeType}
          </span>
          <span className="artifact-meta-sep" aria-hidden="true">·</span>
          <span className="artifact-meta-item">{humanFileSize(artifact.sizeBytes)}</span>
          <span className="artifact-meta-sep" aria-hidden="true">·</span>
          <span className="artifact-meta-item">{formatDateTime(artifact.createdAt)}</span>
        </span>
        {error && (
          <span className="artifact-error" role="alert">
            {error}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="artifact-actions">
        <a
          href={downloadUrl}
          className="artifact-btn artifact-btn--download"
          download={artifact.name}
          aria-label={`تنزيل ${artifact.name}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M8 2v8m0 0-3-3m3 3 3-3M3 12h10"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          تنزيل
        </a>

        {!confirming ? (
          <button
            type="button"
            className="artifact-btn artifact-btn--delete"
            onClick={handleDeleteClick}
            disabled={isPending}
            aria-label={`حذف ${artifact.name}`}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 4h10M6 4V3h4v1M5 4v8a1 1 0 001 1h4a1 1 0 001-1V4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            حذف
          </button>
        ) : (
          <span className="artifact-confirm">
            <span className="artifact-confirm-label">تأكيد الحذف؟</span>
            <button
              type="button"
              className="artifact-btn artifact-btn--confirm-yes"
              onClick={handleConfirmDelete}
              disabled={isPending}
              aria-label="تأكيد الحذف"
            >
              {isPending ? "جارٍ…" : "نعم"}
            </button>
            <button
              type="button"
              className="artifact-btn artifact-btn--confirm-no"
              onClick={handleCancelConfirm}
              disabled={isPending}
              aria-label="إلغاء الحذف"
            >
              لا
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ArtifactList — exported component
// ---------------------------------------------------------------------------

export function ArtifactList({ artifacts, onDelete }: ArtifactListProps) {
  const [localArtifacts, setLocalArtifacts] = useState<ArtifactMeta[]>(artifacts);

  const handleDelete = (id: string) => {
    setLocalArtifacts((prev) => prev.filter((a) => a.id !== id));
    onDelete?.(id);
  };

  if (localArtifacts.length === 0) {
    return (
      <div className="artifact-empty" role="status" aria-live="polite">
        <span className="artifact-empty-icon" aria-hidden="true">📂</span>
        <span className="artifact-empty-title">لا توجد مصنوعات بعد</span>
        <span className="artifact-empty-desc">
          ستظهر الملفات والتقارير والمخرجات التي ينتجها الفريق هنا.
        </span>

        <style>{artifactStyles}</style>
      </div>
    );
  }

  return (
    <div className="artifact-list" role="list" aria-label="قائمة المصنوعات">
      {localArtifacts.map((artifact) => (
        <ArtifactRow
          key={artifact.id}
          artifact={artifact}
          onDelete={handleDelete}
        />
      ))}

      <style>{artifactStyles}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles — co-located to keep the component self-contained
// ---------------------------------------------------------------------------

const artifactStyles = `
  /* ---- List container ---- */
  .artifact-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* ---- Individual row ---- */
  .artifact-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--card, rgba(255,255,255,0.04));
    border: 1px solid var(--card-border, rgba(255,255,255,0.08));
    border-radius: 12px;
    transition: border-color 160ms ease, background 160ms ease;
  }

  .artifact-row:hover {
    border-color: rgba(255,255,255,0.18);
    background: rgba(255,255,255,0.06);
  }

  /* ---- Icon ---- */
  .artifact-icon {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    font-size: 18px;
    background: rgba(255,255,255,0.05);
  }

  .artifact-icon--image  { background: rgba(142,202,230,0.10); }
  .artifact-icon--video  { background: rgba(168,130,255,0.10); }
  .artifact-icon--audio  { background: rgba(255,183,3,0.10);   }
  .artifact-icon--pdf    { background: rgba(255,71,87,0.10);   }
  .artifact-icon--archive{ background: rgba(255,165,0,0.10);   }
  .artifact-icon--data   { background: rgba(46,213,115,0.10);  }
  .artifact-icon--text   { background: rgba(142,202,230,0.08); }
  .artifact-icon--code   { background: rgba(168,130,255,0.08); }
  .artifact-icon--generic{ background: rgba(255,255,255,0.05); }

  /* ---- Info block ---- */
  .artifact-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
    direction: rtl;
  }

  .artifact-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text, #e8e8e8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .artifact-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .artifact-meta-item {
    font-size: 11px;
    color: var(--muted, rgba(255,255,255,0.45));
  }

  .artifact-mime {
    max-width: 180px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: monospace;
    font-size: 10px;
  }

  .artifact-meta-sep {
    font-size: 10px;
    color: var(--muted, rgba(255,255,255,0.3));
  }

  .artifact-error {
    font-size: 11px;
    color: #ff4757;
    margin-top: 2px;
  }

  /* ---- Action area ---- */
  .artifact-actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .artifact-confirm {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .artifact-confirm-label {
    font-size: 11px;
    color: #ffb703;
    white-space: nowrap;
    direction: rtl;
  }

  /* ---- Buttons ---- */
  .artifact-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 5px 12px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    border: 1px solid transparent;
    transition: background 140ms ease, opacity 140ms ease;
    direction: rtl;
    white-space: nowrap;
  }

  .artifact-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .artifact-btn--download {
    background: rgba(142,202,230,0.10);
    border-color: rgba(142,202,230,0.25);
    color: #8ecae6;
  }
  .artifact-btn--download:hover {
    background: rgba(142,202,230,0.18);
  }

  .artifact-btn--delete {
    background: rgba(255,71,87,0.07);
    border-color: rgba(255,71,87,0.20);
    color: #ff4757;
  }
  .artifact-btn--delete:hover:not(:disabled) {
    background: rgba(255,71,87,0.14);
  }

  .artifact-btn--confirm-yes {
    background: rgba(255,71,87,0.12);
    border-color: rgba(255,71,87,0.30);
    color: #ff4757;
  }
  .artifact-btn--confirm-yes:hover:not(:disabled) {
    background: rgba(255,71,87,0.20);
  }

  .artifact-btn--confirm-no {
    background: rgba(255,255,255,0.06);
    border-color: rgba(255,255,255,0.12);
    color: var(--muted, rgba(255,255,255,0.55));
  }
  .artifact-btn--confirm-no:hover:not(:disabled) {
    background: rgba(255,255,255,0.10);
  }

  /* ---- Empty state ---- */
  .artifact-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 32px 24px;
    border: 1px dashed var(--card-border, rgba(255,255,255,0.10));
    border-radius: 14px;
    text-align: center;
    direction: rtl;
  }

  .artifact-empty-icon {
    font-size: 32px;
    opacity: 0.55;
  }

  .artifact-empty-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text, #e8e8e8);
    opacity: 0.75;
  }

  .artifact-empty-desc {
    font-size: 12px;
    color: var(--muted, rgba(255,255,255,0.40));
    max-width: 300px;
    line-height: 1.5;
  }
`;
