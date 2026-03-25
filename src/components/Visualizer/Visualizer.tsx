import { useState, useEffect, useRef } from 'react'
import type { TraceResult, VisStep, SerializedValue, StackFrame } from './types'
import styles from './Visualizer.module.css'

interface Props {
  result: TraceResult
  onClose: () => void
}

// ── 值渲染 ──────────────────────────────────────────────
function ValueBadge({ v }: { v: SerializedValue }) {
  if (v.type === 'None') return <span className={`${styles.badge} ${styles.badgeNone}`}>None</span>
  if (v.type === 'bool') return <span className={`${styles.badge} ${styles.badgeBool}`}>{v.repr}</span>
  if (v.type === 'int' || v.type === 'float') return <span className={`${styles.badge} ${styles.badgeNum}`}>{v.repr}</span>
  if (v.type === 'str') return <span className={`${styles.badge} ${styles.badgeStr}`}>{v.repr}</span>
  if (v.type === 'function') return <span className={`${styles.badge} ${styles.badgeFn}`}>{v.repr}</span>
  return <span className={`${styles.badge} ${styles.badgeObj}`}>{v.repr}</span>
}

function ListBox({ v, label }: { v: SerializedValue; label: string }) {
  const isTuple = v.type === 'tuple'
  const isSet = v.type === 'set'
  const [open, setOpen] = useState(true)
  const bracket = isTuple ? ['(', ')'] : isSet ? ['{', '}'] : ['[', ']']
  return (
    <div className={styles.collectionBox}>
      <div className={styles.collectionHeader} onClick={() => setOpen(o => !o)}>
        <span className={styles.varLabel}>{label}</span>
        <span className={styles.typeTag}>{v.type}</span>
        <span className={styles.lenTag}>len={v.len}</span>
        <span className={styles.toggle}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div className={styles.collectionBody}>
          <span className={styles.bracket}>{bracket[0]}</span>
          {(v.items ?? []).map((item, i) => (
            <div key={i} className={styles.indexedItem}>
              <span className={styles.indexNum}>{i}</span>
              <ValueBadge v={item} />
            </div>
          ))}
          {(v.len ?? 0) > (v.items?.length ?? 0) && (
            <div className={styles.more}>...{(v.len ?? 0) - (v.items?.length ?? 0)} 项未显示</div>
          )}
          <span className={styles.bracket}>{bracket[1]}</span>
        </div>
      )}
    </div>
  )
}

function DictBox({ v, label }: { v: SerializedValue; label: string }) {
  const [open, setOpen] = useState(true)
  return (
    <div className={styles.collectionBox}>
      <div className={styles.collectionHeader} onClick={() => setOpen(o => !o)}>
        <span className={styles.varLabel}>{label}</span>
        <span className={styles.typeTag}>dict</span>
        <span className={styles.lenTag}>len={v.len}</span>
        <span className={styles.toggle}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div className={styles.collectionBody}>
          <span className={styles.bracket}>{'{'}</span>
          {(v.pairs ?? []).map((p, i) => (
            <div key={i} className={styles.dictRow}>
              <ValueBadge v={p.key} />
              <span className={styles.dictArrow}>:</span>
              <ValueBadge v={p.val} />
            </div>
          ))}
          {(v.len ?? 0) > (v.pairs?.length ?? 0) && (
            <div className={styles.more}>...{(v.len ?? 0) - (v.pairs?.length ?? 0)} 项未显示</div>
          )}
          <span className={styles.bracket}>{'}'}</span>
        </div>
      )}
    </div>
  )
}

function VarRow({ name, v }: { name: string; v: SerializedValue }) {
  if (v.type === 'list' || v.type === 'tuple' || v.type === 'set') return <ListBox v={v} label={name} />
  if (v.type === 'dict') return <DictBox v={v} label={name} />
  return (
    <div className={styles.varRow}>
      <span className={styles.varName}>{name}</span>
      <span className={styles.varEq}>=</span>
      <ValueBadge v={v} />
    </div>
  )
}

// ── 栈帧 ─────────────────────────────────────────────────
function FramePanel({ frame, isTop }: { frame: StackFrame; isTop: boolean }) {
  const entries = Object.entries(frame.locals)
  return (
    <div className={`${styles.frame} ${isTop ? styles.frameTop : ''}`}>
      <div className={styles.frameHeader}>
        <span className={styles.frameName}>{frame.func === '<module>' ? '全局' : `函数: ${frame.func}`}</span>
        <span className={styles.frameLine}>第 {frame.line} 行</span>
      </div>
      <div className={styles.frameBody}>
        {entries.length === 0
          ? <div className={styles.emptyVars}>（无变量）</div>
          : entries.map(([k, v]) => <VarRow key={k} name={k} v={v} />)
        }
      </div>
    </div>
  )
}

// ── 代码面板 ─────────────────────────────────────────────
function CodePanel({ lines, currentLine, onJump }: { lines: string[]; currentLine: number; onJump: (n: number) => void }) {
  const lineRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    lineRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [currentLine])

  return (
    <div className={styles.codePanel}>
      {lines.map((l, i) => {
        const lineNo = i + 1
        const active = lineNo === currentLine
        return (
          <div
            key={i}
            ref={active ? lineRef : null}
            className={`${styles.codeLine} ${active ? styles.codeLineActive : ''}`}
            onClick={() => onJump(lineNo)}
          >
            <span className={styles.lineNo}>{lineNo}</span>
            <span className={styles.lineContent}>{l || ' '}</span>
            {active && <span className={styles.arrow}>◀</span>}
          </div>
        )
      })}
    </div>
  )
}

