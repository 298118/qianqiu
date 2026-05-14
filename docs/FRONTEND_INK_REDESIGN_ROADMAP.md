# S73-S77 前端水墨重构路线图

本文档是《千秋》前端大重构的活动任务书。2026-05-14 用户进一步要求把原规划细化到可执行开发粒度，并允许为了更好的前端开发引入外部依赖和框架。因此本版不再把“无构建前端”视为 S74-S77 的固定技术上限，而是改为：

- S73 先完成素材体系、视觉规范、manifest、台账和审核流程，不引入运行时框架。
- S74.0 先走依赖治理，若验证通过，采用 React + TypeScript + Vite 渐进式接管新前端；旧 `public/app.js` 保留为回滚路径。
- S75 先让 React 前端岛接管首页与全局 shell。
- S76 再接管主游戏、身份面板、考试/放榜专题和地图桥接。
- S77 通过验收后再切默认入口，并保证 `npm install && npm start` 仍可本地可玩。

目标不是只给旧界面换皮，而是把《千秋》升级为中国古典水墨、手绘、泛黄宣纸与奏折质感的沉浸式史书/案头体验，同时继续保护 Mock 默认可玩、服务器裁决、存档安全、地图安全 view、AI proposal-only 和完整书生科举路径。

## 1. 本版补强结论

上一版规划方向正确，但粒度偏粗。本版新增以下内容：

- 把 S73-S77 拆成 `S73.0a` 到 `S77.8` 的可交付小步骤，每步写清实现功能、依赖、资料、验收和建议分工。
- 将“素材生成必须全面”落成素材矩阵：UI 材质、首页、场景、身份背景、考试/放榜、NPC/玩家立绘、动效、fallback、缩略图和 manifest。
- 把长期 300-400 张立绘目标拆成四期，不把首轮开发压垮。
- 明确女性立绘边界：全部为成年角色，端庄、服饰严整、高颜值、身份感强，可用剪裁、腰封、衣料层次和站姿表现优雅成熟女性身形比例；不得露骨、挑逗、幼态化或把身体部位当作卖点。
- 允许 S74 之后通过治理引入 React/TypeScript/Vite，但不在本规划提交里安装依赖；真正安装依赖必须单独执行 S74.0。
- 明确 `@pixi/react` 暂缓，S72 已落地的 `public/mapRenderer.js` / `public/mapPanel.js` 继续作为 imperative PixiJS island。

## 2. 设计目标

关键词：案头、卷轴、留白、淡墨、朱印、纸纹、微动、身份化。

整体方向：

- 首页是展开的画卷：顶部“千秋”，下方水墨云雾轻动，表单如题名册或户籍册，开始按钮如玉玺落印。
- 主界面是活的史书与案头工具：叙事正文优先阅读，地图、身份面板、人物、局势簿和专属功能按页签、抽屉、专题界面分层。
- 输入区固定底部：多行输入框伪作展开竹简或空白奏折，右侧“呈上”朱印按钮，支持 Enter 提交、Shift+Enter 换行，并在上方淡显最近一次 AI 行动提示。
- 设置统一右上角：AI 设置、存档/读档、返回首页、显示偏好、可访问性和本地安全摘要都进入“印匣/设置”入口，避免散落在页面各处。
- 专属场景全屏化：科举考试、放榜、殿试、朝议、县衙审案、军营、城市、书斋、御案等重要场景有独立界面与插画。
- 身份面板差异化：书生、地方官、入仕官员、大臣、将领、皇帝拥有不同背景、色彩权重、交互入口、核心指标和未来玩法预留；皇帝预留奏折、圣旨、任免、朝议等扩展位。
- 地图升级复用 S72 PixiJS：不推倒 `mapRuntimeView` 和 `public/mapRenderer.js`，而是纳入新主界面布局、视觉皮肤、场景背景和设置抽屉。

视觉原则：

- 主背景使用宣纸米白、浅驼和旧绢色，建议范围 `#f5f0e6` 到 `#e8dcc8`。
- 正文使用深墨色，关键标题、榜文、警示和行动按钮用朱砂红。
- 边框使用淡墨线、折痕、骑缝章、竹简压边、残纸边缘，避免厚重雕花和高饱和装饰。
- 背景图案低对比，不遮挡文字；文字游戏的阅读舒适度高于装饰密度。
- 动效像墨气浮动、纸页轻展和朱印落下；避免现代弹跳、霓虹、玻璃拟态和过度闪烁。
- 每个固定格式 UI 元素要有稳定尺寸和响应式约束，避免按钮、底部奏折、考试写作区和地图面板因文本变化而跳动。

## 3. 还可以优化丰富的方向

可在 S73-S77 里一并预留，不一定首轮全部做深：

- 史官笔法：叙事卷可按“起居注、实录、奏报、私札、榜文、案牍”切换样式，但底层仍是安全文本节点。
- 身份仪式感：开局、升学、登科、授官、出征、登基、遭弹劾等关键转换使用短暂全屏卷轴或朱批过场。
- 场景记忆：当前地点、身份和事件决定背景图、NPC 露出、可用操作和 action placeholder。
- 人物谱牒：NPC 不只显示头像，还显示关系、身份、公开评价、最近互动和可见记忆摘要；hidden 私档不进入前端。
- 科举沉浸：考试中不只写文章，还展示号舍、考篮、弥封、誊录、磨勘、考官评语、同年关系和授官轨迹。
- 皇帝专属：奏折队列、朱批、圣旨草稿、朝议、任免候选和史官记录。首轮只做前端草稿与安全 proposal 入口，后果仍由服务器普通回合或后续 resolver 裁决。
- 地图叙事化：舆图页不仅显示地点，也能联动局势簿、任所、军务、商路、赶考路线和当前行动草稿。
- 可访问性：低动效、字体大小、对比度、键盘焦点和移动端底部输入都从 S75 开始作为正式功能，不留到最后补丁。

## 4. 技术依赖路线

### 4.1 当前状态

当前项目：

- 后端：Node.js + Express，plain JavaScript。
- 前端：`public/index.html`、`public/app.js`、`public/styles.css`，无构建步骤。
- 地图：S72 已使用本地 `pixi.js@7.4.3` UMD vendor 和 `public/mapRenderer.js` / `public/mapPanel.js`。
- 本机已确认 Node.js `v24.13.1`、npm `11.8.0`，满足当前 Vite 官方 Node 要求。

