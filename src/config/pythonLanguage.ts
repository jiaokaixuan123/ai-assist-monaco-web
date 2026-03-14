/**
 * Python 语言配置和 Monarch 词法分析器
 * 为 Monaco Editor 提供 Python 语法高亮支持
 */
import * as monaco from 'monaco-editor'

export const pythonLanguageConfig: monaco.languages.LanguageConfiguration = {
  comments: {
    lineComment: '#',
    blockComment: ["'''", "'''"]
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')']
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"', notIn: ['string'] },
    { open: "'", close: "'", notIn: ['string', 'comment'] }
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" }
  ],
  folding: {
    offSide: true,
    markers: {
      start: new RegExp('^\\s*#region\\b'),
      end: new RegExp('^\\s*#endregion\\b')
    }
  }
}

export const pythonMonarchLanguage: monaco.languages.IMonarchLanguage = {
  defaultToken: 'invalid',
  tokenPostfix: '.python',

  keywords: [
    'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
    'def', 'del', 'elif', 'else', 'except', 'False', 'finally', 'for',
    'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'None',
    'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'try',
    'while', 'with', 'yield'
  ],

  builtins: [
    '__import__', 'abs', 'all', 'any', 'ascii', 'bin', 'bool', 'breakpoint',
    'bytearray', 'bytes', 'callable', 'chr', 'classmethod', 'compile', 'complex',
    'copyright', 'credits', 'delattr', 'dict', 'dir', 'divmod', 'enumerate',
    'eval', 'exec', 'exit', 'filter', 'float', 'format', 'frozenset', 'getattr',
    'globals', 'hasattr', 'hash', 'help', 'hex', 'id', 'input', 'int',
    'isinstance', 'issubclass', 'iter', 'len', 'license', 'list', 'locals',
    'map', 'max', 'memoryview', 'min', 'next', 'object', 'oct', 'open', 'ord',
    'pow', 'print', 'property', 'quit', 'range', 'repr', 'reversed', 'round',
    'set', 'setattr', 'slice', 'sorted', 'staticmethod', 'str', 'sum', 'super',
    'tuple', 'type', 'vars', 'zip'
  ],

  typeKeywords: [
    'int', 'float', 'str', 'bool', 'list', 'dict', 'tuple', 'set', 'frozenset',
    'bytes', 'bytearray', 'memoryview', 'complex', 'type', 'object'
  ],

  // 内置异常类
  exceptions: [
    'Exception', 'StopIteration', 'GeneratorExit', 'ArithmeticError', 'OverflowError',
    'FloatingPointError', 'ZeroDivisionError', 'AssertionError', 'AttributeError',
    'BufferError', 'EOFError', 'ImportError', 'ModuleNotFoundError', 'LookupError',
    'IndexError', 'KeyError', 'MemoryError', 'NameError', 'UnboundLocalError',
    'OSError', 'BlockingIOError', 'ChildProcessError', 'ConnectionError',
    'FileExistsError', 'FileNotFoundError', 'InterruptedError', 'IsADirectoryError',
    'NotADirectoryError', 'PermissionError', 'ProcessLookupError', 'TimeoutError',
    'ReferenceError', 'RuntimeError', 'NotImplementedError', 'RecursionError',
    'StopAsyncIteration', 'SyntaxError', 'IndentationError', 'TabError',
    'SystemError', 'SystemExit', 'TypeError', 'ValueError', 'UnicodeError',
    'UnicodeDecodeError', 'UnicodeEncodeError', 'UnicodeTranslateError', 'Warning',
    'DeprecationWarning', 'PendingDeprecationWarning', 'RuntimeWarning',
    'SyntaxWarning', 'UserWarning', 'FutureWarning', 'ImportWarning',
    'UnicodeWarning', 'BytesWarning', 'ResourceWarning', 'BaseException',
    'KeyboardInterrupt'
  ],

  // 常量
  constants: ['None', 'True', 'False', 'Ellipsis', '__debug__'],

  operators: [
    '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
    '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
    '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=',
    '%=', '<<=', '>>=', '>>>='
  ],

  // Python 特定符号（不包含 @，@ 用于装饰器）
  symbols: /[=><!~?:&|+\-*\/\^%]+/,

  // 转义序列
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

  // 数字格式
  digits: /\d+(_+\d+)*/,
  octaldigits: /[0-7]+(_+[0-7]+)*/,
  binarydigits: /[0-1]+(_+[0-1]+)*/,
  hexdigits: /[0-9a-fA-F]+(_+[0-9a-fA-F]+)*/, // 修复多余的开头 [ 导致的分组错误

  tokenizer: {
    root: [
      // 特殊装饰器优先匹配 (类/方法相关)，放在通用装饰器之前
      [/@(dataclass|classmethod|staticmethod|property)\b/, 'decorator-type.python'],
      // 装饰器 - 只匹配 @ 和紧跟的标识符，不包括后续内容
      [/@[a-zA-Z_]\w*/, 'decorator.python'],

      // class 定义 - 捕获关键字 + 空白 + 类名 (必须所有字符都在捕获组中)
      [/\b(class)(\s+)([A-Z][a-zA-Z0-9_]*)/, ['keyword.python', 'white', 'class-name.python']],
      // def 魔术方法定义
      [/\b(def)(\s+)(__[a-zA-Z0-9_]+__)/, ['keyword.python', 'white', 'function-magic.python']],
      // def 普通函数定义
      [/\b(def)(\s+)([a-zA-Z_]\w*)/, ['keyword.python', 'white', 'function-name.python']],

      // import / from 模块匹配
      // from X.Y import A, B, C → 进入 from_module 状态处理点分路径和后续 import 关键字
      [/\b(from)(\s+)([a-zA-Z_]\w*)/, ['keyword.python', 'white', { token: 'module.python', next: '@from_module' }]],
      // import X, Y 或 from X import ... 中的 import 关键字 → 进入 import_names 状态
      [/\b(import)\b/, { token: 'keyword.python', next: '@import_names' }],

      // 移除 function-call.python / class-call.python 规则 (调用颜色交由语义 tokens 或默认标识符处理)
      // 常量（全大写标识符，至少2个字符）
      [/\b[A-Z][A-Z0-9_]+\b/, 'constant.python'],

      // 特殊变量 self 和 cls
      [/\b(self|cls)\b/, 'variable-special.python'],

      // 标识符和关键字 (剩余)
      [/[a-zA-Z_]\w*/, {
        cases: {
          '@constants': 'constant-language.python',
          '@keywords': 'keyword.python',
          '@builtins': 'builtin.python',
          '@typeKeywords': 'type-identifier.python',
          '@exceptions': 'exception.python',
          '@default': 'identifier.python'
        }
      }],

      // 空白符
      { include: '@whitespace' },

      // 分隔符和操作符 - 使用更具体的 token 类型
      [/[{}/]/, 'delimiter.bracket.python'],
      [/\(/, 'delimiter.parenthesis.python'],
      [/\)/, 'delimiter.parenthesis.python'],
      [/\[|\]/, 'delimiter.square.python'],
      [/@symbols/, {
        cases: {
          '@operators': 'operator.python',
          '@default': ''
        }
      }],

      // 数字 - 添加 .python 后缀
      [/(@digits)[eE]([\-+]?(@digits))?[fFdD]?/, 'number.float.python'],
      [/(@digits)\.(@digits)([eE][\-+]?(@digits))?[fFdD]?/, 'number.float.python'],
      [/0[xX](@hexdigits)[Ll]?/, 'number.hex.python'],
      [/0[oO]?(@octaldigits)[Ll]?/, 'number.octal.python'],
      [/0[bB](@binarydigits)[Ll]?/, 'number.binary.python'],
      [/(@digits)[lLjJ]?/, 'number.python'],

      // 分隔符
      [/[,;.]/, 'delimiter.python'],

      // 字符串
      [/"""/, 'string.python', '@string_dbl_multi'],
      [/'''/, 'string.python', '@string_sgl_multi'],
      [/"/, 'string.python', '@string_dbl'],
      [/'/, 'string.python', '@string_sgl'],

      // f-strings
      [/f"""/, 'string.python', '@fstring_dbl_multi'],
      [/f'''/, 'string.python', '@fstring_sgl_multi'],
      [/f"/, 'string.python', '@fstring_dbl'],
      [/f'/, 'string.python', '@fstring_sgl'],

      // r-strings (raw)
      [/r"""/, 'string.raw.python', '@string_dbl_multi'],
      [/r'''/, 'string.raw.python', '@string_sgl_multi'],
      [/r"/, 'string.raw.python', '@string_dbl'],
      [/r'/, 'string.raw.python', '@string_sgl'],
    ],

    whitespace: [
      [/\s+/, 'white'],
      [/(^#.*$)/, 'comment.python'],
    ],

    string_dbl_multi: [
      [/[^\\"]+/, 'string.python'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"""/, 'string.python', '@pop']
    ],

    string_sgl_multi: [
      [/[^\\']+/, 'string.python'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/'''/, 'string.python', '@pop']
    ],

    string_dbl: [
      [/[^\\"]+/, 'string.python'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"/, 'string.python', '@pop']
    ],

    string_sgl: [
      [/[^\\']+/, 'string.python'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/'/, 'string.python', '@pop']
    ],

    fstring_dbl_multi: [
      [/[^\\"{}]+/, 'string.python'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/{/, { token: 'string.quote', bracket: '@open', next: '@fstring_expression' }],
      [/"""/, 'string.python', '@pop']
    ],

    fstring_sgl_multi: [
      [/[^\\'{}]+/, 'string.python'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/{/, { token: 'string.quote', bracket: '@open', next: '@fstring_expression' }],
      [/'''/, 'string.python', '@pop']
    ],

    fstring_dbl: [
      [/[^\\"{}]+/, 'string.python'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/{/, { token: 'string.quote', bracket: '@open', next: '@fstring_expression' }],
      [/"/, 'string.python', '@pop']
    ],

    fstring_sgl: [
      [/[^\\'{}]+/, 'string.python'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/{/, { token: 'string.quote', bracket: '@open', next: '@fstring_expression' }],
      [/'/, 'string.python', '@pop']
    ],

    fstring_expression: [
      [/[^}]+/, 'identifier.python'],
      [/}/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
    ],

    // from X.Y 之后，等待 import 关键字或处理点分路径
    from_module: [
      [/[ \t]+/, 'white'],
      [/\./, 'delimiter.python'],
      // 遇到 import → 弹出 from_module 并进入 import_names
      // 使用 (?!\w) 代替 \b，避免 Monarch 逐字符推进时 \b 前缀在行首位置失效
      [/import(?!\w)/, { token: 'keyword.python', switchTo: '@import_names' }],
      [/[a-zA-Z_]\w*/, 'module.python'],
      // 其他字符（行尾等）→ 弹出
      ['', { token: '', next: '@pop' }],
    ],

    // import 后的逗号分隔名称列表：from X import A, B, C 或 import os, sys
    import_names: [
      [/[ \t]+/, 'white'],
      // 括号形式多行导入：from X import (A, B,\n  C)
      [/\(/, 'delimiter.parenthesis.python'],
      [/\)/, { token: 'delimiter.parenthesis.python', next: '@pop' }],
      // 通配符
      [/\*/, 'module.python'],
      // as 关键字后跟别名（别名用 identifier 色）
      [/as(?!\w)/, { token: 'keyword.python', next: '@import_alias' }],
      // 导入的名称
      [/[a-zA-Z_]\w*/, 'module.python'],
      // 逗号分隔
      [/,/, 'delimiter.python'],
      // 行继续符
      [/\\$/, 'white'],
      // 行尾或其他意外字符 → 弹出回上层状态
      ['', { token: '', next: '@pop' }],
    ],

    // as 后面的别名标识符（颜色同普通变量）
    import_alias: [
      [/[ \t]+/, 'white'],
      [/[a-zA-Z_]\w*/, { token: 'identifier.python', next: '@pop' }],
      ['', { token: '', next: '@pop' }],
    ],
  }
}

/**
 * 注册 Python 语言支持
 */
export function registerPythonLanguage() {
  // 注册语言配置
  monaco.languages.setLanguageConfiguration('python', pythonLanguageConfig)
  
  // 注册 Monarch tokenizer
  monaco.languages.setMonarchTokensProvider('python', pythonMonarchLanguage)
  
  // 定义接近 VS Code Dark+ 的自定义主题,匹配自定义 token
  monaco.editor.defineTheme('python-dark-plus', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword.python', foreground: 'C586C0' },
      { token: 'builtin.python', foreground: 'DCDCAA' },
      { token: 'type-identifier.python', foreground: '4EC9B0' },
      { token: 'class-name.python', foreground: '4EC9B0', fontStyle: 'bold' },
      { token: 'exception.python', foreground: 'F48771' },
      { token: 'function-name.python', foreground: 'DCDCAA' },
      { token: 'function-magic.python', foreground: 'C586C0', fontStyle: 'italic bold' },
      { token: 'decorator.python', foreground: 'DCDCAA' },
      { token: 'variable-special.python', foreground: '9CDCFE', fontStyle: 'italic' },
      { token: 'constant.python', foreground: '4FC1FF', fontStyle: 'bold' },
      { token: 'constant-language.python', foreground: '569CD6' },
      { token: 'module.python', foreground: '4EC9B0' },
      { token: 'decorator-type.python', foreground: '4EC9B0', fontStyle: 'bold' },
      { token: 'string.raw.python', foreground: 'CE9178' },
      { token: 'identifier.python', foreground: '9CDCFE' },
      { token: 'number.python', foreground: 'B5CEA8' },
      { token: 'number.float.python', foreground: 'B5CEA8' },
      { token: 'number.hex.python', foreground: '5BB498' },
      { token: 'number.octal.python', foreground: 'B5CEA8' },
      { token: 'number.binary.python', foreground: 'B5CEA8' },
      { token: 'string.python', foreground: 'CE9178' },
      { token: 'string.escape', foreground: 'D7BA7D' },
      { token: 'string.escape.invalid', foreground: 'E51400', fontStyle: 'underline' },
      { token: 'comment.python', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'operator.python', foreground: 'D4D4D4' },
      { token: 'delimiter.bracket.python', foreground: 'FFD700' },
      { token: 'delimiter.parenthesis.python', foreground: 'FFD700' },
      { token: 'delimiter.square.python', foreground: 'FFD700' },
      { token: 'delimiter.python', foreground: 'D4D4D4' },
      { token: 'string.quote', foreground: 'CE9178' },

      // 语义 token (无 .python 后缀)
      { token: 'class', foreground: '4EC9B0', fontStyle: 'bold' },
      { token: 'struct', foreground: '4EC9B0' },
      { token: 'interface', foreground: '4EC9B0' },
      { token: 'type', foreground: '4EC9B0' },
      { token: 'typeParameter', foreground: '4EC9B0' },
      { token: 'enum', foreground: 'B8D7A3' },
      { token: 'enumMember', foreground: 'B5CEA8' },
      { token: 'namespace', foreground: '4EC9B0' },
      { token: 'module', foreground: '4EC9B0' },
      { token: 'function', foreground: 'DCDCAA' },
      { token: 'method', foreground: 'DCDCAA' },
      { token: 'function.declaration', foreground: 'DCDCAA', fontStyle: 'bold' },
      { token: 'method.declaration', foreground: 'DCDCAA', fontStyle: 'bold' },
      { token: 'function.static', foreground: 'DCDCAA', fontStyle: 'underline' },
      { token: 'method.static', foreground: 'DCDCAA', fontStyle: 'underline' },
      { token: 'function.async', foreground: 'DCDCAA', fontStyle: 'italic' },
      { token: 'method.async', foreground: 'DCDCAA', fontStyle: 'italic' },
      { token: 'variable', foreground: '9CDCFE' },
      { token: 'variable.declaration', foreground: '9CDCFE', fontStyle: 'bold' },
      { token: 'variable.readonly', foreground: '4FC1FF' },
      { token: 'variable.defaultLibrary', foreground: '9CDCFE' },
      { token: 'parameter', foreground: '9CDCFE' },
      { token: 'parameter.declaration', foreground: '9CDCFE', fontStyle: 'italic bold' },
      { token: 'property', foreground: '9CDCFE' },
      { token: 'property.readonly', foreground: '4FC1FF' },
      { token: 'event', foreground: 'C586C0' },
      { token: 'macro', foreground: 'C586C0' },
      { token: 'decorator', foreground: 'DCDCAA' },
      { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'keyword', foreground: 'C586C0' },
      { token: 'operator', foreground: 'D4D4D4' },
      { token: 'regexp', foreground: 'D16969' }
    ],
    colors: {
      'editor.foreground': '#D4D4D4',
      'editorBracketHighlight.foreground1': '#FFD700',
      'editorBracketHighlight.foreground2': '#DA70D6',
      'editorBracketHighlight.foreground3': '#87CEFA',
      'editorBracketHighlight.foreground4': '#90EE90',
      'editorBracketHighlight.foreground5': '#FFA657',
      'editorBracketHighlight.foreground6': '#569CD6'
    }
    // semanticTokenColors 不在 IStandaloneThemeData 中，改由语义 provider + rules 控制
  })
  monaco.editor.setTheme('python-dark-plus')
  // 通过 editor.updateOptions 在使用处开启 semanticHighlighting
  console.log('✅ Python 语言配置已注册')
}
