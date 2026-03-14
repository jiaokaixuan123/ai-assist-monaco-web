/** 智能补全 Provider */
import * as monaco from 'monaco-editor'
import { request } from '../connection'
import { lspKindToMonaco, normalizeDoc } from '../utils'

let registered = false
let disposable: monaco.IDisposable | null = null
let enabled = true

export function setAutoCompleteEnabled(v: boolean) { enabled = v }

export function registerCompletionProvider() {
  if (registered) return
  disposable = monaco.languages.registerCompletionItemProvider('python', {
    triggerCharacters: ['.', '(', '[', ',', ':'],
    provideCompletionItems: async (model, position) => {
      if (!enabled) return { suggestions: [] }
      try {
        const resp = await request('textDocument/completion', {
          textDocument: { uri: model.uri.toString() },
          position: { line: position.lineNumber - 1, character: position.column - 1 }
        })
        const word = model.getWordUntilPosition(position)
        const wordRange = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
        const K = monaco.languages.CompletionItemInsertTextRule
        const items = (resp.result?.items || []).map((it: any) => ({
          label: { label: it.label, description: it.detail },
          kind: lspKindToMonaco(it.kind),
          insertText: it.textEdit?.newText || it.insertText || it.label,
          insertTextRules: it.insertTextFormat === 2 ? K.InsertAsSnippet : K.None,
          range: it.textEdit ? new monaco.Range(
            it.textEdit.range.start.line + 1, it.textEdit.range.start.character + 1,
            it.textEdit.range.end.line + 1,   it.textEdit.range.end.character + 1
          ) : wordRange,
          detail: it.detail,
          documentation: normalizeDoc(it.documentation),
          filterText: it.filterText || it.label,
          sortText: it.sortText || it.label,
          preselect: it.preselect,
          commitCharacters: it.commitCharacters,
          tags: it.deprecated || it.tags?.includes(1) ? [monaco.languages.CompletionItemTag.Deprecated] : undefined,
        }))
        return { suggestions: items }
      } catch { return { suggestions: [] } }
    }
  })
  registered = true
}

export function disposeCompletionProvider() {
  disposable?.dispose(); disposable = null; registered = false
}
