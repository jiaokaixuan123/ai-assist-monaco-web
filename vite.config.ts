import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['pyodide'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
    // 注意：COOP/COEP 头已移除（远程合并恢复后再次移除）。
    // 这两个头仅 Pyodide SharedArrayBuffer 需要，但会强制浏览器跨域隔离，导致首屏加载增加 10~30 秒。
    // 如需启用 Pyodide 高级功能，取消下方注释：
    // headers: {
    //   'Cross-Origin-Opener-Policy': 'same-origin',
    //   'Cross-Origin-Embedder-Policy': 'require-corp',
    // },
    fs: {
      allow: ['public', 'E:/Code/python/demo/monaco-ai-assist-web', '.'],
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  // 确保 public 目录下的文件能被正确访问
  publicDir: 'public',
})