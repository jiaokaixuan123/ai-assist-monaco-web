/**
 * EditorPage —— 完整的 Python IDE 页面（原 App.tsx 主功能）
 * 路由：/editor
 */
import { useState, useEffect, useRef } from 'react'
import * as monaco from 'monaco-editor'
import { registerPythonLanguage } from '../config/pythonLanguage'

// Monaco workers
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
    if (label === 'json') return new jsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    return new editorWorker()
  },
}

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
    const worker = new Worker(new URL('../workers/pyodideWorker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.onmessage = (e: MessageEvent<PyWorkerMessage>) => {
      const { id, type, result, error } = e.data
      if (type === 'ready') { setIsReady(true); return }
      const resolver = pendingRef.current.get(id)
      if (resolver) { resolver({ result, error }); pendingRef.current.delete(id) }
    }
    worker.onerror = () => setIsReady(false)
    worker.postMessage({ id: -1, type: 'ping' })
    return () => worker.terminate()
  }, [])

  const callWorker = (type: string, code: string) =>
    new Promise<{ result?: string; error?: string }>((resolve) => {
      if (!workerRef.current) { resolve({ error: 'Worker 未初始化' }); return }
      const id = reqIdRef.current++
      pendingRef.current.set(id, resolve)
      workerRef.current.postMessage({ id, type, code })
      setTimeout(() => {
        if (pendingRef.current.has(id)) {
          resolve({ error: '执行超时（60秒）' })
          pendingRef.current.delete(id)
        }
      }, 60000)
    })

  const runCode = (code: string) => callWorker('run', code)
  const formatCode = (code: string) => callWorker('format', code)
  const traceCode = async (code: string) => {
    const res = await callWorker('trace', code)
    if (res.error) return { steps: [], lines: code.split('\n'), error: res.error }
    try {
      const parsed = JSON.parse(res.result || '{}')
      return {
        steps: parsed.steps || [],
        lines: parsed.lines || code.split('\n'),
        error: parsed.error || null,
      }
    } catch { return { steps: [], lines: code.split('\n'), error: '解析追踪数据失败' } }
  }
  const checkSyntax = async (code: string): Promise<Array<{ line: number; message: string }>> => {
    const res = await callWorker('syntax', code)
    if (!res.result) return []
    try {
      const parsed = JSON.parse(res.result)
      if (parsed.ok) return []
      return [{ line: parsed.line ?? 1, message: parsed.msg ?? 'SyntaxError' }]
    } catch { return [] }
  }

  return { isReady, runCode, formatCode, checkSyntax, traceCode }
}

import Header from '../components/layout/Header'
import OutputPanel from '../components/layout/OutputPanel'
import EditorPane from '../components/Editor/EditorPane'
import Sidebar from '../components/Sidebar/Sidebar'
import StatusBar from '../components/StatusBar/StatusBar'
import { useAutoSave } from '../hooks/useAutoSave'
import { useSelection } from '../hooks/useSelection'
import {
  connectPyright, initPythonModel, disablePyrightLanguageFeatures,
  setSyntaxCheckEnabled, setAutoCompleteEnabled, setSemanticHighlightEnabled,
  onPyrightConnectionChange,
} from '../lsp/index'
import { registerAIActions, applyToEditor } from '../lsp/aiActions'
import type { AIActionEvent } from '../lsp/aiActions'
import { getModelClient } from '../services/modelClient'
import NavBar from '../components/learn/NavBar'
import Visualizer from '../components/Visualizer/Visualizer'
import type { TraceResult } from '../components/Visualizer/types'

