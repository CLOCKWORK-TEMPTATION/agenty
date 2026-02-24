'use client';

import type { TeamDesign } from '@repo/types';

interface RoleEditorProps {
  roles: TeamDesign['roles'];
  onAddRole: (role: TeamDesign['roles'][0]) => void;
  onRemoveRole: (index: number) => void;
  onUpdateRole: (index: number, updates: Partial<TeamDesign['roles'][0]>) => void;
}

export function RoleEditor({
  roles,
  onAddRole,
  onRemoveRole,
  onUpdateRole,
}: RoleEditorProps) {
  const handleAddRole = () => {
    onAddRole({
      name: '',
      description: '',
      model_id: '',
      tools: [],
      skills: [],
    });
  };

  return (
    <div className="card">
      <h3 className="text-lg font-bold text-text mb-4">الأدوار</h3>

      <div className="role-editor">
        {roles.map((role: TeamDesign['roles'][0], index: number) => (
          <div key={index} className="role-editor__item">
            <div className="role-editor__item-header">
              <span className="role-editor__item-num">دور #{index + 1}</span>
              <button
                onClick={() => onRemoveRole(index)}
                disabled={roles.length <= 2}
                className="role-editor__remove-btn"
              >
                حذف
              </button>
            </div>

            <div className="role-editor__fields">
              <div className="form-group">
                <label className="form-label">اسم الدور</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="مثال: كاتب كود"
                  value={role.name}
                  onChange={(e) =>
                    onUpdateRole(index, { name: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">النموذج</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="مثال: gpt-4"
                  value={role.model_id}
                  onChange={(e) =>
                    onUpdateRole(index, { model_id: e.target.value })
                  }
                />
              </div>

              <div className="form-group template-form__field--full">
                <label className="form-label">الوصف</label>
                <textarea
                  className="form-textarea"
                  placeholder="صف مهام ومسؤوليات هذا الدور..."
                  value={role.description}
                  onChange={(e) =>
                    onUpdateRole(index, { description: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="form-group template-form__field--full">
                <label className="form-label">الأدوات (مفصولة بفواصل)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="مثال: file_system, web_search"
                  value={role.tools.join(', ')}
                  onChange={(e) =>
                    onUpdateRole(index, {
                      tools: e.target.value
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>

              <div className="form-group template-form__field--full">
                <label className="form-label">المهارات (مفصولة بفواصل)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="مثال: code_review, testing"
                  value={role.skills.join(', ')}
                  onChange={(e) =>
                    onUpdateRole(index, {
                      skills: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={handleAddRole}
          className="role-editor__add-btn"
        >
          ➕ إضافة دور جديد
        </button>
      </div>

      {roles.length < 2 && (
        <div className="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning">
          يجب أن يحتوي الفريق على دورين على الأقل
        </div>
      )}
    </div>
  );
}
