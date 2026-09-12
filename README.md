# Minelink B2B · Cloudflare 方案

矿联矿机（Minelink Equipment）B2B 官网的 **Cloudflare 全托管重构版**。

旧站是「静态 HTML + Strapi + PostgreSQL + 自托管 nginx」，本目录是迁移目标（迁移规划中的**方案 A**）：
前端 Vite + React 19，API 用 Hono 跑在 Cloudflare Workers，数据存 D1，图片走静态资源 / R2，邮件用 Resend，广告用 Google Ads。

> 仓库根是 `B2B/`（旧站 + 本应用）。本应用位于 `Vite-React-Hono-main/` 子目录，CI 也指向它。
> 构建时会从外部目录 `B2B/assets/images` 拷贝设备图片 —— 少它构建会失败。

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | Vite 7 + React 19 + react-router-dom 7，纯 SPA，中英双语（`/` 与 `/en` 前缀） |
| 后端 | Hono 4 on Cloudflare Workers（单 Worker = API + 静态资源 + SPA 回退） |
| 数据 | Cloudflare D1（SQLite），迁移文件在 `apps/api/migrations/` |
| 存储 | Cloudflare R2（`IMAGES` 绑定）+ 静态资源（`ASSETS`） |
| 邮件 | Resend（`RESEND_API_KEY` 缺省时询盘只落库、不发信） |
| 样式 | 手写 CSS（`index.css` 前台 / `admin.css` 后台），无 UI 框架 |
| 部署 | `wrangler deploy`，或 GitHub Actions 推送 `main` 自动部署 |

## 目录结构

```
Vite-React-Hono-main/
├── apps/api/                      Hono API（Cloudflare Worker）
│   ├── src/
│   │   ├── index.ts               入口：安全头 / CORS / 错误兜底 / 旧站 301 / SPA 回退
│   │   ├── auth.ts                HMAC 会话票据 + requireAdmin（fail-closed）
│   │   ├── routes/
│   │   │   ├── equipments.ts      设备：列表(分页) / 详情 / 分类 / 管理 CRUD / 批量导入
│   │   │   ├── inquiries.ts       询盘：提交 / 管理列表(过滤) / 标记已回复
│   │   │   ├── site.ts            站点设置 / Google Ads 配置 / 页面图片
│   │   │   ├── admin.ts           登录、会话校验
│   │   │   ├── images.ts          R2 图片上传与读取
│   │   │   └── seo.ts             sitemap.xml、robots.txt
│   │   └── legacy-slugs.json      旧站设备 slug → 新 slug 映射（19 条）
│   ├── migrations/                0001_init / 0002_inquiry_replied / 0003_equipment_seo
│   ├── scripts/seed.mjs           从旧仓库资产生成种子 SQL
│   ├── seed/seed.sql              生成的种子数据（31 台设备）
│   ├── wrangler.jsonc             Worker 配置（D1 / R2 / assets / vars）
│   ├── .dev.vars                  本地密钥（勿提交，参考 .dev.vars.example）
│   └── package.json
├── apps/web/                      React SPA（Vite）
│   ├── src/
│   │   ├── pages/                 Home / Catalog / EquipmentDetail / Solutions / Support / About / Faq
│   │   ├── components/            SiteHeader / SiteFooter / InquiryForm / QuoteModal / ContactWidget
│   │   ├── admin/                 后台：AdminApp / Overview / EquipmentList / EquipmentForm /
│   │   │                          EquipmentImport / Inquiries / SiteSettings / ui / theme / i18n
│   │   ├── api.ts                 前端 API 客户端（含票据管理与 401 拦截）
│   │   ├── analytics.ts           Google Ads 注入、页面浏览与转化上报
│   │   ├── seo.ts                 运行时写 title / meta description / keywords
│   │   ├── site.tsx               全局 Context（语言、站点设置、询盘弹窗）
│   │   └── i18n-dict.json         前台文案字典（中英，各 211 键）
│   └── vite.config.ts             dev 代理 /api → 8787；build 拷贝 assets/images
├── scripts/
│   ├── ensure-dist.mjs            dev 前保证 dist 存在（wrangler assets 目录要求）
│   └── check-admin-env.mjs        后台登录自检（解析 .dev.vars → 探活 → 实测登录）
└── package.json                   npm workspaces 根，聚合脚本

# CI 不在本目录：见仓库根 B2B/.github/workflows/deploy.yml
```

## 快速开始

```bash
cd Vite-React-Hono-main
npm install
npm run db:migrate:local     # 首次：建本地 D1 表
npm run db:seed:local        # 首次：灌入 31 台设备种子
npm run dev
```

