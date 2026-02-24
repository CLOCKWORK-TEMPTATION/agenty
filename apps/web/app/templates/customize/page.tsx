'use client';

import React, { useState, useCallback } from 'react';
import { RoleEditor, YamlPreview } from './components';
import type { Role } from './components/RoleEditor';
import { Save, ArrowLeft, RotateCcw, Upload } from 'lucide-react';
import Link from 'next/link';

const defaultRoles: Role[] = [
  {
    id: '1',
    name: 'Project Manager',
    description: 'Manages project timeline and coordinates team',
    responsibilities: ['Triage and assign tasks', 'Manage project timeline', 'Communicate with stakeholders'],
    model: 'GPT-4',
    tools: ['slack', 'jira'],
    skills: ['orchestrator-core', 'inter-agent-communication'],
    color: '#3b82f6',
  },
  {
    id: '2',
    name: 'Lead Developer',
    description: 'Architects solution and reviews code',
    responsibilities: ['Architect the solution', 'Review pull requests', 'Mentor junior developers'],
    model: 'Claude 3',
    tools: ['github', 'vscode'],
    skills: ['code-generation', 'code-review', 'debugging'],
    color: '#10b981',
  },
  {
    id: '3',
    name: 'QA Engineer',
    description: 'Ensures quality through testing',
    responsibilities: ['Write and execute test plans', 'Report and track bugs', 'Automate tests'],
    model: 'GPT-4',
    tools: ['playwright', 'github'],
    skills: ['test-generation', 'debugging'],
    color: '#f59e0b',
  },
  {
    id: '4',
    name: 'UX Designer',
    description: 'Designs user experience and interfaces',
    responsibilities: ['Create wireframes and mockups', 'Conduct user research', 'Design prototypes'],
    model: 'Gemini Pro',
    tools: ['figma'],
    skills: ['content-writing', 'content-optimization'],
    color: '#ef4444',
  },
];

const CustomizeTemplatePage = () => {
  const [roles, setRoles] = useState<Role[]>(defaultRoles);
  const [templateName, setTemplateName] = useState('My Custom Template');
  const [templateDescription, setTemplateDescription] = useState('Custom agent team configuration');
  const [version, setVersion] = useState('1.0');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleRolesChange = useCallback((newRoles: Role[]) => {
    setRoles(newRoles);
  }, []);

  const handleReset = () => {
    if (confirm('هل أنت متأكد من إعادة تعيين جميع الأدوار؟')) {
      setRoles(defaultRoles);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsSaving(false);
    setSaveMessage('تم حفظ القالب بنجاح!');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const _content = event.target?.result as string;
        // Simple YAML parsing - in production, use a proper YAML parser
        console.log('Imported content length:', _content.length);
        alert('استيراد YAML سيتم تنفيذه لاحقاً');
      } catch (error) {
        alert('خطأ في قراءة الملف');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/templates"
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">تخصيص القالب</h1>
            <p className="text-gray-400 text-sm">تخصيص فريق الوكلاء وسحب وإسقاط الأدوار</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg cursor-pointer transition-colors">
            <Upload className="w-4 h-4" />
            استيراد YAML
            <input
              type="file"
              accept=".yaml,.yml"
              onChange={handleImport}
              className="hidden"
            />
          </label>
          
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            إعادة تعيين
          </button>
          
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                حفظ القالب
              </>
            )}
          </button>
        </div>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-green-400 text-sm">{saveMessage}</p>
        </div>
      )}

      {/* Template Info */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">اسم القالب</label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">الإصدار</label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">الوصف</label>
            <input
              type="text"
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <RoleEditor
            roles={roles}
            onRolesChange={handleRolesChange}
          />
        </div>
        <div>
          <YamlPreview
            roles={roles}
            templateName={templateName}
            templateDescription={templateDescription}
            version={version}
          />
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <h3 className="text-sm font-medium text-white mb-2">نصائح:</h3>
        <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
          <li>اسحب وأسقط الأدوار لإعادة ترتيبها</li>
          <li>اضغط على الدور لتوسيعه وتحرير التفاصيل</li>
          <li>سيظهر YAML المحدث تلقائياً عند تغيير الأدوار</li>
          <li>يمكنك تحميل القالب كملف YAML لاستخدامه لاحقاً</li>
        </ul>
      </div>
    </div>
  );
};

export default CustomizeTemplatePage;
