import SettingsPanel from '../layout/SettingsPanel'
import ChatPanel from '../Sidebar/ChatPanel'

interface SidebarProps {
  showSettings: boolean
  code: string
  selectedCode: string
  enableAutoComplete: boolean
  enableSyntaxCheck: boolean
  enableSemanticHighlight: boolean
  enableLanguageService: boolean
  setEnableAutoComplete: (v: boolean) => void
  setEnableSyntaxCheck: (v: boolean) => void
  setEnableSemanticHighlight: (v: boolean) => void
  setEnableLanguageService: (v: boolean) => void
}

export function Sidebar(props: SidebarProps) {
  const { showSettings, code, selectedCode, enableAutoComplete, enableSyntaxCheck, enableSemanticHighlight, enableLanguageService, setEnableAutoComplete, setEnableSyntaxCheck, setEnableSemanticHighlight, setEnableLanguageService } = props
  return (
    <div style={{
      width: '400px',
      borderLeft: '1px solid #3e3e3e',
      background: '#252526',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px',
      overflow: 'auto'
    }}>
      {showSettings && (
        <SettingsPanel
          enableAutoComplete={enableAutoComplete}
          enableSyntaxCheck={enableSyntaxCheck}
          enableSemanticHighlight={enableSemanticHighlight}
          enableLanguageService={enableLanguageService}
          setEnableAutoComplete={setEnableAutoComplete}
          setEnableSyntaxCheck={setEnableSyntaxCheck}
          setEnableSemanticHighlight={setEnableSemanticHighlight}
          setEnableLanguageService={setEnableLanguageService}
          onClearAll={() => {
            if (confirm('确定要清除所有保存的数据吗？\n代码、输出和设置都会被重置。')) {
              localStorage.removeItem('monaco-editor-code')
              localStorage.removeItem('monaco-editor-output')
              localStorage.removeItem('monaco-editor-settings')
              window.location.reload()
            }
          }}
        />
      )}
      <h3 style={{ marginTop: 0 }}>🤖 AI 助教</h3>
      <ChatPanel code={code} selectedCode={selectedCode} />
    </div>
  )
}

export default Sidebar