- 前台 http://localhost:5173
- API 直连 http://127.0.0.1:8787
- 后台 http://localhost:5173/admin（英文版 `/en/admin`）

> dev 模式下 Vite 只代理 `/api`。`/sitemap.xml`、`/robots.txt`、`/images/:key` 要走 8787，或用 `npm run preview`（构建后由 wrangler 在 8787 单端口提供完整形态）。

### 命令速查

| 位置 | 命令 | 作用 |
|---|---|---|
| 根 | `npm run dev` | 同时起 API(:8787) + Web(:5173) |
| 根 | `npm run build` | 构建前端（含 `tsc --noEmit` 类型检查 + 图片拷贝） |
| 根 | `npm run preview` | 构建 + wrangler dev 单端口模拟线上 |
| 根 | `npm run deploy` | 构建 + `wrangler deploy` |
| 根 | `npm run admin:check` | **后台登录自检**（也可 `npm run admin:check -- 密码` 指定） |
| 根 | `npm run db:migrate:local` | 本地 D1 应用迁移 |
| 根 | `npm run db:seed:local` | 重新生成种子并灌入 |
| 根 | `npm run db:reset:local` | 删表 → 迁移 → 种子 |
| api | `npm run typecheck` | `tsc --noEmit` |
| web | `npm run typecheck` | `tsc --noEmit` |

## 数据模型（D1）

| 表 | 说明 |
|---|---|
| `equipment` | 设备。主键是 slug（`id`），含中英名称/描述/特性、JSON 化的 `specs` / `model_tables` / `images`，`published` 与 `sort` 控制上线与排序，`seo_*` 五列（0003 迁移新增） |
| `inquiries` | 询盘。`mail_status` 记录发信结果（pending/sent/failed/skipped），`replied` 标记已回复（0002 迁移新增） |
| `mail_logs` | 邮件发送日志 |
| `site_settings` | 站点键值配置（品牌名、联系方式、Google Ads 等） |
| `website_images` | 页面公共图片（Banner / Logo） |

迁移：`0001_init.sql` → `0002_inquiry_replied.sql` → `0003_equipment_seo.sql`。
线上用 `wrangler d1 migrations apply minelink-db --remote`，本地用 `--local`。

## 接口

### 公开

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/equipments` | 设备列表。支持 `?category=&q=&page=&pageSize=`；**带分页参数时**返回 `{items,total,page,pageSize,totalPages}`，不带则返回全量 |
| GET | `/api/equipments/:slug` | 设备详情（嵌套 `name{zh,en}` / `desc` / `features` / `specs` / `modelTables` / `seo`） |
| GET | `/api/categories` | 分类及计数（仅 published） |
| POST | `/api/inquiries` | 提交询盘（落库 + 写 mail_logs + 可选发信） |
| GET | `/api/site/settings` | 站点设置（驱动页头页脚与客服组件） |
| GET | `/api/site/ads` | Google Ads 规范化配置 |
| GET | `/api/site/images` | 页面图片，可 `?page=` |
| GET | `/images/:key` | 从 R2 读取图片 |
| GET | `/sitemap.xml` | 站点地图（静态页 + 设备详情，中英，含 lastmod） |
| GET | `/robots.txt` | 指向 sitemap |
| GET | `/health` | 健康检查 |

### 管理（需鉴权）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/admin/login` | 用 `ADMIN_TOKEN` 换短期票据（**唯一免鉴权的管理端点**） |
| GET | `/api/admin/session` | 校验票据有效性 |
| GET/POST | `/api/admin/equipments` | 管理列表 / 创建（slug 非法 400、重复 409） |
| POST | `/api/admin/equipments/import` | 批量导入（`ON CONFLICT` upsert，可重复导入刷新） |
| GET/PUT/DELETE | `/api/admin/equipments/:slug` | 读取原始行 / 更新 / 删除 |
| GET | `/api/admin/inquiries` | 询盘列表，支持 `?limit=&status=&q=` 服务端过滤 |
| PUT | `/api/admin/inquiries/:id` | 标记已回复 |
| PUT | `/api/admin/site/settings` | 更新站点设置（`google_ads_*` 会做格式校验，非法 400 不落库） |
| POST | `/admin/images` | 上传图片到 R2（multipart，限 10MB） |

> **路径注意**：图片路由挂在根而非 `/api`，所以上传是 `POST /admin/images`、`GET /images/:key`，与其他管理端点的 `/api/admin/...` 不同。

### 旧站 301

- 6 个营销页 `.html` → 干净路径（`index.html`→`/`、`equipment-catalog.html`→`/equipment` 等）
- `/equipment/*.html` → 新 slug（查 `legacy-slugs.json`，19 条）

## 鉴权模型

