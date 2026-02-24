'use client';

import React, { useMemo } from 'react';
import { Card, CardHeader, CardBody } from '@/components/common/card';

interface ChartData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: ChartData[];
  title: string;
  maxValue?: number;
}

const BarChart = ({ data, title }: BarChartProps) => {
  const calculatedMax = useMemo(() => {
    if (maxValue) return maxValue;
    return Math.max(...data.map(d => d.value)) * 1.1;
  }, [data, maxValue]);

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <h3 className="text-lg font-semibold mb-4 text-white">{title}</h3>
      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={index} className="flex items-center gap-3">
            <span className="text-sm text-gray-400 w-24 truncate">{item.label}</span>
            <div className="flex-1 bg-gray-700 rounded-full h-6 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${(item.value / calculatedMax) * 100}%`,
                  backgroundColor: item.color || '#3b82f6',
                }}
              />
            </div>
            <span className="text-sm font-medium text-white w-12 text-right">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface LineChartProps {
  data: { label: string; value: number }[];
  title: string;
}

const LineChart = ({ data, title }: LineChartProps) => {
  const { path, points, maxValue } = useMemo(() => {
    if (data.length === 0) return { path: '', points: [], maxValue: 0 };
    
    const max = Math.max(...data.map(d => d.value)) * 1.1;
    const width = 100;
    const height = 100;
    const padding = 10;
    
    const effectiveWidth = width - padding * 2;
    const effectiveHeight = height - padding * 2;
    
    const points = data.map((d, i) => ({
      x: padding + (i / (data.length - 1)) * effectiveWidth,
      y: height - padding - (d.value / max) * effectiveHeight,
      label: d.label,
      value: d.value,
    }));
    
    const path = points.reduce((acc, point, i) => {
      if (i === 0) return `M ${point.x} ${point.y}`;
      return `${acc} L ${point.x} ${point.y}`;
    }, '');
    
    return { path, points, maxValue: max };
  }, [data]);

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <h3 className="text-lg font-semibold mb-4 text-white">{title}</h3>
      <div className="relative h-48">
        <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((y, i) => (
            <line
              key={i}
              x1="10"
              y1={90 - y * 0.8}
              x2="90"
              y2={90 - y * 0.8}
              stroke="#374151"
              strokeWidth="0.5"
              strokeDasharray="2,2"
            />
          ))}
          
          {/* Line path */}
          <path
            d={path}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          
          {/* Area under line */}
          <path
            d={`${path} L 90 90 L 10 90 Z`}
            fill="url(#gradient)"
            opacity="0.3"
          />
          
          {/* Data points */}
          {points.map((point, i) => (
            <circle
              key={i}
              cx={point.x}
              cy={point.y}
              r="1.5"
              fill="#60a5fa"
              className="hover:r-2 transition-all"
            />
          ))}
          
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
        </svg>
        
        {/* X-axis labels */}
        <div className="flex justify-between mt-2 px-2">
          {data.map((d, i) => (
            <span key={i} className="text-xs text-gray-500">
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

interface PieChartProps {
  data: ChartData[];
  title: string;
}

const PieChart = ({ data, title }: PieChartProps) => {
  const { slices, total } = useMemo(() => {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    let currentAngle = 0;
    
    const slices = data.map((d, i) => {
      const angle = (d.value / total) * 360;
      const startAngle = currentAngle;
      currentAngle += angle;
      
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = ((startAngle + angle) * Math.PI) / 180;
      
      const x1 = 50 + 40 * Math.cos(startRad);
      const y1 = 50 + 40 * Math.sin(startRad);
      const x2 = 50 + 40 * Math.cos(endRad);
      const y2 = 50 + 40 * Math.sin(endRad);
      
      const largeArc = angle > 180 ? 1 : 0;
      
      return {
        path: `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`,
        color: d.color || `hsl(${(i * 360) / data.length}, 70%, 50%)`,
        label: d.label,
        value: d.value,
        percentage: ((d.value / total) * 100).toFixed(1),
      };
    });
    
    return { slices, total };
  }, [data]);

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <h3 className="text-lg font-semibold mb-4 text-white">{title}</h3>
      <div className="flex items-center gap-6">
        <svg viewBox="0 0 100 100" className="w-32 h-32">
          {slices.map((slice, i) => (
            <path
              key={i}
              d={slice.path}
              fill={slice.color}
              stroke="#1f2937"
              strokeWidth="1"
            />
          ))}
          <circle cx="50" cy="50" r="20" fill="#1f2937" />
          <text x="50" y="52" textAnchor="middle" className="text-xs fill-white">
            {total}
          </text>
        </svg>
        
        <div className="space-y-2 flex-1">
          {slices.map((slice, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: slice.color }}
              />
              <span className="text-gray-300 flex-1">{slice.label}</span>
              <span className="text-gray-500">{slice.percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface ChartsProps {
  runData?: { label: string; value: number }[];
  roleDistribution?: ChartData[];
  modelUsage?: ChartData[];
}

const Charts = ({
  runData = [
    { label: 'Mon', value: 12 },
    { label: 'Tue', value: 19 },
    { label: 'Wed', value: 15 },
    { label: 'Thu', value: 25 },
    { label: 'Fri', value: 22 },
    { label: 'Sat', value: 30 },
    { label: 'Sun', value: 28 },
  ],
  roleDistribution = [
    { label: 'Research', value: 35, color: '#3b82f6' },
    { label: 'Coding', value: 45, color: '#10b981' },
    { label: 'Content', value: 20, color: '#f59e0b' },
    { label: 'Data', value: 15, color: '#ef4444' },
  ],
  modelUsage = [
    { label: 'GPT-4', value: 120, color: '#3b82f6' },
    { label: 'Claude 3', value: 85, color: '#10b981' },
    { label: 'Gemini', value: 45, color: '#f59e0b' },
    { label: 'Llama 3', value: 30, color: '#ef4444' },
  ],
}: ChartsProps) => {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold text-white">Analytics Charts</h2>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <LineChart data={runData} title="Runs Over Time" />
          <PieChart data={roleDistribution} title="Role Distribution" />
          <BarChart data={modelUsage} title="Model Usage" />
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 text-white">Quick Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-700 p-3 rounded">
                <p className="text-2xl font-bold text-blue-400">98.5%</p>
                <p className="text-sm text-gray-400">Uptime</p>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <p className="text-2xl font-bold text-green-400">2.4s</p>
                <p className="text-sm text-gray-400">Avg Response</p>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <p className="text-2xl font-bold text-yellow-400">156</p>
                <p className="text-sm text-gray-400">Active Teams</p>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <p className="text-2xl font-bold text-purple-400">12</p>
                <p className="text-sm text-gray-400">MCP Servers</p>
              </div>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default Charts;
