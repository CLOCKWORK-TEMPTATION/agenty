"use client";

/**
 * Header — Global navigation bar for the multi-agent orchestration platform.
 * Arabic UI labels, dark-theme aware, responsive.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLink {
  href: string;
  label: string;
  labelEn: string;
}

const NAV_LINKS: NavLink[] = [
  { href: "/", label: "لوحة التحكم", labelEn: "Dashboard" },
  { href: "/templates", label: "القوالب", labelEn: "Templates" },
  { href: "/mcp", label: "MCP", labelEn: "MCP" },
];

export function Header() {
  const pathname = usePathname();

  const isActive = (href: string): boolean => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <header className="site-header">
      <div className="site-header__inner">
        {/* Brand */}
        <Link href="/" className="site-header__brand" aria-label="الصفحة الرئيسية">
          <span className="site-header__logo" aria-hidden="true">
            {/* Grid of dots representing a multi-agent network */}
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <circle cx="5" cy="5" r="2.5" fill="var(--accent)" />
              <circle cx="14" cy="5" r="2.5" fill="var(--accent-2)" />
              <circle cx="23" cy="5" r="2.5" fill="var(--accent)" />
              <circle cx="5" cy="14" r="2.5" fill="var(--accent-2)" />
              <circle cx="14" cy="14" r="3.5" fill="var(--accent)" />
              <circle cx="23" cy="14" r="2.5" fill="var(--accent-2)" />
              <circle cx="5" cy="23" r="2.5" fill="var(--accent)" />
              <circle cx="14" cy="23" r="2.5" fill="var(--accent-2)" />
              <circle cx="23" cy="23" r="2.5" fill="var(--accent)" />
              {/* Connector lines */}
              <line x1="5" y1="5" x2="14" y2="14" stroke="var(--accent)" strokeWidth="0.8" opacity="0.5" />
              <line x1="23" y1="5" x2="14" y2="14" stroke="var(--accent-2)" strokeWidth="0.8" opacity="0.5" />
              <line x1="5" y1="23" x2="14" y2="14" stroke="var(--accent-2)" strokeWidth="0.8" opacity="0.5" />
              <line x1="23" y1="23" x2="14" y2="14" stroke="var(--accent)" strokeWidth="0.8" opacity="0.5" />
            </svg>
          </span>
          <span className="site-header__title">
            منصة فرق وكلاء متعددة النماذج
          </span>
        </Link>

        {/* Primary navigation */}
        <nav className="site-header__nav" aria-label="التنقل الرئيسي">
          <ul className="site-header__nav-list" role="list">
            {NAV_LINKS.map(({ href, label, labelEn }) => (
              <li key={href}>
                <Link
                  href={href}
                  className={[
                    "site-header__nav-link",
                    isActive(href) ? "site-header__nav-link--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-current={isActive(href) ? "page" : undefined}
                >
                  <span className="site-header__nav-label-ar">{label}</span>
                  <span className="site-header__nav-label-en" aria-hidden="true">
                    {labelEn}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Status badge */}
        <div className="site-header__meta">
          <span className="site-header__status-badge" role="status" aria-label="Production Ready">
            <span className="site-header__status-dot" aria-hidden="true" />
            Production Ready
          </span>
        </div>
      </div>

      <style>{`
        .site-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(13, 27, 42, 0.85);
          border-bottom: 1px solid var(--card-border);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .site-header__inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
          height: 60px;
          display: flex;
          align-items: center;
          gap: 24px;
        }

        /* Brand */
        .site-header__brand {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          flex-shrink: 0;
        }

        .site-header__logo {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }

        .site-header__title {
          font-size: 14px;
          font-weight: 700;
          color: var(--text);
          line-height: 1.2;
          max-width: 180px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Navigation */
        .site-header__nav {
          flex: 1;
          min-width: 0;
        }

        .site-header__nav-list {
          display: flex;
          align-items: center;
          gap: 4px;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .site-header__nav-link {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 6px 14px;
          border-radius: 8px;
          text-decoration: none;
          transition: background 140ms ease, color 140ms ease;
        }

        .site-header__nav-link:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .site-header__nav-link--active {
          background: rgba(255, 183, 3, 0.12);
        }

        .site-header__nav-link--active .site-header__nav-label-ar,
        .site-header__nav-link--active .site-header__nav-label-en {
          color: var(--accent);
        }

        .site-header__nav-label-ar {
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
          line-height: 1;
          direction: rtl;
        }

        .site-header__nav-label-en {
          font-size: 10px;
          color: var(--muted);
          line-height: 1;
          margin-top: 2px;
        }

        /* Status badge */
        .site-header__meta {
          flex-shrink: 0;
          margin-inline-start: auto;
        }

        .site-header__status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 999px;
          border: 1px solid rgba(46, 213, 115, 0.3);
          background: rgba(46, 213, 115, 0.08);
          font-size: 11px;
          font-weight: 600;
          color: #2ed573;
          white-space: nowrap;
          letter-spacing: 0.02em;
        }

        .site-header__status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #2ed573;
          animation: status-pulse 2s ease-in-out infinite;
          flex-shrink: 0;
        }

        @keyframes status-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(0.85); }
        }

        /* Responsive — hide Arabic label text on small screens to save space */
        @media (max-width: 640px) {
          .site-header__title {
            display: none;
          }

          .site-header__nav-label-ar {
            font-size: 12px;
          }

          .site-header__status-badge {
            padding: 4px 8px;
            font-size: 10px;
          }
        }
      `}</style>
    </header>
  );
}
