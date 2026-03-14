/**
 * LSP WebSocket 连接核心
 * 职责：连接管理、JSON-RPC 消息收发、文档同步
 * 不依赖任何 provider，通过回调与 index.ts 解耦
 */
import * as monaco from 'monaco-editor'

// ── 连接状态 ───────────────────────────────────────────────────────────────
let socket: WebSocket | null = null   // WebSocket 实例，核心通信通道
let initialized = false               // 是否完成 LSP 初始化握手（initialize + initialized）
let pending: any[] = []               // 连接未就绪时的待发送请求队列（初始化前的请求暂存）
let idCounter = 1                     // 请求 ID 计数器（LSP 要求每个请求有唯一 ID，用于匹配响应）
const pendingMap = new Map<number, (res: any) => void>()  // 待响应请求映射（ID → 回调函数），用于接收响应后回调

// 连接状态管理：供外部组件订阅 LSP 连接变化
let lspConnected = false             // LSP 连接状态（true= 握手完成，可正常通信）
const connectionListeners = new Set<(connected: boolean) => void>() // 连接状态监听集合，供外部组件订阅状态变化
// 设置连接状态，通知所有监听器
function setLspConnected(v: boolean) {
  if (lspConnected === v) return      // 无变化则跳过
  lspConnected = v
  connectionListeners.forEach(fn => fn(v))  // 通知所有订阅者
}
/* 订阅 LSP 连接状态变化，返回取消订阅函数 */
export function onPyrightConnectionChange(fn: (connected: boolean) => void): () => void {
  connectionListeners.add(fn)
  fn(lspConnected) // 立即通知当前状态
  return () => connectionListeners.delete(fn) // 取消订阅
}
// 外部获取当前连接状态
export function isPyrightConnected(): boolean { return lspConnected }
export function isPyrightActive(): boolean { return initialized }

// ── 生命周期回调（由 index.ts 注入，避免循环依赖）────────────────────────
type SemanticLegendCb = (types: string[], mods: string[]) => void
type VoidCb = () => void
type DiagCb = (params: any) => void

let _onSemanticLegend: SemanticLegendCb | null = null
let _onServerReady: VoidCb | null = null
let _onDiagnostics: DiagCb | null = null

export function setConnectionCallbacks(opts: {
  onSemanticLegend?: SemanticLegendCb
  onServerReady?: VoidCb
  onDiagnostics?: DiagCb
}) {
  if (opts.onSemanticLegend) _onSemanticLegend = opts.onSemanticLegend
  if (opts.onServerReady)    _onServerReady    = opts.onServerReady
  if (opts.onDiagnostics)    _onDiagnostics    = opts.onDiagnostics
}

// ── 消息收发 ───────────────────────────────────────────────────────────────
export function send(message: any) {
  if (initialized && socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message))
  } else {
    pending.push(message)
  }
}

export function request(method: string, params: any): Promise<any> {
  const id = idCounter++
  return new Promise(resolve => {
    pendingMap.set(id, resolve)
    send({ jsonrpc: '2.0', id, method, params })
  })
}

// ── 文档同步 ───────────────────────────────────────────────────────────────
// LSP 要求客户端同步文档状态（打开 / 修改）到服务器，服务器才能精准分析代码
// 通知服务器 “文档已打开”
export function openVirtualDocument(model: monaco.editor.ITextModel) {
  send({ 
    jsonrpc: '2.0', 
    method: 'textDocument/didOpen', 
    params: { 
      textDocument: { 
        uri: model.uri.toString(), // 文档唯一标识
        languageId: 'python', 
        version: model.getVersionId(), // 文档版本（防冲突）
        text: model.getValue() // 文档完整内容
      } 
    } 
  })
}

// 防抖同步文档修改
export function syncModelChange(model: monaco.editor.ITextModel) {
  send({ 
    jsonrpc: '2.0', 
    method: 'textDocument/didChange',
     params: { 
      textDocument: { 
        uri: model.uri.toString(), 
        version: model.getVersionId() 
      }, 
      contentChanges: [{ text: model.getValue() }]  // 全量同步（简单场景）
    } 
  })
}

// ── 连接 / 断开 ────────────────────────────────────────────────────────────
let retryCount = 0
const MAX_RETRIES = 8

