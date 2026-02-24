'use client';

import { useState, useEffect } from 'react';
import { Loading } from '@/components/common/loading';
import { useToast } from '@/components/common/toast';
import { listSkills, toggleSkill } from '@/lib/api/skills';
import type { Skill } from '@/lib/api/skills';

export function SkillsSettings() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const loadSkills = async () => {
    try {
      const response = await listSkills();
      setSkills(response.skills);
    } catch (error) {
      showToast('فشل تحميل المهارات', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  const handleToggle = async (skillId: string, enabled: boolean) => {
    try {
      await toggleSkill(skillId, enabled);
      showToast(enabled ? 'تم التفعيل' : 'تم التعطيل', 'success');
      loadSkills();
    } catch (error) {
      showToast('فشلت العملية', 'error');
    }
  };

  if (loading) return <Loading message="جاري تحميل المهارات..." />;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-text">المهارات المتاحة</h3>

      {skills.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚡</div>
          <div className="empty-state-title">لا توجد مهارات</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {skills.map((skill) => (
            <div key={skill.id} className="p-4 border border-card-border bg-card/50 rounded-lg">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="font-bold text-text">{skill.name}</div>
                  <div className="text-xs text-muted mt-1">{skill.description}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-1 rounded bg-accent-2/20 text-accent-2">{skill.category}</span>
                    <span className="text-xs text-muted">{skill.version}</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skill.enabled}
                    onChange={(e) => handleToggle(skill.id, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-card-border rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-text after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
