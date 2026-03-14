/**
 * AI 内联操作气泡
 *
 * 两层机制：
 * 1. CodeLens  — 有 Pyright 错误的行上方显示 "🤖 AI修复" 按钮
 * 2. 选区工具栏 — 选中代码后浮动出现 [解释][优化][注释][重构] 按钮
 *
 * 调用方（App.tsx）通过 onAction 回调接收用户意图，
 * AI 调用结束后用 applyToEditor 将结果写回编辑器（支持 undo）。
 */
import * as monaco from 'monaco-editor'

// ── 公共类型 ───────────────────────────────────────────────────────────────
export type AIActionType = 'fix' | 'explain' | 'optimize' | 'comment' | 'refactor'

export interface AIActionEvent {
  action: AIActionType
  code: string               // 选中 / 错误行的代码
  range: monaco.IRange       // 对应编辑器范围（用于写回）
  context?: string           // 额外上下文，如错误信息
}

export interface AIActionsOptions {
  /** 用户点击按钮时触发；调用 AI 后用 applyToEditor 写回 */
  onAction: (evt: AIActionEvent) => void
}

// ── 将 AI 回复写回编辑器（可 Undo）──────────────────────────────────────
export function applyToEditor(
  editor: monaco.editor.IStandaloneCodeEditor,
  range: monaco.IRange,
  newCode: string
) {
  editor.executeEdits('ai-action', [{
    range: new monaco.Range(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn),
    text: newCode,
    forceMoveMarkers: true
  }])
  editor.focus()
}

// ── 内部状态 ───────────────────────────────────────────────────────────────
let codeLensDisposable: monaco.IDisposable | null = null
let selectionDisposable: monaco.IDisposable | null = null
let toolbarWidget: AIToolbarWidget | null = null

// ── 1. CodeLens：错误行上方的 AI 修复按钮 ────────────────────────────────
function registerAICodeLens(editor: monaco.editor.IStandaloneCodeEditor, onAction: AIActionsOptions['onAction']) {
  // 注册命令（命令 ID 由 Monaco 生成并返回）
  const fixCmdId = editor.addCommand(0, (_ctx: any, model: monaco.editor.ITextModel, line: number) => {
    const markers = monaco.editor.getModelMarkers({ resource: model.uri })
      .filter(m => m.source === 'Pyright' && m.startLineNumber === line)
    const errorMessages = markers.map(m => m.message).join('\n')
    const lineText = model.getLineContent(line)
    onAction({
      action: 'fix',
      code: lineText,
      range: new monaco.Range(line, 1, line, model.getLineMaxColumn(line)),
      context: errorMessages
    })
  }, '') ?? ''

  codeLensDisposable = monaco.languages.registerCodeLensProvider('python', {
    provideCodeLenses: (model) => {
      const markers = monaco.editor.getModelMarkers({ resource: model.uri })
        .filter(m => m.source === 'Pyright' && m.severity === monaco.MarkerSeverity.Error)
      const lines = [...new Set(markers.map(m => m.startLineNumber))]
      return {
        lenses: lines.map(line => ({
          range: new monaco.Range(line, 1, line, 1),
          command: { id: fixCmdId, title: '🤖 AI修复', arguments: [model, line] }
        })),
        dispose: () => {}
      }
    },
    resolveCodeLens: (_model, lens) => lens
  })
}

// ── 2. 选区工具栏 ─────────────────────────────────────────────────────────
const TOOLBAR_BUTTONS: { label: string; action: AIActionType }[] = [
  { label: '解释', action: 'explain' },
  { label: '优化', action: 'optimize' },
  { label: '注释', action: 'comment' },
  { label: '重构', action: 'refactor' },
]

class AIToolbarWidget implements monaco.editor.IOverlayWidget {
  private dom: HTMLElement
  private editor: monaco.editor.IStandaloneCodeEditor

