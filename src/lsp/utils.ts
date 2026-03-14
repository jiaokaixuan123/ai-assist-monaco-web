/**
 * LSP ↔ Monaco 共享转换工具函数
 * 供各 provider 文件导入使用，避免重复定义
 */
import * as monaco from 'monaco-editor'

// 将 LSP MarkupContent / MarkedString / string 统一转为 Monaco IMarkdownString
export function normalizeDoc(doc: any): monaco.IMarkdownString | undefined {
  if (!doc) return undefined
  if (typeof doc === 'string') return { value: doc }
  if (doc.kind === 'markdown') return { value: doc.value, isTrusted: false, supportThemeIcons: true }
  if (doc.kind === 'plaintext') return { value: '```\n' + doc.value + '\n```' }
  if (typeof doc.value === 'string') return { value: doc.value }
  return undefined
}

// LSP CompletionItemKind → Monaco CompletionItemKind
export function lspKindToMonaco(kind: number): monaco.languages.CompletionItemKind {
  const K = monaco.languages.CompletionItemKind
  switch (kind) {
    case 2:  return K.Method
    case 3:  return K.Function
    case 4:  return K.Constructor
    case 5:  return K.Field
    case 6:  return K.Variable
    case 7:  return K.Class
    case 8:  return K.Interface
    case 9:  return K.Module
    case 10: return K.Property
    case 13: return K.Enum
    case 14: return K.Keyword
    case 15: return K.Snippet
    case 20: return K.EnumMember
    case 21: return K.Constant
    case 22: return K.Struct
    case 23: return K.Event
    case 24: return K.Operator
    case 25: return K.TypeParameter
    default: return K.Text
  }
}

// LSP SymbolKind → Monaco SymbolKind
export function lspSymbolKindToMonaco(kind: number): monaco.languages.SymbolKind {
  const K = monaco.languages.SymbolKind
  switch (kind) {
    case 1:  return K.File
    case 2:  return K.Module
    case 3:  return K.Namespace
    case 4:  return K.Package
    case 5:  return K.Class
    case 6:  return K.Method
    case 7:  return K.Property
    case 8:  return K.Field
    case 9:  return K.Constructor
    case 10: return K.Enum
    case 11: return K.Interface
    case 12: return K.Function
    case 13: return K.Variable
    case 14: return K.Constant
    case 15: return K.String
    case 16: return K.Number
    case 17: return K.Boolean
    case 18: return K.Array
    case 19: return K.Object
    case 20: return K.Key
    case 21: return K.Null
    case 22: return K.EnumMember
    case 23: return K.Struct
    case 24: return K.Event
    case 25: return K.Operator
    case 26: return K.TypeParameter
    default: return K.Variable
  }
}

// 将 LSP WorkspaceEdit 转为 Monaco WorkspaceEdit（支持 changes / documentChanges 两种格式）
export function convertWorkspaceEdit(lspEdit: any): monaco.languages.WorkspaceEdit {
  const edits: monaco.languages.IWorkspaceTextEdit[] = []
  for (const uri of Object.keys(lspEdit.changes || {})) {
    for (const e of lspEdit.changes[uri]) {
      edits.push({
        resource: monaco.Uri.parse(uri),
        textEdit: { range: lspRangeToMonaco(e.range), text: e.newText },
        versionId: undefined
      })
    }
  }
  for (const dc of (lspEdit.documentChanges || [])) {
    if (!dc.edits) continue
    for (const e of dc.edits) {
      edits.push({
        resource: monaco.Uri.parse(dc.textDocument.uri),
        textEdit: { range: lspRangeToMonaco(e.range), text: e.newText },
        versionId: undefined
      })
    }
  }
  return { edits }
}

// 递归转换 LSP DocumentSymbol[] → Monaco DocumentSymbol[]
export function convertDocumentSymbols(symbols: any[]): monaco.languages.DocumentSymbol[] {
  return (symbols || []).map((s: any) => {
    const range = lspRangeToMonaco(s.range)
    const selectionRange = s.selectionRange ? lspRangeToMonaco(s.selectionRange) : range
    return {
      name: s.name,
      detail: s.detail || '',
      kind: lspSymbolKindToMonaco(s.kind),
      tags: [],
      range,
      selectionRange,
      children: s.children ? convertDocumentSymbols(s.children) : []
    }
  })
}

// LSP range (0-indexed) → Monaco Range (1-indexed)
export function lspRangeToMonaco(r: any): monaco.Range {
  return new monaco.Range(
    r.start.line + 1, r.start.character + 1,
    r.end.line + 1,   r.end.character + 1
  )
}

// LSP position (0-indexed) → Monaco position params
export function monacoPositionToLsp(position: monaco.Position) {
  return { line: position.lineNumber - 1, character: position.column - 1 }
}
