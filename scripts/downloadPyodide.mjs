// 下载Pyodide核心文件和常用包的脚本
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYODIDE_VERSION = '0.29.0';
const BASE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const OUTPUT_DIR = path.join(__dirname, '../public/pyodide');

// 核心文件列表
const coreFiles = [
  'pyodide.js',
  'pyodide.mjs',
  'pyodide.mjs.map',
  'pyodide.asm.js',
  'pyodide.asm.wasm',
  'pyodide.d.ts',
  'pyodide-lock.json',
  'python_stdlib.zip',
  'package.json'
];

// 常用科学计算包（可选）
const commonPackages = [
  'numpy-2.2.5-cp313-cp313-pyodide_2025_0_wasm32.whl',
  'pandas-2.3.2-cp313-cp313-pyodide_2025_0_wasm32.whl',
  'matplotlib-3.8.4-cp313-cp313-pyodide_2025_0_wasm32.whl',
  'micropip-0.11.0-py3-none-any.whl'
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('📦 开始下载 Pyodide 文件...\n');

  // 创建目录
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 下载核心文件
  console.log('⬇️  下载核心文件:');
  for (const file of coreFiles) {
    const url = BASE_URL + file;
    const dest = path.join(OUTPUT_DIR, file);
    
    try {
      process.stdout.write(`  - ${file}...`);
      await downloadFile(url, dest);
      console.log(' ✅');
    } catch (err) {
      console.log(` ❌ ${err.message}`);
    }
  }

  // 可选：下载常用包
  const downloadPackages = process.argv.includes('--with-packages');
  
  if (downloadPackages) {
    console.log('\n⬇️  下载常用 Python 包:');
    for (const pkg of commonPackages) {
      const url = BASE_URL + pkg;
      const dest = path.join(OUTPUT_DIR, pkg);
      
      try {
        process.stdout.write(`  - ${pkg}...`);
        await downloadFile(url, dest);
        console.log(' ✅');
      } catch (err) {
        console.log(` ❌ ${err.message}`);
      }
    }
  } else {
    console.log('\n💡 提示: 使用 --with-packages 参数下载常用 Python 包');
  }

  console.log('\n✅ Pyodide 下载完成！');
  console.log(`📁 文件保存在: ${OUTPUT_DIR}`);
}

main().catch(console.error);