1. 后台输入 `ADMIN_TOKEN` → `POST /api/admin/login`
2. 后端校验通过后签发 **HMAC-SHA256 票据**（`ml1.<exp.nonce>.<sig>`，12 小时有效期），**`ADMIN_TOKEN` 原文绝不下发到浏览器**
3. 票据存 `sessionStorage`，后续请求带 `Authorization: Bearer <ticket>`
4. 票据失效 → 后端 401 → 前端清票据 + 广播 `minelink:unauthorized` → 自动退回登录页

**fail-closed**：未配置 `ADMIN_TOKEN` 时，登录返回 `503 admin_not_configured`、所有管理接口拒绝，绝不因为「没配就放行」而裸奔。
登录端点有 250ms 固定延迟抗爆破；票据校验用恒定时间比较。

> 坑位提醒：鉴权中间件统一收口在 `index.ts` 的 `app.use('/api/admin/*')`，**必须放行 `/api/admin/login`**。
> 若在各子路由里写 `app.use('/admin/*', requireAdmin)`，Hono 会把它提升为父级中间件并优先于 handler 执行，登录请求会在到达 handler 前被拦 —— 表现为「密码正确却永远进不去」。

## 管理后台

访问 `/admin`（`/en/admin`），落地页是**总览仪表盘**：

- **总览**：设备总数/已发布、上线率、询盘总数/未回复、分类分布、最近询盘、快捷入口
- **设备管理**：搜索（slug/中英名）、分类与发布状态筛选、行内发布开关、行内排序、查看前台、编辑、删除、JSON 批量导入
- **设备编辑**：分四个分区（基本信息 / 内容 / 参数与型号表 / SEO），保存后可「保存并查看前台」
- **询盘管理**：搜索、状态筛选（未回复/已回复/邮件已发/失败）、分页、展开详情、标记已回复
- **站点设置**：分三组 —— 站点与联系 / Google Ads / 其它；已知的 Google Ads 键可一键补齐

后台自带：深色/浅色主题（localStorage 持久化，默认跟随系统）、顶栏面包屑、窄屏抽屉菜单、Toast 通知、骨架屏、表格 sticky 表头。样式全部 `--adm-*` / `adm-` 前缀，不污染前台。

## 前台能力

- **页面**：首页（轮播/精选/指标）、设备目录、设备详情、行业方案、服务支持、关于我们、常见问题
- **设备目录**：服务端分页（每页 9 条）、分类筛选、防抖搜索、页码同步到 `?page=`
- **设备 SEO**：后台填写的中英 `seo_title` / `seo_desc` / `seo_keywords`，由 `src/seo.ts` 运行时写入 `document.title` 与 meta 标签（留空回退设备名）
- **详情页预渲染**：`/equipment/:slug` 由 Worker 注入 SEO 头与可索引正文后返回，爬虫不执行 JS 也能抓到内容（详见下方章节）
- **站点设置生效**：`SiteProvider` 拉取 `/api/site/settings`，页头品牌名、页脚联系方式与描述均由其驱动（有硬编码回退）
- **客服悬浮按钮**（自原版 `assets/contact.js` 迁移）：PC 右下角竖排 WhatsApp / Telegram / Email 圆按钮 + hover 提示；移动端浮动主按钮 + 底部抽屉；按访客本地时间自动日夜配色。联系方式后台可配（`contact_whatsapp` / `contact_telegram` / `contact_email`），三个都为空时组件不渲染
- **Google Ads**：后台填 ID（`AW-` / `G-` / `GTM-` 前缀）后，前台自动注入 gtag、上报 `page_view`，询盘提交成功上报转化；自定义 head / body 代码用 `script.textContent` 写入，不走 `innerHTML`
- **询盘表单**：字段级校验（姓名、留言必填，邮箱格式）、行内错误提示、字数计数

## 详情页预渲染（SEO）

设备详情页原本是纯 CSR —— React 挂载后才拉数据、再在 `useEffect` 里写 `document.title`，爬虫抓到的是空壳 HTML。
现在由 Worker 在边缘完成预渲染（`apps/api/src/prerender.ts`）：

1. 拦截 `GET /equipment/:slug` 与 `GET /en/equipment/:slug`
2. 从 D1 查该设备（只取 `published = 1`）
3. 把 SEO 头部标签 + 可索引正文注入 `index.html` 后返回

**注入的头部**：`<title>`、description、keywords、canonical、`hreflang` 双向、`og:*` / `twitter:*`、
JSON-LD（Product + BreadcrumbList）。模板自带的 description/keywords 会先移除，避免重复。

**注入的正文**：图集、设备名、简介、特性列表、参数表、型号表 —— 复用前台 CSS 类（`.detail` / `.spec-table` 等），
React 挂载后接管，视觉一致。

