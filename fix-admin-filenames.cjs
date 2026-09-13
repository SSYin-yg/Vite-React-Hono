// 修复 admin 目录中文件名带不可见 bidi 控制字符的问题
// 用法：在本项目根目录（含 apps/）下执行  node fix-admin-filenames.cjs
const fs = require('fs');
const path = require('path');

const dir = path.resolve(process.cwd(), 'apps/web/src/admin');
if (!fs.existsSync(dir)) {
  console.error('找不到 admin 目录：', dir);
  console.error('请确认在包含 apps/ 的项目根目录下运行本脚本。');
  process.exit(1);
}

// 双向文本控制字符范围：U+200E U+200F U+202A-U+202E U+2066-U+2069
const BIDI = new RegExp('[\\u200E\\u200F\\u202A-\\u202E\\u2066-\\u2069]', 'g');
let renamed = 0;
for (const f of fs.readdirSync(dir)) {
  const clean = f.replace(BIDI, '');
  if (clean !== f && clean.length > 0) {
    const from = path.join(dir, f);
    const to = path.join(dir, clean);
    fs.renameSync(from, to);
    console.log('rename:', JSON.stringify(f), '->', JSON.stringify(clean));
    renamed++;
  }
}
console.log('完成，共重命名 ' + renamed + ' 个文件。');
if (renamed === 0) console.log('未发现带不可见字符的文件名。');