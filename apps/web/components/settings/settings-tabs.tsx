'use client';

import { useState } from 'react';
import { MCPServersSettings } from './mcp-servers-settings';
import { SkillsSettings } from './skills-settings';

const tabs = [
  { id: 'mcp', label: 'خوادم MCP', icon: '🔌' },
  { id: 'skills', label: 'المهارات', icon: '⚡' },
  { id: 'models', label: 'النماذج', icon: '🤖' },
  { id: 'security', label: 'الأمان', icon: '🔒' },
];

export function SettingsTabs() {
  const [activeTab, setActiveTab] = useState('mcp');

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center gap-2 border-b border-card-border pb-3 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${
                  activeTab === tab.id
                    ? 'bg-accent text-bg-end'
                    : 'text-muted hover:text-text hover:bg-card'
                }
              `}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'mcp' && <MCPServersSettings />}
        {activeTab === 'skills' && <SkillsSettings />}
        {activeTab === 'models' && <div className="empty-state"><div className="empty-state-title">قريباً</div></div>}
        {activeTab === 'security' && <div className="empty-state"><div className="empty-state-title">قريباً</div></div>}
      </div>
    </div>
  );
}
