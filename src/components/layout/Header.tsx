import React from 'react'

// 接口：头部组件(TypeScript 的 “类型校验”)
interface HeaderProps {
  isReady: boolean
  loadingStatus: string
  code: string
  onToggleSettings: () => void
  showSettings: boolean
  onFormat: () => void
  onRun: () => void
  isRunning: boolean
  onTrace?: () => void
  isTracing?: boolean
}

// 函数式组件：头部组件
const Header: React.FC<HeaderProps> = ({
  isReady,
  loadingStatus,
  showSettings,
  onToggleSettings,
  onFormat,
  onRun,
  isRunning,
  onTrace,
  isTracing = false,
  code
}) => {
  return (    //JSX：是 React 的语法糖，本质是 React.createElement 的简化写法，允许在 JavaScript 中写 HTML 结构。
    // Flex容器（最外层 + 按钮组容器）
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',    // 定义项目在主轴上的对齐方式
      alignItems: 'center',               // 定义项目在交叉轴上的对齐方式
      padding: '12px 20px',               // 内边距
      background: '#2d2d2d',            // 背景色
      borderBottom: '1px solid #3e3e3e' // 底部边框
    }}>
      {/* <h1>	标题展示 ; margin 属性为给定元素设置所有四个（上右下左）方向的外边距属性，值为 0，即没有外边距。 */}
      <h1 style={{ margin: 0, fontSize: '20px' }}>🎓 Monaco AI 编程助手</h1>
      {/* flex 容器, Flex 交叉轴垂直居中,让标题、按钮、状态文本在头部栏中垂直居中，保证视觉对齐 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* span 标签，状态提示文本，根据就绪状态显示不同的颜色 padding/margin 内边距 / 外边距*/}
        <span style={{
          fontSize: '12px',
          color: isReady ? '#4ec9b0' : '#dcdcaa',
          padding: '4px 8px',
          background: '#1e1e1e',
          borderRadius: '3px'
        }}>
          {isReady ? '🐍 Python 就绪' : '⏳ ' + loadingStatus}
        </span>
        {/* button 标签 */}
        <button
          onClick={onToggleSettings}
          title="编辑器设置"
          style={{
            padding: '8px 12px',
            background: showSettings ? '#0e639c' : '#2d2d2d',
            color: 'white',
            border: '1px solid #3e3e3e',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          ⚙️ 设置
        </button>
        <button
          onClick={onFormat}
          disabled={!isReady || !code.trim()}
          title="格式化代码 (Ctrl+Shift+F)"
          style={{
            padding: '8px 12px',
            background: (!isReady || !code.trim()) ? '#555' : '#2d2d2d',
            color: 'white',
            border: '1px solid #3e3e3e',
            borderRadius: '4px',
            cursor: (!isReady || !code.trim()) ? 'not-allowed' : 'pointer',
            opacity: (!isReady || !code.trim()) ? 0.6 : 1,
            fontSize: '12px'
          }}
        >
          ✨ 格式化
        </button>
        <button
          onClick={onRun}
          disabled={!isReady || isRunning}
          title="运行代码 (Ctrl+Enter)"
          style={{
            padding: '8px 16px',
            background: (!isReady || isRunning) ? '#555' : '#0e639c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: (!isReady || isRunning) ? 'not-allowed' : 'pointer',
            opacity: (!isReady || isRunning) ? 0.6 : 1
          }}
        >
          {isRunning ? '⏳ 运行中...' : '▶️ 运行代码'}
        </button>
        {onTrace && (
          <button
            type="button"
            onClick={onTrace}
            disabled={!isReady || isTracing}
            title="逐步调试"
            style={{
              padding: '8px 16px',
              background: (!isReady || isTracing) ? '#555' : '#1a3a5c',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: (!isReady || isTracing) ? 'not-allowed' : 'pointer',
              opacity: (!isReady || isTracing) ? 0.6 : 1
            }}
          >
            {isTracing ? '⏳ 分析中...' : '🔍 逐步调试'}
          </button>
        )}
      </div>
    </div>
  )
}

export default Header // 导出Header组件供其他文件使用
