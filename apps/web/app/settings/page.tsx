import { SettingsTabs } from '@/components/settings/settings-tabs';

export const metadata = {
  title: 'الإعدادات | Multi-Agent Platform',
  description: 'إدارة MCP والمهارات والإعدادات',
};

export default function SettingsPage() {
  return (
    <main>
      <div className="page-header">
        <div>
          <h1>الإعدادات</h1>
          <p>إدارة MCP، المهارات، والإعدادات العامة</p>
        </div>
      </div>

      <SettingsTabs />
    </main>
  );
}
