import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { adminApi, courseApi, exerciseApi, bookApi, resolveBackendUrl } from '../api'
import { useAuth } from '../contexts/AuthContext'
import NavBar from '../components/learn/NavBar'
import styles from './AdminPage.module.css'

function MdPreview({ value }: { value: string }) {
  return (
    <div className={styles.splitPreview}>
      <div className={styles.splitPreviewTitle}>预览</div>
      <div className={styles.mdPreview}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {value || '*（预览区域为空）*'}
        </ReactMarkdown>
      </div>
    </div>
  )
}

type Tab = 'courses' | 'exercises' | 'users' | 'books'

interface Lesson { id: string; title: string; content: string; starter_code?: string; order: number }
interface Course { id: string; title: string; description: string; difficulty: string; tags: string[]; lesson_count: number; cover?: string; lessons?: Lesson[] }
interface Exercise { id: string; title: string; description: string; difficulty: string; tags: string[]; starter_code?: string; hint?: string; test_cases: { input: string; expected_output: string }[] }
interface UserItem { id: string; username: string; email?: string; role: string; created_at: string }
interface Book { id: string; title: string; author?: string; description?: string; difficulty?: string; tags: string[]; file_path: string | null; file_name: string | null; indexed: boolean; chunk_count?: number; created_at: string }

const emptyExForm = () => ({
  title: '', description: '', difficulty: 'easy',
  tags: '', starter_code: '', hint: '',
  test_cases: [{ input: '', expected_output: '' }]
})

const emptyCourseForm = () => ({
  title: '', description: '', difficulty: 'beginner', tags: '', cover: ''
})

const emptyLessonForm = () => ({
  id: '', title: '', content: '', starter_code: '', order: 1
})

