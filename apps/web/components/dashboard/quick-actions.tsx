import Link from 'next/link';

const actions = [
  {
    href: '/teams/new',
    icon: '➕',
    title: 'فريق جديد',
    description: 'إنشاء فريق وكلاء جديد',
    color: 'accent',
  },
  {
    href: '/templates',
    icon: '📋',
    title: 'تصفح القوالب',
    description: 'استكشاف قوالب الفرق الجاهزة',
    color: 'accent-2',
  },
  {
    href: '/runs',
    icon: '🚀',
    title: 'التشغيلات',
    description: 'عرض جميع التشغيلات',
    color: 'info',
  },
  {
    href: '/settings',
    icon: '⚙️',
    title: 'الإعدادات',
    description: 'إدارة MCP والمهارات',
    color: 'muted',
  },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="group p-5 border border-card-border bg-card rounded-lg hover:border-accent-2/40 hover:shadow-lg transition-all"
        >
          <div className="flex items-start gap-4">
            <div className="text-3xl">{action.icon}</div>
            <div className="flex-1">
              <div className="font-bold text-text group-hover:text-accent-2 transition-colors">
                {action.title}
              </div>
              <div className="text-sm text-muted mt-1">
                {action.description}
              </div>
            </div>
            <div className="text-muted group-hover:text-accent-2 transition-colors">
              ←
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
