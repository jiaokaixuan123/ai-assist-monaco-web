/** 诊断（错误/警告标记） */
import * as monaco from 'monaco-editor'

let syntaxCheckEnabled = true

export function setSyntaxCheckEnabled(v: boolean) {
  syntaxCheckEnabled = v
  if (!v) {
    monaco.editor.getModels().forEach(m => {
      if (m.getLanguageId() === 'python') monaco.editor.setModelMarkers(m, 'pyright', [])
    })
  }
}

function lspSeverityToMonaco(s: number): monaco.MarkerSeverity {
  switch (s) {
    case 1: return monaco.MarkerSeverity.Error
    case 2: return monaco.MarkerSeverity.Warning
    case 3: return monaco.MarkerSeverity.Info
    case 4: return monaco.MarkerSeverity.Hint
    default: return monaco.MarkerSeverity.Warning
  }
}

export function applyDiagnostics(params: any) {
  const { uri, diagnostics } = params
  const model = monaco.editor.getModel(monaco.Uri.parse(uri))
  if (!model) return
  if (!syntaxCheckEnabled) { monaco.editor.setModelMarkers(model, 'pyright', []); return }
  monaco.editor.setModelMarkers(model, 'pyright', (diagnostics || []).map((d: any) => ({
    startLineNumber: d.range.start.line + 1,
    startColumn:     d.range.start.character + 1,
    endLineNumber:   d.range.end.line + 1,
    endColumn:       d.range.end.character + 1,
    message:  d.message,
    severity: lspSeverityToMonaco(d.severity),
    source:   'Pyright',
    code:     d.code ? String(d.code) : undefined,
  })))
}