export default function AdminPage() {
  const { } = useAuth()
  const [tab, setTab] = useState<Tab>('courses')
  const [courses, setCourses] = useState<Course[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [books, setBooks] = useState<Book[]>([])
  const [msg, setMsg] = useState('')

  const importFileRef = useRef<HTMLInputElement>(null)
  const bookFileRef = useRef<HTMLInputElement>(null)

  // 编辑状态
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null)
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null)
  const [bookForm, setBookForm] = useState({ title: '', author: '', description: '', difficulty: 'beginner', tags: '' })

  // 表单状态
  const [courseForm, setCourseForm] = useState(emptyCourseForm())
  const [exForm, setExForm] = useState(emptyExForm())
  const [lessonForm, setLessonForm] = useState(emptyLessonForm())

  const refreshCourses = () => courseApi.list().then(r => setCourses(r.data))
  const refreshExercises = () => exerciseApi.list().then(r => setExercises(r.data))
  const refreshUsers = () => adminApi.listUsers().then(r => setUsers(r.data))
  const refreshBooks = () => bookApi.list().then(r => setBooks(r.data))

  useEffect(() => {
    refreshCourses()
    refreshExercises()
    refreshUsers()
    refreshBooks()
  }, [])

  const notify = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  const handleImportExercises = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const list = JSON.parse(ev.target?.result as string)
        if (!Array.isArray(list)) throw new Error('格式错误：顶层应为数组')
        let ok = 0, fail = 0
        for (const item of list) {
          try {
            const { test_cases = [], ...rest } = item
            await adminApi.createExercise({ exercise: rest, test_cases })
            ok++
          } catch (_) { fail++ }
        }
        notify(`✅ 导入完成：成功 ${ok} 条${fail ? `，失败 ${fail} 条` : ''}`)
        refreshExercises()
      } catch (err: any) {
        notify(`❌ 解析失败：${err.message}`)
      }
      if (importFileRef.current) importFileRef.current.value = ''
    }
    reader.readAsText(file)
  }

  const handleUpdateRole = async (id: string, role: 'student' | 'teacher') => {
    try {
      await adminApi.updateUserRole(id, role)
      notify('✅ 角色已更新')
      refreshUsers()
    } catch { notify('❌ 操作失败') }
  }

  const handleDeleteUser = async (id: string, username: string) => {
    if (!confirm(`确定删除用户「${username}」？`)) return
    try {
      await adminApi.deleteUser(id)
      notify('✅ 用户已删除')
      refreshUsers()
    } catch { notify('❌ 删除失败') }
  }

  /* ── 课程：开始编辑 ── */
  const startEditCourse = async (c: Course) => {
    const { data } = await courseApi.get(c.id)
    setEditingCourse(data)
    setCourseForm({
      title: data.title, description: data.description,
      difficulty: data.difficulty, tags: data.tags.join(', '), cover: data.cover ?? ''
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEditCourse = () => {
    setEditingCourse(null)
    setCourseForm(emptyCourseForm())
    setEditingLesson(null)
    setLessonForm(emptyLessonForm())
  }

  /* ── 课程：保存 ── */
  const handleSaveCourse = async () => {
    if (!courseForm.title.trim()) return notify('请填写课程标题')
    const data = {
      title: courseForm.title, description: courseForm.description,
      difficulty: courseForm.difficulty,
      tags: courseForm.tags.split(',').map(t => t.trim()).filter(Boolean),
      cover: courseForm.cover || undefined,
    }
    try {
      if (editingCourse) {
        await adminApi.updateCourse(editingCourse.id, data)
        notify('✅ 课程更新成功')
        setEditingCourse(null)
      } else {
        await adminApi.createCourse(data)
        notify('✅ 课程创建成功')
      }
      setCourseForm(emptyCourseForm())
      refreshCourses()
    } catch {
      notify('❌ 操作失败，请检查登录状态')
    }
  }

  /* ── 课程：删除 ── */
  const handleDeleteCourse = async (id: string, title: string) => {
    if (!confirm(`确定删除课程「${title}」？此操作不可撤销。`)) return
    try {
      await adminApi.deleteCourse(id)
      notify('✅ 课程已删除')
      refreshCourses()
    } catch {
      notify('❌ 删除失败')
    }
  }

  /* ── 练习：开始编辑 ── */
  const startEditExercise = async (e: Exercise) => {
    const { data } = await exerciseApi.get(e.id)
    setEditingExercise(data)
    setExForm({
      title: data.title, description: data.description,
      difficulty: data.difficulty, tags: data.tags.join(', '),
      starter_code: data.starter_code ?? '', hint: data.hint ?? '',
      test_cases: data.test_cases.length > 0 ? data.test_cases : [{ input: '', expected_output: '' }]
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEditExercise = () => { setEditingExercise(null); setExForm(emptyExForm()) }

  /* ── 章节：开始编辑 ── */
  const startEditLesson = (l: Lesson) => {
    setEditingLesson(l)
    setLessonForm({ id: l.id, title: l.title, content: l.content, starter_code: l.starter_code ?? '', order: l.order })
  }

  const cancelEditLesson = () => { setEditingLesson(null); setLessonForm(emptyLessonForm()) }

  const handleSaveLesson = async () => {
    if (!editingCourse) return
    if (!lessonForm.title.trim()) return notify('请填写章节标题')
    const lesson = { ...lessonForm, id: lessonForm.id || `lesson_${Date.now()}` }
    try {
      if (editingLesson) {
        await adminApi.updateLesson(editingCourse.id, editingLesson.id, lesson)
        notify('✅ 章节更新成功')
      } else {
        await adminApi.addLesson(editingCourse.id, lesson)
        notify('✅ 章节添加成功')
      }
      cancelEditLesson()
      const { data } = await courseApi.get(editingCourse.id)
      setEditingCourse(data)
    } catch { notify('❌ 操作失败') }
  }

  const handleDeleteLesson = async (lessonId: string, title: string) => {
    if (!editingCourse) return
    if (!confirm(`确定删除章节「${title}」？`)) return
    try {
      await adminApi.deleteLesson(editingCourse.id, lessonId)
      notify('✅ 章节已删除')
      const { data } = await courseApi.get(editingCourse.id)
      setEditingCourse(data)
    } catch { notify('❌ 删除失败') }
  }

  /* ── 练习：保存 ── */
  const handleSaveExercise = async () => {
    if (!exForm.title.trim()) return notify('请填写练习标题')
    if (exForm.test_cases.some(tc => !tc.expected_output.trim())) return notify('请填写所有测试用例的期望输出')
    const data = {
      exercise: {
        title: exForm.title, description: exForm.description,
        difficulty: exForm.difficulty,
        tags: exForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        starter_code: exForm.starter_code || undefined,
        hint: exForm.hint || undefined,
      },
      test_cases: exForm.test_cases,
    }
    try {
      if (editingExercise) {
        await adminApi.updateExercise(editingExercise.id, data)
        notify('✅ 练习题更新成功')
        setEditingExercise(null)
      } else {
        await adminApi.createExercise(data)
        notify('✅ 练习题创建成功')
      }
      setExForm(emptyExForm())
      refreshExercises()
    } catch {
      notify('❌ 操作失败，请检查登录状态')
    }
  }

  /* ── 练习：删除 ── */
  const handleDeleteExercise = async (id: string, title: string) => {
    if (!confirm(`确定删除练习题「${title}」？此操作不可撤销。`)) return
    try {
      await adminApi.deleteExercise(id)
      notify('✅ 练习题已删除')
      refreshExercises()
    } catch {
      notify('❌ 删除失败')
    }
  }

  const addTestCase = () =>
    setExForm(f => ({ ...f, test_cases: [...f.test_cases, { input: '', expected_output: '' }] }))

  const removeTestCase = (i: number) =>
    setExForm(f => ({ ...f, test_cases: f.test_cases.filter((_, idx) => idx !== i) }))

  const updateTestCase = (i: number, field: 'input' | 'expected_output', val: string) =>
    setExForm(f => ({
      ...f,
      test_cases: f.test_cases.map((tc, idx) => idx === i ? { ...tc, [field]: val } : tc)
    }))

  const handleUploadBook = async (e: React.FormEvent) => {
    e.preventDefault()
    const file = bookFileRef.current?.files?.[0]
    if (!file) { notify('❌ 请选择文件'); return }
    if (!bookForm.title.trim()) { notify('❌ 请填写书名'); return }
    const fd = new FormData()
    fd.append('file', file)
    fd.append('title', bookForm.title)
    fd.append('author', bookForm.author)
    fd.append('description', bookForm.description)
    fd.append('difficulty', bookForm.difficulty)
    fd.append('tags', bookForm.tags)
    try {
      await bookApi.create(fd)
      notify('✅ 书籍上传成功')
      setBookForm({ title: '', author: '', description: '', difficulty: 'beginner', tags: '' })
      if (bookFileRef.current) bookFileRef.current.value = ''
      refreshBooks()
    } catch { notify('❌ 上传失败') }
  }

  const handleDeleteBook = async (id: string, title: string) => {
    if (!confirm(`确定删除书籍「${title}」？`)) return
    try {
      await bookApi.delete(id)
      notify('✅ 书籍已删除')
      refreshBooks()
    } catch { notify('❌ 删除失败') }
  }

  const [indexingId, setIndexingId] = useState<string | null>(null)

  const handleIndexBook = async (id: string, title: string) => {
    if (!confirm(`对「${title}」建立 RAG 索引？\n\n首次索引较慢（需加载嵌入模型），请耐心等待。`)) return
    setIndexingId(id)
    try {
      const res = await bookApi.index(id)
      notify(`✅ ${res.data.message}`)
      refreshBooks()
    } catch (err: any) {
      notify(`❌ 索引失败：${err?.response?.data?.detail ?? err.message}`)
    } finally {
      setIndexingId(null)
    }
  }

  const handleRemoveIndex = async (id: string, title: string) => {
    if (!confirm(`确定清除「${title}」的向量索引？`)) return
    try {
      await bookApi.removeIndex(id)
      notify('✅ 索引已清除')
      refreshBooks()
    } catch { notify('❌ 操作失败') }
  }

  return (
    <div className={styles.page}>
      <NavBar title="管理后台" backTo="/" />
      {msg && <div className={styles.toast}>{msg}</div>}

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <h2 className={styles.sideTitle}>管理</h2>
          {(['courses', 'exercises', 'users', 'books'] as Tab[]).map(t => (
            <button key={t}
              className={`${styles.sideBtn} ${tab === t ? styles.active : ''}`}
              onClick={() => { setTab(t); cancelEditCourse(); cancelEditExercise() }}
            >
              {t === 'courses' ? '📚 课程管理' : t === 'exercises' ? '🧩 练习管理' : t === 'users' ? '👥 用户管理' : '📖 书籍管理'}
            </button>
          ))}
        </aside>

        <main className={styles.main}>

          {/* ── 课程管理 ── */}
          {tab === 'courses' && (
            <div>
              <h2 className={styles.sectionTitle}>课程列表 ({courses.length})</h2>
              <table className={styles.table}>
                <thead>
                  <tr><th>标题</th><th>难度</th><th>章节数</th><th>操作</th></tr>
                </thead>
                <tbody>
                  {courses.map(c => (
                    <tr key={c.id} className={editingCourse?.id === c.id ? styles.editingRow : ''}>
                      <td>{c.title}</td>
                      <td>{c.difficulty}</td>
                      <td>{c.lesson_count}</td>
                      <td className={styles.actions}>
                        <button type="button" className={styles.btnEdit} onClick={() => startEditCourse(c)}>编辑</button>
                        <button type="button" className={styles.btnDanger} onClick={() => handleDeleteCourse(c.id, c.title)}>删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h2 className={styles.sectionTitle}>
                {editingCourse ? `编辑课程：${editingCourse.title}` : '新建课程'}
              </h2>
              <div className={styles.formSplit}>
                <div className={styles.formLeft}>
                <input className={styles.input} placeholder="课程标题 *"
                  value={courseForm.title} onChange={e => setCourseForm(f => ({ ...f, title: e.target.value }))} />
                <label className={styles.fieldLabel}>课程描述（Markdown）</label>
                <textarea className={styles.textarea} rows={8}
                  placeholder="支持 Markdown"
                  value={courseForm.description}
                  onChange={e => setCourseForm(f => ({ ...f, description: e.target.value }))} />
                <select className={styles.select} aria-label="课程难度"
                  value={courseForm.difficulty} onChange={e => setCourseForm(f => ({ ...f, difficulty: e.target.value }))}>
                  <option value="beginner">入门</option>
                  <option value="intermediate">进阶</option>
                  <option value="advanced">高级</option>
                </select>
                <input className={styles.input} placeholder="标签（逗号分隔）"
                  value={courseForm.tags} onChange={e => setCourseForm(f => ({ ...f, tags: e.target.value }))} />
                <input className={styles.input} placeholder="封面图路径（可选）"
                  value={courseForm.cover} onChange={e => setCourseForm(f => ({ ...f, cover: e.target.value }))} />
                <div className={styles.formActions}>
                  <button type="button" className={styles.btnPrimary} onClick={handleSaveCourse}>
                    {editingCourse ? '保存修改' : '创建课程'}
                  </button>
                  {editingCourse && (
                    <button type="button" className={styles.btnSecondary} onClick={cancelEditCourse}>取消</button>
                  )}
                </div>
                </div>
                <MdPreview value={courseForm.description} />
              </div>

              {/* ── 章节管理（仅编辑课程时显示）── */}
              {editingCourse && (
                <div>
                  <h2 className={styles.sectionTitle}>章节管理</h2>
                  <table className={styles.table}>
                    <thead>
                      <tr><th>顺序</th><th>标题</th><th>操作</th></tr>
                    </thead>
                    <tbody>
                      {(editingCourse.lessons ?? []).map(l => (
                        <tr key={l.id} className={editingLesson?.id === l.id ? styles.editingRow : ''}>
                          <td>{l.order}</td>
                          <td>{l.title}</td>
                          <td className={styles.actions}>
                            <button type="button" className={styles.btnEdit} onClick={() => startEditLesson(l)}>编辑</button>
                            <button type="button" className={styles.btnDanger} onClick={() => handleDeleteLesson(l.id, l.title)}>删除</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <h3 className={styles.subTitle}>{editingLesson ? `编辑章节：${editingLesson.title}` : '新增章节'}</h3>
                  <div className={styles.formSplit}>
                    <div className={styles.formLeft}>
                    <input className={styles.input} placeholder="章节 ID（唯一标识，如 lesson_1）*"
                      value={lessonForm.id} onChange={e => setLessonForm(f => ({ ...f, id: e.target.value }))} />
                    <input className={styles.input} placeholder="章节标题 *"
                      value={lessonForm.title} onChange={e => setLessonForm(f => ({ ...f, title: e.target.value }))} />
                    <label className={styles.fieldLabel}>章节内容（Markdown）*</label>
                    <textarea className={styles.textarea} rows={12}
                      placeholder="支持 Markdown"
                      value={lessonForm.content}
                      onChange={e => setLessonForm(f => ({ ...f, content: e.target.value }))} />
                    <textarea className={styles.textarea} placeholder="初始代码（可选）" rows={4}
                      value={lessonForm.starter_code} onChange={e => setLessonForm(f => ({ ...f, starter_code: e.target.value }))} />
                    <input className={styles.input} type="number" placeholder="排序（数字越小越靠前）"
                      value={lessonForm.order} onChange={e => setLessonForm(f => ({ ...f, order: Number(e.target.value) }))} />
                    <div className={styles.formActions}>
                      <button type="button" className={styles.btnPrimary} onClick={handleSaveLesson}>
                        {editingLesson ? '保存章节' : '添加章节'}
                      </button>
                      {editingLesson && (
                        <button type="button" className={styles.btnSecondary} onClick={cancelEditLesson}>取消</button>
                      )}
                    </div>
                    </div>
                    <MdPreview value={lessonForm.content} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 练习管理 ── */}
          {tab === 'exercises' && (
            <div>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>练习列表 ({exercises.length})</h2>
                <label className={styles.btnImport}>
                  📥 批量导入 JSON
                  <input ref={importFileRef} type="file" accept=".json" style={{ display: 'none' }}
                    onChange={handleImportExercises} />
                </label>
              </div>
              <table className={styles.table}>
                <thead>
                  <tr><th>标题</th><th>难度</th><th>标签</th><th>操作</th></tr>
                </thead>
                <tbody>
                  {exercises.map(e => (
                    <tr key={e.id} className={editingExercise?.id === e.id ? styles.editingRow : ''}>
                      <td>{e.title}</td>
                      <td>{e.difficulty}</td>
                      <td>{e.tags.join(', ')}</td>
                      <td className={styles.actions}>
                        <button type="button" className={styles.btnEdit} onClick={() => startEditExercise(e)}>编辑</button>
                        <button type="button" className={styles.btnDanger} onClick={() => handleDeleteExercise(e.id, e.title)}>删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h2 className={styles.sectionTitle}>
                {editingExercise ? `编辑练习：${editingExercise.title}` : '新建练习题'}
              </h2>
              <div className={styles.formSplit}>
                <div className={styles.formLeft}>
                <input className={styles.input} placeholder="题目标题 *"
                  value={exForm.title} onChange={e => setExForm(f => ({ ...f, title: e.target.value }))} />
                <label className={styles.fieldLabel}>题目描述（Markdown）*</label>
                <textarea className={styles.textarea} rows={8}
                  placeholder="支持 Markdown"
                  value={exForm.description}
                  onChange={e => setExForm(f => ({ ...f, description: e.target.value }))} />
                <select className={styles.select} aria-label="练习难度"
                  value={exForm.difficulty} onChange={e => setExForm(f => ({ ...f, difficulty: e.target.value }))}>
                  <option value="easy">简单</option>
                  <option value="medium">中等</option>
                  <option value="hard">困难</option>
                </select>
                <input className={styles.input} placeholder="标签（逗号分隔）"
                  value={exForm.tags} onChange={e => setExForm(f => ({ ...f, tags: e.target.value }))} />
                <textarea className={styles.textarea} placeholder="初始代码（可选）" rows={4}
                  value={exForm.starter_code} onChange={e => setExForm(f => ({ ...f, starter_code: e.target.value }))} />
                <input className={styles.input} placeholder="提示（可选）"
                  value={exForm.hint} onChange={e => setExForm(f => ({ ...f, hint: e.target.value }))} />

                <h3 className={styles.subTitle}>测试用例</h3>
                {exForm.test_cases.map((tc, i) => (
                  <div key={i} className={styles.testCase}>
                    <span className={styles.tcLabel}>用例 {i + 1}</span>
                    <input className={styles.input} placeholder="输入（可选）"
                      value={tc.input} onChange={e => updateTestCase(i, 'input', e.target.value)} />
                    <input className={styles.input} placeholder="期望输出 *"
                      value={tc.expected_output} onChange={e => updateTestCase(i, 'expected_output', e.target.value)} />
                    {exForm.test_cases.length > 1 && (
                      <button type="button" className={styles.btnDanger} onClick={() => removeTestCase(i)}>删除用例</button>
                    )}
                  </div>
                ))}
                <button type="button" className={styles.btnSecondary} onClick={addTestCase}>+ 添加测试用例</button>
                <div className={styles.formActions}>
                  <button type="button" className={styles.btnPrimary} onClick={handleSaveExercise}>
                    {editingExercise ? '保存修改' : '创建练习题'}
                  </button>
                  {editingExercise && (
                    <button type="button" className={styles.btnSecondary} onClick={cancelEditExercise}>取消</button>
                  )}
                </div>
                </div>
                <MdPreview value={exForm.description} />
              </div>
            </div>
          )}
          {/* ── 用户管理 ── */}
          {tab === 'users' && (
            <div>
              <h2 className={styles.sectionTitle}>用户列表 ({users.length})</h2>
              <table className={styles.table}>
                <thead>
                  <tr><th>用户名</th><th>邮箱</th><th>角色</th><th>注册时间</th><th>操作</th></tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>{u.username}</td>
                      <td>{u.email || '-'}</td>
                      <td>
                        <select value={u.role} aria-label="用户角色"
                          onChange={e => handleUpdateRole(u.id, e.target.value as 'student' | 'teacher')}>
                          <option value="student">学生</option>
                          <option value="teacher">教师</option>
                        </select>
                      </td>
                      <td>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className={styles.actions}>
                        <button type="button" className={styles.btnDanger}
                          onClick={() => handleDeleteUser(u.id, u.username)}>删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── 书籍管理 ── */}
          {tab === 'books' && (
            <div>
              <h2 className={styles.sectionTitle}>书籍管理</h2>

              {/* 上传表单 */}
              <div className={styles.formCard}>
                <h3 className={styles.formTitle}>上传书籍</h3>
                <input className={styles.input} placeholder="书名 *"
                  value={bookForm.title} onChange={e => setBookForm(f => ({ ...f, title: e.target.value }))} />
                <input className={styles.input} placeholder="作者（可选）"
                  value={bookForm.author} onChange={e => setBookForm(f => ({ ...f, author: e.target.value }))} />
                <textarea className={styles.textarea} placeholder="简介（可选）" rows={3}
                  value={bookForm.description} onChange={e => setBookForm(f => ({ ...f, description: e.target.value }))} />
                <select className={styles.select} aria-label="书籍难度"
                  value={bookForm.difficulty} onChange={e => setBookForm(f => ({ ...f, difficulty: e.target.value }))}>
                  <option value="beginner">入门</option>
                  <option value="intermediate">进阶</option>
                  <option value="advanced">高级</option>
                </select>
                <input className={styles.input} placeholder="标签（逗号分隔）"
                  value={bookForm.tags} onChange={e => setBookForm(f => ({ ...f, tags: e.target.value }))} />
                <input type="file" accept=".pdf,.epub,.txt" ref={bookFileRef}
                  aria-label="选择书籍文件" title="选择书籍文件（PDF/EPUB/TXT）"
                  className={styles.input} />
                <button type="button" className={styles.btnPrimary} onClick={handleUploadBook}>上传书籍</button>
              </div>

              {/* 书籍列表 */}
              <h3 className={`${styles.sectionTitle} ${styles.sectionTitleMt}`}>书籍列表 ({books.length})</h3>
              <table className={styles.table}>
                <thead>
                  <tr><th>书名</th><th>作者</th><th>难度</th><th>类型</th><th>RAG 索引</th><th>操作</th></tr>
                </thead>
                <tbody>
                  {books.map(b => (
                    <tr key={b.id}>
                      <td>{b.title}</td>
                      <td>{b.author || '-'}</td>
                      <td>{b.difficulty || '-'}</td>
                      <td>{b.file_name ? b.file_name.split('.').pop()?.toUpperCase() : '-'}</td>
                      <td>
                        {b.indexed
                          ? <span className={styles.indexedBadge}>✅ {b.chunk_count ?? 0} 块</span>
                          : <span className={styles.notIndexedBadge}>未索引</span>}
                      </td>
                      <td className={styles.actions}>
                        {b.file_path && (
                          <a href={resolveBackendUrl(b.file_path)} target="_blank" rel="noreferrer"
                            className={styles.btnEdit}>预览</a>
                        )}
                        {b.file_path && !b.indexed && (
                          <button type="button"
                            className={styles.btnIndex}
                            disabled={indexingId === b.id}
                            onClick={() => handleIndexBook(b.id, b.title)}>
                            {indexingId === b.id ? '⏳ 索引中…' : '🔍 建立索引'}
                          </button>
                        )}
                        {b.indexed && (
                          <button type="button"
                            className={styles.btnSecondary}
                            onClick={() => handleRemoveIndex(b.id, b.title)}>
                            清除索引
                          </button>
                        )}
                        <button type="button" className={styles.btnDanger}
                          onClick={() => handleDeleteBook(b.id, b.title)}>删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
