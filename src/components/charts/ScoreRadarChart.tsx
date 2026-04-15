/**
 * ScoreRadarChart — 三维评分雷达图
 * 
 * 展示正确性 / 复杂性 / 质量 三个维度的得分，
 * 直观呈现用户代码能力的"形状"。
 */


import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

interface ScoreRadarChartProps {
  data: Array<{
    subject: string
    value: number
    fullMark: number
  }>
  width?: number | string
  height?: number | string
}

/** 默认空数据（三条线都为 0）*/
const EMPTY_DATA = [
  { subject: '正确性', value: 0, fullMark: 100 },
  { subject: '复杂性', value: 0, fullMark: 100 },
  { subject: '代码质量', value: 0, fullMark: 100 },
]

export default function ScoreRadarChart({
  data = EMPTY_DATA,
  width = '100%',
  height = 320,
}: ScoreRadarChartProps) {
  const displayData = data.length > 0 ? data : EMPTY_DATA

  return (
    <ResponsiveContainer width={width} height={height}>
      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={displayData}>
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: '#6b7280', fontSize: 13 }}
        />
        <PolarRadiusAxis
          angle={30}
          domain={[0, 100]}
          tick={{ fill: '#9ca3af', fontSize: 10 }}
          tickCount={5}
        />
        <Radar
          name="得分"
          dataKey="value"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.25}
          strokeWidth={2}
        />
        <Tooltip
          formatter={(value: number) => [`${value.toFixed(1)}分`, '得分']}
          contentStyle={{
            borderRadius: 8,
            border: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
