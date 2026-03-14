import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

// 配置 @monaco-editor/react 使用本地 Monaco 文件
loader.config({ monaco })

// EditorPane 组件属性定义
interface EditorPaneProps {
  code: string
  onChange: (code: string) => void
  onMount: (editor: monaco.editor.IStandaloneCodeEditor, m: typeof monaco) => void 
  enableAutoComplete: boolean
}

// EditorPane 组件实现
export function EditorPane({ code, onChange, onMount, enableAutoComplete }: EditorPaneProps) {
  return (
    <div style={{ height: '100%', width: '100%', background: '#1e1e1e' }}>
      <Editor
        height="100%"
        language="python"
        value={code}
        onChange={(v) => onChange(v || '')}   // 处理代码变化
        onMount={(e, m) => onMount(e, m)}     // 处理编辑器挂载
        options={{
        minimap: { enabled: true },         // 启用迷你地图
        fontSize: 14,                       // 设置字体大小
        lineNumbers: 'on',                  // 显示行号
        automaticLayout: true,              // 自动布局调整
        tabSize: 4,                         // 设置制表符大小
        wordWrap: 'on',                     // 启用自动换行
        folding: true,                      // 启用代码折叠
        foldingStrategy: 'indentation',     // 折叠策略为缩进
        matchBrackets: 'always',            // 始终匹配括号
        bracketPairColorization: { enabled: true }, // 启用括号配对着色
        suggestOnTriggerCharacters: true,   // 在触发字符时显示建议
        quickSuggestions: enableAutoComplete ? { other: true, comments: false, strings: false } : false,  // 快速建议配置
        wordBasedSuggestions: 'off',        // 关闭基于单词的建议
        acceptSuggestionOnEnter: 'on',      // 按回车键接受建议
        tabCompletion: 'on',                // 启用制表符补全
        snippetSuggestions: 'top',          // 代码片段建议显示在顶部
        suggest: { showWords: false, showFunctions: true, showVariables: true, showClasses: true }
      }}
    />
    </div>
  )
}

export default EditorPane
