// 将node_modules中vs目录下的 Monaco Editor 运行时文件复制到 public/vs下
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(__dirname, '../node_modules/monaco-editor/min/vs');
const DEST = path.join(__dirname, '../public/vs');

async function main() {
  console.log('📦 复制 Monaco Editor 文件...\n');

  // 检查源目录是否存在
  if (!fs.existsSync(SOURCE)) {
    console.error('❌ 错误: node_modules/monaco-editor 不存在');
    console.error('💡 请先运行: npm install');
    process.exit(1);
  }

  try {
    // 删除旧文件
    if (fs.existsSync(DEST)) {
      console.log('🗑️  删除旧文件...');
      await fs.remove(DEST);
    }

    // 复制文件
    console.log('📁 从 node_modules/monaco-editor/min/vs');
    console.log('📁 复制到 public/vs/');
    await fs.copy(SOURCE, DEST);

    // 计算文件大小
    const stats = await getDirectorySize(DEST);
    const sizeMB = (stats / 1024 / 1024).toFixed(2);

    console.log(`\n✅ Monaco Editor 文件复制完成！`);
    console.log(`📊 文件大小: ${sizeMB} MB`);
    console.log(`📁 保存位置: ${DEST}`);
  } catch (err) {
    console.error('❌ 复制失败:', err.message);
    process.exit(1);
  }
}

async function getDirectorySize(dir) {
  let size = 0;
  const files = await fs.readdir(dir, { withFileTypes: true });
  
  for (const file of files) {
    const filePath = path.join(dir, file.name);
    if (file.isDirectory()) {
      size += await getDirectorySize(filePath);
    } else {
      const stats = await fs.stat(filePath);
      size += stats.size;
    }
  }
  
  return size;
}

main().catch(console.error);
