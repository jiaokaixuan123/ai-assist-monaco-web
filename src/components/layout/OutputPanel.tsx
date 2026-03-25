import React, { useState } from 'react'
import TracePlayer, { type TraceStep } from '../TracePlayer/TracePlayer'
import * as monaco from 'monaco-editor'

interface OutputPanelProps {
  output: string
  onClear: () => void
  traceSteps?: TraceStep[]
  traceError?: string | null
  showTrace?: boolean
  editor?: monaco.editor.IStandaloneCodeEditor | null
  onCloseTrace?: () => void
  activeTab?: 'output' | 'trace'
  onTabChange?: (tab: 'output' | 'trace') => void
}

const TAB_STYLE: React.CSSProperties = {
  padding: '6px 16px',
  fontSize: 12,
  border: 'none',
  background: 'transparent',
  color: '#888',
  cursor: 'pointer',
  borderBottom: '2px solid transparent',
}

const ACTIVE_TAB_STYLE: React.CSSProperties = {
  ...TAB_STYLE,
  color: '#d4d4d4',
  borderBottom: '2px solid #0e639c',
}

const OutputPanel: React.FC<OutputPanelProps> = ({
  output, onClear, traceSteps = [], traceError = null,
  showTrace = false, editor = null, onCloseTrace,
  activeTab = 'output', onTabChange,
}) => {
  const [internalTab, setInternalTab] = useState<'output' | 'trace'>('output')
  const tab = onTabChange ? activeTab : internalTab
  const setTab = onTabChange ?? setInternalTab

  // 当 showTrace 变为 true 时自动切换到调试标签
  React.useEffect(() => {
    if (showTrace) setTab('trace')
  }, [showTrace])

  return (
    <div style={{ height: 220, borderTop: '1px solid #3e3e3e', background: '#1e1e1e', display: 'flex', flexDirection: 'column' }}>
      {/* 标签栏 */}
      <div style={{ display: 'flex', alignItems: 'center', background: '#252526', borderBottom: '1px solid #3c3c3c', flexShrink: 0 }}>
        <button style={tab === 'output' ? ACTIVE_TAB_STYLE : TAB_STYLE} onClick={() => setTab('output')}>📋 输出</button>
        <button
          style={tab === 'trace' ? ACTIVE_TAB_STYLE : TAB_STYLE}
          onClick={() => setTab('trace')}
        >
          🔍 逐步调试
          {traceSteps.length > 0 && <span style={{ marginLeft: 4, color: '#3b9' }}>({traceSteps.length} 步)</span>}
        </button>
        <div style={{ flex: 1 }} />
        {tab === 'output' && (
          <button onClick={onClear} style={{ background: 'transparent', color: '#0e639c', border: 'none', cursor: 'pointer', padding: '0 12px', fontSize: 12 }}>清除</button>
        )}
        {tab === 'trace' && onCloseTrace && (
          <button onClick={onCloseTrace} style={{ background: 'transparent', color: '#666', border: 'none', cursor: 'pointer', padding: '0 12px', fontSize: 12 }}>✕ 关闭调试</button>
        )}
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'output' && (
          <pre style={{ height: '100%', padding: '10px 12px', overflow: 'auto', margin: 0, fontFamily: 'monospace', fontSize: 13, lineHeight: 1.5 }}>
            {output || '等待运行...'}
          </pre>
        )}
        {tab === 'trace' && (
          traceSteps.length === 0 && !traceError
            ? <div style={{ padding: '24px', color: '#666', textAlign: 'center', fontSize: 13 }}>点击上方「🔍 逐步调试」按钮开始分析代码执行过程</div>
            : <TracePlayer steps={traceSteps} error={traceError} editor={editor ?? null} onClose={() => { onCloseTrace?.(); setTab('output') }} />
        )}
      </div>
    </div>
  )
}

export default OutputPanel
