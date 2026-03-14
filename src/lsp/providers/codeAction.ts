/** 代码操作 Provider（LSP 快速修复） */
import * as monaco from 'monaco-editor'
import { request } from '../connection'
import { convertWorkspaceEdit } from '../utils'

let registered = false
let disposable: monaco.IDisposable | null = null

export function registerCodeActionProvider() {
  if (registered) return
  disposable = monaco.languages.registerCodeActionProvider('python', {
    provideCodeActions: async (model, range) => {
      try {
        const lspDiags = monaco.editor.getModelMarkers({ resource: model.uri })
          .filter(m => m.source === 'Pyright' && m.startLineNumber <= range.endLineNumber && m.endLineNumber >= range.startLineNumber)
          .map(m => ({
            range: { start: { line: m.startLineNumber - 1, character: m.startColumn - 1 }, end: { line: m.endLineNumber - 1, character: m.endColumn - 1 } },
            message: m.message, severity: 1, source: m.source, code: m.code
          }))
        const resp = await request('textDocument/codeAction', {
          textDocument: { uri: model.uri.toString() },
          range: { start: { line: range.startLineNumber - 1, character: range.startColumn - 1 }, end: { line: range.endLineNumber - 1, character: range.endColumn - 1 } },
          context: { diagnostics: lspDiags }
        })
        const actions: any[] = resp.result || []
        return {
          actions: actions.map((a: any) => ({
            title: a.title, kind: a.kind, isPreferred: a.isPreferred,
            edit: a.edit ? convertWorkspaceEdit(a.edit) : undefined,
            command: a.command
          })),
          dispose: () => {}
        }
      } catch { return { actions: [], dispose: () => {} } }
    }
  })
  registered = true
}

export function disposeCodeActionProvider() {
  disposable?.dispose(); disposable = null; registered = false
}
