import { useEffect, useState } from 'react'
import NavBar from '../components/learn/NavBar'
import styles from './BooksPage.module.css'
import { bookApi, resolveBackendUrl } from '../api'

interface Book {
  id: string
  title: string
  author: string
  description: string
  difficulty: string
  tags: string[]
  cover: string
  file_path: string | null
  file_name: string | null
  created_at: string
}

const DIFF_LABEL: Record<string, string> = { beginner: '入门', intermediate: '进阶', advanced: '高级' }
const DIFF_COLOR: Record<string, string> = { beginner: '#3fb950', intermediate: '#d29922', advanced: '#f85149' }

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    bookApi.list().then(r => setBooks(r.data))
  }, [])

  const filtered = filter === 'all' ? books : books.filter(b => b.difficulty === filter)

  return (
    <div className={styles.page}>
      <NavBar title="教学书籍" backTo="/" />

      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>教学书籍库</h1>
          <p className={styles.sub}>精选 Python 教学书籍，供学习参考</p>
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
          {filtered.length === 0 && (
            <div className={styles.empty}>暂无书籍，请等待教师上传</div>
          )}
          {filtered.map(b => (
            <div key={b.id} className={styles.card}>
              <div className={styles.cardHead}>
                <span
                  className={styles.badge}
                  style={{ color: DIFF_COLOR[b.difficulty], borderColor: DIFF_COLOR[b.difficulty] }}
                >
                  {DIFF_LABEL[b.difficulty] ?? b.difficulty}
                </span>
              </div>
              {b.cover && (
                <img src={b.cover} alt={b.title} className={styles.cover} />
              )}
              <h2 className={styles.cardTitle}>{b.title}</h2>
              {b.author && <p className={styles.author}>作者：{b.author}</p>}
              <p className={styles.cardDesc}>{b.description}</p>
              <div className={styles.cardTags}>
                {b.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}
              </div>
              <div className={styles.actions}>
                {b.file_path ? (
                  <a
                    href={resolveBackendUrl(b.file_path)}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.previewBtn}
                  >
                    在线预览
                  </a>
                ) : (
                  <span className={styles.noFileTip}>暂无文件</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
