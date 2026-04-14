import axios from 'axios'

const normalizeBaseUrl = (value?: string) => {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return ''
  return trimmed.replace(/\/+$/, '')
}

const API_BASE = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL)
  || (import.meta.env.DEV ? 'http://localhost:8000' : '')
const FILE_BASE = normalizeBaseUrl(import.meta.env.VITE_FILE_BASE_URL) || API_BASE

export const api = axios.create({ baseURL: API_BASE })

export const resolveBackendUrl = (path?: string | null) => {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  if (!FILE_BASE) return path
  return `${FILE_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

// 每次请求自动带 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Auth ──────────────────────────────────────────────
export const authApi = {
  register: (username: string, password: string, email?: string, role: 'student' | 'teacher' = 'student') =>
    api.post('/api/auth/register', { username, password, email, role }),
  login: (username: string, password: string) =>
    api.post('/api/auth/login', { username, password }),
  me: () => api.get('/api/auth/me'),
}

// ── Courses ───────────────────────────────────────────
export const courseApi = {
  list: () => api.get('/api/courses'),
  get: (id: string) => api.get(`/api/courses/${id}`),
  getLesson: (courseId: string, lessonId: string) =>
    api.get(`/api/courses/${courseId}/lessons/${lessonId}`),
}

// ── Exercises ─────────────────────────────────────────
export const exerciseApi = {
  list: (params?: { difficulty?: string; tag?: string }) =>
    api.get('/api/exercises', { params }),
  get: (id: string) => api.get(`/api/exercises/${id}`),
  submit: (payload: { exercise_id: string; code: string; passed: boolean; result: string }) =>
    api.post('/api/exercises/submissions', payload),
}

// ── Progress ──────────────────────────────────────────
export const progressApi = {
  me: () => api.get('/api/progress/me'),
  complete: (payload: { course_id?: string; lesson_id?: string; study_time?: number }) =>
    api.post('/api/progress/complete', payload),
}

// ── Admin ─────────────────────────────────────────────
export const adminApi = {
  createCourse: (data: {
    title: string; description: string; difficulty: string; tags: string[]; cover?: string
  }) => api.post('/api/admin/courses', data),

  updateCourse: (id: string, data: {
    title: string; description: string; difficulty: string; tags: string[]; cover?: string
  }) => api.put(`/api/admin/courses/${id}`, data),

  deleteCourse: (id: string) => api.delete(`/api/admin/courses/${id}`),

  addLesson: (courseId: string, lesson: {
    id: string; title: string; content: string; starter_code?: string; order: number
  }) => api.post(`/api/admin/courses/${courseId}/lessons`, lesson),

  updateLesson: (courseId: string, lessonId: string, lesson: {
    id: string; title: string; content: string; starter_code?: string; order: number
  }) => api.put(`/api/admin/courses/${courseId}/lessons/${lessonId}`, lesson),

  deleteLesson: (courseId: string, lessonId: string) =>
    api.delete(`/api/admin/courses/${courseId}/lessons/${lessonId}`),

  createExercise: (data: {
    exercise: {
      title: string; description: string; difficulty: string
      tags: string[]; starter_code?: string; hint?: string
    }
    test_cases: { input: string; expected_output: string }[]
  }) => api.post('/api/admin/exercises', data),

  updateExercise: (id: string, data: {
    exercise: {
      title: string; description: string; difficulty: string
      tags: string[]; starter_code?: string; hint?: string
    }
    test_cases: { input: string; expected_output: string }[]
  }) => api.put(`/api/admin/exercises/${id}`, data),

  deleteExercise: (id: string) => api.delete(`/api/admin/exercises/${id}`),

  // 用户管理
  listUsers: () => api.get('/api/admin/users'),
  updateUserRole: (id: string, role: 'student' | 'teacher') =>
    api.put(`/api/admin/users/${id}/role`, { role }),
  deleteUser: (id: string) => api.delete(`/api/admin/users/${id}`),
}

// ── Judge ─────────────────────────────────────────────
export const judgeApi = {
  submit: (exercise_id: string, code: string) =>
    api.post('/api/judge/submit', { exercise_id, code }),
}

// ── Knowledge ─────────────────────────────────────────
// ── Books ────────────────────────────────────────────
export const bookApi = {
  list: () => api.get('/api/books'),
  get: (id: string) => api.get(`/api/books/${id}`),
  create: (formData: FormData) => api.post('/api/books', formData),
  update: (id: string, data: object) => api.put(`/api/books/${id}`, data),
  delete: (id: string) => api.delete(`/api/books/${id}`),
  index: (id: string) => api.post(`/api/books/${id}/index`),
  removeIndex: (id: string) => api.delete(`/api/books/${id}/index`),
}

export const knowledgeApi = {
  search: (query: string, top_k = 3) =>
    api.post('/api/knowledge/search', { query, top_k }),
  ask: (question: string) =>
    api.post('/api/knowledge/ask', { question }),
}

// ── AI（后端代理模式）───────────────────────────
export const aiApi = {
  /** 非流式对话 */
  chat: (messages: any[], opts?: { temperature?: number; max_tokens?: number; model?: string }) =>
    api.post('/api/ai/chat', { messages, ...opts }),

  /** 获取 SSE 流式对话的 URL 和 payload（前端自行 fetch） */
  getStreamUrl: () => '/api/ai/stream',

  /** AI 状态查询（是否已配置等） */
  status: () => api.get('/api/ai/status'),
}
