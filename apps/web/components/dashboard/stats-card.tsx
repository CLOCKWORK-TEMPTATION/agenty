import type { ReactNode } from 'react';

interface StatsCardProps {
  value: number | string;
  label: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    positive: boolean;
  };
}

export function StatsCard({ value, label, icon, trend }: StatsCardProps) {
  return (
    <div className="stat-card">
      {icon && <div className="text-accent-2 mb-2">{icon}</div>}
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {trend && (
        <div
          className={`text-xs mt-2 ${
            trend.positive ? 'text-success' : 'text-error'
          }`}
        >
          {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
        </div>
      )}
    </div>
  );
}
