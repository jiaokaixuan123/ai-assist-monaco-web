/**
 * TrendLineChart — 周趋势折线图
 *
 * 展示最近 N 周各维度及综合分的变化趋势，
 * 支持多条折线叠加显示。
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { WeeklyPoint } from '../../hooks/useLearningCurve'

interface TrendLineChartProps {
  data: WeeklyPoint[]
  width?: number | string
  height?: number | string
}

const LINE_CONFIG = [
  { key: 'correctness', name: '正确性', color: '#10b981' },    // green-500
  { key: 'complexity', name: '复杂性', color: '#f59e0b' },       // amber-500
  { key: 'quality', name: '质量', color: '#8b5cf6' },           // violet-500
  { key: 'overall', name: '综合分', color: '#3b82f6', width: 3, dasharray: '6 3' },  // blue-500 dashed
]

export default function TrendLineChart({
  data = [],
  width = '100%',
  height = 280,
}: TrendLineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{
        width, height, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: '#9ca3af', fontSize: 13,
      }}>
        暂无足够的数据绘制趋势图
      </div>
    )
  }

  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis
          dataKey="week_label"
          tick={{ fontSize: 12, fill: '#6b7280' }}
          axisLine={{ stroke: '#e5e7eb' }}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={{ stroke: '#e5e7eb' }}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            `${value.toFixed(1)}分`,
            name,
          ]}
          contentStyle={{
            borderRadius: 8,
            border: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        
        {LINE_CONFIG.map((line) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.name}
            stroke={line.color}
            strokeWidth={line.width ?? 2}
            strokeDasharray={line.dasharray ?? undefined}
            dot={{ r: 4, fill: line.color }}
            activeDot={{ r: 6, fill: line.color }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
