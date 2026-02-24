// MCP Servers page — Server Component
import { fetchMcpCatalog } from "@/lib/api";
import type { McpCatalogItem } from "@/lib/api";
import { McpTestButton } from "./mcp-test-button";

export const dynamic = "force-dynamic";

const TRANSPORT_LABELS: Record<"stdio" | "http", string> = {
  stdio: "Stdio",
  http: "HTTP"
};

export default async function McpPage() {
  const result = await fetchMcpCatalog();

  const servers: McpCatalogItem[] = result.ok ? result.data.items : [];
  const total = result.ok ? result.data.total : 0;

  return (
    <main>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1>خوادم MCP</h1>
          <p>
            {result.ok && total > 0
              ? `${total} خادم MCP مسجل في الكتالوج`
              : result.ok
                ? "لا توجد خوادم MCP مسجلة"
                : "تعذّر تحميل الكتالوج"}
          </p>
        </div>
      </div>

      {/* API error state */}
      {!result.ok && (
        <div className="empty-state">
          <span className="empty-state-icon">⚠️</span>
          <span className="empty-state-title">تعذّر الاتصال بالخادم</span>
          <span className="empty-state-desc">{result.message}</span>
        </div>
      )}

      {/* MCP server grid */}
      {result.ok && servers.length > 0 && (
        <div className="grid">
          {servers.map((server, idx) => {
            const transportLabel = TRANSPORT_LABELS[server.transport] ?? server.transport;

            return (
              <article
                key={server.id}
                className="mcp-card"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                {/* Name + transport badge */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 8
                  }}
                >
                  <span className="mcp-card-name">{server.name}</span>
                  <span className="mcp-card-transport">{transportLabel}</span>
                </div>

                {/* Description */}
                {server.description && (
                  <p className="small" style={{ lineHeight: 1.55 }}>
                    {server.description}
                  </p>
                )}

                {/* Endpoint */}
                {server.endpoint && (
                  <div className="mcp-card-endpoint">{server.endpoint}</div>
                )}

                {/* Server ID */}
                <span className="small" style={{ opacity: 0.6, fontSize: 11 }}>
                  ID: {server.id}
                </span>

                {/* Footer: test button */}
                <div className="mcp-card-footer">
                  <McpTestButton serverId={server.id} />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {result.ok && servers.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon">🔌</span>
          <span className="empty-state-title">لا توجد خوادم MCP</span>
          <span className="empty-state-desc">
            لم يتم تسجيل أي خوادم MCP في الكتالوج بعد. أضف خوادم MCP من إعدادات النظام.
          </span>
        </div>
      )}
    </main>
  );
}
