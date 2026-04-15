/**
 * ExerciseBarChart — 各难度分组平均分条形图
 *
 * 按简单 / 中等 / 困难三个维度展示平均得分，
 * 帮助识别不同难度下的表现差异。
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { ExerciseBreakdown } from '../../hooks/useLearningCurve'

interface ExerciseBarChartProps {
  data: ExerciseBreakdown[]
  width?: number | string
  height?: number | string
}

/** 难度对应的固定色板 */
const DIFF_COLORS: Record<string, { correctness: string; complexity: string; quality: string }> = {
  easy:   { correctness: '#10b981', complexity: '#34d399', quality: '#6ee7b7' },
  medium: { correctness: '#3b82f6', complexity: '#60a5fa', quality: '#93c5fd' },
  hard:   { correctness: '#ef4444', complexity: '#f87171', quality: '#fca5a5' },
}

/** 默认颜色 */
const DEFAULT_COLORS = { correctness: '#9ca3af', complexity: '#d1d5db', quality: '#e5e7eb' }

export default function ExerciseBarChart({
  data = [],
  width = '100%',
  height = Math.max(220, data.length * 70),
}: ExerciseBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{
        width, height: 200, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: '#9ca3af', fontSize: 13,
      }}>
        暂无练习数据
      </div>
    )
  }

  return (
    <ResponsiveContainer width={width} height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 4, left: 60 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
        <YAxis
          dataKey="difficulty_label"
          type="category"
          tick={{ fontSize: 13, fill: '#374151', fontWeight: 600 }}
          width={58}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number, name: string) => {
            let label = name
            if (name === 'avg_correctness') label = '正确性'
            if (name === 'avg_complexity') label = '复杂性'
            if (name === 'avg_quality') label = '质量'
            return [typeof value === 'number' ? value.toFixed(1) : value, label]
          }}
          contentStyle={{
            borderRadius: 8,
            border: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            fontSize: 12,
          }}
          // 自定义 tooltip 显示额外信息
          labelFormatter={(label: string) => {
            const item = data.find((d) => d.difficulty_label === label)
            if (item) {
              return `${label}（${item.exercise_count} 题，${item.attempt_count} 次提交）`
            }
            return label
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />

        <Bar dataKey="avg_correctness" name="正确性">
          {data.map((entry, index) => {
            const colors = DIFF_COLORS[entry.difficulty_key] || DEFAULT_COLORS
            return <Cell key={`c-${index}`} fill={colors.correctness} />
          })}
        </Bar>

        <Bar dataKey="avg_complexity" name="复杂性">
          {data.map((entry, index) => {
            const colors = DIFF_COLORS[entry.difficulty_key] || DEFAULT_COLORS
            return <Cell key={`x-${index}`} fill={colors.complexity} />
          })}
        </Bar>

        <Bar dataKey="avg_quality" name="质量">
          {data.map((entry, index) => {
            const colors = DIFF_COLORS[entry.difficulty_key] || DEFAULT_COLORS
            return <Cell key={`q-${index}`} fill={colors.quality} />
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
