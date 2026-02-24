'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardBody } from '@/components/common/card';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

export interface RunStatisticsItem {
  id: string;
  name: string;
  status: 'draft' | 'running' | 'waiting_approval' | 'completed' | 'failed';
  teamName: string;
  duration: string;
  startedAt: string;
  stepsCompleted: number;
  totalSteps: number;
  modelUsed?: string;
}

interface RunStatisticsProps {
  runs?: RunStatisticsItem[];
  onRefresh?: () => void;
  onFilterChange?: (filter: string) => void;
}

const defaultRuns: RunStatisticsItem[] = [
  {
    id: 'run-12345',
    name: 'Research Task Alpha',
    status: 'completed',
    teamName: 'Research Team A',
    duration: '2m 34s',
    startedAt: '2024-01-15 14:30',
    stepsCompleted: 8,
    totalSteps: 8,
    modelUsed: 'GPT-4',
  },
  {
    id: 'run-12344',
    name: 'Code Generation Beta',
    status: 'running',
    teamName: 'Dev Team B',
    duration: '1m 12s',
    startedAt: '2024-01-15 14:28',
    stepsCompleted: 3,
    totalSteps: 6,
    modelUsed: 'Claude 3',
  },
  {
    id: 'run-12343',
    name: 'Content Creation Gamma',
    status: 'completed',
    teamName: 'Content Team C',
    duration: '4m 56s',
    startedAt: '2024-01-15 14:20',
    stepsCompleted: 5,
    totalSteps: 5,
    modelUsed: 'Gemini Pro',
  },
  {
    id: 'run-12342',
    name: 'Data Analysis Delta',
    status: 'failed',
    teamName: 'Data Team D',
    duration: '3m 21s',
    startedAt: '2024-01-15 14:15',
    stepsCompleted: 2,
    totalSteps: 7,
    modelUsed: 'Llama 3',
  },
  {
    id: 'run-12341',
    name: 'Integration Test Epsilon',
    status: 'waiting_approval',
    teamName: 'QA Team E',
    duration: '0m 45s',
    startedAt: '2024-01-15 14:10',
    stepsCompleted: 1,
    totalSteps: 4,
    modelUsed: 'GPT-4',
  },
];

const StatusBadge = ({ status }: { status: RunStatisticsItem['status'] }) => {
  const config = {
    draft: { label: 'مسودة', className: 'bg-gray-500/10 text-gray-400 border-gray-500/30' },
    running: { label: 'قيد التشغيل', className: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
    waiting_approval: { label: 'بانتظار الموافقة', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
    completed: { label: 'مكتمل', className: 'bg-green-500/10 text-green-400 border-green-500/30' },
    failed: { label: 'فاشل', className: 'bg-red-500/10 text-red-400 border-red-500/30' },
  };

  const { label, className } = config[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'running' ? 'animate-pulse' : ''} ${
        status === 'completed' ? 'bg-green-400' :
        status === 'running' ? 'bg-blue-400' :
        status === 'failed' ? 'bg-red-400' :
        status === 'waiting_approval' ? 'bg-yellow-400' :
        'bg-gray-400'
      }`} />
      {label}
    </span>
  );
};

const StatusIcon = ({ status }: { status: RunStatisticsItem['status'] }) => {
  const colors = {
    draft: 'bg-gray-400',
    running: 'bg-blue-400 animate-pulse',
    waiting_approval: 'bg-yellow-400 animate-pulse',
    completed: 'bg-green-400',
    failed: 'bg-red-400',
  };

  return (
    <div className={`w-2 h-2 rounded-full ${colors[status]}`} />
  );
};

const ProgressBar = ({ completed, total }: { completed: number; total: number }) => {
  const percentage = total > 0 ? (completed / total) * 100 : 0;
  return (
    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
      <div
        className="h-full bg-blue-500 rounded-full transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

const RunRow = ({ run }: { run: RunStatisticsItem }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-gray-700 last:border-0">
      <div
        className="py-4 px-4 hover:bg-gray-700/50 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <StatusIcon status={run.status} />
            <div>
              <p className="font-medium text-white">{run.name}</p>
              <p className="text-sm text-gray-400">{run.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right hidden md:block">
              <p className="text-sm text-gray-300">{run.teamName}</p>
              <p className="text-xs text-gray-500">{run.modelUsed}</p>
            </div>
            <div className="text-right hidden sm:block">
              <StatusBadge status={run.status} />
            </div>
            <div className="text-right w-20">
              <p className="text-sm text-gray-300">{run.duration}</p>
            </div>
            <div className="w-6">
              {expanded ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </div>
          </div>
        </div>
        <div className="mt-2">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Steps: {run.stepsCompleted}/{run.totalSteps}</span>
            <ProgressBar completed={run.stepsCompleted} total={run.totalSteps} />
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 bg-gray-700/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Started At</p>
              <p className="text-sm text-white">{run.startedAt}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Duration</p>
              <p className="text-sm text-white">{run.duration}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Model</p>
              <p className="text-sm text-white">{run.modelUsed || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Team</p>
              <p className="text-sm text-white">{run.teamName}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const RunStatistics = ({ 
  runs = defaultRuns,
  onRefresh,
  onFilterChange,
}: RunStatisticsProps) => {
  const [filter, setFilter] = useState<string>('all');

  const filteredRuns = runs.filter(run => {
    if (filter === 'all') return true;
    return run.status === filter;
  });

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    onFilterChange?.(newFilter);
  };

  const filterOptions = [
    { value: 'all', label: 'الكل', count: runs.length },
    { value: 'running', label: 'قيد التشغيل', count: runs.filter(r => r.status === 'running').length },
    { value: 'waiting_approval', label: 'بانتظار الموافقة', count: runs.filter(r => r.status === 'waiting_approval').length },
    { value: 'completed', label: 'مكتمل', count: runs.filter(r => r.status === 'completed').length },
    { value: 'failed', label: 'فاشل', count: runs.filter(r => r.status === 'failed').length },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">إحصائيات التشغيل</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleFilterChange(option.value)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                filter === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {option.label}
              <span className="ml-1.5 text-xs opacity-70">({option.count})</span>
            </button>
          ))}
        </div>

        {/* Run list */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          {filteredRuns.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>لا توجد تشغيلات مطابقة للفلتر المحدد</p>
            </div>
          ) : (
            filteredRuns.map((run) => (
              <RunRow key={run.id} run={run} />
            ))
          )}
        </div>

        {/* Summary footer */}
        <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
          <p>عرض {filteredRuns.length} من {runs.length} تشغيل</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              نجاح: {runs.filter(r => r.status === 'completed').length}
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              فشل: {runs.filter(r => r.status === 'failed').length}
            </span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default RunStatistics;
