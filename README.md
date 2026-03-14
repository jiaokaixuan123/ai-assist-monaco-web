# Monaco AI 编程助手

基于 Monaco Editor 和 Pyodide 的在线 Python 编程环境，提供代码编辑、运行、智能补全和语法检查功能。

## ✨ 特性

- 🎨 **Monaco Editor** - VS Code 同款编辑器，支持语法高亮、代码补全
- 🐍 **Pyodide** - 在浏览器中运行 Python 代码，无需后端服务器
- 💡 **智能代码补全** - Python 内置函数、关键字、代码片段
- 🔍 **语法检查** - 实时检测语法错误并高亮显示
- 🎯 **语义高亮** - 自动识别用户定义的函数、类、变量
- 💾 **自动保存** - 代码和输出自动保存到浏览器本地存储
- 🌙 **深色主题** - VS Code 深色主题，保护眼睛
- ⚡ **快捷键** - Ctrl+Enter 运行、Ctrl+Shift+F 格式化
- 🔒 **完全本地化** - 所有资源本地加载，支持离线使用

## 🚀 快速开始

### 环境要求

- Node.js 16+
- npm 或 yarn

### 安装步骤

```bash
# 1. 克隆项目
git clone <你的仓库地址>
cd monaco-ai-assist-web

# 2. 安装依赖（会自动复制 Monaco Editor）
npm install

# 3. 下载 Pyodide（可选 - 离线开发需要，约 300 MB）
npm run download:pyodide

# 4. 启动开发服务器
npm run dev
```

访问 `http://localhost:5173/`

