import { useState, useEffect, useRef } from 'react'
import * as monaco from 'monaco-editor'
import styles from './TracePlayer.module.css'

export interface TraceStep {
  line: number          // 1-based，与 worker 一致
  vars: Record<string, any>
  output: string
}

interface Props {
  steps: TraceStep[]
  error: string | null
  editor: monaco.editor.IStandaloneCodeEditor | null
  onClose: () => void
}

export default function TracePlayer({ steps, error, editor, onClose }: Props) {
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(600)
  const decorationsRef = useRef<string[]>([])
  const intervalRef = useRef<number | null>(null)

  const current = steps[idx]

  // Monaco 高亮当前行
  useEffect(() => {
    if (!editor || !current) return
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
      {
        range: new monaco.Range(current.line, 1, current.line, 1),
        options: {
          isWholeLine: true,
          className: 'trace-highlight-line',
          glyphMarginClassName: 'trace-highlight-glyph',
          overviewRuler: { color: '#f1c40f', position: monaco.editor.OverviewRulerLane.Full },
        },
      },
    ])
    editor.revealLineInCenterIfOutsideViewport(current.line)
  }, [idx, editor, current])

  // 清理高亮（关闭时）
  useEffect(() => {
    return () => {
      if (editor) editor.deltaDecorations(decorationsRef.current, [])
    }
  }, [editor])

  // 自动播放
  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = window.setInterval(() => {
      setIdx(prev => {
        if (prev >= steps.length - 1) { setPlaying(false); return prev }
        return prev + 1
      })
    }, speed)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [playing, speed, steps.length])

  const prev = () => { setPlaying(false); setIdx(i => Math.max(0, i - 1)) }
  const next = () => { setPlaying(false); setIdx(i => Math.min(steps.length - 1, i + 1)) }
  const togglePlay = () => {
    if (idx >= steps.length - 1) setIdx(0)
    setPlaying(p => !p)
  }

  if (error) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>调试追踪</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.error}>❌ {error}</div>
      </div>
    )
  }

  if (!steps.length) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>调试追踪</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.empty}>（无可追踪步骤，代码可能没有可执行行）</div>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>🐛 调试追踪</span>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      {/* 进度 */}
      <div className={styles.progress}>
        <span className={styles.step}>步骤 {idx + 1} / {steps.length}</span>
        <input
          type="range" min={0} max={steps.length - 1} value={idx}
          title="拖动跳转步骤"
          aria-label="步骤进度"
          onChange={e => { setPlaying(false); setIdx(Number(e.target.value)) }}
          className={styles.slider}
        />
      </div>

      {/* 控制栏 */}
      <div className={styles.controls}>
        <button type="button" className={styles.btn} onClick={() => { setPlaying(false); setIdx(0) }} title="回到开始">⏮</button>
        <button type="button" className={styles.btn} onClick={prev} disabled={idx === 0}>⏪</button>
        <button type="button" className={`${styles.btn} ${styles.playBtn}`} onClick={togglePlay}>
          {playing ? '⏸ 暂停' : '▶ 播放'}
        </button>
        <button type="button" className={styles.btn} onClick={next} disabled={idx >= steps.length - 1}>⏩</button>
        <button type="button" className={styles.btn} onClick={() => { setPlaying(false); setIdx(steps.length - 1) }} title="跳到结尾">⏭</button>
        <select
          className={styles.speedSelect}
          title="播放速度"
          aria-label="播放速度"
          value={speed}
          onChange={e => setSpeed(Number(e.target.value))}
        >
          <option value={1200}>0.5x</option>
          <option value={600}>1x</option>
          <option value={300}>2x</option>
          <option value={150}>4x</option>
        </select>
      </div>

      {/* 当前行提示 */}
      {current && (
        <div className={styles.lineInfo}>
          <span className={styles.lineTag}>第 {current.line} 行</span>
        </div>
      )}

      {/* 变量面板 */}
      <div className={styles.varsSection}>
        <div className={styles.sectionTitle}>变量</div>
        {current && Object.keys(current.vars).length > 0 ? (
          <div className={styles.varGrid}>
            {Object.entries(current.vars).map(([k, v]) => (
              <div key={k} className={styles.varRow}>
                <span className={styles.varName}>{k}</span>
                <span className={styles.varEq}>=</span>
                <span className={styles.varVal}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>（无局部变量）</div>
        )}
      </div>

      {/* stdout */}
      {current?.output && (
        <div className={styles.stdoutSection}>
          <div className={styles.sectionTitle}>输出（到此步）</div>
          <pre className={styles.stdout}>{current.output}</pre>
        </div>
      )}
    </div>
  )
}
