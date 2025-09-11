// generate-filelist.js
const fs = require('fs');
const path = require('path');

const DOCS_DIR = './resources';
const OUTPUT_FILE = './filelist.json';

function walkDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      const children = walkDir(filePath);
      if (children.length > 0) {
        results.push({
          type: 'directory',
          name: file,
          children: children
        });
      }
    } else if (path.extname(file) === '.md') {
      results.push({
        type: 'file',
        name: file,
        path: filePath.replace(/\\/g, '/').replace(/^\.\/?/, '')
      });
    }
  });

  return results;
}

try {
  const tree = walkDir(DOCS_DIR);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(tree, null, 2), 'utf8');
  console.log(`✅ 成功生成 ${OUTPUT_FILE}`);
  console.log(`📁 扫描目录: ${DOCS_DIR}`);
} catch (err) {
  console.error('❌ 生成失败:', err);
}
