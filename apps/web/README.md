# Multi-Agent Platform - Web Dashboard

Web UI Dashboard للمنصة متعددة الوكلاء.

## الميزات

### الصفحات الرئيسية
- **Dashboard (`/`)**: صفحة رئيسية مع إحصائيات، نشاط حديث، وإجراءات سريعة
- **Team Builder (`/teams/new`)**: بناء فريق جديد من الصفر أو باستخدام قالب
- **Runs (`/runs`)**: قائمة جميع التشغيلات مع فلترة وبحث
- **Run Details (`/runs/[runId]`)**: عرض تفصيلي للتشغيل مع real-time updates
- **Templates (`/templates`)**: Template marketplace
- **Settings (`/settings`)**: إعدادات MCP، المهارات، والنماذج

### المكونات الرئيسية

#### Common Components
- `Navbar`: شريط التنقل العلوي
- `Button`: أزرار قابلة للتخصيص
- `Card`: بطاقات للمحتوى
- `Modal`: نوافذ منبثقة
- `Loading`: مؤشرات التحميل
- `Toast`: إشعارات

#### Dashboard Components
- `StatsCard`: بطاقات الإحصائيات
- `RecentActivity`: النشاط الأخير
- `QuickActions`: إجراءات سريعة

#### Team Builder Components
- `TemplateSelector`: اختيار القوالب
- `RoleEditor`: تحرير الأدوار
- `TeamPreview`: معاينة الفريق

#### Run Viewer Components
- `WorkflowVisualization`: عرض مرئي لسير العمل
- `EventsTimeline`: خط زمني للأحداث
- `ArtifactsList`: قائمة الملفات المنتجة
- `StateInspector`: فحص الحالة

### Features متقدمة
- **Real-time Updates**: SSE للتحديثات اللحظية
- **Dark Mode**: دعم كامل للثيم الداكن
- **Responsive Design**: دعم كامل للموبايل والتابلت
- **RTL Support**: دعم كامل للعربية من اليمين لليسار
- **Type Safety**: TypeScript strict mode
- **Error Handling**: معالجة شاملة للأخطاء

## البنية

```
apps/web/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Dashboard home
│   ├── teams/new/         # Team builder
│   ├── runs/              # Runs list & details
│   ├── templates/         # Templates marketplace
│   └── settings/          # Settings
├── components/            # React components
│   ├── common/           # Shared components
│   ├── dashboard/        # Dashboard components
│   ├── team-builder/     # Team builder components
│   ├── run-viewer/       # Run viewer components
│   ├── runs/             # Runs components
│   └── settings/         # Settings components
├── contexts/             # React contexts
│   └── theme-context.tsx # Theme context
├── lib/                  # Utilities & API
│   ├── api/             # API clients
│   ├── hooks/           # Custom hooks
│   └── utils.ts         # Utility functions
└── globals.css          # Global styles

## التثبيت

```bash
pnpm install
```

## التشغيل

```bash
# Development
pnpm run dev

# Production build
pnpm run build
pnpm run start

# Type checking
pnpm run typecheck

# Linting
pnpm run lint
pnpm run lint --fix
```

## المتغيرات البيئية

أنشئ ملف `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
API_INTERNAL_URL=http://api:4000
```

## التكنولوجيا

- **Next.js 15**: App Router, Server Components
- **React 19**: Latest React features
- **TypeScript**: Strict mode
- **Tailwind CSS**: Utility-first CSS
- **SSE**: Real-time updates
- **clsx + tailwind-merge**: Dynamic class names

## Guidelines

### Code Style
- TypeScript strict mode
- Named exports only
- `kebab-case.tsx` for files
- `PascalCase` for components
- Server Components by default
- Client Components only when needed (`'use client'`)

### Component Structure
```tsx
// Server Component
export function MyComponent() {
  return <div>...</div>;
}

// Client Component
'use client';
export function MyClientComponent() {
  const [state, setState] = useState();
  return <div>...</div>;
}
```

### API Calls
```tsx
// Server Component
async function getData() {
  const data = await apiClient('/api/v1/data');
  return data;
}

// Client Component
const { data } = useSWR('/api/v1/data', fetcher);
```

## Accessibility
- ARIA labels على جميع العناصر التفاعلية
- دعم لوحة المفاتيح
- تباين الألوان WCAG AA

## Performance
- Server Components للصفحات الثابتة
- Lazy loading للمكونات الثقيلة
- Code splitting تلقائي
- Image optimization مع next/image

## الترجمة
- واجهة عربية primary
- دعم إنجليزي
- RTL support
