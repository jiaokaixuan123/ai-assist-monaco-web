/** 语义高亮 Tokens Provider */
import * as monaco from 'monaco-editor'
import { request } from '../connection'

let registered = false
let disposable: monaco.IDisposable | null = null

// legend 由 connection.ts 在 initialize 响应后通过 setSemanticLegend 注入
let tokenTypes: string[] = []
let tokenModifiers: string[] = []
let legendReady = false

export function setSemanticLegend(types: string[], mods: string[]) {
  tokenTypes = types
  tokenModifiers = mods
  legendReady = true
}

export function isLegendReady(): boolean { return legendReady }

export function registerSemanticTokensProvider() {
  if (registered || !legendReady) return
  disposable = monaco.languages.registerDocumentSemanticTokensProvider('python', {
    getLegend: () => ({ tokenTypes, tokenModifiers }),
    provideDocumentSemanticTokens: async (model) => {
      try {
        const resp = await request('textDocument/semanticTokens/full', { textDocument: { uri: model.uri.toString() } })
        const data: number[] = resp.result?.data || []
        return { data: new Uint32Array(data) }
      } catch { return { data: new Uint32Array() } }
    },
    releaseDocumentSemanticTokens: () => {}
  })
  registered = true
}

// 开关：dispose 立即清除已渲染装饰，re-register 重新启用
export function setSemanticHighlightEnabled(enabled: boolean) {
  if (enabled) {
    if (!registered && legendReady) registerSemanticTokensProvider()
  } else {
    disposable?.dispose(); disposable = null; registered = false
  }
}

export function disposeSemanticProvider() {
  disposable?.dispose(); disposable = null; registered = false
}
