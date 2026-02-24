'use client';

import React, { useState, useCallback } from 'react';
import { 
  GripVertical, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X
} from 'lucide-react';

export interface Role {
  id: string;
  name: string;
  description: string;
  responsibilities: string[];
  model?: string;
  tools: string[];
  skills: string[];
  color?: string;
}

interface RoleEditorProps {
  roles?: Role[];
  onRolesChange?: (roles: Role[]) => void;
  availableModels?: string[];
  availableTools?: string[];
  availableSkills?: string[];
}

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

const availableModels = ['GPT-4', 'Claude 3', 'Gemini Pro', 'Llama 3'];
const availableTools = ['github', 'slack', 'jira', 'vscode', 'playwright', 'figma', 'notion'];
const availableSkills = [
  'orchestrator-core',
  'code-generation',
  'code-review',
  'test-generation',
  'debugging',
  'content-writing',
  'content-optimization',
  'inter-agent-communication',
];

const RoleEditor = ({
  roles: initialRoles = defaultRoles,
  onRolesChange,
}: RoleEditorProps) => {
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [newResponsibility, setNewResponsibility] = useState('');

  const updateRoles = useCallback((newRoles: Role[]) => {
    setRoles(newRoles);
    onRolesChange?.(newRoles);
  }, [onRolesChange]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newRoles = [...roles];
    const draggedRole = newRoles[draggedIndex];
    newRoles.splice(draggedIndex, 1);
    newRoles.splice(index, 0, draggedRole);
    
    setDraggedIndex(index);
    updateRoles(newRoles);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const addRole = () => {
    const newRole: Role = {
      id: `role-${Date.now()}`,
      name: 'New Role',
      description: 'Role description',
      responsibilities: [],
      model: availableModels[0],
      tools: [],
      skills: [],
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
    };
    updateRoles([...roles, newRole]);
    setEditingRole(newRole.id);
  };

  const removeRole = (id: string) => {
    updateRoles(roles.filter(r => r.id !== id));
  };

  const updateRole = (id: string, updates: Partial<Role>) => {
    updateRoles(roles.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const addResponsibility = (roleId: string) => {
    if (!newResponsibility.trim()) return;
    const role = roles.find(r => r.id === roleId);
    if (role) {
      updateRole(roleId, {
        responsibilities: [...(role.responsibilities || []), newResponsibility.trim()],
      });
      setNewResponsibility('');
    }
  };

  const removeResponsibility = (roleId: string, index: number) => {
    const role = roles.find(r => r.id === roleId);
    if (role) {
      updateRole(roleId, {
        responsibilities: role.responsibilities.filter((_, i) => i !== index),
      });
    }
  };

  const toggleTool = (roleId: string, tool: string) => {
    const role = roles.find(r => r.id === roleId);
    if (role) {
      const tools = role.tools.includes(tool)
        ? role.tools.filter(t => t !== tool)
        : [...role.tools, tool];
      updateRole(roleId, { tools });
    }
  };

  const toggleSkill = (roleId: string, skill: string) => {
    const role = roles.find(r => r.id === roleId);
    if (role) {
      const skills = role.skills.includes(skill)
        ? role.skills.filter(s => s !== skill)
        : [...role.skills, skill];
      updateRole(roleId, { skills });
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-white">محرر الأدوار</h2>
          <p className="text-sm text-gray-400">اسحب وأسقط لإعادة ترتيب الأدوار</p>
        </div>
        <button
          onClick={addRole}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          إضافة دور
        </button>
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {roles.map((role, index) => (
          <div
            key={role.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`border rounded-lg transition-all ${
              draggedIndex === index
                ? 'opacity-50 border-blue-500'
                : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            {/* Role Header */}
            <div
              className="flex items-center gap-3 p-3 cursor-pointer"
              onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
            >
              <div className="cursor-move text-gray-500 hover:text-gray-300">
                <GripVertical className="w-5 h-5" />
              </div>
              
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: role.color }}
              />
              
              {editingRole === role.id ? (
                <input
                  type="text"
                  value={role.name}
                  onChange={(e) => updateRole(role.id, { name: e.target.value })}
                  className="flex-1 bg-gray-700 text-white px-2 py-1 rounded text-sm"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="flex-1 font-medium text-white">{role.name}</span>
              )}
              
              <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">
                {role.model}
              </span>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingRole(editingRole === role.id ? null : role.id);
                  }}
                  className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded transition-colors"
                >
                  {editingRole === role.id ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Edit2 className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRole(role.id);
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Expanded Content */}
            {expandedRole === role.id && (
              <div className="px-3 pb-3 border-t border-gray-700">
                {/* Description */}
                <div className="mt-3">
                  <label className="text-xs text-gray-500 block mb-1">الوصف</label>
                  <input
                    type="text"
                    value={role.description}
                    onChange={(e) => updateRole(role.id, { description: e.target.value })}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
                  />
                </div>

                {/* Model Selection */}
                <div className="mt-3">
                  <label className="text-xs text-gray-500 block mb-1">النموذج</label>
                  <select
                    value={role.model}
                    onChange={(e) => updateRole(role.id, { model: e.target.value })}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
                  >
                    {availableModels.map((model) => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>

                {/* Responsibilities */}
                <div className="mt-3">
                  <label className="text-xs text-gray-500 block mb-1">المسؤوليات</label>
                  <div className="space-y-1">
                    {role.responsibilities.map((resp, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="flex-1 text-sm text-gray-300 bg-gray-700 px-2 py-1 rounded">
                          {resp}
                        </span>
                        <button
                          onClick={() => removeResponsibility(role.id, i)}
                          className="text-gray-400 hover:text-red-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newResponsibility}
                        onChange={(e) => setNewResponsibility(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addResponsibility(role.id)}
                        placeholder="إضافة مسؤولية..."
                        className="flex-1 bg-gray-700 text-white px-2 py-1 rounded text-sm"
                      />
                      <button
                        onClick={() => addResponsibility(role.id)}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tools */}
                <div className="mt-3">
                  <label className="text-xs text-gray-500 block mb-1">الأدوات</label>
                  <div className="flex flex-wrap gap-1">
                    {availableTools.map((tool) => (
                      <button
                        key={tool}
                        onClick={() => toggleTool(role.id, tool)}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          role.tools.includes(tool)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}
                      >
                        {tool}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Skills */}
                <div className="mt-3">
                  <label className="text-xs text-gray-500 block mb-1">المهارات</label>
                  <div className="flex flex-wrap gap-1">
                    {availableSkills.map((skill) => (
                      <button
                        key={skill}
                        onClick={() => toggleSkill(role.id, skill)}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          role.skills.includes(skill)
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Picker */}
                <div className="mt-3">
                  <label className="text-xs text-gray-500 block mb-1">اللون</label>
                  <div className="flex gap-2">
                    {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map((color) => (
                      <button
                        key={color}
                        onClick={() => updateRole(role.id, { color })}
                        className={`w-6 h-6 rounded-full transition-transform ${
                          role.color === color ? 'scale-125 ring-2 ring-white' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RoleEditor;
