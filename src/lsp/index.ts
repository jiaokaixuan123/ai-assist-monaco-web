/**
 * LSP 公共 API 入口
 * App.tsx 只从这里导入，不直接依赖任何子模块
 */
import * as monaco from 'monaco-editor'
import {
  connectPyright as _connect,
  disconnectPyright,
  setConnectionCallbacks,
  openVirtualDocument,
  syncModelChange,
  onPyrightConnectionChange,
  isPyrightConnected,
  isPyrightActive,
} from './connection'

import { applyDiagnostics, setSyntaxCheckEnabled } from './providers/diagnostics'
import { setAutoCompleteEnabled, registerCompletionProvider, disposeCompletionProvider } from './providers/completion'
import { registerHoverProvider, disposeHoverProvider } from './providers/hover'
import { registerSignatureHelpProvider, disposeSignatureHelpProvider } from './providers/signature'
import { registerCodeActionProvider, disposeCodeActionProvider } from './providers/codeAction'
import { registerDefinitionProvider, registerReferenceProvider, registerDocumentSymbolProvider,
         disposeDefinitionProvider, disposeReferenceProvider, disposeDocumentSymbolProvider } from './providers/navigation'
import { setSemanticLegend, registerSemanticTokensProvider, setSemanticHighlightEnabled,
         isLegendReady, disposeSemanticProvider } from './providers/semantic'

// ── 公共 setter re-exports ────────────────────────────────────────────────
export { setSyntaxCheckEnabled, setAutoCompleteEnabled, setSemanticHighlightEnabled }
export { onPyrightConnectionChange, isPyrightConnected, isPyrightActive }
export { openVirtualDocument, syncModelChange, disconnectPyright }
export { applyDiagnostics }

// ── 注入 connection 回调（避免循环依赖）──────────────────────────────────
setConnectionCallbacks({
  onSemanticLegend: (types, mods) => {
    setSemanticLegend(types, mods)
    registerSemanticTokensProvider()
  },
  onServerReady: () => {
    monaco.editor.getModels().forEach(m => { if (m.getLanguageId() === 'python') initPythonModel(m) })
  },
  onDiagnostics: applyDiagnostics
})

// ── 防重复绑定 ────────────────────────────────────────────────────────────
const initializedModels = new WeakSet<monaco.editor.ITextModel>()

/** 初始化单个 Python 模型：注册所有 providers + 绑定文档同步 */
export function initPythonModel(model: monaco.editor.ITextModel) {
  if (model.getLanguageId() !== 'python') return

  // 所有 provider 注册均幂等
  registerCompletionProvider()
  registerHoverProvider()
  registerDefinitionProvider()
  registerSignatureHelpProvider()
  registerCodeActionProvider()
  registerReferenceProvider()
  registerDocumentSymbolProvider()
  if (isLegendReady()) registerSemanticTokensProvider()

  // WeakSet 防止重复绑定 onDidChangeContent
  if (initializedModels.has(model)) return
  initializedModels.add(model)

  let syncTimer: ReturnType<typeof setTimeout>
  model.onDidChangeContent(() => {
    clearTimeout(syncTimer)
    syncTimer = setTimeout(() => syncModelChange(model), 200)
  })
}

/** 启动 Pyright LSP 连接（注入回调后再连）*/
export function connectPyright(url?: string) {
  _connect(url)
}

/** 停用所有 LSP 语言功能（不断开连接）*/
export function disablePyrightLanguageFeatures() {
  disposeCompletionProvider()
  disposeHoverProvider()
  disposeSignatureHelpProvider()
  disposeCodeActionProvider()
  disposeDefinitionProvider()
  disposeReferenceProvider()
  disposeDocumentSymbolProvider()
  disposeSemanticProvider()
  console.log('[lsp] language features disabled')
}
