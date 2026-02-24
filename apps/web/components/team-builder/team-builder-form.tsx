'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TemplateSelector } from './template-selector';
import { RoleEditor } from './role-editor';
import { TeamPreview } from './team-preview';
import { Button } from '@/components/common/button';
import { useTeamBuilder } from '@/lib/hooks/use-team-builder';
import { createTeam } from '@/lib/api/teams';
import { useToast } from '@/components/common/toast';
import type { TeamDesign } from '@repo/types';

export function TeamBuilderForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const [step, setStep] = useState<'select' | 'customize' | 'preview'>(
    'select'
  );
  const [loading, setLoading] = useState(false);
  const [userRequest, setUserRequest] = useState('');

  const {
    design,
    updateDesign,
    addRole,
    removeRole,
    updateRole,
  } = useTeamBuilder();

  const handleTemplateSelect = (templateId: string | null) => {
    if (templateId === null) {
      setStep('customize');
    } else {
      updateDesign({ template_id: templateId });
      setStep('preview');
    }
  };

  const handleSaveDraft = async () => {
    setLoading(true);
    try {
      const response = await createTeam({
        custom_design: design as Partial<TeamDesign>,
        user_request: userRequest || 'Custom team',
      });

      showToast('تم حفظ المسودة بنجاح', 'success');
      router.push(`/teams/${response.team_id}`);
    } catch (error) {
      showToast('فشل حفظ المسودة', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      const response = await createTeam({
        custom_design: design as Partial<TeamDesign>,
        user_request: userRequest || 'Custom team',
      });

      showToast('تم إنشاء الفريق بنجاح', 'success');
      router.push(`/runs/new?team_id=${response.team_id}`);
    } catch (error) {
      showToast('فشل إنشاء الفريق', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Request Input */}
      <div className="card">
        <label className="form-label">وصف المهمة (اختياري)</label>
        <textarea
          className="form-textarea"
          placeholder="اكتب وصفاً للمهمة التي تريد من الفريق إنجازها..."
          value={userRequest}
          onChange={(e) => setUserRequest(e.target.value)}
          rows={3}
        />
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2">
        {['اختيار القالب', 'التخصيص', 'المراجعة'].map((label, index) => {
          const stepIndex = ['select', 'customize', 'preview'].indexOf(step);
          const isActive = index === stepIndex;
          const isCompleted = index < stepIndex;

          return (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${
                    isActive
                      ? 'bg-accent text-bg-end'
                      : isCompleted
                        ? 'bg-success text-white'
                        : 'bg-card-border text-muted'
                  }
                `}
              >
                {isCompleted ? '✓' : index + 1}
              </div>
              <span
                className={`text-sm ${isActive ? 'text-accent' : 'text-muted'}`}
              >
                {label}
              </span>
              {index < 2 && <span className="text-muted mx-2">→</span>}
            </div>
          );
        })}
      </div>

      {/* Content based on step */}
      {step === 'select' && (
        <TemplateSelector onSelect={handleTemplateSelect} />
      )}

      {step === 'customize' && (
        <div className="space-y-6">
          <RoleEditor
            roles={design.roles || []}
            onAddRole={addRole}
            onRemoveRole={removeRole}
            onUpdateRole={updateRole}
          />

          <div className="flex items-center justify-between gap-4">
            <Button variant="ghost" onClick={() => setStep('select')}>
              السابق
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={handleSaveDraft}
                loading={loading}
              >
                حفظ كمسودة
              </Button>
              <Button onClick={() => setStep('preview')}>التالي</Button>
            </div>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-6">
          <TeamPreview design={design as TeamDesign} />

          <div className="flex items-center justify-between gap-4">
            <Button variant="ghost" onClick={() => setStep('customize')}>
              السابق
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={handleSaveDraft}
                loading={loading}
              >
                حفظ كمسودة
              </Button>
              <Button onClick={handleApprove} loading={loading}>
                إنشاء الفريق
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
