// 声明 Web Worker 全局函数
declare function importScripts(...urls: string[]): void;

console.log('🚀 Pyodide Worker 已启动')

let pyodideReadyPromise: Promise<any> | null = null;
let pyodideReadyFlag = false;
const pendingMessages: Array<{ id: number; type: string; code?: string }> = [];

// 初始化 Pyodide
async function initPyodide() {
  if (pyodideReadyPromise) return pyodideReadyPromise;
  console.log('🚀 [worker] 开始初始化 Pyodide (module + dynamic import)');
  try {
    // 动态导入 Pyodide 模块（避免打包时静态解析，减小主包体积）
    const mod = await import(/* @vite-ignore */ new URL('/pyodide/pyodide.mjs', self.location.origin).toString());
    if (!mod.loadPyodide) throw new Error('loadPyodide 未从 pyodide.mjs 导出');

    // 加载 Pyodide（fullStdLib: false 不加载完整标准库，加快初始化）
    pyodideReadyPromise = mod.loadPyodide({ indexURL: '/pyodide/', fullStdLib: false });
    const pyodide = await pyodideReadyPromise;

    // 标记就绪，通知主线程
    pyodideReadyFlag = true;
    console.log('✅ [worker] Pyodide 就绪, version:', pyodide.version);
    self.postMessage({ id: -1, type: 'ready', version: pyodide.version });

    // 处理排队消息
    if (pendingMessages.length) {
      console.log('📦 处理排队消息数量:', pendingMessages.length);
      pendingMessages.splice(0).forEach(msg => processMessage(pyodide, msg));
    }
    return pyodide;
  } catch (e: any) {
    console.error('❌ [worker] 初始化失败:', e);
    pyodideReadyPromise = null;
    throw e;
  }
}

// 监听主线程消息
function safeString(v: any) { try { return String(v); } catch { return '[不可显示的对象]'; } }