> **💡 提示**：
>
> - Pyodide 和 Monaco Editor 文件（~350 MB）**不在 Git 仓库中**
> - `npm install` 会自动复制 Monaco Editor
> - Pyodide 可选：开发时用本地文件，生产可用 CDN
> - 详见 [文件管理说明](#-文件管理) 和 [部署指南](./DEPLOYMENT.md)

### 可用命令

```bash
npm run dev                # 启动开发服务器
npm run build              # 构建生产版本
npm run preview            # 预览生产构建
npm run download:pyodide   # 下载 Pyodide 文件（可选）
npm run copy:monaco        # 复制 Monaco 文件（install 自动执行）
```

## 📦 技术栈

- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Monaco Editor** - 代码编辑器
- **Pyodide 0.29.0** - 浏览器中的 Python 环境
- **Web Workers** - Pyodide 运行在独立线程中，不阻塞 UI

## 🎯 功能说明

### 代码编辑

- 语法高亮（Python）
- 自动缩进
- 括号匹配
- 代码折叠
- 行号显示
- Minimap

### 代码智能

- **自动补全**：

  - Python 内置函数（print, len, range 等）
  - 代码片段（for, while, if, def, class）
  - 用户定义的函数和类
- **悬停提示**：

  - 内置函数的文档
  - 用户定义符号的详细信息
- **语法检查**：

  - 实时检测语法错误
  - 红色波浪线标记
  - 错误提示
- **语义高亮**：

  - 自动识别用户定义的函数（黄色）
  - 自动识别用户定义的类（青色）
  - 自动识别用户定义的变量（蓝色）

### 快捷键

- `Ctrl+Enter` - 运行代码
- `Ctrl+Shift+F` - 格式化代码
- `Ctrl+S` - 保存代码
- `Ctrl+/` - 注释/取消注释

## 📁 项目结构

```


monaco-ai-assist-web/
├── public/
│   ├── pyodide/          # Pyodide 文件（本地）
│   └── vs/               # Monaco Editor 文件（通过 npm 提供）
├── src/
│   ├── components/       # React 组件
│   │   ├── Editor/       # 编辑器组件
│   │   ├── layout/       # 布局组件
│   │   └── Sidebar/      # 侧边栏
│   ├── hooks/            # 自定义 Hooks
│   ├── services/         # 服务层
│   ├── workers/          # Web Workers
│   │   └── pyodideWorker.ts  # Pyodide Worker
│   ├── styles/           # 样式文件
│   ├── App.tsx           # 主应用
│   └── main.tsx          # 入口文件
├── package.json
├── vite.config.ts
└── tsconfig.json

Monaco Editor (渲染层)
│
├── Monarch Tokenizer        词法高亮（本地，pythonLanguage.ts）
├── DocumentSemanticTokens   语义高亮（pyrightClient.ts → WS → Pyright）
├── CompletionItemProvider   智能补全（pyrightClient.ts → WS → Pyright）
├── HoverProvider            悬停提示（pyrightClient.ts → WS → Pyright）
├── DefinitionProvider       跳转定义（pyrightClient.ts → WS → Pyright）
├── ModelMarkers             错误诊断（applyDiagnostics ← publishDiagnostics）
│
├── WebSocket（3001 port）
│   └── pyright-ws-server.mjs ──stdio──► pyright-langserver
│
└── Pyodide Worker（pyodideWorker.ts）
    ├── run       运行代码
    ├── format    格式化（当前是 ast.parse 占位，未接 autopep8）
    └── syntax    语法检查（存在但从未被调用！）

```

## 🔧 配置

### Pyodide 本地化

项目使用本地 Pyodide 文件以支持离线使用。如果需要重新下载或更新 Pyodide：

```bash
npm run prepare:pyodide
```

这会从 npm 包中复制 Pyodide 文件到 `public/pyodide/` 目录。

### Monaco Editor 配置

Monaco Editor 通过 npm 安装并由 Vite 处理。配置文件在 `src/App.tsx` 中：

```typescript
// Worker 配置
self.MonacoEnvironment = {
  getWorker(_: any, label: string) {
    // ... 返回对应的 worker
  }
}

// 编辑器选项
loader.config({ monaco })
```

## 📝 使用说明

### 运行 Python 代码

1. 在左侧编辑器中输入 Python 代码
2. 点击"运行"按钮或按 `Ctrl+Enter`
3. 查看右下方的输出面板

### 功能开关

点击右上角的设置图标，可以切换：

- ✅ 自动补全
- ✅ 语法检查
- ✅ 语义高亮

### 代码选择

在编辑器中选择代码，右侧边栏会显示：

- 选择的代码
- 字符数和行数

## � 文件管理

### Pyodide 和 Monaco Editor 文件说明

本项目包含两个大型库文件，**不会上传到 Git 仓库**：

| 文件          | 大小    | 位置                | Git 状态  |
| ------------- | ------- | ------------------- | --------- |
| Pyodide       | ~300 MB | `public/pyodide/` | ❌ 已排除 |
| Monaco Editor | ~50 MB  | `public/vs/`      | ❌ 已排除 |

### 为什么不上传？

- 文件体积过大（350+ MB）
- GitHub 限制单文件 100 MB
- 可以通过脚本自动获取
- 生产环境推荐使用 CDN

### 如何获取？

```bash
# Monaco Editor（npm install 自动执行）
npm run copy:monaco

# Pyodide（可选 - 离线开发需要）
npm run download:pyodide
npm run download:pyodide -- --with-packages  # 包含常用科学计算包
```

### 生产部署建议

**教学网站推荐使用 CDN**（节省带宽、提升速度）：

```typescript
// .env.production
VITE_USE_CDN=true
VITE_PYODIDE_URL=https://cdn.jsdelivr.net/pyodide/v0.29.0/full/
```

详细说明请参考：

- 📖 [完整部署指南](./DEPLOYMENT.md)
- 📋 [文件管理 FAQ](./FILE_MANAGEMENT_FAQ.md)
- ⚡ [3分钟速查](./QUICK_REFERENCE.md)

---

## �🐛 常见问题

### Q: Pyodide 加载很慢？

**A:** Pyodide 首次加载需要下载约 10MB 的文件。本项目使用本地文件，所以加载速度较快。如果仍然慢，检查：

1. 开发服务器是否正常运行
2. 浏览器缓存是否清理
3. `public/pyodide/` 目录下的文件是否完整

### Q: Monaco Editor 不显示？

**A:** 检查：

1. 浏览器控制台是否有错误
2. Monaco Worker 是否正确加载
3. 清除浏览器缓存并硬刷新（Ctrl+F5）

### Q: 代码智能不工作？

**A:** 确保：

1. Pyodide 已加载完成（状态栏显示"Python 环境已加载"）
2. 在设置中启用了对应功能
3. 代码有语法错误时某些功能可能不可用

## 🔒 隐私说明

- 所有代码和数据仅保存在**浏览器本地存储**中
- 不会上传到任何服务器
- 支持完全离线使用
- 清除浏览器数据会删除所有保存的代码

## 📄 许可证

MIT License

## 🙏 致谢

- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Microsoft
- [Pyodide](https://pyodide.org/) - Pyodide Development Team
- [React](https://react.dev/) - Meta
- [Vite](https://vitejs.dev/) - Evan You

## 📮 反馈

如有问题或建议，欢迎提交 Issue 或 Pull Request！
