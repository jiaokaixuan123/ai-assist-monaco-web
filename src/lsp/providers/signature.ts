/** 函数签名提示 Provider */
import * as monaco from 'monaco-editor'
import { request } from '../connection'
import { normalizeDoc } from '../utils'

let registered = false
let disposable: monaco.IDisposable | null = null

export function registerSignatureHelpProvider() {
  if (registered) return
  disposable = monaco.languages.registerSignatureHelpProvider('python', {
    signatureHelpTriggerCharacters: ['(', ','],
    signatureHelpRetriggerCharacters: [','],
    provideSignatureHelp: async (model, position) => {
      try {
        const resp = await request('textDocument/signatureHelp', {
          textDocument: { uri: model.uri.toString() },
          position: { line: position.lineNumber - 1, character: position.column - 1 }
        })
        const result = resp.result
        if (!result?.signatures?.length) return null
        return {
          value: {
            signatures: result.signatures.map((sig: any) => ({
              label: sig.label,
              documentation: normalizeDoc(sig.documentation),
              parameters: (sig.parameters || []).map((p: any) => ({
                label: p.label,
                documentation: normalizeDoc(p.documentation)
              }))
            })),
            activeSignature: result.activeSignature ?? 0,
            activeParameter: result.activeParameter ?? 0,
          },
          dispose: () => {}
        }
      } catch { return null }
    }
  })
  registered = true
}

export function disposeSignatureHelpProvider() {
  disposable?.dispose(); disposable = null; registered = false
}
