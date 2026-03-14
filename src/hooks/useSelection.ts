import { useState } from 'react'
import type * as monaco from 'monaco-editor'

// 选区钩子
export function useSelection() {
  const [selectedCode, setSelectedCode] = useState('')

  const attachSelectionListener = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editor.onDidChangeCursorSelection(() => {
      const selection = editor.getSelection(); if (!selection) return
      if (selection.isEmpty()) { setSelectedCode(''); return }
      const model = editor.getModel(); if (!model) return
      setSelectedCode(model.getValueInRange(selection))
    })
  }

  return { selectedCode, attachSelectionListener }
}
