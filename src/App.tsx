import { useState, useEffect, useRef } from 'react'
import * as monaco from 'monaco-editor'
import { registerPythonLanguage } from './config/pythonLanguage'

// 使用 Vite 的 worker 导入方式配置 Monaco Editor
// @ts-ignore
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
// @ts-ignore
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
// @ts-ignore
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
// @ts-ignore
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
// @ts-ignore
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

registerPythonLanguage()

self.MonacoEnvironment = {
  getWorker(_: any, label: string) {
    if (label === 'json') {
      return new jsonWorker()
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new cssWorker()
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new htmlWorker()
    }
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker()
    }
    return new editorWorker()
  }
}

// 直接加载 Pyodide 为 Web Worker 方式，避免与 Monaco AMD define 冲突
interface PyWorkerMessage {
  id: number
  type: string
  result?: string
  error?: string
}

function usePyodideWorker() {
  const workerRef = useRef<Worker | null>(null)
  const reqIdRef = useRef(0)
  const pendingRef = useRef<Map<number, (res: { result?: string; error?: string }) => void>>(new Map())
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    console.log('🔧 初始化 Pyodide Worker...')
    const worker = new Worker(new URL('./workers/pyodideWorker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    
    worker.onmessage = (e: MessageEvent<PyWorkerMessage>) => {
      const { id, type, result, error } = e.data
      console.log('📨 Worker 消息:', { id, type, hasResult: !!result, hasError: !!error })
      
      if (type === 'ready') {
        console.log('✅ Pyodide 已就绪!')
        setIsReady(true)
        return
      }
      const resolver = pendingRef.current.get(id)
      if (resolver) {
        resolver({ result, error })
        pendingRef.current.delete(id)
      } else {
        console.warn('⚠️ 未找到对应的 resolver，id:', id)
      }
    }
    
    worker.onerror = (err) => {
      console.error('❌ Worker 错误:', {
        message: err.message,
        filename: err.filename,
        lineno: err.lineno,
        colno: err.colno
      })
      setIsReady(false)
    }
    
    // 仅发送 ping
    console.log('📤 发送 ping 消息...')
    worker.postMessage({ id: -1, type: 'ping' })
    
    return () => {
      console.log('🛑 终止 Worker')
      worker.terminate()
    }
  }, [])

  const callWorker = (type: string, code: string) => {
    return new Promise<{ result?: string; error?: string }>((resolve) => {
      if (!workerRef.current) {
        console.error('❌ Worker 未初始化')
        resolve({ error: 'Worker 未初始化' })
        return
      }
      const id = reqIdRef.current++
      pendingRef.current.set(id, resolve)
      console.log('📤 发送消息到 Worker:', { id, type, codeLength: code.length })
      workerRef.current.postMessage({ id, type, code })
      
      setTimeout(() => {
        if (pendingRef.current.has(id)) {
          console.error('⏱️ Worker 响应超时，id:', id)
          resolve({ error: '执行超时（60秒）' })
          pendingRef.current.delete(id)
        }
      }, 60000)
    })
  }

  const runCode = async (code: string) => {
    const start = performance.now()
    const res = await callWorker('run', code)
    console.log('⏱️ run 耗时(ms):', performance.now() - start)
    return res
  }
  const formatCode = async (code: string) => callWorker('format', code)

  // Pyodide 本地语法检查（compile() 级别，LSP 不可用时作为 fallback）
  const checkSyntax = async (code: string): Promise<Array<{ line: number; message: string }>> => {
    const res = await callWorker('syntax', code)
    if (!res.result) return []
    try {
      const parsed = JSON.parse(res.result)
      if (parsed.ok) return []
      return [{ line: parsed.line ?? 1, message: parsed.msg ?? 'SyntaxError' }]
    } catch { return [] }
  }

  return { isReady, runCode, formatCode, checkSyntax }
}

import Header from './components/layout/Header'
import OutputPanel from './components/layout/OutputPanel'
import EditorPane from './components/Editor/EditorPane'
import Sidebar from './components/Sidebar/Sidebar'
import StatusBar from './components/StatusBar/StatusBar'
import { useAutoSave } from './hooks/useAutoSave'
import { useSelection } from './hooks/useSelection'
import { connectPyright, initPythonModel, disablePyrightLanguageFeatures, setSyntaxCheckEnabled, setAutoCompleteEnabled, setSemanticHighlightEnabled, onPyrightConnectionChange } from './lsp/index'
import { registerAIActions, applyToEditor } from './lsp/aiActions'
import type { AIActionEvent } from './lsp/aiActions'
import { getModelClient } from './services/modelClient'