// ── 主组件 ───────────────────────────────────────────────
const EVENT_LABEL: Record<string, string> = {
  line: '执行', call: '调用函数', return: '函数返回', exception: '发生异常'
}
const EVENT_COLOR: Record<string, string> = {
  line: '#89b4fa', call: '#a6e3a1', return: '#f9e2af', exception: '#f38ba8'
}

export default function Visualizer({ result, onClose }: Props) {
  const { steps, lines, error, truncated } = result
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(800)
  const timerRef = useRef<number | null>(null)

  const step: VisStep | undefined = steps[idx]
  const prevStep: VisStep | undefined = steps[idx - 1]

  // 自动播放
  useEffect(() => {
    if (!playing) { if (timerRef.current) clearInterval(timerRef.current); return }
    timerRef.current = window.setInterval(() => {
      setIdx(i => {
        if (i >= steps.length - 1) { setPlaying(false); return i }
        return i + 1
      })
    }, speed)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [playing, speed, steps.length])

  const go = (n: number) => { setPlaying(false); setIdx(Math.max(0, Math.min(steps.length - 1, n))) }

  // 检查变量是否变化（用于高亮）
  const changedVars = new Set<string>()
  if (step && prevStep) {
    const cur = step.stack[step.stack.length - 1]?.locals ?? {}
    const prev = prevStep.stack[prevStep.stack.length - 1]?.locals ?? {}
    for (const k of Object.keys(cur)) {
      if (JSON.stringify(cur[k]) !== JSON.stringify(prev[k])) changedVars.add(k)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* 顶部工具栏 */}
        <div className={styles.toolbar}>
          <span className={styles.toolbarTitle}>🐍 Python 执行可视化</span>
          <div className={styles.controls}>
            <button type="button" className={styles.btn} onClick={() => go(0)} title="回到开始">⏮</button>
            <button type="button" className={styles.btn} onClick={() => go(idx - 1)} disabled={idx === 0}>⏪ 上一步</button>
            <button type="button" className={`${styles.btn} ${styles.playBtn}`} onClick={() => { if (idx >= steps.length - 1) setIdx(0); setPlaying(p => !p) }}>
              {playing ? '⏸ 暂停' : '▶ 自动播放'}
            </button>
            <button type="button" className={styles.btn} onClick={() => go(idx + 1)} disabled={idx >= steps.length - 1}>下一步 ⏩</button>
            <button type="button" className={styles.btn} onClick={() => go(steps.length - 1)} title="跳到结尾">⏭</button>
            <select
              className={styles.speedSel}
              value={speed}
              title="播放速度"
              aria-label="播放速度"
              onChange={e => setSpeed(Number(e.target.value))}
            >
              <option value={1600}>0.5x</option>
              <option value={800}>1x</option>
              <option value={400}>2x</option>
              <option value={200}>4x</option>
            </select>
            <span className={styles.stepInfo}>步骤 {idx + 1} / {steps.length}</span>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>✕ 关闭</button>
        </div>

        {/* 进度条 */}
        <div className={styles.progress}>
          <input
            type="range" min={0} max={steps.length - 1} value={idx}
            title="步骤进度"
            aria-label="步骤进度"
            onChange={e => go(Number(e.target.value))}
            className={styles.slider}
          />
        </div>

        {/* 当前步骤说明 */}
        {step && (
          <div className={styles.stepBanner} style={{ borderColor: EVENT_COLOR[step.event] ?? '#89b4fa' }}>
            <span style={{ color: EVENT_COLOR[step.event] ?? '#89b4fa', fontWeight: 700 }}>
              {EVENT_LABEL[step.event] ?? step.event}
            </span>
            &nbsp;第 {step.line} 行
            {step.stack.length > 1 && (
              <span className={styles.callChain}>
                &nbsp;{'→'}&nbsp;{step.stack.map(f => f.func === '<module>' ? '全局' : f.func).join(' → ')}
              </span>
            )}
          </div>
        )}
        {truncated && (
          <div style={{ padding: '4px 16px', background: '#f9e2af22', color: '#f9e2af', fontSize: 12, borderBottom: '1px solid #313244' }}>
            ⚠️ 代码执行步骤超过 500 步，已截断显示。可将代码拆分为更小的片段分别调试。
          </div>
        )}

        {/* 主体：代码 + 调用栈 + 输出 */}
        <div className={styles.body}>
          {/* 列1：代码区 */}
          <div className={styles.leftPane}>
            <div className={styles.paneTitle}>代码</div>
            <CodePanel
              lines={lines}
              currentLine={step?.line ?? 0}
              onJump={n => {
                const target = steps.findIndex(s => s.line === n)
                if (target >= 0) go(target)
              }}
            />
          </div>

          {/* 列2：调用栈 + 变量 */}
          <div className={styles.stackCol}>
            <div className={styles.paneTitle}>
              调用栈 + 变量
              {changedVars.size > 0 && (
                <span className={styles.changed}>  ✦ {Array.from(changedVars).join(', ')} 已更新</span>
              )}
            </div>
            <div className={styles.stackArea}>
              {!step
                ? <div className={styles.empty}>暂无执行信息</div>
                : step.stack.length === 0
                  ? <div className={styles.empty}>无活跃栈帧</div>
                  : [...step.stack].reverse().map((frame, i) => (
                    <FramePanel key={i} frame={frame} isTop={i === 0} />
                  ))
              }
            </div>
          </div>

          {/* 列3：输出 */}
          <div className={styles.outputCol}>
            <div className={styles.paneTitle}>📋 输出</div>
            <div className={styles.outputArea}>
              {step?.stdout
                ? <pre className={styles.stdout}>{step.stdout}</pre>
                : <div className={styles.empty}>（暂无输出）</div>
              }
              {error && (
                <div className={styles.errorBox}>❌ {error}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
