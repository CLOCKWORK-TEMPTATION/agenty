'use client';

import React from 'react';
import { Card, CardHeader, CardBody } from '@/components/common/card';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Activity,
  CheckCircle,
  Clock,
  Users,
  Zap,
  BarChart3
} from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    trend: 'up' | 'down' | 'neutral';
  };
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  subtitle?: string;
}

const MetricCard = ({ title, value, change, icon, color, subtitle }: MetricCardProps) => {
  const colorClasses = {
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    green: 'bg-green-500/10 border-green-500/20 text-green-400',
    red: 'bg-red-500/10 border-red-500/20 text-red-400',
    yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
  };

  const TrendIcon = change?.trend === 'up' ? TrendingUp : 
                   change?.trend === 'down' ? TrendingDown : Minus;

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
          {change && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${
              change.trend === 'up' ? 'text-green-400' : 
              change.trend === 'down' ? 'text-red-400' : 'text-gray-400'
            }`}>
              <TrendIcon className="w-4 h-4" />
              <span>{change.value > 0 ? '+' : ''}{change.value}%</span>
              <span className="text-gray-500 text-xs">vs last week</span>
            </div>
          )}
        </div>
        <div className="p-2 bg-gray-800 rounded-lg">
          {icon}
        </div>
      </div>
    </div>
  );
};

interface MetricsData {
  totalRuns: number;
  successRate: number;
  avgRunTime: number;
  activeAgents: number;
  totalTeams: number;
  apiCalls: number;
  changes?: {
    totalRuns?: { value: number; trend: 'up' | 'down' | 'neutral' };
    successRate?: { value: number; trend: 'up' | 'down' | 'neutral' };
    avgRunTime?: { value: number; trend: 'up' | 'down' | 'neutral' };
    activeAgents?: { value: number; trend: 'up' | 'down' | 'neutral' };
    totalTeams?: { value: number; trend: 'up' | 'down' | 'neutral' };
    apiCalls?: { value: number; trend: 'up' | 'down' | 'neutral' };
  };
}

interface MetricsProps {
  data?: MetricsData;
}

const defaultMetrics: MetricsData = {
  totalRuns: 1234,
  successRate: 95.2,
  avgRunTime: 12.5,
  activeAgents: 48,
  totalTeams: 156,
  apiCalls: 8923,
  changes: {
    totalRuns: { value: 12.5, trend: 'up' },
    successRate: { value: 2.1, trend: 'up' },
    avgRunTime: { value: -5.3, trend: 'down' },
    activeAgents: { value: 8, trend: 'up' },
    totalTeams: { value: 5.2, trend: 'up' },
    apiCalls: { value: 15.7, trend: 'up' },
  },
};

const Metrics = ({ data = defaultMetrics }: MetricsProps) => {
  const metrics: MetricCardProps[] = [
    {
      title: 'إجمالي التشغيلات',
      value: data.totalRuns.toLocaleString(),
      change: data.changes?.totalRuns,
      icon: <Activity className="w-5 h-5 text-blue-400" />,
      color: 'blue',
      subtitle: 'آخر 30 يوم',
    },
    {
      title: 'معدل النجاح',
      value: `${data.successRate}%`,
      change: data.changes?.successRate,
      icon: <CheckCircle className="w-5 h-5 text-green-400" />,
      color: 'green',
      subtitle: 'من إجمالي التشغيلات',
    },
    {
      title: 'متوسط وقت التشغيل',
      value: `${data.avgRunTime}s`,
      change: data.changes?.avgRunTime,
      icon: <Clock className="w-5 h-5 text-yellow-400" />,
      color: 'yellow',
      subtitle: 'للمهمة الواحدة',
    },
    {
      title: 'الوكلاء النشطون',
      value: data.activeAgents,
      change: data.changes?.activeAgents,
      icon: <Users className="w-5 h-5 text-purple-400" />,
      color: 'purple',
      subtitle: 'حالياً',
    },
    {
      title: 'الفرق الكلية',
      value: data.totalTeams,
      change: data.changes?.totalTeams,
      icon: <BarChart3 className="w-5 h-5 text-blue-400" />,
      color: 'blue',
      subtitle: 'مشروع نشط',
    },
    {
      title: 'استدعاءات API',
      value: data.apiCalls.toLocaleString(),
      change: data.changes?.apiCalls,
      icon: <Zap className="w-5 h-5 text-green-400" />,
      color: 'green',
      subtitle: 'هذا الشهر',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold text-white">مؤشرات الأداء الرئيسية</h2>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((metric, index) => (
            <MetricCard key={index} {...metric} />
          ))}
        </div>
      </CardBody>
    </Card>
  );
};

export default Metrics;