**数据复用**：同时以 `<script type="application/json" id="ssr-equipment">` 注入设备数据，
前端 `EquipmentDetail` 直接读取（`readSsrEquipment`），省掉首屏那次 API 请求，也消除静态内容被替换的闪烁。

| 情况 | 行为 |
|---|---|
| 设备不存在 / 未发布 / slug 非法 | 返回 null，交回 SPA 回退，由前端显示 404 |
| `?_prerender=0` | 跳过预渲染（排障用） |
| 命中预渲染 | 响应带 `X-Prerender: equipment`，`Cache-Control: s-maxage=300` |

所有动态文本都经 HTML 转义，JSON-LD 中的 `<` / `>` / `&` 转为 `\\u003c` 等，不存在注入面。

> **本地怎么看效果**：dev 模式（:5173）由 Vite 提供页面且只代理 `/api`，**看不到预渲染**。
> 需 `npm run build && npm run preview` 后访问 http://127.0.0.1:8787/equipment/<slug> 查看源码。

## 环境变量

`apps/api/.dev.vars`（本地，勿提交；线上用 `wrangler secret put`）：

```
RESEND_API_KEY=        # 缺省时询盘只落库，mail_status=skipped
ADMIN_TOKEN=admin123   # 后台登录密码，必填
```

`apps/api/wrangler.jsonc` 的 `vars`（非敏感）：`MAIL_FROM`、`MAIL_TO`、`SITE_URL`（sitemap/robots 依赖，上线前改成真实域名）。

## 部署

### 手动首次上线

```bash
npx wrangler login
npx wrangler d1 create minelink-db          # 把返回的 database_id 填进 wrangler.jsonc
npx wrangler r2 bucket create minelink-images   # 声明了 IMAGES 绑定，桶必须存在
npx wrangler d1 migrations apply minelink-db --remote   # 0001 + 0002 + 0003
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put RESEND_API_KEY
# 改 wrangler.jsonc：SITE_URL / MAIL_FROM / MAIL_TO
npm run deploy
```

### GitHub Actions

仓库根 `.github/workflows/deploy.yml`：push `main`（且 `Vite-React-Hono-main/**` 有变更）自动执行
装依赖 → 构建 web → 应用 D1 迁移 → `wrangler deploy`。
需要在仓库 Secrets 配 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。

## 排错

### 后台登录失败

```bash
npm run admin:check              # 用 .dev.vars 里的值实测
npm run admin:check -- 你的密码   # 指定密码
```

脚本四步：解析 `.dev.vars`（查 BOM/CRLF/引号/首尾空格）→ 探 `/health` → 真实发一次登录 → 给结论。

按响应体判断：

| 响应 | 含义 | 处理 |
|---|---|---|
| `admin_not_configured` (503) | 后端没读到 `ADMIN_TOKEN` | 确认 `.dev.vars` 存在且拼写正确，**改完必须完全重启 dev**（wrangler 只在启动时读一次） |
| `invalid_credentials` (401) | 密码不对 | 大小写敏感，别加引号，别留空格 |
| `unauthorized` (401) | **被中间件拦了，没进 handler** | 检查是否有子路由重复挂了 `requireAdmin`（见上文坑位） |
| `fetch failed` | API 没起 | `npm install && npm run dev`，看终端 wrangler 报错 |

密码确认无误仍 401：浏览器可能存着旧票据 ——
`F12 → Application → Session Storage → 删除 minelink_admin_token → 刷新`。

### 其它

- 构建报找不到图片：确认 `B2B/assets/images` 存在（构建从这里拷图）
- `no such table: equipment`：本地没跑迁移，`npm run db:migrate:local`
- 改了 `.dev.vars` 没生效：完全停止 dev 再重启

## 迁移状态

已完成：旧站页面与视觉复用、设备数据（31 台）、i18n 字典、SEO（sitemap/robots/设备级 SEO）、后台全套、鉴权加固、Google Ads、客服组件、D1 迁移与种子、CI 部署。

> 说明：原版 `equipment/` 有 51 个 HTML 详情页，但只有 31 台有数据，另外 20 个页面视为旧版冗余，**不迁移**。

待办：

- [x] 设备详情页边缘预渲染（Worker 注入 SEO 头 + 可索引正文，见「详情页预渲染」章节）
- [ ] 设备图片迁 R2（当前随静态资源部署，仍读 `assets/images`）
- [ ] `equipments` 列表接口精简投影（列表场景不必返回 `specs` / `model_tables` 大字段）
- [ ] 给 `equipment(published, category, sort)` 加复合索引
- [ ] 统一图片路由的 `/api` 前缀（当前 `/admin/images` 与 `/api/admin/*` 不一致）
