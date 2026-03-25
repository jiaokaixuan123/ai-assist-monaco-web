/** Worker 返回的序列化变量值 */
export interface SerializedValue {
  type: string
  repr: string
  value?: any
  items?: SerializedValue[]     // list / tuple / set
  pairs?: { key: SerializedValue; val: SerializedValue }[]  // dict
  len?: number
}

/** 一个栈帧 */
export interface StackFrame {
  func: string
  line: number
  locals: Record<string, SerializedValue>
}

/** 一步执行记录 */
export interface VisStep {
  line: number       // 1-based
  event: string      // 'line' | 'call' | 'return' | 'exception'
  stack: StackFrame[]
  stdout: string
}

/** worker 返回的完整 trace 结果 */
export interface TraceResult {
  steps: VisStep[]
  lines: string[]
  error: string | null
  truncated?: boolean   // 是否因步骤过多被截断
}
