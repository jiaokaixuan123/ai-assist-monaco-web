import React from 'react'

// 输出面板
interface OutputPanelProps {
  output: string
  onClear: () => void
}

const OutputPanel: React.FC<OutputPanelProps> = ({ output, onClear }) => {
  return (
    <div style={{
      height: '200px',
      borderTop: '1px solid #3e3e3e',
      background: '#1e1e1e',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: '#2d2d2d',
        fontSize: '13px'
      }}>
        <span>📋 运行输出</span>
        <button
          onClick={onClear}
          style={{
            background: 'transparent',
            color: '#0e639c',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          清除
        </button>
      </div>
      {/* <pre> 标签 专门用于展示预格式化的文本（比如代码运行输出、日志、命令行结果）
      保留文本的原始格式,默认使用等宽字体（monospace）：和代码编辑器字体一致，适合展示程序输出*/}
      <pre style={{
        flex: 1,
        padding: '12px',
        overflow: 'auto',
        margin: 0,
        fontFamily: 'monospace',
        fontSize: '13px',
        lineHeight: 1.5
      }}>
        {output || '等待运行...'}
      </pre>
    </div>
  )
}

export default OutputPanel
