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

    // 注意：不再在初始化时预加载 numpy/pandas/matplotlib 等重量级包
    // 这些包总计 40MB+，会严重拖慢 Worker 就绪时间
    // 改为按需加载（用户触发对应功能时才下载）

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
      const jsonSymbols = await pyodide.runPythonAsync(`import ast, json
source = CODE_ANALYZE
symbols = []
try:
  tree = ast.parse(source)
  for n in ast.walk(tree):
    if isinstance(n, ast.FunctionDef):
      params = [a.arg for a in n.args.args]
      symbols.append({'name': str(n.name), 'type': 'function', 'detail': f"def {n.name}({', '.join(params)})"})
    elif isinstance(n, ast.ClassDef):
      symbols.append({'name': str(n.name), 'type': 'class', 'detail': f"class {n.name}"})
    elif isinstance(n, ast.Assign):
      for t in n.targets:
        if isinstance(t, ast.Name):
          symbols.append({'name': str(t.id), 'type': 'variable', 'detail': f"{t.id} = ..."})
except Exception:
  pass
# 去重并确保所有值都是可序列化的
uniq = {}
for s in symbols:
  uniq[s['name']] = {'name': str(s['name']), 'type': str(s['type']), 'detail': str(s['detail'])}
json.dumps(list(uniq.values()))`)
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
  // 执行追踪：逐步执行代码，捕获每一步的行号、变量、输出
  if (type === 'trace') {
    try {
      pyodide.globals.set('USER_CODE_TRACE', code);
      const traceResult = await pyodide.runPythonAsync(`
import sys, io, json, types

source = USER_CODE_TRACE
steps = []
output_buffer = io.StringIO()
old_stdout = sys.stdout
sys.stdout = output_buffer

def serialize_value(v, depth=0):
    if depth > 3:
        return {"type": "ellipsis", "repr": "..."}
    t = type(v).__name__
    if v is None:
        return {"type": "None", "repr": "None"}
    elif isinstance(v, bool):
        return {"type": "bool", "repr": repr(v), "value": v}
    elif isinstance(v, int):
        return {"type": "int", "repr": repr(v), "value": v}
    elif isinstance(v, float):
        return {"type": "float", "repr": repr(v), "value": v}
    elif isinstance(v, str):
        display = repr(v) if len(v) < 50 else repr(v[:50]) + "..."
        return {"type": "str", "repr": display, "value": v[:100]}
    elif isinstance(v, (list, tuple)):
        kind = "list" if isinstance(v, list) else "tuple"
        items = [serialize_value(x, depth+1) for x in v[:20]]
        return {"type": kind, "repr": repr(v)[:80], "items": items, "len": len(v)}
    elif isinstance(v, dict):
        pairs = []
        for k, val in list(v.items())[:20]:
            pairs.append({"key": serialize_value(k, depth+1), "val": serialize_value(val, depth+1)})
        return {"type": "dict", "repr": repr(v)[:80], "pairs": pairs, "len": len(v)}
    elif isinstance(v, set):
        items = [serialize_value(x, depth+1) for x in list(v)[:20]]
        return {"type": "set", "repr": repr(v)[:80], "items": items, "len": len(v)}
    elif isinstance(v, types.FunctionType):
        return {"type": "function", "repr": f"<function {v.__name__}>"}
    else:
        return {"type": t, "repr": repr(v)[:80]}

def capture_frame(frame):
    local_vars = {}
    for k, v in frame.f_locals.items():
        if k.startswith('__'):
            continue
        try:
            local_vars[k] = serialize_value(v)
        except:
            local_vars[k] = {"type": "error", "repr": "<error>"}
    return {
        "func": frame.f_code.co_name,
        "line": frame.f_lineno,
        "locals": local_vars
    }

MAX_STEPS = 500  # 防止步骤过多导致卡死

def trace_calls(frame, event, arg):
    # 只追踪用户代码，遇到非用户帧立即返回 None 阻止继续追踪
    if frame.f_code.co_filename != '<user>':
        return None

    if len(steps) >= MAX_STEPS:
        return None

    if event in ('line', 'call', 'return', 'exception'):
        # 收集完整调用栈（只保留用户帧）
        stack = []
        f = frame
        while f and f.f_code.co_filename == '<user>':
            stack.insert(0, capture_frame(f))
            f = f.f_back

        steps.append({
            'line': frame.f_lineno,   # 1-based
            'event': event,
            'stack': stack,
            'stdout': output_buffer.getvalue()
        })

    return trace_calls  # 继续追踪该帧的后续事件

try:
    sys.settrace(trace_calls)
    # ★ 关键修复：传入 __name__ = '__main__'，否则 if __name__ == "__main__" 块不会执行
    exec_globals = {'__name__': '__main__'}
    exec(compile(source, '<user>', 'exec'), exec_globals)
    sys.settrace(None)
    sys.stdout = old_stdout
    truncated = len(steps) >= MAX_STEPS
    result = {'steps': steps, 'error': None, 'lines': source.splitlines(), 'truncated': truncated}
except Exception as e:
    sys.settrace(None)
    sys.stdout = old_stdout
    result = {'steps': steps, 'error': str(e), 'lines': source.splitlines(), 'truncated': False}

json.dumps(result)
`);
      self.postMessage({ id, type: 'trace', result: traceResult });
    } catch (err: any) {
      self.postMessage({ id, type: 'trace', error: err.message || safeString(err) });
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
