/** 悬停提示 Provider */
import * as monaco from 'monaco-editor'
import { request } from '../connection'

let registered = false
let disposable: monaco.IDisposable | null = null

export function registerHoverProvider() {
  if (registered) return
  disposable = monaco.languages.registerHoverProvider('python', {
    provideHover: async (model, position) => {
      try {
        const resp = await request('textDocument/hover', {
          textDocument: { uri: model.uri.toString() },
          position: { line: position.lineNumber - 1, character: position.column - 1 }
        })
        const raw = resp.result?.contents
        if (!raw) return null
        const normalize = (c: any): string => {
          if (typeof c === 'string') return c
          if (typeof c === 'object' && 'value' in c) return c.value || ''
          return ''
        }
        const marked = (Array.isArray(raw) ? raw : [raw]).map(normalize).filter(Boolean).map(v => ({ value: v }))
        if (!marked.length) return null
        const r = resp.result?.range
        const range = r ? new monaco.Range(r.start.line + 1, r.start.character + 1, r.end.line + 1, r.end.character + 1) : undefined
        return { contents: marked, range }
      } catch { return null }
    }
  })
  registered = true
}

export function disposeHoverProvider() {
  disposable?.dispose(); disposable = null; registered = false
}
