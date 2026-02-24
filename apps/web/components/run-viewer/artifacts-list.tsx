import Link from 'next/link';

interface Artifact {
  id: string;
  type: string;
  name: string;
  url: string;
  size?: number;
}

interface ArtifactsListProps {
  artifacts: Artifact[];
}

export function ArtifactsList({ artifacts }: ArtifactsListProps) {
  if (artifacts.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📦</div>
        <div className="empty-state-title">لا توجد ملفات منتجة</div>
        <div className="empty-state-desc">
          سيتم عرض الملفات المنتجة هنا عند اكتمال التشغيل
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {artifacts.map((artifact) => (
        <div
          key={artifact.id}
          className="flex items-center justify-between p-4 border border-card-border bg-card/50 rounded-lg hover:border-accent-2/30 transition-colors"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="text-2xl">{getArtifactIcon(artifact.type)}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-text truncate">
                {artifact.name}
              </div>
              <div className="text-xs text-muted mt-1">
                {artifact.type}
                {artifact.size && ` • ${formatBytes(artifact.size)}`}
              </div>
            </div>
          </div>
          <Link
            href={artifact.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
          >
            تنزيل
          </Link>
        </div>
      ))}
    </div>
  );
}

function getArtifactIcon(type: string): string {
  const icons: Record<string, string> = {
    code: '💻',
    document: '📄',
    image: '🖼️',
    data: '📊',
    archive: '📦',
  };
  return icons[type] || '📎';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round(bytes / Math.pow(k, i))} ${sizes[i]}`;
}