export default function EditorPage() {
  const getInitialCode = () =>
    localStorage.getItem('monaco-editor-code') ||
    '# 在这里编写 Python 代码\nprint("Hello, Monaco!")\n\nfor i in range(5):\n    print(f"Count: {i}")'

  const getInitialOutput = () => localStorage.getItem('monaco-editor-output') || ''

  const getInitialSettings = () => {
    const saved = localStorage.getItem('monaco-editor-settings')
    if (saved) { try { return JSON.parse(saved) } catch {} }
    return { autoComplete: true, syntaxCheck: true, semanticHighlight: true }
  }

  const initialSettings = getInitialSettings()
  const [code, setCode] = useState(getInitialCode)
  const [output, setOutput] = useState(getInitialOutput)
  const [traceResult, setTraceResult] = useState<TraceResult | null>(null)
  const [isTracing, setIsTracing] = useState(false)
  const { isReady, runCode, formatCode: formatWithPyodide, checkSyntax, traceCode } = usePyodideWorker()
  const loadingStatus = isReady ? 'Python 环境已加载' : '正在加载 Python 环境...'
  const [isRunning, setIsRunning] = useState(false)
  const [lspConnected, setLspConnected] = useState(false)
  useEffect(() => onPyrightConnectionChange(setLspConnected), [])

  const [enableAutoComplete, setEnableAutoComplete] = useState(initialSettings.autoComplete)
  const [enableSyntaxCheck, setEnableSyntaxCheck] = useState(initialSettings.syntaxCheck)
  const [enableSemanticHighlight, setEnableSemanticHighlight] = useState(initialSettings.semanticHighlight)
  const [enableLanguageService, setEnableLanguageService] = useState(true)
  const [showSettings, setShowSettings] = useState(false)

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof monaco | null>(null)
  const formatCodeRef = useRef<() => Promise<void>>(async () => {})

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

  const PROMPTS: Record<AIActionEvent['action'], (code: string, ctx?: string) => string> = {
    fix: (code, ctx) => `请修复以下 Python 代码中的错误并只返回修复后的代码，不要解释：\n错误信息：${ctx ?? ''}\n\n${code}`,
    explain: (code) => `请简要解释以下 Python 代码的作用：\n\n${code}`,
    optimize: (code) => `请优化以下 Python 代码，只返回优化后的代码，不要解释：\n\n${code}`,
    comment: (code) => `请为以下 Python 代码添加中文注释，只返回带注释的代码：\n\n${code}`,
    refactor: (code) => `请重构以下 Python 代码使其更清晰，只返回重构后的代码，不要解释：\n\n${code}`,
  }

  const handleAIAction = async (evt: AIActionEvent) => {
    const { action, code: snippet, range, context } = evt
    const editor = editorRef.current
    const prompt = PROMPTS[action](snippet, context)
    if (action === 'explain') {
      setOutput('🤖 AI 正在解释...')
      try {
        let acc = ''
        await getModelClient().streamChat(
          { messages: [{ role: 'user', content: prompt }], temperature: 0.4, maxTokens: 600 },
          delta => { acc += delta; setOutput('🤖 ' + acc) }
        )
      } catch (e: any) { setOutput('❌ AI 解释失败: ' + e.message) }
      return
    }
    if (!editor) return
    const actionLabel = { fix: '修复', optimize: '优化', comment: '添加注释', refactor: '重构' }[action] ?? action
    setOutput(`🤖 AI 正在${actionLabel}...`)
    try {
      let acc = ''
      await getModelClient().streamChat(
        { messages: [{ role: 'user', content: prompt }], temperature: 0.2, maxTokens: 800 },
        delta => { acc += delta }
      )
      const cleaned = acc.replace(/^```[\w]*\n?/m, '').replace(/\n?```$/m, '').trim()
      applyToEditor(editor, range, cleaned)
      setOutput(`✓ AI ${actionLabel}完成`)
    } catch (e: any) { setOutput('❌ AI 操作失败: ' + e.message) }
  }

  const { selectedCode, attachSelectionListener } = useSelection()

  const handleTraceCode = async () => {
    if (!isReady) return
    setIsTracing(true)
    try {
      const result = await traceCode(code)
      setTraceResult(result)
    } finally {
      setIsTracing(false)
    }
  }

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor, m: typeof monaco) => {
    editorRef.current = editor
    monacoRef.current = m
    attachSelectionListener(editor)
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
    monaco.editor.setTheme('python-dark-plus')
    editor.updateOptions({
      minimap: { enabled: true }, fontSize: 14, tabSize: 4,
      insertSpaces: true, wordWrap: 'on',
      semanticHighlighting: { enabled: enableSemanticHighlight },
    } as any)
    editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyS, () => { formatCodeRef.current() })
    registerAIActions(editor, { onAction: handleAIAction })
  }

  useAutoSave(code, output, { autoComplete: enableAutoComplete, syntaxCheck: enableSyntaxCheck, semanticHighlight: enableSemanticHighlight })
  useEffect(() => { formatCodeRef.current = formatCodeLocal })
  useEffect(() => { setAutoCompleteEnabled(enableAutoComplete) }, [enableAutoComplete])
  useEffect(() => {
    localStorage.setItem('monaco-editor-settings', JSON.stringify({
      autoComplete: enableAutoComplete, syntaxCheck: enableSyntaxCheck,
      semanticHighlight: enableSemanticHighlight, languageService: enableLanguageService,
    }))
  }, [enableAutoComplete, enableSyntaxCheck, enableSemanticHighlight, enableLanguageService])
  useEffect(() => {
    setSemanticHighlightEnabled(enableSemanticHighlight)
    editorRef.current?.updateOptions({ semanticHighlighting: { enabled: enableSemanticHighlight } } as any)
  }, [enableSemanticHighlight])
  useEffect(() => { setSyntaxCheckEnabled(enableSyntaxCheck) }, [enableSyntaxCheck])
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const model = editor.getModel(); if (!model) return
    if (enableLanguageService) { connectPyright(); initPythonModel(model) }
    else { disablePyrightLanguageFeatures(); if (monacoRef.current) monacoRef.current.editor.setModelMarkers(model, 'pyright', []) }
  }, [enableLanguageService])
  useEffect(() => {
    const useFallback = enableSyntaxCheck && isReady && (!enableLanguageService || !lspConnected)
    if (!useFallback) {
      const model = editorRef.current?.getModel()
      if (model && monacoRef.current) monacoRef.current.editor.setModelMarkers(model, 'pyodide', [])
      return
    }
    const timer = setTimeout(async () => {
      const errors = await checkSyntax(code)
      const model = editorRef.current?.getModel()
      if (!model || !monacoRef.current) return
      monacoRef.current.editor.setModelMarkers(model, 'pyodide', errors.map(e => ({
        startLineNumber: e.line, startColumn: 1,
        endLineNumber: e.line, endColumn: model.getLineMaxColumn(e.line),
        message: e.message, severity: monacoRef.current!.MarkerSeverity.Error, source: 'Pyodide',
      })))
    }, 600)
    return () => clearTimeout(timer)
  }, [code, enableSyntaxCheck, enableLanguageService, lspConnected, isReady])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1e1e1e', color: '#d4d4d4' }}>
      <NavBar title="Python 代码编辑器" backTo="/" />
      <Header
        isReady={isReady}
        loadingStatus={loadingStatus}
        code={code}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
        onFormat={formatCodeLocal}
        onRun={handleRunCode}
        isRunning={isRunning}
        onTrace={handleTraceCode}
        isTracing={isTracing}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ flex: 1 }}>
            <EditorPane code={code} onChange={v => setCode(v)} onMount={handleEditorDidMount} enableAutoComplete={enableAutoComplete} />
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
      <StatusBar
        isReady={isReady}
        status={{
          message: !isReady ? loadingStatus
            : lspConnected ? 'Python 3.11 | Pyright LSP ✓'
              : enableLanguageService ? 'Python 3.11 | LSP 连接中... (需运行: npm run lsp:server)'
                : 'Python 3.11 | 本地模式',
          type: !isReady ? 'loading' : lspConnected ? 'success' : 'idle',
        }}
      />
      {traceResult && (
        <Visualizer result={traceResult} onClose={() => setTraceResult(null)} />
      )}
    </div>
  )
}
