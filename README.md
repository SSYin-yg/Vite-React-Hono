# Minelink B2B · Cloudflare 方案

矿联矿机（Minelink Equipment）B2B 官网的 **Cloudflare 全托管重构版**。

旧站是「静态 HTML + Strapi + PostgreSQL + 自托管 nginx」，本目录是迁移目标（迁移规划中的**方案 A**）：
前端 Vite + React 19，API 用 Hono 跑在 Cloudflare Workers，数据存 D1，图片走静态资源 / R2，邮件用 Resend，广告用 Google Ads。

> 仓库根就是本应用（`cloudflare/` 目录本身是独立仓库 `SSYin-yg/Vite-React-Hono`，分支 `main`）。
> **构建是自包含的**：只依赖仓库内文件，不需要仓库外的任何目录 —— 云端（Cloudflare Workers Builds）构建因此可以正常工作。

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | Vite 7 + React 19 + react-router-dom 7，纯 SPA，中英双语（`/` 与 `/en` 前缀） |
| 后端 | Hono 4 on Cloudflare Workers（单 Worker = API + 静态资源 + SPA 回退） |
| 数据 | Cloudflare D1（SQLite），迁移文件在 `apps/api/migrations/` |
| 存储 | Cloudflare R2（桶 `minelink-images`，`IMAGES` 绑定）为图片**唯一权威源**；`ASSETS` 静态资源仅作旧站遗留兜底 |
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
│   ├── migrations/                0001_init / 0002_inquiry_replied / 0003_equipment_seo / 0004_equipment_indexes / 0005_equipment_intro
│   ├── scripts/seed.mjs           从旧仓库资产生成种子 SQL（设备图路径自动 remap 为 R2）
│   ├── scripts/migrate-images-r2.mjs  一次性迁移：旧静态图上传 R2 + 生成 D1 UPDATE SQL
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
│   │   ├── i18n-dict.json         前台文案字典（中英，各 211 键）
│   │   └── styles/legacy/         旧站 6 个 CSS（common/home/catalog/pages/faq/product），已内联进仓库
│   └── vite.config.ts             dev 代理 /api → 8787；build 拷贝 legacy 图片（源缺失时跳过）
├── scripts/
│   ├── ensure-dist.mjs            dev 前保证 dist 存在（wrangler assets 目录要求）
│   ├── check-admin-env.mjs        后台登录自检（解析 .dev.vars → 探活 → 实测登录）
│   ├── smoke-prerender.mts        预渲染冒烟（mock D1/ASSETS，校验注入 HTML / 锚点 / 转义 / 回退）
│   └── smoke-admin-e2e.mjs        全链路回归：后台 API → D1 → 公开 API → 预渲染页（需 dev 在跑）
└── package.json                   npm workspaces 根，聚合脚本