// Pyodide 类型定义
interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<any>
  loadPackage: (packages: string[]) => Promise<void>
  FS: any
  globals: any
}

declare global {
  interface Window {
    loadPyodide: (config: { indexURL: string }) => Promise<PyodideInterface>
  }
}

function App() {
  // 💾 从 localStorage 恢复状态
  const getInitialCode = () => {
    const saved = localStorage.getItem('monaco-editor-code')  // localStorage 直接在浏览器存储数据
    return saved || '# 在这里编写 Python 代码\nprint("Hello, Monaco!")\n\nfor i in range(5):\n    print(f"Count: {i}")'
  }
  
  const getInitialOutput = () => {
    const saved = localStorage.getItem('monaco-editor-output')
    return saved || ''
  }
  
  const getInitialSettings = () => {
    const saved = localStorage.getItem('monaco-editor-settings')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return { autoComplete: true, syntaxCheck: true, semanticHighlight: true }
      }
    }
    return { autoComplete: true, syntaxCheck: true, semanticHighlight: true }
  }
  
  const initialSettings = getInitialSettings()
  
  const [code, setCode] = useState(getInitialCode())
  const [output, setOutput] = useState(getInitialOutput())
  const { isReady, runCode, formatCode: formatWithPyodide, checkSyntax } = usePyodideWorker()
  const loadingStatus = isReady ? 'Python 环境已加载' : '正在加载 Python 环境...'
  const [isRunning, setIsRunning] = useState(false)
  // LSP 连接状态：用于决定是否启用 Pyodide fallback 语法检查
  const [lspConnected, setLspConnected] = useState(false)
  // 订阅 Pyright LSP 连接状态变化
  useEffect(() => {
    return onPyrightConnectionChange(setLspConnected)
  }, [])

  // 🎛️ 功能开关
  const [enableAutoComplete, setEnableAutoComplete] = useState(initialSettings.autoComplete)
  const [enableSyntaxCheck, setEnableSyntaxCheck] = useState(initialSettings.syntaxCheck)
  const [enableSemanticHighlight, setEnableSemanticHighlight] = useState(initialSettings.semanticHighlight)
  const [enableLanguageService, setEnableLanguageService] = useState(true) // 默认开启 Pyright 语言服务
  const [showSettings, setShowSettings] = useState(false)
  
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof monaco | null>(null)
  const autoCompleteEnabledRef = useRef(true)  // 用于补全提供器
  const formatCodeRef = useRef<() => Promise<void>>(async () => {})  // 保持最新格式化函数引用，供 Ctrl+S 命令使用

  // ⚡ 功能2：代码格式化 (使用 worker)
  const formatCodeLocal = async () => {
    if (!isReady || !code.trim()) return
    const { result, error } = await formatWithPyodide(code)
    if (error) { setOutput(`⚠️ 格式化失败: ${error}`); return }
    if (result) { setCode(result); setOutput('✓ 代码格式化完成') }
  }

  const handleRunCode = async () => {
    if (!isReady) { setOutput('⚠️ Python 环境还未加载完成，请稍候...'); return }
    if (!code.trim()) { setOutput('⚠️ 请先输入代码'); return }
    setIsRunning(true)
    setOutput('正在执行...\n')
    try {
      const { result, error } = await runCode(code)
      if (error) setOutput(`❌ 运行错误:\n${error}`)
      else if (result) setOutput(result)
    } catch (e: any) {
      setOutput('❌ 调用失败: ' + (e.message || String(e)))
    } finally {
      setIsRunning(false)
    }
  }

  // AI 内联操作：CodeLens 修复 / 选区工具栏（解释、优化、注释、重构）
  const PROMPTS: Record<AIActionEvent['action'], (code: string, ctx?: string) => string> = {
    fix:      (code, ctx) => `请修复以下 Python 代码中的错误并只返回修复后的代码，不要解释：\n错误信息：${ctx ?? ''}\n\n${code}`,
    explain:  (code)      => `请简要解释以下 Python 代码的作用：\n\n${code}`,
    optimize: (code)      => `请优化以下 Python 代码，只返回优化后的代码，不要解释：\n\n${code}`,
    comment:  (code)      => `请为以下 Python 代码添加中文注释，只返回带注释的代码：\n\n${code}`,
    refactor: (code)      => `请重构以下 Python 代码使其更清晰，只返回重构后的代码，不要解释：\n\n${code}`,
  }

  const handleAIAction = async (evt: AIActionEvent) => {
    const { action, code: snippet, range, context } = evt
    const editor = editorRef.current
    const prompt = PROMPTS[action](snippet, context)

    if (action === 'explain') {
      // 解释结果显示在输出面板
      setOutput('🤖 AI 正在解释...')
      try {
        let acc = ''
        await getModelClient().streamChat(
          { messages: [{ role: 'user', content: prompt }], temperature: 0.4, maxTokens: 600 },
          (delta) => { acc += delta; setOutput('🤖 ' + acc) }
        )
      } catch (e: any) { setOutput('❌ AI 解释失败: ' + e.message) }
      return
    }

    // 其余操作：生成新代码后写回编辑器
    if (!editor) return
    setOutput(`🤖 AI 正在${action === 'fix' ? '修复' : action === 'optimize' ? '优化' : action === 'comment' ? '添加注释' : '重构'}...`)
    try {
      let acc = ''
      await getModelClient().streamChat(
        { messages: [{ role: 'user', content: prompt }], temperature: 0.2, maxTokens: 800 },
        (delta) => { acc += delta }
      )
      // 去掉 AI 可能包裹的 markdown 代码块
      const cleaned = acc.replace(/^```[\w]*\n?/m, '').replace(/\n?```$/m, '').trim()
      applyToEditor(editor, range, cleaned)
      setOutput(`✓ AI ${action === 'fix' ? '修复' : action === 'optimize' ? '优化' : action === 'comment' ? '注释添加' : '重构'}完成`)
    } catch (e: any) { setOutput('❌ AI 操作失败: ' + e.message) }
  }

  // 🎨 功能3：Monaco Editor 挂载时的配置
  const { selectedCode, attachSelectionListener } = useSelection()

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor, m: typeof monaco) => {
    editorRef.current = editor
    monacoRef.current = m
    attachSelectionListener(editor)
    // registerPythonLanguage 已在模块顶层调用，此处不重复注册

    if (enableLanguageService) {
      connectPyright()
      const model = editor.getModel()
      if (model) {
        let pyModel = model
        if (!model.uri.path.endsWith('.py')) {
          pyModel = monaco.editor.createModel(model.getValue(), 'python', monaco.Uri.parse('file:///virtual/main.py'))
          editor.setModel(pyModel)
        }
        initPythonModel(pyModel)
      }
    }

    // 2. 设置主题
    monaco.editor.setTheme('python-dark-plus')

    // 🔧 配置编辑器选项
    editor.updateOptions({
      minimap: { enabled: true },
      fontSize: 14,
      tabSize: 4,
      insertSpaces: true,
      wordWrap: 'on',
      // 语义高亮初始状态由开关决定
      semanticHighlighting: { enabled: enableSemanticHighlight }
    } as any)

    // Ctrl+S：拦截浏览器默认"另存为"，改为触发代码格式化
    editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyS, () => {
      formatCodeRef.current()
    })

    // AI 内联气泡：CodeLens 修复 + 选区工具栏
    registerAIActions(editor, { onAction: handleAIAction })
  }

  // Attach auto-save hook
  useAutoSave(code, output, { autoComplete: enableAutoComplete, syntaxCheck: enableSyntaxCheck, semanticHighlight: enableSemanticHighlight })

  // 保持 formatCodeRef 始终指向最新的格式化函数（供 Ctrl+S 命令闭包使用）
  useEffect(() => { formatCodeRef.current = formatCodeLocal })

  // Sync autoComplete flag to pyrightClient
  useEffect(() => {
    autoCompleteEnabledRef.current = enableAutoComplete
    setAutoCompleteEnabled(enableAutoComplete)
  }, [enableAutoComplete])

  // 保存设置到 localStorage（含新语言服务开关）
  useEffect(() => {
    localStorage.setItem('monaco-editor-settings', JSON.stringify({
      autoComplete: enableAutoComplete,
      syntaxCheck: enableSyntaxCheck,
      semanticHighlight: enableSemanticHighlight,
      languageService: enableLanguageService
    }))
  }, [enableAutoComplete, enableSyntaxCheck, enableSemanticHighlight, enableLanguageService])


  // 语义高亮开关：dispose/re-register provider + 同步编辑器选项
  useEffect(() => {
    setSemanticHighlightEnabled(enableSemanticHighlight)
    editorRef.current?.updateOptions({
      semanticHighlighting: { enabled: enableSemanticHighlight }
    } as any)
  }, [enableSemanticHighlight])

  // 语法检查开关同步到 pyrightClient
  useEffect(() => {
    setSyntaxCheckEnabled(enableSyntaxCheck)
  }, [enableSyntaxCheck])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const model = editor.getModel(); if (!model) return
    if (enableLanguageService) {
      connectPyright()
      initPythonModel(model)
    } else {
      disablePyrightLanguageFeatures()
      if (monacoRef.current) monacoRef.current.editor.setModelMarkers(model, 'pyright', [])
    }
  }, [enableLanguageService])

  // Pyodide fallback 语法检查：当 LSP 未连接（服务器未启动）或语言服务关闭时，
  // 用 Pyodide 的 compile() 提供基础 SyntaxError 标红，避免编辑器完全无诊断
  useEffect(() => {
    const useFallback = enableSyntaxCheck && isReady && (!enableLanguageService || !lspConnected)
    if (!useFallback) {
      // LSP 已接管，清除本地 fallback marker（避免与 pyright marker 叠加）
      const model = editorRef.current?.getModel()
      if (model && monacoRef.current) monacoRef.current.editor.setModelMarkers(model, 'pyodide', [])
      return
    }
    const timer = setTimeout(async () => {
      const errors = await checkSyntax(code)
      const model = editorRef.current?.getModel()
      if (!model || !monacoRef.current) return
      monacoRef.current.editor.setModelMarkers(model, 'pyodide', errors.map(e => ({
        startLineNumber: e.line,
        startColumn: 1,
        endLineNumber: e.line,
        endColumn: model.getLineMaxColumn(e.line),
        message: e.message,
        severity: monacoRef.current!.MarkerSeverity.Error,
        source: 'Pyodide'
      })))
    }, 600)
    return () => clearTimeout(timer)
  }, [code, enableSyntaxCheck, enableLanguageService, lspConnected, isReady])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1e1e1e', color: '#d4d4d4' }}>
      <Header
        isReady={isReady}
        loadingStatus={loadingStatus}
        code={code}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
        onFormat={formatCodeLocal}
        onRun={handleRunCode}
        isRunning={isRunning}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ flex: 1 }}>
            <EditorPane code={code} onChange={(v) => setCode(v)} onMount={handleEditorDidMount} enableAutoComplete={enableAutoComplete} />
          </div>
          <OutputPanel output={output} onClear={() => setOutput('')} />
        </div>
        <Sidebar
          showSettings={showSettings}
          code={code}
          selectedCode={selectedCode}
          enableAutoComplete={enableAutoComplete}
          enableSyntaxCheck={enableSyntaxCheck}
          enableSemanticHighlight={enableSemanticHighlight}
          enableLanguageService={enableLanguageService}
          setEnableAutoComplete={setEnableAutoComplete}
          setEnableSyntaxCheck={setEnableSyntaxCheck}
          setEnableSemanticHighlight={setEnableSemanticHighlight}
          setEnableLanguageService={setEnableLanguageService}
        />
      </div>
      {/* 状态栏 - 显示 Python 运行时及 LSP 连接状态 */}
      <StatusBar
        isReady={isReady}
        status={{
          message: !isReady
            ? loadingStatus
            : lspConnected
              ? 'Python 3.11 | Pyright LSP ✓'
              : enableLanguageService
                ? 'Python 3.11 | LSP 连接中... (需运行: npm run lsp:server)'
                : 'Python 3.11 | 本地模式',
          type: !isReady ? 'loading' : lspConnected ? 'success' : 'idle'
        }}
      />
    </div>
  )
}

export default App