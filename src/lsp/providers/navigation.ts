/** 跳转定义 / 引用查找 / 大纲视图 Providers */
import * as monaco from 'monaco-editor'
import { request } from '../connection'
import { lspRangeToMonaco, lspSymbolKindToMonaco, convertDocumentSymbols } from '../utils'

// ── 跳转定义 ─────────────────────────────────────────────────────────────
let defRegistered = false, defDisposable: monaco.IDisposable | null = null

export function registerDefinitionProvider() {
  if (defRegistered) return
  defDisposable = monaco.languages.registerDefinitionProvider('python', {
    provideDefinition: async (model, position) => {
      try {
        const resp = await request('textDocument/definition', {
          textDocument: { uri: model.uri.toString() },
          position: { line: position.lineNumber - 1, character: position.column - 1 }
        })
        let locs = resp.result
        if (!locs) return []
        if (!Array.isArray(locs)) locs = [locs]
        return locs.map((l: any) => ({ uri: monaco.Uri.parse(l.uri), range: lspRangeToMonaco(l.range) }))
      } catch { return [] }
    }
  })
  defRegistered = true
}

export function disposeDefinitionProvider() {
  defDisposable?.dispose(); defDisposable = null; defRegistered = false
}

// ── 引用查找（Shift+F12）────────────────────────────────────────────────
let refRegistered = false, refDisposable: monaco.IDisposable | null = null

export function registerReferenceProvider() {
  if (refRegistered) return
  refDisposable = monaco.languages.registerReferenceProvider('python', {
    provideReferences: async (model, position, context) => {
      try {
        const resp = await request('textDocument/references', {
          textDocument: { uri: model.uri.toString() },
          position: { line: position.lineNumber - 1, character: position.column - 1 },
          context: { includeDeclaration: context.includeDeclaration }
        })
        return (resp.result || []).map((l: any) => ({ uri: monaco.Uri.parse(l.uri), range: lspRangeToMonaco(l.range) }))
      } catch { return [] }
    }
  })
  refRegistered = true
}

export function disposeReferenceProvider() {
  refDisposable?.dispose(); refDisposable = null; refRegistered = false
}

// ── 大纲视图（DocumentSymbol）────────────────────────────────────────────
let symRegistered = false, symDisposable: monaco.IDisposable | null = null

export function registerDocumentSymbolProvider() {
  if (symRegistered) return
  symDisposable = monaco.languages.registerDocumentSymbolProvider('python', {
    provideDocumentSymbols: async (model) => {
      try {
        const resp = await request('textDocument/documentSymbol', { textDocument: { uri: model.uri.toString() } })
        const result = resp.result
        if (!Array.isArray(result) || !result.length) return []
        // 扁平 SymbolInformation（有 location 字段）
        if (result[0]?.location) {
          return result.map((s: any) => {
            const range = lspRangeToMonaco(s.location.range)
            return { name: s.name, detail: s.containerName || '', kind: lspSymbolKindToMonaco(s.kind), tags: [], range, selectionRange: range, children: [] }
          })
        }
        return convertDocumentSymbols(result)
      } catch { return [] }
    }
  })
  symRegistered = true
}

export function disposeDocumentSymbolProvider() {
  symDisposable?.dispose(); symDisposable = null; symRegistered = false
}
