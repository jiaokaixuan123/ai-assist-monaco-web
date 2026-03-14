import { useState, useCallback } from 'react'

// 单条消息
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  id: string
  model?: string
}

// 一个会话
export interface ChatSession {
  id: string
  title: string      // 自动取第一条用户消息前 24 字
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
}

const SESSIONS_KEY = 'chat-sessions'
const ACTIVE_KEY   = 'chat-active-session'

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function loadSessions(): ChatSession[] {
  try {
    const s = localStorage.getItem(SESSIONS_KEY)
    if (s) return JSON.parse(s)
  } catch {}
  return []
}

function saveSessions(sessions: ChatSession[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

function makeSession(title = '新会话'): ChatSession {
  return { id: uid(), title, createdAt: Date.now(), updatedAt: Date.now(), messages: [] }
}

// 初始化时迁移旧版单会话数据（chat-messages → chat-sessions）
function initSessions(): ChatSession[] {
  let list = loadSessions()
  if (list.length === 0) {
    try {
      const old = localStorage.getItem('chat-messages')
      if (old) {
        const msgs: ChatMessage[] = JSON.parse(old)
        if (Array.isArray(msgs) && msgs.length > 0) {
          const firstUser = msgs.find(m => m.role === 'user')
          const session = { ...makeSession(firstUser?.content.slice(0, 24) || '旧会话'), messages: msgs }
          list = [session]
          saveSessions(list)
          return list
        }
      }
    } catch {}
    // 没有旧数据 → 创建空会话
    const session = makeSession()
    list = [session]
    saveSessions(list)
  }
  return list
}

export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>(initSessions)

  const [activeId, setActiveId] = useState<string>(() => {
    const list = loadSessions()
    const saved = localStorage.getItem(ACTIVE_KEY)
    if (saved && list.find(s => s.id === saved)) return saved
    return list[0]?.id ?? ''
  })

  // 当前激活会话（fallback 到第一个，避免 null 闪烁）
  const activeSession = sessions.find(s => s.id === activeId) ?? sessions[0] ?? null

  // 新建会话并自动激活
  const createSession = useCallback((): string => {
    const session = makeSession()
    setSessions(prev => {
      const next = [session, ...prev]
      saveSessions(next)
      return next
    })
    setActiveId(session.id)
    localStorage.setItem(ACTIVE_KEY, session.id)
    return session.id
  }, [])

  // 删除会话（保证至少保留 1 个）
  const deleteSession = useCallback((id: string) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)
      const final = next.length > 0 ? next : [makeSession()]
      saveSessions(final)
      // 删除的是激活会话 → 切换到列表第一个
      setActiveId(cur => {
        if (cur !== id) return cur
        const newId = final[0].id
        localStorage.setItem(ACTIVE_KEY, newId)
        return newId
      })
      return final
    })
  }, [])

  // 切换激活会话
  const switchSession = useCallback((id: string) => {
    setActiveId(id)
    localStorage.setItem(ACTIVE_KEY, id)
  }, [])

  // 更新当前激活会话的消息，并自动从第一条用户消息生成标题
  const updateMessages = useCallback((msgs: ChatMessage[]) => {
    setSessions(prev => {
      const next = prev.map(s => {
        if (s.id !== activeId) return s
        let title = s.title
        // 只在标题还是默认值时自动命名
        if (title === '新会话') {
          const firstUser = msgs.find(m => m.role === 'user')
          if (firstUser) title = firstUser.content.slice(0, 24)
        }
        return { ...s, messages: msgs, updatedAt: Date.now(), title }
      })
      saveSessions(next)
      return next
    })
  }, [activeId])

  return { sessions, activeSession, activeId, createSession, deleteSession, switchSession, updateMessages }
}
