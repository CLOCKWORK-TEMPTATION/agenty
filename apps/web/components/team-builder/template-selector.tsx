'use client';

import { useState, useEffect } from 'react';
import { listTemplates } from '@/lib/api/templates';
import { Loading } from '@/components/common/loading';
import type { TeamTemplate } from '@repo/types';

interface TemplateSelectorProps {
  onSelect: (templateId: string | null) => void;
}

export function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<TeamTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState<string>('all');

  useEffect(() => {
    async function loadTemplates() {
      try {
        const response = await listTemplates();
        setTemplates(response.templates);
      } catch (error) {
        console.error('Failed to load templates:', error);
      } finally {
        setLoading(false);
      }
    }
    loadTemplates();
  }, []);

  if (loading) {
    return <Loading message="جاري تحميل القوالب..." />;
  }

  const filteredTemplates =
    selectedDomain === 'all'
      ? templates
      : templates.filter((t) => t.domains.includes(selectedDomain as any));

  const domains = ['all', ...Array.from(new Set(templates.flatMap((t) => t.domains)))];

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-bold text-text mb-4">اختر نوع الفريق</h3>

        {/* Domain Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          {domains.map((domain) => (
            <button
              key={domain}
              onClick={() => setSelectedDomain(domain)}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${
                  selectedDomain === domain
                    ? 'bg-accent text-bg-end'
                    : 'bg-card-border text-muted hover:bg-card hover:text-text'
                }
              `}
            >
              {getDomainLabel(domain)}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Custom Team Option */}
          <button
            onClick={() => onSelect(null)}
            className="template-card text-right"
          >
            <div className="text-3xl mb-2">🎯</div>
            <div className="template-card-name">فريق مخصص</div>
            <div className="template-card-desc">
              قم ببناء فريق من الصفر بتحديد الأدوار والنماذج والأدوات بنفسك
            </div>
            <div className="mt-4 text-accent text-sm font-medium">
              ابدأ من الصفر →
            </div>
          </button>

          {filteredTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => onSelect(template.id)}
              className="template-card text-right"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="template-card-name">{template.name}</div>
                  <div className="template-card-desc mt-2">
                    {template.description}
                  </div>
                </div>
              </div>
              <div className="template-card-meta mt-4">
                <span className={`pill pill-${template.domains[0] || 'coding'}`}>
                  {getDomainLabel(template.domains[0] || 'coding')}
                </span>
                <span className="text-xs text-muted">
                  {template.roles.length} أدوار
                </span>
              </div>
            </button>
          ))}
        </div>

        {filteredTemplates.length === 0 && selectedDomain !== 'all' && (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">لا توجد قوالب</div>
            <div className="empty-state-desc">
              لا توجد قوالب متاحة لهذا المجال
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getDomainLabel(domain: string): string {
  const labels: Record<string, string> = {
    all: 'الكل',
    coding: 'برمجة',
    research: 'بحث',
    content: 'محتوى',
    data: 'بيانات',
    operations: 'عمليات',
  };
  return labels[domain] || domain;
}
