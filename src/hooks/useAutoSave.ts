import { useEffect } from 'react'

interface SettingsState {
  autoComplete: boolean
  syntaxCheck: boolean
  semanticHighlight: boolean
}

// 保存设置选项
export function useAutoSave(code: string, output: string, settings: SettingsState) {
  // 保存代码
  useEffect(() => {
    localStorage.setItem('monaco-editor-code', code)
  }, [code])
  // 保存输出
  useEffect(() => {
    localStorage.setItem('monaco-editor-output', output)
  }, [output])
  // 保存设置
  useEffect(() => {
    localStorage.setItem('monaco-editor-settings', JSON.stringify(settings))
  }, [settings.autoComplete, settings.syntaxCheck, settings.semanticHighlight])
}
