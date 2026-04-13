/**
 * AI 客户端（后端代理模式）
 *
 * 安全设计：
 * - 前端不持有任何 API Key
 * - 所有请求经后端 /api/ai/* 代理转发至实际模型服务
 * - 后端从 .env 读取密钥，Key 始终不出服务器
 *
 * 接口兼容性：
 * - chat()     → POST /api/ai/chat      （非流式）
 * - streamChat → POST /api/ai/stream    （SSE 流式）
 */

import axios from 'axios'

// ── 类型定义 ──

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatOptions {
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  model?: string
}

interface ChatResponse {
  content: string
  model: string
}

const AI_BASE = '/api/ai'

// ── 实现 ──

class ModelClient {
  constructor() {
    // 不再读取任何 API Key
    console.log('[ModelClient] 初始化（后端代理模式）')
  }

  /**
   * 非流式聊天 — 经后端代理转发
   */
  async chat(options: ChatOptions): Promise<ChatResponse> {
    const { messages, temperature = 0.7, maxTokens = 1000 } = options

    console.log('[ModelClient] chat request (proxy)', {
      messagesCount: messages.length,
    })

    try {
      const { data } = await axios.post(`${AI_BASE}/chat`, {
        messages,
        temperature,
        max_tokens: maxTokens,
      }, { timeout: 30000 })

      return { content: data.content, model: data.model }
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 503) {
        console.warn('[ModelClient] AI 服务未配置，返回模拟响应')
        return this.getMockResponse(messages)
      }
      if (status === 401 || status === 403) {
        throw new Error(`鉴权失败(${status})，请联系管理员检查后端 AI 配置`)
      }
      throw new Error(`AI 服务错误: ${error.message}`)
    }
  }

  /**
   * SSE 流式聊天 — 后端透传 SSE 流至前端
   *
   * 数据流：
   *   前端 fetch → 后端 /api/ai/stream → 大模型 SSE → 后端逐行 yield → 前端 onDelta 回调
   */
  async streamChat(
    options: ChatOptions,
    onDelta: (text: string) => void,
  ): Promise<ChatResponse> {
    const { messages, temperature = 0.5, maxTokens = 800 } = options

    console.log('[ModelClient] stream request (proxy)', { messagesCount: messages.length })

    const response = await fetch(`${AI_BASE}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, temperature, max_tokens: maxTokens }),
    })

    // 服务未配置时回退到模拟响应
    if (!response.ok || !response.body) {
      if (response.status === 503) {
        console.warn('[ModelClient] AI 未配置，流式模拟')
        const mock = this.getMockResponse(messages)
        onDelta(mock.content)
        return mock
      }
      throw new Error(`流式请求失败: ${response.status}`)
    }

    // 读取后端转发的 SSE 流
    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let full = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        // 解析 SSE 行格式: data: "文本"\n\n
        const lines = chunk.split(/\r?\n/).filter(l => l.startsWith('data: '))

        for (const line of lines) {
          const raw = line.slice(6).trim()

          if (raw === '[DONE]') break

          // 检查是否为错误标记
          if (raw.startsWith('[ERROR]')) {
            throw new Error(raw.slice(7))
          }

          try {
            // 后端发送的 data 内容是 JSON 字符串化的纯文本 delta
            const delta = JSON.parse(raw)
            if (typeof delta === 'string' && delta) {
              full += delta
              onDelta(delta)
            }
          } catch {
            // 兼容：如果解析失败且非特殊标记，当作纯文本处理
            if (raw) { full += raw; onDelta(raw) }
          }
        }
      }
    } catch (e: any) {
      console.error('[ModelClient] 流读取错误', e)
      throw new Error('流式读取失败: ' + e.message)
    }

    return { content: full, model: 'via-backend-proxy' }
  }

  // ── Mock 响应 ──

  private getMockResponse(messages: ChatMessage[]): ChatResponse {
    const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || ''

    let text =
      '后端 AI 服务尚未配置。请在服务器 backend/.env 中设置 AI_API_KEY 以启用真实 AI 功能。'

    if (lastMsg.includes('解释')) {
      text = '这段代码定义了一个函数，用于处理特定逻辑。启用 AI 后可获得更详细的分析。'
    } else if (lastMsg.includes('优化')) {
      text = '优化建议：\n1. 减少重复计算\n2. 拆分大函数提升可读性\n3. 增加错误处理和边界条件判断'
    }

    return { content: text, model: 'mock-backend' }
  }
}

// ── 单例导出 ──

let instance: ModelClient | null = null

export function getModelClient(): ModelClient {
  if (!instance) instance = new ModelClient()
  return instance
}
