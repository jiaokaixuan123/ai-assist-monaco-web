import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'

// ── 页面懒加载（首屏只加载 HomePage，其余按需）─────────
const HomePage          = lazy(() => import('./pages/HomePage'))
const LoginPage         = lazy(() => import('./pages/LoginPage'))
const RegisterPage      = lazy(() => import('./pages/RegisterPage'))
const CoursesPage       = lazy(() => import('./pages/CoursesPage'))
const CourseDetailPage  = lazy(() => import('./pages/CourseDetailPage'))
const LearnPage         = lazy(() => import('./pages/LearnPage'))
const ExercisesPage     = lazy(() => import('./pages/ExercisesPage'))
const ExerciseDetailPage = lazy(() => import('./pages/ExerciseDetailPage'))
const EditorPage        = lazy(() => import('./pages/EditorPage'))
const AdminPage         = lazy(() => import('./pages/AdminPage'))
const BooksPage         = lazy(() => import('./pages/BooksPage'))

// AiTutor 含 react-markdown / highlight.js 等重量依赖，必须懒加载
const AiTutor = lazy(() => import('./components/AiTutor/AiTutor'))

/** 路由级 loading 占位 */
function PageFallback() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      height: '60vh', fontSize: '14px', color: '#999',
    }}>
      加载中...
    </div>
  )
}

function TeacherRoute({ children }: { children: JSX.Element }) {
  const { user, loading, isTeacher } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (!isTeacher) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/courses/:courseId" element={<CourseDetailPage />} />
        <Route path="/courses/:courseId/learn/:lessonId" element={<LearnPage />} />
        <Route path="/exercises" element={<ExercisesPage />} />
        <Route path="/exercises/:exerciseId" element={<ExerciseDetailPage />} />
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/books" element={<BooksPage />} />
        <Route path="/admin" element={<TeacherRoute><AdminPage /></TeacherRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <AiTutor />
    </Suspense>
  )
}
