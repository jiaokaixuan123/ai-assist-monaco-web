import React from 'react'

// 设置栏接口属性
interface SettingsPanelProps {
  enableAutoComplete: boolean       // 自动补全
  enableSyntaxCheck: boolean        // 语法检查
  enableSemanticHighlight: boolean  // 语义高亮
  enableLanguageService: boolean    // Pyright LSP
  setEnableAutoComplete: (v: boolean) => void
  setEnableSyntaxCheck: (v: boolean) => void
  setEnableSemanticHighlight: (v: boolean) => void
  setEnableLanguageService: (v: boolean) => void // setter
  onClearAll: () => void
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  enableAutoComplete,
  enableSyntaxCheck,
  enableSemanticHighlight,
  enableLanguageService,
  setEnableAutoComplete,
  setEnableSyntaxCheck,
  setEnableSemanticHighlight,
  setEnableLanguageService,
  onClearAll
}) => {
  return (
    <div style={{
      marginBottom: '20px',
      padding: '15px',
      background: '#1e1e1e',
      borderRadius: '8px',
      border: '1px solid #3e3e3e'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '16px' }}>⚙️ 编辑器设置</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* 语言服务总开关 */}
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
          <input
            type="checkbox"
            checked={enableLanguageService}
            onChange={e => setEnableLanguageService(e.target.checked)}
            style={{ marginRight: '10px', cursor: 'pointer', width: '16px', height: '16px' }}
          />
          <span>
            <strong>Pyright 语言服务</strong>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>开启完整的类型与语义支持 (补全/跳转/诊断)。关闭后其它子功能自动停用。</div>
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
          <input
            type="checkbox"
            checked={enableAutoComplete}
            onChange={e => setEnableAutoComplete(e.target.checked)}
            disabled={!enableLanguageService}
            style={{ marginRight: '10px', cursor: 'pointer', width: '16px', height: '16px' }}
          />
          <span>
            <strong>智能代码补全</strong>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>输入时自动提示函数、变量</div>
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
          <input
            type="checkbox"
            checked={enableSyntaxCheck}
            onChange={e => setEnableSyntaxCheck(e.target.checked)}
            disabled={!enableLanguageService}
            style={{ marginRight: '10px', cursor: 'pointer', width: '16px', height: '16px' }}
          />
          <span>
            <strong>实时语法检查</strong>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>自动检测语法错误并标记</div>
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
          <input
            type="checkbox"
            checked={enableSemanticHighlight}
            onChange={e => setEnableSemanticHighlight(e.target.checked)}
            disabled={!enableLanguageService}
            style={{ marginRight: '10px', cursor: 'pointer', width: '16px', height: '16px' }}
          />
          <span>
            <strong>语义高亮</strong>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>函数、变量、类用不同颜色显示</div>
          </span>
        </label>
      </div>
      <div style={{ marginTop: '15px', padding: '10px', background: '#2d2d2d', borderRadius: '4px', fontSize: '12px', color: '#dcdcaa' }}>
        💡 提示：关闭功能可以提升性能
      </div>
      <div style={{ marginTop: '15px', padding: '10px', background: '#1e3a20', borderRadius: '4px', fontSize: '12px', color: '#4ec9b0', border: '1px solid #2d5a2f' }}>
        💾 代码和设置会自动保存，刷新页面不会丢失
      </div>
      <button
        onClick={onClearAll}
        style={{
          marginTop: '15px',
          padding: '8px 12px',
          background: '#5a1e1e',
          color: '#f48771',
          border: '1px solid #7a2e2e',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          width: '100%'
        }}
      >
        🗑️ 清除所有保存的数据
      </button>
    </div>
  )
}

export default SettingsPanel