# CI：本仓库根 .github/workflows/deploy.yml（push main → 构建 + 迁移 + 部署）
```

## 快速开始

```bash
cd cloudflare
npm install
npm run db:migrate:local     # 首次：建本地 D1 表
npm run db:seed:local        # 首次：灌入 31 台设备种子
npm run dev
```

- 前台 http://localhost:5173
- API 直连 http://127.0.0.1:8787
- 后台 http://localhost:5173/admin（英文版 `/en/admin`）

> dev 模式下 Vite 只代理 `/api`。`/sitemap.xml`、`/robots.txt`、`/api/images/*` 要走 8787，或用 `npm run preview`（构建后由 wrangler 在 8787 单端口提供完整形态）。

### 命令速查

| 位置 | 命令 | 作用 |
|---|---|---|
| 根 | `npm run dev` | 同时起 API(:8787) + Web(:5173) |
| 根 | `npm run build` | 构建前端（含 `tsc --noEmit` 类型检查 + legacy 图片拷贝，CI 无源时自动跳过） |
| 根 | `npm run preview` | 构建 + wrangler dev 单端口模拟线上 |
| 根 | `npm run deploy` | 构建 + `wrangler deploy` |
| 根 | `npm run admin:check` | **后台登录自检**（也可 `npm run admin:check -- 密码` 指定） |
| 根 | `npm run db:migrate:local` | 本地 D1 应用迁移 |
| 根 | `npm run db:seed:local` | 重新生成种子并灌入 |
| 根 | `npm run db:reset:local` | 删表 → 迁移 → 种子 |
| api | `npm run typecheck` | `tsc --noEmit` |
| web | `npm run typecheck` | `tsc --noEmit` |

### 回归测试

```bash
# 1) 预渲染：不需要起服务，mock D1/ASSETS 直接校验注入的 HTML
node --experimental-strip-types scripts/smoke-prerender.mts

# 2) 全链路：先起服务，再跑（会创建并删除一个临时设备 smoke-intro-check）
npm run dev
node scripts/smoke-admin-e2e.mjs
```

## 数据模型（D1）

| 表 | 说明 |
|---|---|
| `equipment` | 设备。主键是 slug（`id`），含中英名称/描述/特性、JSON 化的 `specs` / `model_tables` / `images` / `intro`，`published` 与 `sort` 控制上线与排序，`seo_*` 五列（0003 迁移新增），`intro` 产品介绍段落块（0005 迁移新增） |
| `inquiries` | 询盘。`mail_status` 记录发信结果（pending/sent/failed/skipped），`replied` 标记已回复（0002 迁移新增） |
| `mail_logs` | 邮件发送日志 |
| `site_settings` | 站点键值配置（品牌名、联系方式、Google Ads 等） |
| `website_images` | 页面公共图片（Banner / Logo） |

迁移：`0001_init.sql` → `0002_inquiry_replied.sql` → `0003_equipment_seo.sql` → `0004_equipment_indexes.sql` → `0005_equipment_intro.sql`。
线上用 `wrangler d1 migrations apply minelink-db --remote`，本地用 `--local`。

设备结构化字段（均由后台**可视化编辑器**维护，运维无需写 JSON / HTML）：

| 列 | JSON 结构 | 前台渲染 |
|---|---|---|
| `specs` | `[{k_zh,k_en,v}]` | 「主要参数」两列表格 |
| `model_tables` | `[{title_zh,title_en,columns:[{zh,en}],rows:[[...]]}]` | 每张表一个 `<h2>` section，列头支持中英 |
| `intro` | `[{title_zh,title_en,body_zh,body_en}]` | 「产品介绍」：每块 → `<h3>`（锚点 `intro-N`）+ 段落（空行分段） |

列表查询复合索引（0004）：`idx_equipment_published_sort (published, sort)` 服务未筛选列表（`WHERE published=1 ORDER BY sort`，首页全量 / 目录分页），`idx_equipment_published_category_sort (published, category, sort)` 服务分类筛选列表与分类计数。经 `EXPLAIN QUERY PLAN` 验证两类查询均命中索引且无需额外排序。

## 接口

### 公开

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/equipments` | 设备列表（**精简投影**：仅 `id` / `name` / `category` / `images`，不含 `specs` / `model_tables` / `desc` / `seo` 大字段）。支持 `?category=&q=&page=&pageSize=`；**带分页参数时**返回 `{items,total,page,pageSize,totalPages}`，不带则返回全量 |
| GET | `/api/equipments/:slug` | 设备详情（嵌套 `name{zh,en}` / `desc` / `features` / `specs` / `modelTables` / `intro` / `seo`） |
| GET | `/api/categories` | 分类及计数（仅 published） |
| POST | `/api/inquiries` | 提交询盘（落库 + 写 mail_logs + 可选发信） |
| GET | `/api/site/settings` | 站点设置（驱动页头页脚与客服组件） |
| GET | `/api/site/ads` | Google Ads 规范化配置 |
| GET | `/api/site/images` | 页面图片，可 `?page=` |
| GET | `/api/images/*` | 从 R2 读取图片（通配，支持 `equipment/<file>`、`global/<file>` 等嵌套 key） |
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
| POST | `/api/admin/images` | 上传图片到 R2（multipart，限 10MB） |

> **路径注意**：图片读取/上传路由统一收在 `/api` 下——上传 `POST /api/admin/images`（受 `/api/admin/*` 鉴权中间件保护）、读取 `GET /api/images/*`，与其他管理端点 `/api/admin/...` 风格一致。

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
- **设备编辑**：五个分区（基本信息 / 内容 / **产品介绍** / 参数与型号表 / SEO），保存后可「保存并查看前台」
  - **产品介绍**：段落块编辑器（小标题 + 正文，可增删/排序）→ 前台渲染为 `<h3>` 锚点，自动进入详情页「本页目录」
  - **参数与型号表**：主要参数为行式编辑器（参数名中英 + 值）；型号表为表格式编辑器（列定义中英 + 数据行，列/行均可增删）
  - 两者都保留「高级：直接编辑 JSON」折叠区（点「应用 JSON」才校验回写），供技术人员做批量调整；**普通运维全程不接触 JSON**
- **询盘管理**：搜索、状态筛选（未回复/已回复/邮件已发/失败）、分页、展开详情、标记已回复
- **站点设置**：分三组 —— 站点与联系 / Google Ads / 其它；已知的 Google Ads 键可一键补齐

后台自带：深色/浅色主题（localStorage 持久化，默认跟随系统）、顶栏面包屑、窄屏抽屉菜单、Toast 通知、骨架屏、表格 sticky 表头。样式全部 `--adm-*` / `adm-` 前缀，不污染前台。

## 前台能力

- **页面**：首页（轮播/精选/指标）、设备目录、设备详情、行业方案、服务支持、关于我们、常见问题
- **设备目录**：服务端分页（每页 9 条）、分类筛选、防抖搜索、页码同步到 `?page=`
- **设备 SEO**：后台填写的中英 `seo_title` / `seo_desc` / `seo_keywords`，由 `src/seo.ts` 运行时写入 `document.title` 与 meta 标签（留空回退设备名）
- **详情页产品介绍 + h 标签导航**：后台维护的「产品介绍」段落块渲染为 `<h3>` 锚点；页面按实际渲染顺序自动生成「本页目录」（h2 一级 / h3 二级），点击平滑跳转对应段落
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

**注入的正文**：h 标签导航（本页目录）、产品介绍（`<h3>` 锚点 + 段落）、图集、设备名、简介、特性列表、参数表、型号表 —— 复用前台 CSS 类（`.detail` / `.detail-toc` / `.intro-block` / `.spec-table` 等），
React 挂载后接管，视觉一致。锚点 id 规则（`intro` / `intro-N` / `specs` / `models-N` / `inquiry`）在 SSR 与 CSR 两侧保持一致。

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

## 图片存储（R2）

全站图片（设备详情图 + 首页轮播 / 通用图）统一存入 Cloudflare R2 桶 `minelink-images`，由 Worker 经 `GET /api/images/*` 同源读取：

- **设备图** key：`equipment/<filename>`；D1 里 `equipment.images` 存 `api/images/equipment/<filename>`（无前导斜杠，前端 `src=/\${src}` 拼成 `/api/images/equipment/...`），预渲染 `absUrl` 亦拼成绝对同源 URL，SEO 一致。
- **通用图** key：`global/<filename>`；`website-images.json` 与 `i18n.ts` 的 `HERO_IMAGES` 存 `/api/images/global/<filename>`（带斜杠，适配 CSS `url()` / 绝对引用）。

读取路由用通配 `GET /api/images/*`（非 `:key`），以兼容带斜杠的嵌套 key；命中后 `Cache-Control: public, max-age=86400`。上传走 `POST /api/admin/images`（鉴权，限 10MB，写入 `website_images` 并登记）。

> 旧站的 `B2B/assets/images/equipment/*` 是**迁移源**而非线上源；`vite.config.ts` 的 `legacy-images` 插件仍会在构建时把该目录拷入 `dist/assets/images`，属遗留兜底，**线上图片以 R2 为准**。
> 该目录位于**本仓库之外**，CI 构建机只 clone 本仓库、拿不到它 —— 插件检测不到源目录时会跳过拷贝，不影响云端构建。因此线上必须确保 R2 里已有对象，否则设备图 404。
> 同理，旧站 6 个 CSS 原先也 import 自 `../../../../assets/`，已内联到 `apps/web/src/styles/legacy/`，保证仓库自包含、可云端构建。

### 迁移脚本（一次性）

`apps/api/scripts/migrate-images-r2.mjs` 负责把旧静态图搬进 R2 并改写数据：

1. 解析 `assets/equipment-data.js`（设备图）+ `apps/web/src/i18n.ts`、`website-images.json`（通用图），去重后确定待上传文件
2. 通过 `wrangler r2 object put` 上传到 `minelink-images`（前缀 `equipment/`、`global/`）
3. 生成 `scripts/r2-equipment-image-update.sql`（UPDATE `equipment.images`）与 `scripts/r2-website-image-update.sql`（UPSERT `website_images`）
4. 原地改写 `website-images.json` 为 R2 路径

```bash
cd apps/api
node scripts/migrate-images-r2.mjs --dry-run   # 只打印映射与 SQL，不落库 / 不写文件
node scripts/migrate-images-r2.mjs             # 真实上传 + 写 SQL + 改写 json
# 上传完成后应用 SQL（生产把 --local 换 --remote）
wrangler d1 execute minelink-db --local  --file scripts/r2-equipment-image-update.sql
wrangler d1 execute minelink-db --local  --file scripts/r2-website-image-update.sql
```

> 执行需本机 `wrangler login` 且 `minelink-images` 桶已创建；脚本内部用 `import.meta.url` 推算仓库根（解析 `wrangler.jsonc` 的 `bucket_name`），**不依赖当前 cwd**。

`apps/api/scripts/seed.mjs` 已同步：重生成 `seed.sql` 时设备图路径自动 remap 为 `images/equipment/<f>`，重导入不会覆盖回旧静态路径。

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
npx wrangler d1 migrations apply minelink-db --remote   # 0001 + 0002 + 0003 + 0004 + 0005
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put RESEND_API_KEY
# 改 wrangler.jsonc：SITE_URL / MAIL_FROM / MAIL_TO
npm run deploy
```

### CI 自动部署（已配置）

`.github/workflows/deploy.yml`（仓库根）：push `main` 或手动触发，依次执行

`npm ci` → `npm run typecheck` → `npm run build` → D1 迁移（`--remote`）→ `wrangler deploy`

需在 **Settings → Secrets and variables → Actions** 配置两个 secret：

| Secret | 权限 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Edit Cloudflare Workers + D1 Edit + Workers R2 Storage Edit |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账号 ID（Dashboard 右侧栏） |

未配置这两个 secret 时，workflow 只跑类型检查与构建并给出 warning，**不会失败**（避免推送即报红）。

> 也可改用 Cloudflare 原生 Workers Builds（Dashboard → 该 Worker → Settings → Builds 连接仓库）：
> 构建在 Cloudflare 侧进行，无需在 GitHub 存 token。构建命令 `npm ci && npm run build`，
> 部署命令 `npm run deploy --workspace apps/api`。两种方式**只能启用一个**，否则每次 push 会重复部署。

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

- `no such table: equipment`：本地没跑迁移，`npm run db:migrate:local`
- 改了 `.dev.vars` 没生效：完全停止 dev 再重启
- `npm ci` 报 `can only install packages when your package.json and package-lock.json are in sync`：lockfile 与 package.json 不一致（例如残留了指向仓库外目录的 `file:..` 依赖）。跑一次 `npm install` 让 lockfile 追平，或手工清理 lockfile 里的多余条目
- `wrangler r2 object put` 报 `Unknown argument: key`：wrangler 4.x 已改用 `r2 object put <bucket>/<key> --file <path>`
- 图片迁移脚本报「未找到 wrangler」：npm workspaces 会把 wrangler 提升到**仓库根** `node_modules/`，脚本已改为逐级向上查找，无需处理
- 线上图片全 404：R2 桶是空的，或 D1 里仍是旧路径。见「图片迁移」一节，记得把生成的两个 SQL 应用到 `--remote`

## 迁移状态

已完成：旧站页面与视觉复用、设备数据（31 台）、i18n 字典、SEO（sitemap/robots/设备级 SEO）、后台全套、鉴权加固、Google Ads、客服组件、D1 迁移与种子。

> CI：采用 **Cloudflare Workers Builds**（Dashboard 侧配置，构建跑在 Cloudflare，无需在 GitHub 存 token）。仓库内**不再需要** `.github/workflows/`。

> 说明：原版 `equipment/` 有 51 个 HTML 详情页，但只有 31 台有数据，另外 20 个页面视为旧版冗余，**不迁移**。

待办：

- [x] 设备详情页边缘预渲染（Worker 注入 SEO 头 + 可索引正文，见「详情页预渲染」章节）
- [x] 设备图片迁 R2（见「图片存储（R2）」章节：`migrate-images-r2.mjs` + 读取路由 `GET /api/images/*` + 数据 remap）
- [x] `equipments` 列表接口精简投影（列表仅返回 `id` / `name` / `category` / `images`，见「接口」）
- [x] 给 `equipment` 加列表查询复合索引（0004：`(published, sort)` + `(published, category, sort)`，见「数据模型」）
- [x] 统一图片路由的 `/api` 前缀（上传 `POST /api/admin/images`、读取 `GET /api/images/*`，与 `/api/admin/*` 风格一致）
- [x] 构建自包含化（旧站 6 个 CSS 内联进 `src/styles/legacy/`、`closeBundle` 拷图加存在性守卫）→ 云端构建可跑
- [x] lockfile 与 package.json 同步（移除残留的 `minelink-b2b: file:..`）→ `npm ci` 通过
- [x] 首次线上部署（`https://minelink-b2b.ssyin033.workers.dev`）：D1 迁移 0001~0005、R2 37 张图、seed 31 台设备、website_images 11 条

待办（线上收尾）：

- [ ] 把 `wrangler.jsonc` 的 `SITE_URL` / `MAIL_FROM` / `MAIL_TO` 换成真实域名（否则 sitemap 仍是 `example.com`）
- [ ] 设置 secrets：`npx wrangler secret put ADMIN_TOKEN` / `RESEND_API_KEY`
- [ ] Dashboard 配置 Cloudflare Workers Builds（见 `cloudflare-workers-builds-配置指南.md`）
- [ ] 绑定自定义域名