export function connectPyright(url = 'ws://localhost:3001') {
  if (socket && socket.readyState !== WebSocket.CLOSED) return
  socket = new WebSocket(url)
  let initRequestId: number | null = null

  socket.onopen = () => {
    retryCount = 0                // 成功连接，重置重试计数
    setLspConnected(false)        // 连接建立，但还未 initialize 完成
    initRequestId = idCounter++   // 初始化请求 ID，确保唯一性
    const payload = {
      jsonrpc: '2.0', id: initRequestId, method: 'initialize',
      params: {
        processId: null, rootUri: null,
        capabilities: {
          textDocument: {
            semanticTokens: { dynamicRegistration: false, requests: { full: true, range: false }, tokenTypes: [], tokenModifiers: [], formats: ['relative'] },
            synchronization: { dynamicRegistration: false, didSave: false, willSave: false },
            completion: { dynamicRegistration: false, completionItem: { snippetSupport: true, documentationFormat: ['markdown', 'plaintext'] } },
            hover: { dynamicRegistration: false, contentFormat: ['markdown', 'plaintext'] },
            definition: { dynamicRegistration: false },
            references: {},
            codeAction: { dynamicRegistration: false, codeActionLiteralSupport: { codeActionKind: { valueSet: ['', 'quickfix', 'refactor', 'source'] } } },
            signatureHelp: { dynamicRegistration: false, signatureInformation: { documentationFormat: ['markdown', 'plaintext'], parameterInformation: { labelOffsetSupport: true } } },
            documentSymbol: { dynamicRegistration: false, hierarchicalDocumentSymbolSupport: true }
          }
        }
      }
    }
    // 发送初始化请求（连接就绪则直接发，否则加入待发送队列）
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload))
    else pending.push(payload)
  }

  // 消息接收（onmessage）：处理服务器响应 / 推送
  socket.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data)
      // 过滤冗余日志（避免控制台刷屏）
      if (msg.method === 'window/logMessage') return  // 过滤 Pyright 内部日志

      // initialize 响应 — 协商 legend 并完成握手
      if (initRequestId && msg.id === initRequestId) {
        const legend = msg.result?.capabilities?.semanticTokensProvider?.legend
        if (legend) _onSemanticLegend?.(legend.tokenTypes || [], legend.tokenModifiers || [])
        send({ jsonrpc: '2.0', method: 'initialized', params: {} })
        initialized = true
        setLspConnected(true)
        pending.forEach(m => socket?.send(JSON.stringify(m))); pending = []
        monaco.editor.getModels().forEach(m => { if (m.getLanguageId() === 'python') openVirtualDocument(m) })
        console.log('[lsp] connected, semanticTokens:', !!legend)
        return
      }

      // 处理服务器推送的消息（非响应类）
      if (msg.method === 'pyright/serverReady') { _onServerReady?.(); return }
      if (msg.method === 'workspace/semanticTokens/refresh') return
      if (msg.method === 'textDocument/publishDiagnostics') { _onDiagnostics?.(msg.params); return }

      // 处理请求响应（匹配 pendingMap 中的回调）
      if (msg.id && pendingMap.has(msg.id)) {
        const resolve = pendingMap.get(msg.id)!
        pendingMap.delete(msg.id)
        resolve(msg)
      }
    } catch (e) { console.warn('[lsp] parse error', e) }
  }

  socket.onerror = () => {
    if (retryCount === 0) console.warn('[lsp] server unavailable. Run: npm run lsp:server')
  }

  // 连接关闭（onclose）：指数退避重连
  socket.onclose = () => {
    initialized = false
    setLspConnected(false)
    if (retryCount >= MAX_RETRIES) {
      console.warn(`[lsp] stopped retrying after ${MAX_RETRIES} attempts`)
      return
    }
    retryCount++
    const delay = Math.min(1500 * Math.pow(2, retryCount - 1), 30000)
    setTimeout(() => { if (!socket || socket.readyState === WebSocket.CLOSED) connectPyright(url) }, delay)
  }
}

export function disconnectPyright() {
  try { socket?.close() } catch {}
  socket = null
  initialized = false
  setLspConnected(false)
}
