import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import { getModelClient } from '../../services/modelClient'
import { useChatSessions, ChatMessage } from '../../hooks/useChatSessions'

interface ChatPanelProps {
  code: string
  selectedCode?: string
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

// 相对时间显示：刚刚 / Xm前 / Xh前 / 昨天 / X天前
function relativeTime(ts: number): string {
  const min = Math.floor((Date.now() - ts) / 60000)
  if (min < 1)  return '刚刚'
  if (min < 60) return `${min}m前`
  const h = Math.floor(min / 60)
  if (h < 24)   return `${h}h前`
  const d = Math.floor(h / 24)
  return d === 1 ? '昨天' : `${d}天前`
}

export default function ChatPanel({ code, selectedCode }: ChatPanelProps) {
  const {
    sessions,
    activeSession,
    activeId,
    createSession,
    deleteSession,
    switchSession,
    updateMessages,
  } = useChatSessions()

  const messages = activeSession?.messages ?? []

  const [input,        setInput]        = useState('')
  const [streaming,    setStreaming]     = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [showSessions, setShowSessions] = useState(false)

  const listRef        = useRef<HTMLDivElement | null>(null)
  const sessionBarRef  = useRef<HTMLDivElement | null>(null)

  // 消息更新时自动滚动到底部
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, streaming])

  // 点击会话栏外部时收起下拉
  useEffect(() => {
    if (!showSessions) return
    const handler = (e: MouseEvent) => {
      if (sessionBarRef.current && !sessionBarRef.current.contains(e.target as Node)) {
        setShowSessions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSessions])

  // 流式问答
  const streamAsk = async (content: string) => {
    if (!content.trim() || streaming) return
    setError(null)
    setStreaming(true)

    const userMsg:    ChatMessage = { role: 'user',      content,  id: uid() }
    const assistantId = uid()
    const placeholder: ChatMessage = { role: 'assistant', content: '', id: assistantId, model: '' }

    // 先把用户消息和助手占位一起写入（快照作为后续更新的基准）
    const base = [...messages, userMsg]
    updateMessages([...base, placeholder])

    let acc = ''
    try {
      const client = getModelClient()
      // 上下文窗口保护：只截断发给 API 的历史，UI 和持久化保留完整记录
      const contextHistory = messages.slice(-10)

      const resp = await client.streamChat({
        messages: [
          { role: 'system', content: '你是一名专业的 Python 编程助教，回答精炼且包含必要示例。' },
          ...contextHistory.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content },
        ],
        temperature: 0.6,
        maxTokens: 800,
      }, (delta) => {
        acc += delta
        // 直接用 base 快照重建，不依赖 prev（避免 stale closure 叠加 delta 错位）
        updateMessages([...base, { role: 'assistant', content: acc, id: assistantId, model: 'stream' }])
      })

      // 流结束：写入最终模型名
      updateMessages([...base, { role: 'assistant', content: acc, id: assistantId, model: resp.model || '' }])
    } catch (e: any) {
      setError(e.message || '流式请求失败')
    } finally {
      setStreaming(false)
    }
  }

  const handleQuickAsk = (type: 'explain' | 'optimize' | 'tests') => {
    if (streaming) return
    const source     = (selectedCode?.trim()) ? selectedCode : code
    const isSelection = !!(selectedCode?.trim())
    if (!source.trim()) { setError(isSelection ? '选中的代码为空' : '当前没有代码可分析'); return }
    if (type === 'explain')  streamAsk(`请解释以下${isSelection ? '代码片段' : '代码'}：\n\n${source}`)
    if (type === 'optimize') streamAsk(`请优化以下${isSelection ? '代码片段' : '代码'}并说明改进点：\n\n${source}`)
    if (type === 'tests')    streamAsk(`请为以下${isSelection ? '代码片段' : '代码'}生成完整的单元测试（使用 pytest 风格），并说明每个测试的目的：\n\n${source}`)
  }

  const handleNewSession = () => {
    if (streaming) return
    createSession()
    setShowSessions(false)
    setError(null)
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    deleteSession(id)
    setShowSessions(false)
  }

  const handleSwitch = (id: string) => {
    switchSession(id)
    setShowSessions(false)
    setError(null)
  }

  // 下拉列表按最后更新时间降序
  const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      {/* ── 会话栏 ── */}
      <div ref={sessionBarRef} style={{ position: 'relative', marginBottom: '8px' }}>
        {/* 标题行 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '5px 8px',
          background: '#252526',
          border: '1px solid #3e3e3e',
          borderRadius: showSessions ? '4px 4px 0 0' : '4px',
          fontSize: '12px',
        }}>
          {/* 新建按钮 */}
          <button
            onClick={handleNewSession}
            disabled={streaming}
            title="新建会话"
            style={{ ...iconBtn, color: '#4ec9b0', border: '1px solid #1e4a3a', background: '#162e26' }}
          >+</button>

          {/* 当前会话标题（点击展开列表） */}
          <span
            onClick={() => setShowSessions(v => !v)}
            title={activeSession?.title}
            style={{
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', color: '#d4d4d4', cursor: 'pointer', userSelect: 'none',
            }}
          >
            {activeSession?.title || '新会话'}
          </span>

          {/* 会话计数 */}
          {sessions.length > 1 && (
            <span style={{ fontSize: '10px', color: '#666', flexShrink: 0 }}>
              {sortedSessions.findIndex(s => s.id === activeId) + 1}/{sessions.length}
            </span>
          )}

          {/* 展开/收起 */}
          <button
            onClick={() => setShowSessions(v => !v)}
            style={{ ...iconBtn, color: '#888' }}
            title="会话列表"
          >{showSessions ? '▲' : '▼'}</button>
        </div>

        {/* 下拉会话列表 */}
        {showSessions && (
          <div className="session-list" style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
            background: '#252526',
            border: '1px solid #3e3e3e', borderTop: 'none',
            borderRadius: '0 0 4px 4px',
            maxHeight: '200px', overflowY: 'auto',
          }}>
            {sortedSessions.map(s => (
              <div
                key={s.id}
                onClick={() => handleSwitch(s.id)}
                style={{
                  display: 'flex', alignItems: 'center',
                  padding: '7px 10px', cursor: 'pointer', fontSize: '12px',
                  background:   s.id === activeId ? '#2d2d2d' : 'transparent',
                  borderLeft: `2px solid ${s.id === activeId ? '#0e639c' : 'transparent'}`,
                }}
                onMouseEnter={e => { if (s.id !== activeId) (e.currentTarget as HTMLElement).style.background = '#2a2a2a' }}
                onMouseLeave={e => { if (s.id !== activeId) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <span style={{
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: s.id === activeId ? '#e8e8e8' : '#bbb',
                }}>{s.title}</span>
                <span style={{ fontSize: '10px', color: '#555', marginLeft: '8px', flexShrink: 0 }}>
                  {relativeTime(s.updatedAt)}
                </span>
                <button
                  onClick={e => handleDelete(e, s.id)}
                  title="删除会话"
                  style={{ marginLeft: '6px', padding: '0 4px', background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f48771' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#555' }}
                >×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 快捷操作 ── */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <button onClick={() => handleQuickAsk('explain')}  disabled={streaming} style={btnStyle}>🧐 解释代码</button>
        <button onClick={() => handleQuickAsk('optimize')} disabled={streaming} style={btnStyle}>⚙️ 优化代码</button>
        <button onClick={() => handleQuickAsk('tests')}    disabled={streaming} style={btnStyle}>🧪 生成测试</button>
        <button
          onClick={() => { if (!streaming) updateMessages([]) }}
          disabled={streaming}
          style={{ ...btnStyle, background: '#5a1e1e', color: '#f48771' }}
        >🗑️ 清空</button>
      </div>

      {/* ── 消息列表 ── */}
      <div ref={listRef} style={{
        flex: 1, overflowY: 'auto', padding: '10px',
        background: '#1e1e1e', border: '1px solid #3e3e3e', borderRadius: '6px',
      }}>
        {messages.length === 0 && (
          <div style={{ fontSize: '12px', color: '#888' }}>开始提问：例如 "解释当前递归函数在做什么？"</div>
        )}
        {messages.map(m => (
          <div key={m.id} style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column' }}>
            {m.role === 'user' ? (
              <div style={{
                alignSelf: 'flex-end', background: '#0e639c', color: '#fff',
                padding: '8px 10px', borderRadius: '10px', maxWidth: '85%',
                fontSize: '12px', whiteSpace: 'pre-wrap', lineHeight: 1.5,
              }}>{m.content}</div>
            ) : (
              <div className="chat-md" style={{
                alignSelf: 'flex-start', background: '#2d2d2d', color: '#d4d4d4',
                padding: '8px 12px', borderRadius: '10px', maxWidth: '92%',
                fontSize: '12px', lineHeight: 1.6,
              }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {m.content || (streaming ? '▍' : '')}
                </ReactMarkdown>
              </div>
            )}
            {m.model && m.role === 'assistant' && m.model !== 'stream' && (
              <div style={{ fontSize: '10px', color: '#555', marginTop: '2px', marginLeft: '4px' }}>{m.model}</div>
            )}
          </div>
        ))}
        {streaming && <div style={{ fontSize: '12px', color: '#888' }}>⌛ 正在生成回复...</div>}
        {error    && <div style={{ fontSize: '12px', color: '#f48771' }}>错误: {error}</div>}
      </div>

      {/* ── 输入框 ── */}
      <form
        onSubmit={e => { e.preventDefault(); streamAsk(input); setInput('') }}
        style={{ display: 'flex', gap: '8px', marginTop: '8px' }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="输入问题，回车发送..."
          disabled={streaming}
          style={{
            flex: 1, background: '#1e1e1e', border: '1px solid #3e3e3e',
            borderRadius: '4px', padding: '8px', color: '#d4d4d4', fontSize: '12px',
          }}
        />
        <button type="submit" disabled={streaming || !input.trim()} style={{ ...btnStyle, background: '#16825d' }}>
          发送
        </button>
      </form>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '6px 10px', background: '#2d2d2d',
  border: '1px solid #3e3e3e', borderRadius: '4px',
  cursor: 'pointer', fontSize: '12px', color: '#d4d4d4',
}

const iconBtn: React.CSSProperties = {
  padding: '2px 7px', background: 'transparent',
  border: '1px solid transparent', borderRadius: '3px',
  cursor: 'pointer', fontSize: '13px', color: '#888', lineHeight: 1.4,
}
