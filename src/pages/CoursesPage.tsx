import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { courseApi } from '../api'
import NavBar from '../components/learn/NavBar'
import styles from './CoursesPage.module.css'

interface Course {
  id: string
  title: string
  description: string
  difficulty: string
  tags: string[]
  lesson_count: number
}

const DIFF_LABEL: Record<string, string> = { beginner: '入门', intermediate: '进阶', advanced: '高级' }
const DIFF_COLOR: Record<string, string> = { beginner: '#3fb950', intermediate: '#d29922', advanced: '#f85149' }

export default function CoursesPage() {
  const navigate = useNavigate()
  const [courses, setCourses] = useState<Course[]>([])
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    courseApi.list().then(r => setCourses(r.data))
  }, [])

  const filtered = filter === 'all' ? courses : courses.filter(c => c.difficulty === filter)

  return (
    <div className={styles.page}>
      <NavBar title="所有课程" backTo="/" />

      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>Python 系列课程</h1>
          <p className={styles.sub}>从基础到进阶，系统掌握 Python 编程</p>
          <div className={styles.filters}>
            {['all', 'beginner', 'intermediate', 'advanced'].map(f => (
              <button
                key={f}
                className={`${styles.filterBtn} ${filter === f ? styles.active : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? '全部' : DIFF_LABEL[f]}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.grid}>
          {filtered.map(c => (
            <div key={c.id} className={styles.card}>
              <div className={styles.cardHead}>
                <span
                  className={styles.badge}
                  style={{ color: DIFF_COLOR[c.difficulty], borderColor: DIFF_COLOR[c.difficulty] }}
                >
                  {DIFF_LABEL[c.difficulty] ?? c.difficulty}
                </span>
                <span className={styles.count}>{c.lesson_count} 节课</span>
              </div>
              <h2 className={styles.cardTitle}>{c.title}</h2>
              <p className={styles.cardDesc}>{c.description}</p>
              <div className={styles.cardTags}>
                {c.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}
              </div>
              <button
                className={styles.startBtn}
                onClick={() => navigate(`/courses/${c.id}`)}
              >
                开始学习 →
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
