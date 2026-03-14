// Pyright 语言服务器的 WebSocket 桥接服务
// 前端（浏览器）可以通过 WebSocket 协议与 Pyright 语言服务器进行通信
// 实现 Python 代码的类型检查、补全、语义高亮等 LSP（Language Server Protocol）功能

import { WebSocketServer } from 'ws'    // 导入websocket模块
import { spawn } from 'child_process'   // 导入子进程模块
import { createMessageConnection, StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc'  // 导入 JSON RPC 协议模块
import path from 'node:path'                // 导入路径模块
import fs from 'node:fs'                    // 导入文件系统模块

const PORT = process.env.PYRIGHT_WS_PORT || 3001  // 监听端口

// JSON-RPC 是一种基于 JSON 格式的轻量级远程过程调用（RPC）协议，
// 旨在实现分布式系统中不同服务之间的通信。它具有无状态、跨平台、易于解析等特点，
// 支持多种传输协议（如 HTTP、WebSocket 等）
// 简单广播工具
function broadcast(obj) {
  const payload = JSON.stringify({ jsonrpc: '2.0', ...obj })              // 序列化 JSON 对象
  for (const ws of clients) { if (ws.readyState === 1) ws.send(payload) } // 广播给所有客户端
}

// 创建语言服务器进程
let serverProcess = null
function spawnLanguageServer() {
  const isWin = process.platform === 'win32'    // 判断是否为 Windows 系统
  const bin = path.resolve(process.cwd(), 'node_modules', '.bin', isWin ? 'pyright-langserver.cmd' : 'pyright-langserver')  // 语言服务器二进制文件路径
  const exists = fs.existsSync(bin)             // 注意：Windows 系统下需要使用 .cmd 后缀
  let proc
  try {
    proc = spawn(exists ? bin : (isWin ? 'npx.cmd' : 'npx'), exists ? ['--stdio'] : ['pyright-langserver','--stdio'], {
      stdio: ['pipe', 'pipe', 'pipe'],    // 重定向 stdio: 标准输入输出
      shell: isWin                        // 允许在 Windows 上使用 shell 运行
    })
  } catch (e) {
    console.error('[pyright] initial spawn failed, retry with npx + shell', e)
    proc = spawn(isWin ? 'npx.cmd' : 'npx', ['pyright-langserver','--stdio'], { stdio: ['pipe','pipe','pipe'], shell: true })
  }
  proc.on('error', (e) => console.error('[pyright] spawn error', e))  // 错误处理
  proc.on('exit', (code, sig) => {                                    // 退出处理
    console.warn(`[pyright] exited code=${code} signal=${sig}`)
    // 自动重启
    setTimeout(() => {
      console.log('[pyright] restarting language server...')
      spawnLanguageServer()
      wireConnection()
    }, 2000)
  })
  serverProcess = proc
}

spawnLanguageServer()     // 创建

let reader, writer, lspConnection
function wireConnection() {       // 连接到语言服务器进程
  if (!serverProcess) return
  reader = new StreamMessageReader(serverProcess.stdout)    // 对象：输入流
  writer = new StreamMessageWriter(serverProcess.stdin)     // 对象：输出流
  lspConnection = createMessageConnection(reader, writer)   // 对象：JSON RPC 连接
  lspConnection.listen()                                    // 监听连接 
  lspConnection.onNotification('window/logMessage', (p) => {  // 日志通知
    if (p?.message) console.log('[pyright-log]', p.message)
  })
  lspConnection.onNotification('textDocument/publishDiagnostics', (p) => { //诊断通知
    broadcast({ method: 'textDocument/publishDiagnostics', params: p })
  })
  // 语义刷新通知需要透传给前端以便重新请求 tokens
  lspConnection.onNotification('workspace/semanticTokens/refresh', () => {
    console.log('[pyright-ws] semanticTokens refresh notification')
    broadcast({ method: 'workspace/semanticTokens/refresh', params: {} })
  })
  // 其他常见通知可按需继续添加
  // 
  // 
}

wireConnection()

// 维护所有已连接的 WebSocket 客户端
const clients = new Set()

// 客户端消息在 LS (language server) 初始化完成前暂存
const lsRequestQueue = []   // ls请求队列
let lsInitialized = false

// 清空并执行 暂存的请求 队列
function flushQueue() {
  while (lsRequestQueue.length) {       
    const fn = lsRequestQueue.shift()   // 循环取出队列里的第一个函数shift()
    try { fn() } catch (e) { console.warn('[pyright-ws] flushQueue error', e) }// 执行
  }
}

// 监听 LS 通知：捕获开始并广播
lspConnection?.onNotification && lspConnection.onNotification('pyright/beginProgress', (p) => {
  broadcast({ method: 'pyright/beginProgress', params: p })   // 广播进度通知给clients集合里的所有前端 WebSocket 客户端
})

// 处理 Pyright 语言服务器的请求
lspConnection.onRequest(async () => {
  // 情况极少,先不返回
  return null
})

// 创建 WebSocket 服务端
const wss = new WebSocketServer({ port: PORT })
console.log(`[pyright-ws] listening on ws://localhost:${PORT}`)

let initializedLS = false
// 缓存 Pyright 返回的 capabilities，用于响应客户端的 initialize 请求，避免重复转发
let pyrightCapabilities = null

// 客户端连接后初始化语言服务器
function initializeLanguageServer() {
  if (initializedLS) return
  initializedLS = true
  // rootUri 使用 file:/// 根路径，配合 openFilesOnly 模式，
  // 使 Pyright 能识别 file:///virtual/main.py 这类虚拟路径
  const rootUri = 'file:///'
  const initParams = {
    processId: null,
    rootUri,
    workspaceFolders: [{ name: 'workspace', uri: rootUri }],
    initializationOptions: {
      openFilesOnly: true  // 只分析已通过 didOpen 打开的文件，不扫描文件系统
    },
    capabilities: {
      textDocument: {           // 文本文档功能列表
        // 同步
        synchronization: { didSave: true, willSave: false, dynamicRegistration: false },
        // 补全
        completion: { completionItem: { snippetSupport: true } },
        // 悬停提示
        hover: {},
        // 定义跳转
        definition: {},
        // 引用查找
        references: {},
        // 代码操作（快速修复）
        codeAction: { dynamicRegistration: false, codeActionLiteralSupport: { codeActionKind: { valueSet: ['', 'quickfix', 'refactor', 'source'] } } },
        // 函数签名提示
        signatureHelp: { dynamicRegistration: false, signatureInformation: { documentationFormat: ['markdown', 'plaintext'], parameterInformation: { labelOffsetSupport: true } } },
        // 文档符号：类、方法、变量等
        documentSymbol: { dynamicRegistration: false, hierarchicalDocumentSymbolSupport: true },
        // 语义tokens
        semanticTokens: {
          dynamicRegistration: false,
          requests: {
            full: true,   // 请求完整文档的 semantic tokens
            range: false  // 不请求范围 tokens
          },
          tokenTypes: [],
          tokenModifiers: []
        }
      }
    }
  }
  // 发送初始化请求
  lspConnection.sendRequest('initialize', initParams).then((result) => {
    pyrightCapabilities = result?.capabilities || {}  // 缓存服务器能力
    lspConnection.sendNotification('initialized', {}) // 通知初始化完成
    lsInitialized = true
    console.log('[pyright-ws] language server initialized rootUri=', rootUri) // 日志输出
    console.log('[pyright-ws] server capabilities:', JSON.stringify(pyrightCapabilities, null, 2)) // 日志输出
    flushQueue()    // 执行 暂存的请求 队列
    broadcast({ method: 'pyright/serverReady', params: { capabilities: pyrightCapabilities } })  // 通知前端 WebSocket 客户端 LS 已就绪
  }).catch(e => console.error('[pyright-ws] init failed', e))
}

// 客户端连接
wss.on('connection', (ws) => {
  clients.add(ws)             // 加入客户端集合
  console.log('[pyright-ws] client connected, total:', clients.size)
  initializeLanguageServer()  // 初始化语言服务器

  ws.on('message', (data) => {
    let msg
    try { msg = JSON.parse(data) } catch { return } // 前端消息先解析为 JSON 格式
    const forward = () => {
      if (msg.id && msg.method) { // 带id的请求（如补全、悬停）通过sendRequest转发
        // initialize 已由服务器处理完毕，直接返回缓存的 capabilities，不再转发给 Pyright
        if (msg.method === 'initialize') {
          ws.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { capabilities: pyrightCapabilities } }))
          return
        }
        lspConnection.sendRequest(msg.method, msg.params).then(result => {
          ws.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }))
        }).catch(error => {
          console.error('[pyright-ws] request error', msg.method, error?.message)
          ws.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { message: error?.message || String(error) } }))
        })
        return
      }
      if (msg.method && !msg.id) { // 无id的通知（如文件同步）通过sendNotification转发
        // initialized 已由服务器发送，忽略客户端的重复通知
        if (msg.method === 'initialized') return
        lspConnection.sendNotification(msg.method, msg.params)
      }
    }
    // 语言服务器未初始化，则将转发逻辑存入lsRequestQueue队列，初始化完成后执行，避免无效通信。
    if (!lsInitialized) lsRequestQueue.push(forward); else forward()
  })

  // 客户端断开连接
  ws.on('close', () => {
    clients.delete(ws)    // 从客户端集合中移除
    console.log('[pyright-ws] client disconnected, total:', clients.size)
  })
})

// 监听SIGINT信号（如终端 Ctrl+C）
process.on('SIGINT', () => {
  console.log('Shutting down...')
  wss.close()
  serverProcess.kill()
  process.exit(0)
})