  constructor(editor: monaco.editor.IStandaloneCodeEditor, onAction: AIActionsOptions['onAction']) {
    this.editor = editor
    this.dom = this.buildDom(onAction)
    editor.addOverlayWidget(this)
  }

  getId() { return 'ai.selection.toolbar' }
  getDomNode() { return this.dom }
  getPosition(): monaco.editor.IOverlayWidgetPosition | null { return null }  // 手动定位

  private buildDom(onAction: AIActionsOptions['onAction']): HTMLElement {
    const wrap = document.createElement('div')
    wrap.style.cssText = [
      'position:absolute', 'display:none', 'align-items:center', 'gap:4px',
      'background:#252526', 'border:1px solid #3e3e3e', 'border-radius:6px',
      'padding:3px 6px', 'box-shadow:0 2px 8px rgba(0,0,0,.5)',
      'z-index:100', 'pointer-events:auto', 'font-size:11px'
    ].join(';')

    for (const { label, action } of TOOLBAR_BUTTONS) {
      const btn = document.createElement('button')
      btn.textContent = label
      btn.title = `AI ${label}`
      btn.style.cssText = [
        'background:transparent', 'border:none', 'color:#d4d4d4',
        'cursor:pointer', 'padding:2px 6px', 'border-radius:3px',
        'font-size:11px', 'white-space:nowrap'
      ].join(';')
      btn.onmouseenter = () => { btn.style.background = '#094771'; btn.style.color = '#fff' }
      btn.onmouseleave = () => { btn.style.background = 'transparent'; btn.style.color = '#d4d4d4' }
      btn.onclick = (e) => {
        e.stopPropagation()
        const selection = this.editor.getSelection()
        if (!selection || selection.isEmpty()) return
        const code = this.editor.getModel()?.getValueInRange(selection) ?? ''
        onAction({ action, code, range: selection })
        this.hide()
      }
      wrap.appendChild(btn)
    }
    return wrap
  }

  show(top: number, left: number) {
    this.dom.style.display = 'flex'
    this.dom.style.top = `${Math.max(0, top - 36)}px`
    this.dom.style.left = `${left}px`
  }

  hide() { this.dom.style.display = 'none' }

  dispose() { this.editor.removeOverlayWidget(this) }
}

function registerSelectionToolbar(editor: monaco.editor.IStandaloneCodeEditor, onAction: AIActionsOptions['onAction']) {
  toolbarWidget = new AIToolbarWidget(editor, onAction)

  selectionDisposable = editor.onDidChangeCursorSelection((e) => {
    const sel = e.selection
    if (sel.isEmpty()) {
      toolbarWidget?.hide()
      return
    }
    // 将选区起始位置转换为编辑器像素坐标
    const coords = editor.getScrolledVisiblePosition({ lineNumber: sel.startLineNumber, column: sel.startColumn })
    if (coords) toolbarWidget?.show(coords.top, coords.left)
    else toolbarWidget?.hide()
  })

  // 点击编辑器空白处隐藏工具栏
  editor.onMouseDown(() => {
    // 延迟一帧，让 onDidChangeCursorSelection 先触发
    requestAnimationFrame(() => {
      const sel = editor.getSelection()
      if (!sel || sel.isEmpty()) toolbarWidget?.hide()
    })
  })
}

// ── 公共 API ───────────────────────────────────────────────────────────────
/** 注册所有 AI 内联操作；返回 dispose 函数 */
export function registerAIActions(
  editor: monaco.editor.IStandaloneCodeEditor,
  options: AIActionsOptions
): () => void {
  registerAICodeLens(editor, options.onAction)
  registerSelectionToolbar(editor, options.onAction)
  return disposeAIActions
}

/** 销毁所有 AI 内联操作 */
export function disposeAIActions() {
  codeLensDisposable?.dispose(); codeLensDisposable = null
  selectionDisposable?.dispose(); selectionDisposable = null
  toolbarWidget?.dispose(); toolbarWidget = null
}