### 4.2 S74.0 建议引入的依赖

以下是候选方案，真正安装必须在 S74.0 单独修改 `package.json` / lockfile，并按 [DEPENDENCY_PLUGIN_GOVERNANCE.md](DEPENDENCY_PLUGIN_GOVERNANCE.md) 记录用途、许可证、维护状态、安全影响、Mock/no-key 影响、验证和回滚。

| 依赖 | 建议 | 用途 | 说明 |
| --- | --- | --- | --- |
| `react` / `react-dom` | 引入 | 首页、shell、抽屉、考试全屏、身份面板、底部奏折 | 复杂 UI 状态和组件复用明显多于旧原生脚本能舒适承担的范围。 |
| `typescript` | 引入 dev | 只用于 `client/` 类型 | 不把后端 CJS 转 ESM，不在根级加 `"type": "module"`。 |
| `vite` | 引入 dev | React 前端岛 dev/build | 构建输出先放 `public/ink-client/`，S77 再切默认入口。 |
| `zustand` | 引入 | 前端视图缓存与 UI 状态 | 仅保存 `sessionId`、当前安全 payload、tab/drawer/modal 状态；不能当 canonical state。 |
| `lucide-react` | 引入 | 设置、存档、发送、返回、关闭等图标 | 图标再用 CSS 做朱印/淡墨样式，避免手画一堆不可维护 SVG。 |
| `vitest` | 引入 dev | client 纯函数、store、组件测试 | 后端继续保留 `node --test`。 |
| `@testing-library/react`、`@testing-library/user-event`、`jsdom` | 引入 dev | React 交互测试 | 覆盖设置抽屉、存档列表、行动 dock、考试写作区、键盘行为。 |

### 4.3 明确暂缓的依赖

| 依赖 | 结论 | 原因 |
| --- | --- | --- |
| `react-router` | 暂缓 | 当前是单页游戏，home/game/exam/settings 可先用 store 状态；URL 路由会增加读档和返回首页边界复杂度。 |
| `@tanstack/react-query` | 暂缓 | 回合提交、SSE、考试流程是强顺序事务；缓存层容易制造 stale payload。等存档/设置/列表查询明显复杂后再评估。 |
| `@pixi/react` | 暂缓 | 当前 S72 固定 PixiJS v7 UMD；最新 React wrapper 面向 PixiJS v8，直接引入会冲撞既有地图运行时。 |
| Tailwind / UI component kit | 暂缓 | 水墨 UI 需要强定制材料语言，现成组件库容易把界面带回现代仪表盘气质。 |
| Next/Nuxt/SSR 框架 | 不建议 | 本项目是本地 Express 文本游戏，复杂度和部署假设不匹配。 |

### 4.4 官方资料参考

2026-05-14 已核对以下官方资料，用于技术路线判断：

