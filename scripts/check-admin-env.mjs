#!/usr/bin/env node
/**
 * 后台登录自检 —— 定位「.dev.vars 填了密码却登录失败」的原因。
 *
 * 用法（在项目根执行）：
 *   npm run admin:check                    # 用 .dev.vars 里的 ADMIN_TOKEN 实测登录
 *   npm run admin:check -- 我的密码        # 用指定密码实测登录
 *
 * 依次检查：文件 → 变量解析 → API 存活 → 实际登录请求，并给出可执行的下一步。
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DEV_VARS = path.join(ROOT, 'apps', 'api', '.dev.vars');
const API = process.env.API_BASE || 'http://127.0.0.1:8787';

const COL = {
  ok: '\x1b[32m',
  bad: '\x1b[31m',
  warn: '\x1b[33m',
  dim: '\x1b[2m',
  b: '\x1b[1m',
  r: '\x1b[0m',
};
const wrap = (color, s) => color + s + COL.r;
const OK = wrap(COL.ok, '[OK]');
const BAD = wrap(COL.bad, '[X]');
const WARN = wrap(COL.warn, '[!]');
const D = (s) => wrap(COL.dim, s);
const B = (s) => wrap(COL.b, s);

const mask = (v) => {
  if (v.length <= 2) return '*'.repeat(v.length);
  return v.slice(0, 2) + '*'.repeat(Math.min(6, v.length - 3)) + v.slice(-1);
};

function parseDevVars() {
  if (!existsSync(DEV_VARS)) {
    return { map: null, issues: ['未找到 apps/api/.dev.vars（请复制 .dev.vars.example 后重命名并填写）'] };
  }
  const buf = readFileSync(DEV_VARS);
  const hasBom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const raw = buf.toString('utf8').replace(/^﻿/, '');
  const issues = [];
  if (hasBom) issues.push('文件带 UTF-8 BOM，首个变量名可能被读成带 BOM 的名字');
  if (raw.indexOf('\r\n') >= 0) issues.push('文件是 CRLF 换行，值可能残留 \\r 导致比对失败');

  const map = {};
  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t || t.charAt(0) === '#') continue;
    const idx = t.indexOf('=');
    if (idx < 0) continue;
    const k = t.slice(0, idx).trim();
    let v = t.slice(idx + 1);
    if (/^["'].*["']$/.test(v.trim())) issues.push('第 ' + (i + 1) + ' 行 ' + k + ' 的值被引号包裹，引号会被当成密码的一部分');
    if (v !== v.trim()) issues.push('第 ' + (i + 1) + ' 行 ' + k + ' 的值含首尾空格');
    v = v.trim().replace(/^["'](.*)["']$/, '$1');
    map[k] = v;
  }
  return { map: map, issues: issues };
}

function finish(msg) {
  console.log('');
  console.log(B('结论：') + msg);
}

async function main() {
  console.log(B('=== Minelink 后台登录自检 ==='));
  console.log(D('项目根: ' + ROOT));
  console.log(D('API 基址: ' + API));
  console.log('');

  // 1. 解析 .dev.vars
  console.log(B('[1/4] 读取 apps/api/.dev.vars'));
  const parsed = parseDevVars();
  if (!parsed.map) {
    console.log('  ' + BAD + ' ' + parsed.issues[0]);
    finish('后端拿不到 ADMIN_TOKEN，登录会返回 503。');
    process.exit(1);
  }
  const token = parsed.map.ADMIN_TOKEN || '';
  if (!token) {
    console.log('  ' + BAD + ' ADMIN_TOKEN 为空');
    finish('在 apps/api/.dev.vars 里写 ADMIN_TOKEN=你的密码，然后重启 npm run dev。');
    process.exit(1);
  }
  console.log('  ' + OK + ' ADMIN_TOKEN 已设置  ' + D(mask(token) + ' (长度 ' + token.length + ')'));
  for (const it of parsed.issues) console.log('  ' + WARN + ' ' + it);

  const arg = process.argv[2];
  const useArg = typeof arg === 'string' && arg.length > 0;
  const pwd = useArg ? arg : token;
  console.log('  ' + D(useArg ? '用命令行传入的密码测试（长度 ' + pwd.length + '）' : '用文件里的值测试'));
  console.log('');

  // 2. API 存活
  console.log(B('[2/4] 检查 API 是否在运行'));
  let alive = false;
  try {
    const r = await fetch(API + '/health', { signal: AbortSignal.timeout(3000) });
    alive = r.ok;
    console.log('  ' + (r.ok ? OK : BAD) + ' GET /health -> ' + r.status);
  } catch (e) {
    console.log('  ' + BAD + ' 无法连接 ' + API + ' —— ' + (e.name === 'TimeoutError' ? '超时' : e.message));
  }
  if (!alive) {
    finish('API 没起来，前端点登录会提示「无法连接 API」。在项目根执行 npm install && npm run dev。');
    process.exit(1);
  }
  console.log('');

  // 3. 实测登录
  console.log(B('[3/4] 实测 POST /api/admin/login'));
  let res;
  let body = {};
  try {
    res = await fetch(API + '/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd }),
      signal: AbortSignal.timeout(8000),
    });
    body = await res.json().catch(() => ({}));
  } catch (e) {
    console.log('  ' + BAD + ' 请求失败：' + e.message);
    finish('请求没到达后端，检查 wrangler dev 是否崩溃（看终端红字）。');
    process.exit(1);
  }
  console.log('  HTTP ' + res.status + '  body=' + JSON.stringify(body).slice(0, 160));
  console.log('');

  // 4. 结论
  console.log(B('[4/4] 结论'));
  if (res.ok && body.ok) {
    console.log('  ' + OK + ' 登录成功 —— 后端已签发票据，有效期至 ' + new Date(body.exp).toLocaleString('zh-CN'));
    console.log('');
    console.log(D('  若浏览器仍进不去，清掉旧票据：'));
    console.log(D('    F12 -> Application -> Session Storage -> 删除 minelink_admin_token -> 刷新'));
    return;
  }

  if (res.status === 503 || body.error === 'admin_not_configured') {
    console.log('  ' + BAD + ' 后端读不到 ADMIN_TOKEN（文件已填，但运行中的进程没加载到）');
    console.log('');
    console.log(B('  解决办法：'));
    console.log('    1. 完全停掉 dev（Ctrl+C，api 和 web 两个进程都要停）');
    console.log('    2. 确认改的是 ' + B('apps/api/.dev.vars') + '，不是 .dev.vars.example');
    console.log('    3. 重新启动：npm run dev');
    console.log(D('  wrangler 只在启动时读取 .dev.vars，改完必须重启才会生效。'));
    return;
  }

  if (res.status === 401) {
    console.log('  ' + BAD + ' 密码不匹配（后端已加载 ADMIN_TOKEN，但与你输入的不一致）');
    console.log('');
    console.log('  逐条核对：');
    console.log('    - 文件里的值：' + B(mask(token)) + '（长度 ' + token.length + '）');
    if (useArg) console.log('    - 你传入的值：' + B(mask(pwd)) + '（长度 ' + pwd.length + '）');
    console.log('    - 大小写敏感；首尾空格会被 trim');
    console.log('');
    console.log(D('  想看后端实际加载了什么：在 admin.ts 登录处打印 c.env.ADMIN_TOKEN 的长度，看 wrangler 终端输出。'));
    return;
  }

  console.log('  ' + BAD + ' 未预期响应 ' + res.status + ' ' + JSON.stringify(body));
}

main().catch((e) => {
  console.error(BAD + ' 自检脚本异常：', e);
  process.exit(1);
});