// 处理消息: 运行代码、格式化、分析、语法检查
async function processMessage(pyodide: any, payload: { id: number; type: string; code?: string }) {
  const { id, type, code = '' } = payload;
  // 运行代码：执行用户代码并捕获输出
  if (type === 'run') {
    try {
      pyodide.globals.set('USER_CODE', code);// 把用户代码传入 Pyodide 全局变量
      // 核心捕获逻辑：重定向 stdout/stderr，提取最后一行表达式结果
      const capture = `import sys, io, traceback, ast, json
source = USER_CODE
stdout_io, stderr_io = io.StringIO(), io.StringIO()
old_out, old_err = sys.stdout, sys.stderr
result_value = None
had_error = False
try:
  sys.stdout, sys.stderr = stdout_io, stderr_io
  try:
    mod = ast.parse(source, '<user>')
    if mod.body and isinstance(mod.body[-1], ast.Expr):
      last = mod.body.pop()
      # 创建带位置信息的 AST 节点
      assign = ast.Assign(
        targets=[ast.Name(id='_RESULT_VALUE', ctx=ast.Store(), lineno=1, col_offset=0)],
        value=last.value,
        lineno=1,
        col_offset=0
      )
      mod.body.append(assign)
    code_obj = compile(mod, '<user>', 'exec')
    exec(code_obj, globals())
    result_value = globals().get('_RESULT_VALUE', None)
  except Exception:
    had_error = True
    traceback.print_exc()
finally:
  sys.stdout, sys.stderr = old_out, old_err
payload = {
  'stdout': stdout_io.getvalue(),
  'stderr': stderr_io.getvalue(),
  'result': None if result_value is None else repr(result_value),
  'hadError': had_error
}
json.dumps(payload)`;
      const jsonStr = await pyodide.runPythonAsync(capture);  // 运行捕获代码
      let parsed: any;
      try { parsed = JSON.parse(jsonStr); } catch { parsed = { stdout: '', stderr: jsonStr, result: null, hadError: true }; }
      // 合并输出（stdout + stderr + 结果）
      let combined = '';
      if (parsed.stdout) combined += parsed.stdout;                             // 捕获标准输出
      if (parsed.stderr) combined += (combined ? '\n' : '') + parsed.stderr;    // 捕获错误输出
      if (!combined && parsed.result) combined = `[结果] ${parsed.result}`;     // 合并结果输出
      if (!combined) combined = '（无输出）';
      // 发送结果到主线程
      self.postMessage({ id, type: 'run', result: combined, hadError: parsed.hadError });
    } catch (err: any) {
      self.postMessage({ id, type: 'run', result: `Error: ${err.message}`, error: err.message || safeString(err), hadError: true });
    }
    return;
  }
  // 格式化代码：使用 autopep8（通过 micropip 按需安装）(micropip 是 Pyodide 官方内置的轻量级包管理器)
  if (type === 'format') {
    try {
      pyodide.globals.set('CODE_TO_FORMAT', code);
      // 先在 JS 层加载 micropip（Pyodide 内置包，需显式加载）
      await pyodide.loadPackage('micropip');
      const formatted = await pyodide.runPythonAsync(`
import sys, micropip
if 'autopep8' not in sys.modules:
  await micropip.install('autopep8')
import autopep8
autopep8.fix_code(CODE_TO_FORMAT, options={'aggressive': 1})
`);
      self.postMessage({ id, type: 'format', result: formatted });
    } catch (err: any) {
      self.postMessage({ id, type: 'format', error: err.message || safeString(err) });
    }
    return;
  }
  // 处理 ping 消息
  if (type === 'ping') {
    // 已在 initPyodide 完成后发送 ready，这里如果已经就绪直接回应
    if (pyodideReadyFlag) self.postMessage({ id, type: 'ready' });
    return;
  }
  // 分析代码：提取函数、类、变量等符号信息
  if (type === 'analyze') {
    try {
      pyodide.globals.set('CODE_ANALYZE', code);
      const jsonSymbols = await pyodide.runPythonAsync(`import ast, json\nsource = CODE_ANALYZE\nsymbols=[]\ntry:\n tree=ast.parse(source)\n for n in ast.walk(tree):\n  if isinstance(n, ast.FunctionDef):\n   params=[a.arg for a in n.args.args]\n   symbols.append({'name':n.name,'type':'function','detail':f"def {n.name}({', '.join(params)})"})\n  elif isinstance(n, ast.ClassDef):\n   symbols.append({'name':n.name,'type':'class','detail':f"class {n.name}"})\n  elif isinstance(n, ast.Assign):\n   for t in n.targets:\n    if isinstance(t, ast.Name):\n     symbols.append({'name':t.id,'type':'variable','detail':f"{t.id} = ..."})\nexcept Exception as e:\n pass\n# 去重\nuniq={}\nfor s in symbols: uniq[s['name']]=s\njson.dumps(list(uniq.values()))`)
      self.postMessage({ id, type: 'analyze', result: jsonSymbols });
    } catch (err: any) {
      self.postMessage({ id, type: 'analyze', error: err.message || safeString(err) });
    }
    return;
  }
  // 语法检查：尝试编译代码捕获 SyntaxError
  if (type === 'syntax') {
    try {
      pyodide.globals.set('CODE_SYNTAX', code);
      const status = await pyodide.runPythonAsync(`import json, traceback\nsource = CODE_SYNTAX\nerror=None\ntry:\n compile(source,'<user>','exec')\nexcept SyntaxError as e:\n error={'line':e.lineno,'msg':e.msg}\njson.dumps(error if error else {'ok':True})`)
      self.postMessage({ id, type: 'syntax', result: status });
    } catch (err: any) {
      self.postMessage({ id, type: 'syntax', error: err.message || safeString(err) });
    }
    return;
  }
  self.postMessage({ id, error: 'Unknown type: ' + type });
}

// 监听主线程消息
self.onmessage = async (e) => {
  const { id, type, code } = e.data || {};
  try {
    if (!pyodideReadyPromise) initPyodide(); // 触发初始化但不 await，避免阻塞 ping 后的队列
    // 未就绪且非 ping 消息 → 加入队列
    if (!pyodideReadyFlag && type !== 'ping') {
      pendingMessages.push({ id, type, code });
      return;
    }
    // 就绪后处理消息
    const pyodide = await pyodideReadyPromise;
    processMessage(pyodide, { id, type, code });
  } catch (err: any) {
    self.postMessage({ id, error: err.message || safeString(err) });
  }
};