- React 官方文档建议新 React 应用使用框架，也允许从 build tool 如 Vite 起步：[Creating a React App](https://react.dev/learn/start-a-new-react-project)。
- Vite 官方文档列出 `react-ts` 模板、dev/build 脚本和 Node 要求：[Getting Started | Vite](https://vite.dev/guide/)。
- Zustand 官方说明其轻量 hook store API：[Introduction - Zustand](https://zustand.docs.pmnd.rs/getting-started/introduction)。
- Vitest 官方说明默认测试文件匹配和 TypeScript 支持：[Writing Tests | Vitest](https://main.vitest.dev/guide/learn/writing-tests)。
- Testing Library 官方资料建议用 user-event 测试用户交互：[user-event Introduction](https://testing-library.com/docs/user-event/intro)。
- Lucide 官方说明图标可定制且 tree-shakable：[Lucide](https://lucide.dev/)。
- PixiJS React 文档面向 PixiJS v8，故当前 S72 v7 地图先不切换：[Getting Started | PixiJS React](https://react.pixijs.io/getting-started)。

## 5. 稳定边界

技术边界：

- `npm install && npm start` 必须一直可运行，默认打开 `http://localhost:3000`。
- S73 不安装新运行时依赖，不改运行时代码，专注素材/契约/审核。
- S74.0 只有在依赖治理记录和验证通过后，才允许安装 React/TypeScript/Vite 等依赖。
- S74-S76 采用并行前端岛：`/ink-client/` 先运行新 React 前端，`/` 仍保持旧前端可用。
- S77 验收通过后才把 `/` 切到新前端；旧版保留为 `/legacy.html` 或等价回滚入口至少一个发布周期。
- 存档仍优先走 `GET /api/game/saves` 与 `GET /api/game/player-state/:sessionId`；普通读档不得使用 raw session 或 raw audit。
- AI 设置仍走 `GET/POST /api/ai/settings/:sessionId` 和安全 `aiSettingsView` / `aiControlAuditView`；前端不得读取 `.env`、本地路径、raw prompt、raw provider payload 或 hidden ledger。
- 返回首页只改变前端视图和当前本地 session 指针，不删除存档，不重写服务器状态。
- S72 地图继续只读 `mapRuntimeView`；显示坐标不进入 prompt、AI 工具、移动裁决或 canonical 世界事实。

内容边界：

- 所有 AI 生成或第三方候选视觉素材入库前，必须由 Codex 视觉审核历史/水墨适配、缩放可读性、无水印、无现代元素、无可读乱码、无 hidden/raw 暗示、无本地路径和 key。
- 玩家与 NPC 立绘要求古代形象、成年、端庄、有身份感、高颜值但不露骨；不得性化未成年人，不用幼态卖点，不生成过度暴露、挑逗或只强调身体的素材。
- 女性角色可以是女官、才女、商贾、宫廷人物、将领或市井人物；美感来自面容、神情、服饰层次、体态、身份气质和构图，不来自裸露或挑逗姿势。
- 科举、刑名、战争等场景可以有紧张感，但避免血腥猎奇。
- 榜文、奏折、书卷、试卷背景尽量不生成可读文字；真实可读文字由前端 HTML 渲染，避免图片乱码和错误史实。
- 立绘规模 300-400 张属于长期目标，不在 S73 一次性全部生成。首轮只建立风格基准、manifest、审核流程和少量代表样张。

安全视图边界：

- 新增首页、设置、存档、身份面板、考试界面、放榜界面、NPC 立绘面板只能组合已有 route view 或后续服务器新增的安全 projection。
- 若新增任何可见数据域、角色面板、NPC 私档摘要或场景工具入口，必须同步定义 AI read scope、actor intelligence、tool permissions、proposal boundaries、server adjudication、audit records 和 Mock/no-key fallback。
- React store 不保存 raw session，只保存 `sessionId`、显示偏好、当前安全 payload 和 UI 状态。
- 禁止用 `dangerouslySetInnerHTML` 渲染 provider 文本；叙事、评语、榜文和 AI 提示使用文本节点。

## 6. 需要准备的资料

视觉与历史资料只作为风格和结构参考，不直接复制未经许可图片：

- 书案与纸面：宣纸、旧绢、奏折、折子、册页、竹简、卷轴、骑缝章、朱批、印泥、砚台、毛笔。
- 首页与场景：水墨山水长卷、古城、驿道、云雾、飞鸟、梅兰竹菊、书斋、县衙、公堂、军帐、御案、街巷、城门。
- 科举：明清贡院号舍、考篮、弥封、誊录、磨勘、皇榜、殿试殿阁、考官桌案。
- 服饰与身份：士人服、官服补子、女官服饰、甲胄、宫廷礼服、胥吏、市井商贾、书院师友、同年、考官。
- 现有项目契约：`IMPERIAL_EXAM_SYSTEM_CONTRACT.md`、`AI_CONTROL_AUDIT_MATRIX.md`、`PIXIJS_INK_MAP_RUNTIME_CONTRACT.md`、`MAP_ASSET_LEDGER.md`、`DATABASE_RESOLVER_INPUT_CONTRACT.md`。
- API 与安全资料：`player-state`、`aiSettingsView`、`aiControlAuditView`、`mapRuntimeView`、考试安全快照、hidden/raw 防线测试。

## 7. 信息架构草案

### 首页

第一视口必须直接传达“千秋”与古代史书/画卷气质：

- 顶部大标题“千秋”，下方水墨云雾动画。
- 中央表单置于画卷或题名册中：朝代下拉、自定义年份、身份、姓名、家境；书生身份才显示家境细分“贫寒/普通/世家”，并保留自定义背景。
- “开始”按钮为朱印/玉玺盖章效果。
- 右上角可打开印匣/设置；首页存档以案卷列表呈现。
- 背景为巨幅水墨山水画卷，留白足够承载表单，不遮挡输入。

### 主界面

建议分为五个层次：

- 顶栏：日期、身份、地点/场景、核心资源、设置入口。
- 主叙事卷：中央阅读区，像史书正文或卷册页面，保留最近行动、AI 叙事、世界回响。
- 场景插画带：根据当前身份与场景显示淡墨背景或专属插画，如书斋、贡院、官署、军营、御案、城市。
- 功能页签/抽屉：舆图、人物、局势簿、科举档案、官职履历、AI 调动审计等进入分层界面，不全部常驻堆叠。
- 底部行动奏折：固定输入与“呈上”，响应身份 placeholder。

### 右上角设置

统一入口建议命名为“印匣”或“设置”：

- AI 设置：复用 `aiSettingsView`，展示 provider/model/输出长度/安全严格度/critic/safety，不暴露 key。
- 存档/读档：复用存档 metadata 列表，显示当前存档、最近更新时间、身份、回合、摘要。
- 返回首页：回到首页但保留当前 session；提供“继续本局”入口。
- 显示偏好：动效开关、字体大小、对比度、地图动效、自动滚动叙事。
- 本地安全摘要：仅显示脱敏诊断，不连接 raw dev diagnostics。

### 专属界面

- 科举考试：全屏模态，贡院号舍淡墨背景，中央试卷，上方考题，下方宽大写作区，顶部考试阶段/局部时间，侧边虚拟考生或考场记录，“交卷”为火漆/朱印。
- 放榜：皇榜黄纸底，状元/榜眼/探花朱砂章强调，其他名次列表，玩家高亮，点击玩家名展开考官评语、防作弊和评分维度；背景为贡院外放榜场景。
- 皇帝：御案界面，奏折队列、圣旨书写、朝议入口、任免/赏罚预留位；所有后果仍由服务器 resolver 或普通回合裁决。
- 地方官：县衙案牍、钱粮、水利、盗匪、词讼入口，未来接入地方案件和财政 resolver。
- 将领：军帐、粮饷、斥候、边患、军令草案和战报入口。
- 大臣/入仕官员：部院公文、同年/派系、考成、弹劾、奏疏入口。
- 书生：书斋、读书簿、师友、科期、文章练习和赶考入口。

## 8. S73 素材准备与资产体系

目标：建立可复用视觉资产体系，而不是先大改 UI。S73 完成后，S74-S76 能直接按 manifest、台账和视觉规范接入。

### S73.0a 详细蓝图与依赖规划

状态：本文档本版补强即 S73.0a 的交付。

交付：

- 将用户的新要求拆成可执行小步骤。
- 记录框架/依赖候选与暂缓项。
- 固定素材生成全面性、女性立绘安全边界、NPC 分期和子代理分工。
- 同步 `docs/DEVELOPMENT_STEPS.md`、brief、README 和共享上下文。

验收：

- 不安装依赖、不改运行时代码、不生成素材。
- docs governance 与 diff check 通过。

### S73.1 视觉资产指南

需要资料：

- 宣纸、奏折、榜文、科举、官服、书斋、县衙、军帐、御案资料。
- S72 地图素材指南和台账，复用其审核经验。

实现功能：

- 新增 `docs/FRONTEND_VISUAL_ASSET_GUIDE.md`。
- 固定颜色、字体、纸纹、边框、动效、图片格式、尺寸、命名、压缩、移动裁切、缩略图和 fallback 规则。
- 写清“阅读优先，装饰服从文本”的硬规则。
- 写清女性与男性立绘都必须成年、端庄、高颜值、有身份差异；女性可展现优雅身形比例但不能露骨、挑逗或幼态。

验收：

- 指南能指导 S73.2-S73.8 独立生成素材。
- 不出现 prompt 原文泄漏真实 key/path 的风险。

### S73.2 UI 素材 manifest schema 与台账

实现功能：

- 新增 `public/assets/ui/ink-ui-manifest.json` 草案。
- 新增 `docs/FRONTEND_ASSET_LEDGER.md` 台账。
- 定义 manifest 字段：
  - `id`、`version`、`phase`、`category`、`subcategory`
  - `path`、`thumbnailPath`、`fallbackRef`
  - `dimensions`、`aspectRatio`、`format`、`transparent`
  - `usage`、`roleOrScene`、`identityTags`、`genderPresentation`、`ageBand`
  - `toneTags`、`paletteTags`、`cropSafeZones`、`mobileCropNotes`
  - `sourceType`、`generator`、`promptSummary`、`negativePromptSummary`
  - `licenseNote`、`thirdPartySourceUrl`、`reviewStatus`
  - `visualReview`、`safetyReview`、`performance`
- 规定 manifest 不保存完整敏感 prompt、key、本地绝对路径、raw provider payload 或 hidden/raw 词样。

验收：

- manifest 字段能覆盖背景、UI 材质、立绘、动效和 fallback。
- 后续测试能读取并校验路径、字段、尺寸和审核状态。

Manifest 示例：

```json
{
  "id": "s73-home-scroll-bg-v1",
  "version": 1,
  "phase": "S73",
  "category": "background",
  "subcategory": "home",
  "roleOrScene": "home",
  "path": "/assets/ui/backgrounds/s73-home-scroll-bg-v1.webp",
  "thumbnailPath": "/assets/ui/thumbs/s73-home-scroll-bg-v1.webp",
  "format": "webp",
  "dimensions": { "width": 1920, "height": 1080 },
  "aspectRatio": "16:9",
  "transparent": false,
  "toneTags": ["水墨", "宣纸", "山水", "留白"],
  "usage": ["home.hero.background"],
  "sourceType": "ai_generated",
  "generator": "gpt-image-2",
  "promptSummary": "首页山水画卷背景，淡墨云雾，留白充足",
  "negativePromptSummary": "无文字、水印、现代物品、过饱和 UI",
  "licenseNote": "project-generated",
  "reviewStatus": "approved",
  "visualReview": {
    "reviewer": "Codex",
    "historicalFit": "pass",
    "inkWashFit": "pass",
    "readability": "pass",
    "mobileCrop": "pass",
    "notes": "低对比，适合表单叠加"
  },
  "safetyReview": {
    "noSecrets": true,
    "noHiddenRaw": true,
    "adultOrNonHumanOnly": true,
    "nonSexualized": true,
    "noWatermark": true,
    "noModernObjects": true
  },
  "performance": {
    "eager": false,
    "lazyLoad": true,
    "targetKb": 450
  },
  "fallbackRef": "s73-paper-parchment-v1"
}
```

### S73.3 UI 材质包

首轮数量：12-20 个。

实现功能：

- 生成或制作宣纸纹理、旧绢纹理、奏折纸、竹简纸、卷轴边、残纸边、水渍、淡墨分隔线、朱印按钮底、印匣纹理、试卷界栏、皇榜纸底。
- 为每类材质准备桌面/移动或可平铺版本。
- 所有纹理低对比，不抢正文。

验收：

- 每个素材有 manifest、缩略图、台账记录和 Codex 视觉审核。
- 支持 CSS `background-image` 或 React 组件引用。
- 缺失时可回退到纯 CSS 纸色。

### S73.4 首页资产包

首轮数量：4-6 个。

实现功能：

- 首页山水画卷主背景。
- 水墨云雾透明层。
- 题名册/户籍册表单底。
- “开始”朱印/玉玺按钮底。
- 首页案卷存档列表背景或图标。
- reduced-motion 静态云雾 fallback。

验收：

- 第一屏直接显示“千秋”视觉气质。
- 桌面、移动裁切都有留白，不遮挡表单。
- 无可读文字、水印、现代物品、乱码。

### S73.5 场景插画包

首轮数量：8-12 张。

优先场景：

- 书斋
- 贡院号舍
- 皇榜放榜
- 殿试金殿
- 县衙厅堂
- 公堂审案
- 军帐
- 御案
- 城市街巷
- 驿道/舆图过场

实现功能：

- 每张图给出用途、留白位置、裁切建议和 fallback。
- 考试/放榜图必须避免可读伪文字；真实榜文和考题由 DOM 渲染。
- 背景可淡墨，重要操作区要能叠加羊皮纸/宣纸面板。

验收：

- 至少覆盖首页、书生、科举、放榜、官署、军营、皇帝六类关键体验。
- 移动端裁切后主体仍可辨。

### S73.6 身份背景包

首轮数量：6-10 张。

实现功能：

- 书生：寒窗书斋、竹影、砚台。
- 地方官：县衙、公案、案牍。
- 入仕官员：部院公文、同年名帖、官署走廊。
- 大臣：内阁/部院案头、奏疏、朱批。
- 将领：军帐、沙盘、边塞风。
- 皇帝：御案、玉玺、奏折、殿阁。
- 可选补充：市井/商路、书院、驿馆。

验收：

- 每个身份有专属色彩权重和 UI 材料建议。
- 背景不等同于角色立绘，不泄漏 hidden 状态。

### S73.7 玩家与 NPC 立绘风格基准

首轮数量：24-40 张，不进入长期大批量。

实现功能：

- 玩家基准：成年男女书生、成年男女入仕官员、成年男女将领、成年男女皇帝/摄政视角、成年男女地方官/大臣。
- NPC 类型：老师、考官、同年、县令、吏员、大臣、将领、宫廷人物、商贾、士绅、女官。
- 重要 NPC 预留：张居正、魏忠贤等先做 prompt 与审核标准，不要求 S73 全量实装。
- 每个立绘登记 `portraitRef`，未来 UI 只引用 ref，不硬编码图片路径。

立绘规范：

- 全部角色为成年，端庄、身份明确、服饰符合古代语境。
- 高颜值来自五官协调、神情、服饰、姿态、光影和身份气质。
- 女性角色可通过剪裁、腰封、衣料层次与站姿体现优雅成熟女性身形比例；服饰仍需严整，不做裸露、挑逗、幼态或现代写真感。
- 同一人物后续可扩展常态、喜、怒、忧、病、入仕、战时、朝服等状态。
- 浏览器先通过 manifest `portraitRef` 预留接线，不把 hidden NPC 私档暴露给前端。

验收：

- 小尺寸头像和半身卡都可读。
- 性别、身份、年龄层和职业有差异，不做同质化“漂亮头像池”。
- 未审核通过的立绘只能 fallback 到身份剪影或纸面占位。

### S73.8 动效与 fallback 包

首轮数量：6-10 个。

实现功能：

- 水墨云雾、墨迹扩散、朱印落章、纸页展开、榜文揭示、考试交卷火漆印。
- 每个动效都要有 `prefers-reduced-motion` 静态替代。
- 动效不阻塞交互，不改变游戏状态。

验收：

- 低动效偏好下动画真正关闭。
- 资源失败时仍能开局、读档、提交行动和考试。

### S73.9 素材预览与 QA

实现功能：

- 新增素材预览页或脚本，列出 manifest 项目、尺寸、路径、透明度、用途和审核状态。
- 新增 Node 测试校验 manifest 路径只指向 `public/assets/`，字段不含 key/path/raw/prompt 原文泄漏，图片存在且尺寸符合预期。
- 抽检移动裁切、缩略图和 fallback。

验收：

- 未审核或 rejected 素材不能被 UI 默认引用。
- 测试能发现路径缺失、尺寸错配、敏感字段和 manifest 引用错误。

### S73.10 立绘长期分期

长期目标：300-400 张立绘，不作为 S73-S77 首轮完成条件。

分期：

- 第 0 期：24-40 张风格基准，只验证审美、安全、manifest、裁切和 UI 适配。
- 第 1 期：80-120 张核心身份与常见 NPC，覆盖玩家男女、书生、老师、同年、考官、官员、吏员、商贾、士绅、女官、将领、宫廷人物。
- 第 2 期：180-250 张重要历史/拟史人物和职业扩展，补姿态、年龄层、身份等级、地域差异。
- 第 3 期：300-400 张完整池，按剧情重要性、复用频次和缺口逐批生成。

约束：

- 不首屏加载全部立绘。
- 每批都有 manifest、缩略图、审核状态、替换计划。
- 女性立绘每批单独抽检成年感、端庄度、服饰合理性、身份辨识度和非露骨边界。

## 9. S74 React/Vite 迁移与信息架构

目标：先建立可回滚的新前端岛和安全 API 层，再逐步接管界面。S74 不直接替换 `/`。

### S74.0 依赖治理与迁移契约

需要资料：

- 本文档第 4 节依赖路线。
- 官方 React/Vite/Zustand/Vitest/Testing Library/Lucide 文档。
- 现有 `package.json`、server 静态资源逻辑和 browser smoke。

实现功能：

- 按治理模板记录 React、React DOM、TypeScript、Vite、Zustand、Lucide、Vitest、Testing Library、jsdom。
- 新增 `docs/FRONTEND_REACT_MIGRATION_CONTRACT.md`。
- 安装依赖并更新 lockfile。
- 新增 npm scripts 草案：
  - `dev:client`
  - `build:client`
  - `typecheck:client`
  - `test:client`
  - `preview:client`
- 明确 React 前端构建输出到 `public/ink-client/`，旧 `/` 不受影响。

验收：

- `npm install` 通过。
- `npm audit --omit=dev` 结果记录。
- `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check` 通过。
- `npm start` 仍能启动旧前端。

### S74.1 Vite/TypeScript 并行前端岛

实现功能：

- 新增：
  - `client/index.html`
  - `client/src/main.tsx`
  - `client/src/App.tsx`
  - `client/src/api/`
  - `client/src/types/`
  - `client/src/state/`
  - `client/src/styles/`
  - `vite.config.mjs`
  - `tsconfig.client.json`
  - `vitest.config.mjs`
- Express 暂不改默认入口；通过 `/ink-client/` 访问构建产物。

验收：

- `npm run typecheck:client`
- `npm run test:client`
- `npm run build:client`
- 旧 `npm run smoke:browser` 仍通过。

### S74.2 安全 API client

实现功能：

- `gameApi.ts` 只允许调用：
  - `POST /api/game/start`
  - `GET /api/game/saves`
  - `GET /api/game/player-state/:sessionId`
  - `POST /api/game/turn`
  - `POST /api/exam/question`
  - `POST /api/exam/progress`
  - `POST /api/exam/submit`
  - `GET/POST /api/ai/settings/:sessionId`
- 普通读档不用 `GET /api/game/state/:sessionId`。
- 建立 response 类型：存档 metadata、redacted player state、AI settings view、AI audit view、考试 view、mapRuntimeView。

验收：

- client 源码测试禁止读取 raw audit/provider/prompt/key/path。
- map bridge 不自行 `fetch('/api/game/turn')`，只通过行动草稿和玩家确认提交。

### S74.3 前端状态层

实现功能：

- 用 Zustand 管理：
  - `sessionId`
  - 当前安全 player payload
  - 当前页面状态：home/game/exam/ranking
  - 设置抽屉状态
  - 当前 modal/surface
  - action draft
  - display preferences
- 不保存 raw worldState、raw provider payload 或 hidden ledger。

验收：

- store 单元测试覆盖开局、读档、返回首页、打开/关闭设置、action draft 清空。
- 刷新恢复只通过安全存档/player-state。

### S74.4 Shell 与 surface registry

实现功能：

- 建立 `AppShell`、`HomeScreen`、`GameScreen`、`SettingsDrawer`、`SurfaceHost`。
- 建立 surface registry：exam、ranking、map-expanded、npc-profile、edict-draft、memorial-review。
- 所有全屏 surface 能 Esc 关闭并回收焦点。

验收：

- 组件测试覆盖抽屉、全屏 modal、焦点回收和键盘行为。

### S74.5 资产加载层

实现功能：

- `assetRegistry.ts` 读取 `ink-ui-manifest.json`。
- 支持按 usage/role/scene 获取素材、缩略图和 fallback。
- 未审核素材默认不可用。
- 支持 lazy loading 与 preload hints。

验收：

- manifest 引用错误会测试失败。
- 组件渲染缺图时显示纸底 fallback。

### S74.6 旧前端兼容桥

实现功能：

- 旧 `public/app.js` 不立即删除。
- 新前端读取同一 API，不依赖旧全局变量。
- 地图桥只通过 `window.QianqiuMapRenderer` / `window.QianqiuMapPanel` 或等价包装挂载到 React 容器。

验收：

- `/` 旧版、`/ink-client/` 新版都能启动 Mock 开局。
- 无双重提交、无重复读档、无隐藏字段进入 DOM。

### S74.7 回滚策略

实现功能：

- 文档写明如何关闭 `/ink-client/`、如何回退 package/lock/scripts。
- S77 前不删旧首页。

验收：

- 任意 S74/S75 失败时，用户仍可用旧 `/` 玩完整书生路径。

### S74.8 S74 验收

命令：

- `npm run typecheck:client`
- `npm run test:client`
- `npm run build:client`
- `npm run smoke:browser`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `git diff --check`

关键风险：

- 构建流程破坏开箱可玩。
- 新前端误读 raw state route。
- 新 store 保存过多服务器状态。
- 地图桥绕过玩家确认提交。

## 10. S75 首页与全局 Shell

目标：完成用户第一眼可见的水墨画卷首页与统一设置入口。S75 新前端仍先在 `/ink-client/` 上验收。

### S75.1 首页画卷布局

实现功能：

- 标题“千秋”位于顶部主视觉，不放在卡片内。
- 下方水墨云雾动画，支持 reduced-motion 静态图。
- 背景为 S73 首页画卷，表单在画卷中央。
- 移动端首屏仍能看到标题、主要表单和一点下方内容提示。

验收：

- 桌面和移动截图无文字重叠。
- 背景加载失败时仍显示纸色首页。

### S75.2 开局表单

实现功能：

- 朝代下拉。
- 自定义年份输入。
- 身份选择：皇帝/大臣/将领/县令/书生/入仕官员。
- 姓名输入。
- 家境：书生时显示“贫寒/普通/世家”，其他身份隐藏或替换为身份背景说明。
- 自定义背景文本保留，但不作为 hidden 私档。

验收：

- 表单提交使用现有 `POST /api/game/start`。
- 未知身份仍由服务器拒绝。
- 书生家境只影响可见开局文本或安全字段，不绕过科举规则。

### S75.3 朱印开始按钮

实现功能：

- 按钮如玉玺/印章，红底白字或墨色描边。
- 点击时有短朱印落章反馈。
- loading、disabled、error 状态有明确视觉。

验收：

- Enter 不误触多次提交。
- reduced-motion 下无落章动画。

### S75.4 右上角印匣入口

实现功能：

- 使用 lucide 图标配合水墨样式，不手画复杂 SVG。
- 打开设置抽屉。
- 抽屉包含 AI 设置、存档、显示、关于/安全摘要 tab。

验收：

- Esc 关闭。
- 焦点不丢失。
- 不显示 API key、base URL、本地路径、raw prompt。

### S75.5 存档/读档案卷

实现功能：

- 首页和设置抽屉都能看到案卷式存档列表。
- 显示 sessionId 短码、玩家名、身份、朝代年月旬、回合数、摘要、最近更新时间。
- 点击读档只走 `player-state`。

验收：

- 读档后进入 GameScreen。
- 存档 metadata 缺字段时显示 fallback。
- 无 raw `worldState` 泄漏。

### S75.6 返回首页与继续本局

实现功能：

- 游戏中通过印匣“返回首页”回到 HomeScreen。
- 首页显示“继续本局”。
- 返回首页不删除 session、不保存空行动、不改服务器状态。

验收：

- browser smoke 覆盖开局 -> 返回首页 -> 继续本局 -> 行动。

### S75.7 显示偏好

实现功能：

- 动效开关。
- 字体大小。
- 高对比度。
- 自动滚动叙事。
- 地图动效开关。
- 设置保存在 localStorage，不进入服务器 canonical state。

验收：

- localStorage 不保存 key、prompt、raw state。
- 低动效真实关闭云雾、墨晕、朱印、地图新增动效。

### S75.8 底部奏折输入雏形

实现功能：

- 固定底部多行输入，伪作展开竹简或空白奏折。
- 右侧“呈上”朱印按钮。
- Enter 提交，Shift+Enter 换行。
- placeholder 按身份：
  - 皇帝：“宣旨、朱批、召见群臣...”
  - 书生：“研读、作文、拜师、赴考...”
  - 将领：“遣将、巡营、上战报...”
  - 地方官：“审案、赈济、修堤、安民...”
  - 大臣/官员：“上疏、会商、查阅案牍...”

验收：

- 移动端底部输入不遮挡主要按钮。
- 提交失败保留草稿。
- 不允许空提交。

### S75.9 S75 验收

命令：

- `npm run test:client`
- `npm run build:client`
- `npm run smoke:browser -- --client react` 或新增等价 smoke。
- `npm run check:docs-governance`
- `git diff --check`

## 11. S76 身份、场景与专题界面

目标：把主游戏从“所有面板堆在侧栏”升级为身份和场景驱动的清爽多页体验。

### S76.1 主游戏壳

实现功能：

- `GameScreen` 分成顶栏、叙事卷、场景插画带、功能页签、底部奏折。
- 叙事卷优先阅读，其他信息折叠或分页。
- 当前身份/场景决定背景和 panel registry。

验收：

- 普通 Mock 行动可提交并刷新安全 payload。
- SSE 或普通 turn 文本用文本节点显示。

### S76.2 书生面板

实现功能：

- 书斋背景。
- 读书簿、老师点评、师友、科期、文章练习、赶考入口。
- 科举档案不常驻挤压主叙事，可进入专题页。

验收：

- 书生完整路径不退化。
- `studyProfileView`、`examCalendarView`、考试历史安全快照正常显示。

### S76.3 地方官面板

实现功能：

- 县衙/公堂背景。
- 案牍、钱粮、水利、盗匪、词讼、士绅关系入口。
- 行动草稿如“开仓赈济”“审理词讼”“修堤防汛”只填入奏折，不直接执行 resolver。

验收：

- 只读 `localAffairsDocketView`、公开财政/城市 projection。
- 不读取 hidden evidence refs。

### S76.4 入仕官员/大臣面板

实现功能：

- 部院/内阁背景。
- 官职履历、同年座师、派系、考成、弹劾、奏疏。
- 大臣强调朝议、公文和上疏；入仕官员强调观政、铨选、任所和考成。

验收：

- 只读 `officialCareerView`、`appointmentTrackView`、`relationshipView`、`aiControlAuditView`。

### S76.5 将领面板

实现功能：

- 军帐/边塞背景。
- 粮饷、斥候、边患、军心、战报、军令草案。
- 地图页可展示军务相关路线或 frontier refs。

验收：

- 不让前端直接结算战役、调兵或外交。
- 军令仍走普通自然语言行动或未来服务器 resolver。

### S76.6 皇帝面板

实现功能：

- 御案背景。
- 奏折队列、朱批、圣旨草稿、朝议、任免候选、赏罚预留。
- “拟旨”是草稿编辑界面，不是直接改状态。
- 可预留 `edictDraft` 数据结构，但服务器未支持前不落 canonical 字段。

验收：

- 皇帝行动仍走 `POST /api/game/turn`。
- 不把圣旨草稿伪装成已经发生的任免/赏罚事实。

### S76.7 科举考试全屏

实现功能：

- 贡院号舍淡墨插画背景。
- 中央试卷区域：考题大字、写作区、细线界栏、字数/草稿状态。
- 顶部考试阶段与局部时间。
- 侧边虚拟考生/考场记录，由后端安全 view 提供。
- “交卷”火漆/朱印按钮。

验收：

- 交卷走现有考试 API。
- 写作区支持长文、移动端滚动、草稿保留。
- 不显示弥封身份映射、考官 hidden intent 或 raw provider proposal。

### S76.8 放榜全屏

实现功能：

- 皇榜黄纸底。
- 状元、榜眼、探花用朱砂名次章。
- 其他进士/举人名单列表。
- 玩家名字高亮。
- 点击玩家名展开考官评语、评分维度、防作弊检测结果、授官提示。
- 背景为百姓围观/敲锣打鼓的淡墨插画，真实名单文字由 DOM 渲染。

验收：

- 榜单名次来自服务器 canonical ranking / `examHonorView`。
- 防作弊和考官评语来自安全 view。
- 不读取 raw review 或 provider 未采纳原文。

### S76.9 地图舆图页升级

实现功能：

- 将 S72 地图作为“舆图”页纳入 React shell。
- 支持缩放查看、场景背景联动、tooltip、局势簿跳转、行动草稿。
- 地图素材失败时回退到纸色静态底。

验收：

- 继续只读 `mapRuntimeView`。
- 地图按钮只回填行动草稿，不自动提交。
- canvas 非空、reduced-motion、资源失败 smoke 继续覆盖。

### S76.10 NPC 与玩家立绘接线

实现功能：

- `Portrait` 组件只接收 `portraitRef`、身份 fallback、情绪 token。
- NPC 列表/人物谱牒显示公开姓名、身份、关系、最近互动、可见记忆摘要。
- 重要 NPC 可出现专属立绘；普通 NPC 使用类型化立绘池。
- 玩家可在开局或身份变化时选择可用立绘。

验收：

- 未审核立绘不显示。
- 不读取 hidden NPC 私档、hidden motive、资产真数或未公开关系。
- 不一次性加载 300-400 张立绘。

### S76.11 专题 surface 扩展位

预留但不一定首轮做深：

- `MemorialReviewSurface`：奏折队列。
- `EdictDraftSurface`：圣旨草稿。
- `CourtDebateSurface`：朝议。
- `TrialSurface`：堂审。
- `WarCouncilSurface`：军议。
- `NpcProfileSurface`：人物公开档案。

验收：

- 每个 surface 都有安全数据来源说明。
- 没有后端安全 projection 的 surface 只能显示草稿/占位，不伪造事实。

### S76.12 S76 验收

命令：

- `npm run test:client`
- `npm run build:client`
- `npm run smoke:browser -- --client react --screenshots artifacts/s76-frontend-ink`
- `npm run smoke:exam-s69`
- `npm run smoke:dual-mode -- --storage-only`
- hidden/raw/key/path/prompt 污染扫描。

## 12. S77 验收、切入口与归档

目标：把大重构收口为稳定可玩版本。

### S77.1 默认入口切换

实现功能：

- 将 `/` 切到新 React 构建产物。
- 旧版保留为 `/legacy.html` 或等价路径。
- 新增 `scripts/ensureClientBuild.js` 或等价机制，保证 `npm install && npm start` 不因缺 client build 直接坏掉。

验收：

- 新 clone 后按 README 启动可玩。
- 旧版可回退至少一个发布周期。

### S77.2 浏览器 smoke 扩展

覆盖：

- 首页。
- 设置抽屉。
- 存档/读档。
- 返回首页/继续本局。
- 开局。
- 主游戏普通回合。
- 地图。
- 科举考试。
- 放榜。
- 皇帝/将领/地方官/大臣代表身份行动。
- 资源失败 fallback。
- reduced-motion。
- 移动端。

### S77.3 视觉与像素检查

验收：

- 首页背景非空。
- 地图 canvas 非空。
- 考试/放榜背景加载。
- 桌面和移动没有明显文本重叠。
- 大图失败不阻断文字主流程。
- 立绘没有现代物件、水印、乱码、露骨或幼态问题。

### S77.4 安全与污染防线

验收：

- DOM、localStorage、测试截图、manifest 中不出现 key、本地路径、raw prompt、raw provider payload、hidden/raw 词样。
- 读档只走 redacted player API。
- AI 设置不暴露 secret。
- 地图只读 `mapRuntimeView`。
- 考试不暴露弥封映射和考官 hidden intent。

### S77.5 性能与资源预算

验收：

- 首页只预加载必要素材。
- 场景和立绘按需加载。
- manifest 支持缩略图。
- 移动端无明显卡顿。
- 300-400 张长期立绘池不进入首屏 bundle。

### S77.6 可访问性

验收：

- Enter 提交、Shift+Enter 换行。
- Esc 关闭抽屉/模态。
- 焦点回收。
- 字体大小和对比度偏好生效。
- reduced-motion 生效。
- 按钮文字不溢出。

### S77.7 文档与归档

实现功能：

- 更新 README、brief、共享上下文、活动台账。
- 新增 `docs/FRONTEND_INK_REDESIGN_ARCHIVE.md`。
- 活动台账压缩为归档入口，后续再开 NPC 批量立绘、皇帝玩法、场景 resolver 或地图深度玩法。

### S77.8 总验证命令

建议命令：

- `npm test`
- `npm run typecheck:client`
- `npm run test:client`
- `npm run build:client`
- `npm run smoke:browser -- --screenshots artifacts/s77-frontend-ink`
- `npm run smoke:exam-s69`
- `npm run smoke:dual-mode -- --storage-only`
- `npm run check:docs-governance`
- `git diff --check`

## 13. 子代理调度建议

用户已授权 Codex 使用子代理。本专项建议这样拆：

- S73 素材 prompt 创意：可用 medium 子代理发散，但只产草案；Codex 最终定稿、生成、视觉审核和入库。
- S73 manifest/test：一个 worker 负责 manifest/test，另一个 worker 负责文档台账；写入范围要分开。
- S74.0 依赖治理：一个 explorer 只读核对依赖官方文档和 license；主代理安装和提交。
- S74.1-S74.4 React 基础：一个 worker 负责 `client/src/api` 和 `types`，另一个 worker 负责 shell/components，避免同文件冲突。
- S75 首页：一个 worker 做 HomeScreen 和表单，另一个 worker 做 SettingsDrawer/SaveList。
- S76 身份面板：按 role 分配 worker，或一个 worker 只做 Exam/Ranking surface，一个 worker 只做 Map bridge/Portrait。
- S77 验收：至少一个只读子代理复审最终 diff 和验证证据，再由主代理提交。

所有实施子代理提示必须包含：不得运行 `git add`、`git commit`、`git push` 或创建 PR；不得 revert 他人改动；最终报告列出改动文件和验证命令。

## 14. Prompt 草案

创意发散可交给 medium 子代理，以下为 Codex 收口后的安全草案。实际生成前仍需根据尺寸、用途、留白位置和负面约束定稿。

### 水墨背景

一幅适合中国古代历史模拟文字游戏的淡墨背景，泛黄宣纸质感，松烟墨晕染，远处有若隐若现的山脉、江河与城郭轮廓，大面积留白，低对比，不含任何文字、标志、水印、现代建筑或现代 UI。画面气质沉静、典雅，像案头展开的旧史书插页，适合叠加中文界面文字。

### 首页山水画卷

中国古典水墨长卷风格的首页主视觉，画卷在书案上展开，远山、江水、云雾、古城与驿道以淡墨绘成，画面中央上方留出放置“千秋”二字的空白，前景有极淡纸纹与卷轴边缘，整体温润泛黄，庄重但不压迫。不要出现真实文字、人物特写、现代物品、水印或花哨装饰，风格清爽，留白充足。

### 考试号舍

明清科举贡院号舍场景，窄小号舍、木板、考篮、砚台、卷纸、孤灯，雨后微湿的青砖与深夜寒意，水墨手绘插画风，宣纸底色，墨色克制，局部暖光。气氛紧张、清冷、专注，适合作为全屏考试界面背景。不要出现可读文字、现代灯具、现代桌椅、夸张戏剧表情或血腥内容。

### 皇榜放榜

古代皇榜放榜场景，城门或贡院外张贴榜文，士子与百姓聚集远观，朱砂榜纸醒目但榜上不可有可读文字，远处旗幡与飞檐以淡墨勾勒，画面有晨雾和金色微光。整体像中国手绘历史画卷，热闹但不拥挤，主体清晰，适合作为放榜全屏界面。无现代服饰、无现代建筑、无水印。

### 身份背景：书生

中国古代寒门书生的身份背景图，简朴书斋，木案、旧书、砚台、窗外竹影与远山，宣纸泛黄底，水墨手绘风，清寒而有志气。画面留出右侧或中部大块空白用于 UI 面板，不出现可读文字，不要华丽宫廷感，不要现代物品。

### 身份背景：地方官

中国古代地方官署背景，县衙厅堂、案牍、公文匣、屏风、庭院树影，以淡墨和少量朱砂表现制度感。画面端正、克制、可长期阅读，不拥挤，留出信息面板空间。不要出现可读文字、现代徽章或夸张刑具。

### 身份背景：皇帝

古代帝王视角的御案与殿阁背景，远处金殿轮廓，近处御案、奏折、玉玺、烛光，以水墨与低饱和金色表现威仪。庄重、深远、不过度奢华，留白充足，适合文字游戏主界面。不要出现真实文字、现代元素、夸张龙纹堆叠或强烈金光。

### 成年女性 NPC 立绘风格

中国古代历史模拟游戏成年女性 NPC 半身立绘，水墨手绘，淡彩上色，服饰严整端庄，身份可辨，可为女官、才女、商贾、宫廷人物或将领。人物高颜值，五官协调，神情克制，姿态优雅，通过衣料层次、腰封、剪裁和站姿体现成熟女性的优雅身形比例，整体气质自持、聪慧、有身份感。背景透明或极淡宣纸底，适合中小尺寸 UI 显示。不要幼态化，不要未成年人，不要露骨或挑逗姿势，不要现代妆造、现代饰品、可读文字、水印或徽标。

### NPC 通用立绘风格

中国古代历史模拟游戏 NPC 半身立绘风格基准，水墨手绘，淡彩上色，人物为成年，站姿端正，服饰符合古代士人、官员、将领、女官或市井人物气质，面部有克制表情与身份差异，背景透明或极淡宣纸底。线条干净，适合在 UI 面板中小尺寸显示。不要幼态化、不要露骨性化、不要夸张动漫眼、不要现代饰品、不要可读文字、水印或徽标。

## 15. 风险与收束原则

- 最大风险不是“不够古风”，而是“太古风导致难读”。所有装饰必须服务阅读与长期游玩。
- 新依赖能解决复杂 UI，但也会增加构建和回滚成本；S74 必须保留旧前端直到 S77。
- 大量素材会影响加载性能，S76 前必须引入懒加载、缩略图和 fallback，不一次性加载大批立绘。
- 现有 `public/app.js` 体量过大，若不在 S74 建立新前端岛，S75-S76 会变成难以审查的大 patch。
- 立绘长期规模很大，需要以人物 `portraitRef`、manifest、台账和审核状态驱动，而不是把图片路径硬编码在渲染函数里。
- 皇帝、地方官、将领等专属操作先做前端草稿和入口预留；真实玩法后果必须走后续服务器 resolver，不让前端或模型直接改状态。
