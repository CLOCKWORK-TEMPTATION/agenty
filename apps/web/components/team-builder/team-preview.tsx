import type { TeamDesign } from '@repo/types';

interface TeamPreviewProps {
  design: TeamDesign;
}

export function TeamPreview({ design }: TeamPreviewProps) {
  const totalTools = design.roles.reduce(
    (sum: number, role: TeamDesign['roles'][0]) => sum + role.tools.length,
    0
  );
  const totalSkills = design.roles.reduce(
    (sum: number, role: TeamDesign['roles'][0]) => sum + role.skills.length,
    0
  );

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-bold text-text mb-4">معاينة الفريق</h3>

        {/* Team Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 bg-card/50 rounded-lg border border-card-border">
            <div className="text-2xl font-bold text-accent">
              {design.roles.length}
            </div>
            <div className="text-sm text-muted mt-1">أدوار</div>
          </div>
          <div className="text-center p-4 bg-card/50 rounded-lg border border-card-border">
            <div className="text-2xl font-bold text-accent-2">
              {totalTools}
            </div>
            <div className="text-sm text-muted mt-1">أدوات</div>
          </div>
          <div className="text-center p-4 bg-card/50 rounded-lg border border-card-border">
            <div className="text-2xl font-bold text-info">{totalSkills}</div>
            <div className="text-sm text-muted mt-1">مهارات</div>
          </div>
        </div>

        {/* Roles List */}
        <div className="assignment-list">
          {design.roles.map((role: TeamDesign['roles'][0], index: number) => (
            <div key={index} className="assignment-item">
              <div className="flex-1">
                <div className="assignment-role">{role.name}</div>
                <div className="text-sm text-muted mt-1">
                  {role.description}
                </div>
                <div className="assignment-meta mt-3">
                  <div>
                    <span className="assignment-meta-label">النموذج:</span>
                    <span className="assignment-model ml-2">
                      {role.model_id}
                    </span>
                  </div>
                  {role.tools.length > 0 && (
                    <div>
                      <span className="assignment-meta-label">الأدوات:</span>
                      <span className="text-xs text-accent-2 ml-2">
                        {role.tools.join(', ')}
                      </span>
                    </div>
                  )}
                  {role.skills.length > 0 && (
                    <div>
                      <span className="assignment-meta-label">المهارات:</span>
                      <span className="text-xs text-info ml-2">
                        {role.skills.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Workflow Info */}
      <div className="card">
        <h3 className="text-lg font-bold text-text mb-4">سير العمل</h3>
        <div className="text-sm text-muted leading-relaxed">
          <p className="mb-3">
            سيتم تنفيذ هذا الفريق وفقاً لـ LangGraph workflow المحدد:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-xs">
            <li>استقبال الطلب وتحليل السياق</li>
            <li>تخصيص النماذج والأدوات للأدوار</li>
            <li>بوابة الموافقة (إذا لزم الأمر)</li>
            <li>التخطيط وتوزيع المهام</li>
            <li>تنفيذ متوازي من قبل المتخصصين</li>
            <li>تجميع والتحقق من النتائج</li>
            <li>المراجعة البشرية (إذا لزم الأمر)</li>
            <li>الإنهاء وإنتاج الملفات</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
