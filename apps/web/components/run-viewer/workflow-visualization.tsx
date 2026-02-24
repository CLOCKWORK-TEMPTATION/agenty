'use client';

const workflowSteps = [
  { id: 'intake', label: 'استقبال الطلب', icon: '📥' },
  { id: 'profile', label: 'تحليل السياق', icon: '🔍' },
  { id: 'template_select', label: 'اختيار القالب', icon: '📋' },
  { id: 'team_design', label: 'تصميم الفريق', icon: '👥' },
  { id: 'model_route', label: 'توزيع النماذج', icon: '🤖' },
  { id: 'tools_allocate', label: 'تخصيص الأدوات', icon: '🔧' },
  { id: 'skills_load', label: 'تحميل المهارات', icon: '⚡' },
  { id: 'approval_gate', label: 'بوابة الموافقة', icon: '✓' },
  { id: 'planner', label: 'التخطيط', icon: '📝' },
  { id: 'specialists_parallel', label: 'المتخصصون', icon: '👨‍💼' },
  { id: 'tool_executor', label: 'تنفيذ الأدوات', icon: '⚙️' },
  { id: 'aggregate', label: 'التجميع', icon: '🔄' },
  { id: 'verifier', label: 'التحقق', icon: '✔️' },
  { id: 'human_feedback', label: 'المراجعة البشرية', icon: '👤' },
  { id: 'finalizer', label: 'الإنهاء', icon: '🎯' },
];

interface WorkflowVisualizationProps {
  currentStep?: string;
  completedSteps?: string[];
}

export function WorkflowVisualization({
  currentStep,
  completedSteps = [],
}: WorkflowVisualizationProps) {
  return (
    <div className="workflow-graph">
      {workflowSteps.map((step, index) => {
        const isActive = currentStep === step.id;
        const isCompleted = completedSteps.includes(step.id);
        const status = isActive
          ? 'active'
          : isCompleted
            ? 'completed'
            : 'pending';

        return (
          <div key={step.id}>
            <div className={`workflow-node workflow-node-${status}`}>
              <div className="workflow-node-icon">{step.icon}</div>
              <div className="flex-1">{step.label}</div>
              {isCompleted && <span className="text-success">✓</span>}
            </div>
            {index < workflowSteps.length - 1 && (
              <div className="workflow-edge" />
            )}
          </div>
        );
      })}
    </div>
  );
}
