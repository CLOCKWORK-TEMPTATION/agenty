'use client';

import React, { useMemo } from 'react';
import { Copy, Download, FileText, Check } from 'lucide-react';
import type { Role } from './RoleEditor';

interface YamlPreviewProps {
  roles?: Role[];
  templateName?: string;
  templateDescription?: string;
  version?: string;
}

const generateYaml = (
  roles: Role[],
  templateName: string,
  templateDescription: string,
  version: string
): string => {
  const yamlLines: string[] = [
    `# Template: ${templateName}`,
    `# Description: ${templateDescription}`,
    ``,
    `version: '${version}'`,
    ``,
    `team:`
  ];

  roles.forEach((role) => {
    yamlLines.push(`  - role: ${role.name}`);
    yamlLines.push(`    id: ${role.id}`);
    yamlLines.push(`    description: ${role.description}`);
    yamlLines.push(`    color: ${role.color || '#3b82f6'}`);
    yamlLines.push(`    model:`);
    yamlLines.push(`      name: ${role.model || 'GPT-4'}`);
    yamlLines.push(`      provider: auto`);
    yamlLines.push(`    responsibilities:`);
    
    if (role.responsibilities.length === 0) {
      yamlLines.push(`      - TBD`);
    } else {
      role.responsibilities.forEach((resp) => {
        yamlLines.push(`      - ${resp}`);
      });
    }

    yamlLines.push(`    tools:`);
    if (role.tools.length === 0) {
      yamlLines.push(`      - none`);
    } else {
      role.tools.forEach((tool) => {
        yamlLines.push(`      - ${tool}`);
      });
    }

    yamlLines.push(`    skills:`);
    if (role.skills.length === 0) {
      yamlLines.push(`      - orchestrator-core`);
    } else {
      role.skills.forEach((skill) => {
        yamlLines.push(`      - ${skill}`);
      });
    }

    yamlLines.push(`    policy:`);
    yamlLines.push(`      approval_required: auto`);
    yamlLines.push(`      max_iterations: 2`);
    yamlLines.push(`      timeout: 300`);
    yamlLines.push(`    `);
  });

  yamlLines.push(`workflow:`);
  yamlLines.push(`  execution_mode: parallel`);
  yamlLines.push(`  checkpoint_interval: 30`);
  yamlLines.push(`  enable_verification: true`);
  yamlLines.push(`  enable_human_feedback: optional`);
  yamlLines.push(`  `);
  yamlLines.push(`metadata:`);
  yamlLines.push(`  created_at: ${new Date().toISOString()}`);
  yamlLines.push(`  updated_at: ${new Date().toISOString()}`);
  yamlLines.push(`  author: user`);
  yamlLines.push(`  tags:`);
  yamlLines.push(`    - custom`);
  yamlLines.push(`    - production`);

  return yamlLines.join('\n');
};

const YamlPreview = ({
  roles,
  templateName = 'Custom Template',
  templateDescription = 'Custom agent team configuration',
  version = '1.0',
}: YamlPreviewProps) => {
  const [copied, setCopied] = React.useState(false);

  const yamlContent = useMemo(() => {
    if (!roles || roles.length === 0) {
      return `# No roles defined yet\n# Use the Role Editor to add roles to your template`;
    }
    return generateYaml(roles, templateName, templateDescription, version);
  }, [roles, templateName, templateDescription, version]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(yamlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateName.toLowerCase().replace(/\s+/g, '-')}.yaml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Simple YAML syntax highlighting
  const highlightedContent = useMemo(() => {
    return yamlContent.split('\n').map((line, index) => {
      // Comments
      if (line.trim().startsWith('#')) {
        return (
          <span key={index} className="text-gray-500">
            {line}
          </span>
        );
      }

      // Keys
      if (line.includes(':')) {
        const parts = line.split(':');
        const key = parts[0] || '';
        const value = parts.slice(1).join(':');
        
        // Check if it's a list item key
        if (line.trim().startsWith('-')) {
          return (
            <span key={index}>
              <span className="text-yellow-400">-</span>
              <span className="text-blue-300">{key.replace('-', '')}</span>
              <span className="text-gray-300">:{value}</span>
            </span>
          );
        }

        return (
          <span key={index}>
            <span className="text-purple-300">{key}</span>
            <span className="text-gray-300">:{value}</span>
          </span>
        );
      }

      // List items
      if (line.trim().startsWith('-')) {
        return (
          <span key={index}>
            <span className="text-yellow-400">-</span>
            <span className="text-gray-300">{line.substring(line.indexOf('-') + 1)}</span>
          </span>
        );
      }

      return <span key={index} className="text-gray-300">{line}</span>;
    });
  }, [yamlContent]);

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">معاينة YAML</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-400" />
                <span className="text-green-400">تم النسخ</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                نسخ
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            تحميل
          </button>
        </div>
      </div>

      {/* YAML Content */}
      <div className="flex-1 bg-gray-900 overflow-auto">
        <pre className="p-4 text-sm font-mono leading-relaxed">
          <code>
            {highlightedContent.map((line, index) => (
              <div key={index} className="whitespace-pre">
                {line}
              </div>
            ))}
          </code>
        </pre>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-700 bg-gray-800">
        <p className="text-xs text-gray-500">
          {roles?.length || 0} أدوار • {yamlContent.split('\n').length} سطر
        </p>
      </div>
    </div>
  );
};

export default YamlPreview;
