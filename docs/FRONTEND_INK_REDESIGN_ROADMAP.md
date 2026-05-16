# S73-S77 前端水墨重构路线图

本文档是《千秋》前端大重构的活动任务书。2026-05-14 用户进一步要求把原规划细化到可执行开发粒度，并允许为了更好的前端开发引入外部依赖和框架。因此本版不再把“无构建前端”视为 S74-S77 的固定技术上限，而是改为：

- S73 先完成素材体系、视觉规范、manifest、台账、审核流程和全量玩家/NPC 立绘池，不引入运行时框架。
- S74.0 已走依赖治理并安装 React + TypeScript + Vite + React Router 工具链，新增 [FRONTEND_REACT_MIGRATION_CONTRACT.md](FRONTEND_REACT_MIGRATION_CONTRACT.md)；真正创建 `client/`、配置构建和让新前端接管默认 `/` 从 S74.1 开始。
- 新前端按多页 SPA 路由设计，不再把首页、主叙事、地图、人物、史册、考试、放榜和设置全部塞进一个单页壳。
- S75 让新前端接管首页、全局 shell 和基础路由。
- S76 接管主叙事页、身份面板、考试/放榜专题和独立舆图页。
- S77 做总体验收、性能/安全/可访问性收口和归档，并保证 `npm install && npm start` 仍可本地可玩。

目标不是只给旧界面换皮，而是把《千秋》升级为中国古典水墨、手绘、泛黄宣纸与奏折质感的沉浸式史书/案头体验，同时继续保护 Mock 默认可玩、服务器裁决、存档安全、地图安全 view、AI proposal-only 和完整书生科举路径。

## 1. 本版补强结论

上一版规划方向正确，但粒度偏粗。本版新增以下内容：

- 把 S73-S77 拆成 `S73.0a` 到 `S77.8` 的可交付小步骤，每步写清实现功能、依赖、资料、验收和建议分工。
- 将“素材生成必须全面”落成素材矩阵：UI 材质、首页、场景、身份背景、考试/放榜、NPC/玩家立绘、动效、fallback、缩略图和 manifest。
- 把 300-400 张玩家/NPC 立绘目标正式纳入 S73.10 完成，不再作为 S77 之后的长期分期；后续 S74-S77 必须通过 manifest `portraitRef` 使用已审核立绘。
- 明确女性立绘边界：全部为成年角色，端庄、服饰严整、高颜值、身份感强，可用剪裁、腰封、衣料层次和站姿表现优雅成熟女性身形比例；不得露骨、挑逗、幼态化或把身体部位当作卖点。
- S74.0 已通过治理安装 React/TypeScript/Vite/React Router；后续依赖升级、替换或新增 UI/数据层库仍必须单独走依赖治理。
- 当前旧前端本质是单页游戏壳，已经不适合承载地图、科举、NPC、史册、存档和多身份专属玩法；新前端采用多页 SPA 路由，主页面只放当下最重要的信息。
- 按用户最新确认，重构不需要继续保持旧前端可用；S74 起新 React/Vite 前端直接接管默认 `/`，旧原生前端文件可在实施步骤中替换或删除，回退依赖 Git，不在产品内保留 `/legacy.html` 或双入口。
- 明确 `@pixi/react` 暂缓，S72 已落地的 `public/mapRenderer.js` / `public/mapPanel.js` 继续作为 imperative PixiJS island。

## 2. 设计目标

关键词：案头、卷轴、留白、淡墨、朱印、纸纹、微动、身份化。

整体方向：

- 首页是展开的画卷：顶部“千秋”，下方水墨云雾轻动，表单如题名册或户籍册，开始按钮如玉玺落印。
- 主界面是活的史书与案头工具：叙事正文优先阅读，地图、身份面板、人物、局势簿和专属功能按独立页面、局部页签、抽屉、专题界面分层。
- 输入区固定底部：多行输入框伪作展开竹简或空白奏折，右侧“呈上”朱印按钮，支持 Enter 提交、Shift+Enter 换行，并在上方淡显最近一次 AI 行动提示。
- 设置统一右上角：AI 设置、存档/读档、返回首页、显示偏好、可访问性和本地安全摘要都进入“印匣/设置”入口，避免散落在页面各处。
- 专属场景全屏化：科举考试、放榜、殿试、朝议、县衙审案、军营、城市、书斋、御案等重要场景有独立界面与插画。
- 身份面板差异化：书生、地方官、入仕官员、大臣、将领、皇帝拥有不同背景、色彩权重、交互入口、核心指标和未来玩法预留；皇帝预留奏折、圣旨、任免、朝议等扩展位。
- 地图升级复用 S72 PixiJS：不推倒 `mapRuntimeView` 和 `public/mapRenderer.js`，而是把地图重构为独立“舆图”页面，主叙事页只保留小型地图入口或局势提示。

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
- 地图叙事化：舆图页独立承载大画布、图层、地点、路线、事件、局势联动、任所、军务、商路、赶考路线和当前行动草稿，避免挤压主叙事。
- 可访问性：低动效、字体大小、对比度、键盘焦点和移动端底部输入都从 S75 开始作为正式功能，不留到最后补丁。

## 4. 技术依赖路线

### 4.1 当前状态

当前项目：

- 后端：Node.js + Express，plain JavaScript。
- 前端：默认运行入口已由 S74.1 React/Vite 构建产物接管；源码在 `client/`，构建输出在 `dist/client/`。旧 `public/index.html`、`public/app.js`、`public/styles.css` 暂留作迁移参考；`public/assets/`、`public/vendor/` 和 S72 地图脚本继续作为静态资源路径。
- 地图：S72 已使用本地 `pixi.js@7.4.3` UMD vendor 和 `public/mapRenderer.js` / `public/mapPanel.js`。
- 本机已确认 Node.js `v24.13.1`、npm `11.8.0`，满足当前 Vite 官方 Node 要求。

### 4.2 S74.0 已引入的依赖

S74.0 已单独修改 `package.json` / lockfile，并按 [DEPENDENCY_PLUGIN_GOVERNANCE.md](DEPENDENCY_PLUGIN_GOVERNANCE.md) 与 [FRONTEND_REACT_MIGRATION_CONTRACT.md](FRONTEND_REACT_MIGRATION_CONTRACT.md) 记录用途、许可证、维护状态、安全影响、Mock/no-key 影响、验证和回滚。所有版本使用精确版本，不使用 `latest`。

| 依赖 | 建议 | 用途 | 说明 |
| --- | --- | --- | --- |
| `react@19.2.6` / `react-dom@19.2.6` | 已引入 | 首页、shell、抽屉、考试全屏、身份面板、底部奏折 | 复杂 UI 状态和组件复用明显多于旧原生脚本能舒适承担的范围。 |
| `typescript@6.0.3` | 已引入 dev | 只用于 `client/` 类型 | 不把后端 CJS 转 ESM，不在根级加 `"type": "module"`。 |
| `vite@8.0.13` / `@vitejs/plugin-react@6.0.2` | 已引入 dev | React 默认前端 dev/build | 构建输出接管默认浏览器入口；保留 `public/assets/`、S72 地图运行时和后端静态资源约束。 |
| `react-router@7.15.1` | 已引入 | 多页 SPA 路由、页面过场、深链接、loader、pending/error/focus/scroll 边界 | 采用 Data Mode，不启用 React Router Framework Mode；Express 仍是后端 API 与静态资源服务器。 |
| `zustand@5.0.13` | 已引入 | 前端视图缓存与 UI 状态 | 仅保存 `sessionId`、当前安全 payload、tab/drawer/modal 状态；不能当 canonical state。 |
| `lucide-react@1.16.0` | 已引入 | 设置、存档、发送、返回、关闭等图标 | 图标再用 CSS 做朱印/淡墨样式，避免手画一堆不可维护 SVG。 |
| `vitest@4.1.6` | 已引入 dev | client 纯函数、store、组件测试 | 后端继续保留 `node --test`。 |
| `@testing-library/react@16.3.2`、`@testing-library/user-event@14.6.1`、`jsdom@29.1.1` | 已引入 dev | React 交互测试 | 覆盖设置抽屉、存档列表、行动 dock、考试写作区、键盘行为。 |
| `@types/react@19.2.14`、`@types/react-dom@19.2.3`、`@types/node@25.8.0` | 已引入 dev | TypeScript 类型声明 | 只辅助 `client/` 和配置文件类型检查。 |

### 4.3 明确暂缓的依赖

| 依赖 | 结论 | 原因 |
| --- | --- | --- |
| `@tanstack/react-query` | 暂缓 | 回合提交、SSE、考试流程是强顺序事务；缓存层容易制造 stale payload。等存档/设置/列表查询明显复杂后再评估。 |
| `@pixi/react` | 暂缓 | 当前 S72 固定 PixiJS v7 UMD；最新 React wrapper 面向 PixiJS v8，直接引入会冲撞既有地图运行时。 |
| Tailwind / UI component kit | 暂缓 | 水墨 UI 需要强定制材料语言，现成组件库容易把界面带回现代仪表盘气质。 |
| Next/Nuxt/SSR 框架 | 不建议 | 本项目是本地 Express 文本游戏，复杂度和部署假设不匹配。 |

### 4.4 官方资料参考

2026-05-14 已核对以下官方资料，用于技术路线判断：

- React 官方文档建议新 React 应用使用框架，也允许从 build tool 如 Vite 起步：[Creating a React App](https://react.dev/learn/start-a-new-react-project)。
- Vite 官方文档列出 `react-ts` 模板、dev/build 脚本和 Node 要求：[Getting Started | Vite](https://vite.dev/guide/)。
- React Router 官方文档说明其有 Declarative、Data、Framework 三种模式；本项目采用 Data Mode，以 `createBrowserRouter` / `RouterProvider` 提供 route loader、pending UI 和 error boundary，同时避免把 Express 游戏后端改造成 React Router framework server：[Picking a Mode | React Router](https://reactrouter.com/start/modes)。
- Zustand 官方说明其轻量 hook store API：[Introduction - Zustand](https://zustand.docs.pmnd.rs/getting-started/introduction)。
- Vitest 官方说明默认测试文件匹配和 TypeScript 支持：[Writing Tests | Vitest](https://main.vitest.dev/guide/learn/writing-tests)。
- Testing Library 官方资料建议用 user-event 测试用户交互：[user-event Introduction](https://testing-library.com/docs/user-event/intro)。
- Lucide 官方说明图标可定制且 tree-shakable：[Lucide](https://lucide.dev/)。
- PixiJS React 文档面向 PixiJS v8，故当前 S72 v7 地图先不切换：[Getting Started | PixiJS React](https://react.pixijs.io/getting-started)。

## 5. 稳定边界

技术边界：

- `npm install && npm start` 必须一直可运行，默认打开 `http://localhost:3000`。
- S73 不安装新运行时依赖，不改运行时代码，专注素材/契约/审核。
- S74.0 已完成依赖治理记录并安装 React/TypeScript/Vite/React Router 等依赖；S74.1 前不得改默认 `/` 入口或 Express fallback。
- S74 起新 React/Vite 前端直接接管默认 `/`；旧原生前端不再作为必须保留的交付入口。
- 新前端可以使用 URL 路由表达游戏页面，但路由参数只能保存 `sessionId` 或公开页面状态；不得把 hidden refs、raw query、prompt、provider payload 或本地路径写入 URL。
- S74-S76 每一步都必须保持 `npm install && npm start` 后默认 `/` 可玩；若重构失败，回退方式是 Git revert 或恢复上一提交，不在运行时保留 `/legacy.html` 双入口。
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
- 立绘规模 300-400 张改为 S73.10 的正式交付：S73 内完成生成、缩略图、压缩、视觉审核、安全审核、manifest 入库和台账登记；S74-S77 只能引用已审核 `portraitRef`，不得硬编码路径或把未审核素材当作可用资产。

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

### 多页路由

新前端不再追求所有内容都在一个单页壳内展开，而是使用 React Router 做多页 SPA。推荐路由：

- `/`：首页画卷、开局、案卷式存档、继续本局。
- `/game/:sessionId`：主叙事页，只放当前场景、身份摘要、最近 AI 回响、底部奏折和少量必要入口。
- `/game/:sessionId/map`：独立“舆图”页，承载大画布地图、图层筛选、地点/路线/事件、局势簿联动和行动草稿。
- `/game/:sessionId/people`：人物谱牒页，显示公开 NPC、关系、可见记忆和立绘。
- `/game/:sessionId/archive`：史册/局势簿页，容纳事件档案、天下格局、官职簿、搜索和分页。
- `/game/:sessionId/exam`：科举考试页，全屏号舍与试卷体验。
- `/game/:sessionId/ranking`：放榜页，皇榜、名次、评语、防作弊和授官提示。
- `/game/:sessionId/court`：皇帝/朝议/奏折/圣旨草稿页；非皇帝身份可隐藏或改为官署公文页。
- `/game/:sessionId/settings`：可选设置页；右上角印匣仍可作为全局抽屉快捷入口。

路由原则：

- 主叙事页不塞满所有系统；只显示当前回合最需要读和写的内容。
- 地图、人物、史册、考试、放榜、朝议都可以有独立页面与插画。
- 设置/存档在任何页面可打开，但不应遮挡主流程太久。
- 页面切换使用纸页轻翻、墨晕淡入、卷轴展开等短动效，必须尊重 reduced-motion。
- 每个路由重新加载时都只通过安全 API 恢复，不依赖内存中的 raw state。

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

### S73.0b 多页信息架构与舆图页决策

状态：本文档本版补强即 S73.0b 的交付。

交付：

- 明确当前旧前端是近似单页游戏壳，继续堆面板会让地图、科举、NPC、局势簿、设置和身份专属玩法互相挤压。
- 将 S74 之后的目标改为 React Router 多页 SPA：主叙事页保持轻量，地图、人物、史册、考试、放榜、朝议/官署等进入独立页面。
- 将 `react-router` 从暂缓项调整为 S74.0 候选依赖，并要求依赖治理记录其模式选择、URL 安全边界、刷新 fallback、动效和 Git 回退方式。
- 固定地图重构方向：独立“舆图”页承载大画布、图层筛选、地点/路线/事件详情和行动草稿，主叙事页只保留入口或摘要。

验收：

- 不安装依赖、不改运行时代码、不生成素材。
- `mapRuntimeView` 仍只供浏览器渲染，不进入 prompt 或服务器裁决。

### S73.1 视觉资产指南

状态：已完成，交付见 [FRONTEND_VISUAL_ASSET_GUIDE.md](FRONTEND_VISUAL_ASSET_GUIDE.md)。

需要资料：

- 宣纸、奏折、榜文、科举、官服、书斋、县衙、军帐、御案资料。
- S72 地图素材指南和台账，复用其审核经验。

实现功能：

- 新增 `docs/FRONTEND_VISUAL_ASSET_GUIDE.md`。
- 固定颜色、字体、纸纹、边框、动效、图片格式、尺寸、命名、压缩、移动裁切、缩略图和 fallback 规则。
- 写清“阅读优先，装饰服从文本”的硬规则。
- 写清女性与男性立绘都必须成年、端庄、高颜值、有身份差异；女性可展现优雅身形比例但不能露骨、挑逗或幼态。

验收：

- 指南能指导 S73.2-S73.10 独立生成、审核、入库和接入素材。
- 不出现 prompt 原文泄漏真实 key/path 的风险。

### S73.2 UI 素材 manifest schema 与台账

状态：已完成，manifest 草案见 `public/assets/ui/ink-ui-manifest.json`，台账见 [FRONTEND_ASSET_LEDGER.md](FRONTEND_ASSET_LEDGER.md)。

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

状态：已完成，首批素材见 `public/assets/ui/materials/`，缩略图见 `public/assets/ui/thumbs/`，manifest 见 `public/assets/ui/ink-ui-manifest.json`，台账见 [FRONTEND_ASSET_LEDGER.md](FRONTEND_ASSET_LEDGER.md)。

首轮数量：12-20 个。

实现功能：

- 已生成并入库 16 个首批 UI 材质：宣纸、旧绢、奏折纸面、竹简输入条、卷轴面板、残纸卡片、水渍叠加层、淡墨分隔线、角饰笔触、朱印按钮默认/按下态、印匣纹理、试卷界栏、皇榜纸底、朱砂墨迹和纸页边缘阴影。
- 已为每个素材生成缩略图，记录 `safeArea`、`focalPoint`、`mobileCrop`、性能预算、fallback、视觉审核和安全审核。
- 透明素材已用 chroma-key 去底、despill 和 WebP alpha 压缩；不透明材质统一压缩为 WebP。
- 所有纹理低对比，不承载正式 UI 文案；真实文字仍由 DOM 渲染。

验收：

- 每个素材有 manifest、缩略图、台账记录和 Codex 视觉审核。
- 支持 CSS `background-image` 或 React 组件引用。
- 缺失时可回退到纯 CSS 纸色。
- `test/frontendInkAssetsManifest.test.js` 已扩展为校验素材存在性、尺寸、alpha、性能预算、审核状态和安全字段。

### S73.4 首页资产包

状态：已完成，首页素材见 `public/assets/ui/home/`，缩略图见 `public/assets/ui/thumbs/`，manifest 见 `public/assets/ui/ink-ui-manifest.json`，台账见 [FRONTEND_ASSET_LEDGER.md](FRONTEND_ASSET_LEDGER.md)。

首轮数量：4-6 个。

实现功能：

- 已生成并入库 6 个首页资产：首页水墨山水画卷主背景、云雾透明层、题名册/户籍册表单底、无字朱印开始按钮、首页案卷存档素材和 reduced-motion 静态首页底。
- 已为每个素材生成缩略图，记录 `safeArea`、`focalPoint`、`mobileCrop`、`motion` / `reducedMotionFallback`、性能预算、fallback、视觉审核和安全审核。
- 透明素材已用 chroma-key 去底、despill、alpha 软化和 WebP alpha 压缩；云雾层经复审后改为基于 AI 雾层的柔化 alpha mask、低频雾团和边界渐隐，朱印首版空心感过强后已重生成厚实无字版本。
- 已新增透明素材 QA sidecar，记录纸色/深色合成复审背景、SHA-256 和色边/边界指标，避免透明素材变更绕过复审。
- 所有首页素材不承载正式 UI 文案；“千秋”、表单、开始按钮和存档 metadata 仍由 DOM 渲染。

验收：

- 第一屏可直接显示“千秋”视觉气质：首页画卷、云雾、册页表单、朱印和案卷素材已形成完整组合。
- 桌面、移动裁切都有留白，不遮挡标题、表单或存档列表。
- 已经 Codex 视觉审核：无可读文字、水印、现代物品、乱码、本地路径、key、raw/hidden 内容。
- `test/frontendInkAssetsManifest.test.js` 已扩展为校验 S73.4 真实图片存在性、尺寸、alpha、性能预算、审核状态、透明 QA sidecar 和安全字段。

### S73.5 场景插画包

状态：已完成。首批 10 张场景插画已入库 `public/assets/ui/scenes/`，覆盖书斋、贡院号舍、放榜、殿试、县衙、公堂、军帐、御案、城市街巷和部院公文；manifest 与台账已记录 safeArea、移动裁切、视觉审核和安全审核。

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

状态：已完成。首批 6 张身份背景已入库 `public/assets/ui/roles/`，覆盖书生、地方官、入仕官员、大臣、将领和皇帝；manifest 与台账已记录 `roleStyle.colorWeightsPercent`、面板材料建议、safeArea、移动裁切、视觉审核和安全审核。地方官首稿因疑似伪文字未入库，已重生成干净版本。

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
- 已审核素材不含可读文字、水印、现代 UI、本地路径、key、raw/hidden 内容或服务器尚未裁决的结果暗示。

### S73.7 玩家与 NPC 立绘风格基准

首轮数量：24-40 张风格基准，为 S73.10 的 300-400 张全量生产锁定审美、安全、裁切和 manifest 规则。

执行结果：S73.7 已完成 24 张基准立绘，统一为 1024x1536 WebP、384x576 缩略图和 64x96 低清占位，登记在 `public/assets/ui/portraits/`、`public/assets/ui/thumbs/`、`public/assets/ui/portraits/placeholders/`、`public/assets/ui/ink-ui-manifest.json`、`docs/FRONTEND_ASSET_LEDGER.md` 和 `public/assets/ui/portraits/portrait-baseline-qa-v1.json`。本步采用极淡宣纸底而非强制透明，先锁定小尺寸可读性、成人端庄安全边界、`portraitRef`、fallback 与懒加载规则；S73.10 可再按全量池需求补透明或状态变体。

实现功能：

- 玩家基准：成年男女书生、成年男女入仕官员、成年男女将领、成年男女皇帝/摄政视角、成年男女地方官/大臣。
- NPC 类型：老师、考官、同年、县令、吏员、大臣、将领、宫廷人物、商贾、士绅、女官。
- 重要 NPC 标准：张居正、魏忠贤等重要人物先在本步定 prompt 结构、身份辨识点、审核标准和负面约束，具体全量生产进入 S73.10。
- 每个基准立绘登记 `portraitRef`，后续 UI 只引用 ref，不硬编码图片路径。

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

执行结果：

- 已完成 8 个已审核动效/fallback 素材：水墨云雾缓入层、墨迹扩散圆晕、无字朱印落章、纸页展开横幅、榜文揭示纸幕、考试交卷朱封、淡墨分场擦拭和卷边揭页角标。
- 已保存到 `public/assets/ui/effects/`，缩略图保存到 `public/assets/ui/thumbs/`，QA sidecar 为 `public/assets/ui/effects/effect-motion-qa-v1.json`。
- `public/assets/ui/ink-ui-manifest.json` 已登记 `category: "effect"`、`scene`、`motion.type`、`motion.suggestedUse`、最长建议时长、`fallbackRef` 和 `reducedMotionFallback`；动效只作为 opacity/scale/clip-path/遮罩/静态关键帧建议，不改变游戏状态。

实现功能：

- 水墨云雾、墨迹扩散、朱印落章、纸页展开、榜文揭示、考试交卷火漆印。
- 每个动效都要有 `prefers-reduced-motion` 静态替代。
- 动效不阻塞交互，不改变游戏状态。

验收：

- 低动效偏好下动画真正关闭。
- 资源失败时仍能开局、读档、提交行动和考试。

### S73.9 素材预览与 QA

状态：已完成。新增 `scripts/frontendAssetQa.js`、`public/assets/ui/asset-qa-preview.html`、`public/assets/ui/asset-qa-report-v1.json` 和 `npm run qa:frontend-assets`，把 manifest、缩略图、fallback、透明素材合成和审核状态收束为可重复检查流程。

实现功能：

- 已新增素材预览页，列出 manifest 项目、尺寸、路径、透明度、用途和审核状态，并支持阶段/分类/搜索筛选。
- 已新增 Node QA 脚本和 `qa:frontend-assets` 命令，校验 manifest 路径只指向 `public/assets/ui/`，字段不含 key、本地路径、raw、provider、hidden 或 prompt 原文泄漏，图片存在且尺寸符合预期。
- 已用统一报告覆盖缩略图、fallback、审核状态、性能预算、立绘低清占位和 transparent alpha 标记；当前报告覆盖 618 个 active 素材。
- 透明素材已额外做宣纸底/深色底合成预览和 chroma-key 高饱和绿/紫色边检查，覆盖当前 19 个透明素材，避免去底残留、矩形切口或黑线进入首页和专题界面。

验收：

- 未审核或 rejected 素材不能被 UI 默认引用。
- 测试能发现路径缺失、尺寸错配、敏感字段和 manifest 引用错误。
- QA 能暴露透明素材的绿边、紫边、横线、矩形切口和深浅底合成瑕疵。
- `npm run qa:frontend-assets` 可在后续 S73.10/S74-S77 持续校验报告与 manifest 同步。

### S73.10 全量立绘生产与入库

目标：S73 内完成 300-400 张玩家/NPC 立绘的生成、审核、缩略图、压缩、manifest 入库和台账登记，使 S74-S77 的首页、人物谱牒、身份面板、考试/放榜、朝议/官署和后续专题界面都能直接使用同一套已审核 `portraitRef`。

当前状态：S73.10.1 已完成矩阵定稿。新增 `docs/FRONTEND_PORTRAIT_MATRIX.md`、`public/assets/ui/portraits/portrait-pool-matrix-v1.json`、`scripts/frontendPortraitMatrix.js` 和 `npm run qa:portrait-matrix`，把全量池锁定为 336 张 planned 立绘：玩家身份阶段 72、通用 NPC 120、重要 NPC 72、状态姿态 48、场景锚点 24。矩阵只预置安全 `portraitRef`、生成目标路径、prompt 母版、fallback、懒加载分组和审核字段；不把未生成素材写入 `ink-ui-manifest.json` 可用集合。S73.10.2 已完成玩家身份阶段 72 张立绘，并保留 60 张已审核女性玩家风格补充与 60 张已审核男性玩家风格补充，使玩家可选池男女各 96 张。S73.10.3 已完成 188 张通用 NPC 立绘，包括一开始的 120 张矩阵通用 NPC、20 张旧版 bonus 和 48 张宫装/唐装女性风格扩展；S73.10.4 已完成 72 张重要 NPC 专属立绘；S73.10.5 已完成 72 张状态/姿态与场景锚点立绘；S73.10.7 已完成 24 张年轻成年女性补充立绘，覆盖宫署/女官、书院/才女、商事/市井和边关/军务，Codex 视觉审核确认无中年女性、无发福老态、无中性化；S73.10.6 已完成缩略图与压缩总括 QA，新增 `scripts/frontendPortraitCompressionQa.js`、`public/assets/ui/portraits/portrait-compression-qa-v1.json` 和 `qa:portrait-compression`，当前统一校验 572 张 active 立绘、其中 548 张 S73.10 立绘的主图、缩略图、低清占位、safeArea、focalPoint、移动裁切、文件预算和禁止 eager load。manifest 与 S73.9 QA 报告当前为 618 个 active 素材。

内部小步骤：

- S73.10.1 立绘矩阵定稿：已完成。按玩家身份、性别、年龄层、身份阶段、NPC 职业、重要人物、姿态、情绪和场景用途列出 336 条完整矩阵；每条记录预置 `portraitRef`、usage、role、gender、ageBand、statusVariant、thumbnail、fallback 和审核字段，且 `runtimeUsable` 保持 false。
- S73.10.2 玩家立绘池：已完成。覆盖男女玩家在书生、童试、秀才、举人、贡士、进士、初任官、地方官、京官、大臣、将领、皇帝/摄政等阶段的 72 张可选半身立绘；另有 60 张已审核女性玩家风格补充与 60 张已审核男性玩家风格补充继续保留为额外可用池，玩家可选池男女各 96 张。同一玩家身份切换不能复用明显不合阶段的旧立绘。
- S73.10.3 通用 NPC 立绘池：已完成。覆盖一开始的 120 张矩阵通用 NPC，另把 20 张旧版源页作为 `bonus_generic_npc` 继续使用，并额外补入 48 张 `female_style_pack` 宫装/唐装女性风格扩展；女性扩展只使用 `palace-lady`、`tang-lady` 和 `palace`/`tang` 标签，作为通用已审核补充池按需懒加载。
- S73.10.4 重要 NPC 专属池：已完成张居正、魏忠贤等已规划重要人物或拟史关键人物的专属立绘隔离方案，不把重要 NPC 混进通用头像池；未进入当前剧情公开视野的人物只登记安全 `portraitRef`，不泄漏 hidden 私档。
- S73.10.5 状态与姿态变体：已完成重要玩家身份和高频 NPC 的状态/姿态变体与场景锚点；普通 NPC 仍至少有稳定常态 fallback。
- S73.10.6 缩略图与压缩：已完成并随 S73.10.7 刷新。`qa:portrait-compression` 固定半身主图 1024x1536、缩略图 384x576、低清占位 64x96，校验 572 张 active 立绘的 bytes、SHA-256、文件预算、safeArea、focalPoint、移动裁切和 `allowEagerLoad=false`。
- S73.10.7 视觉与安全审核/年轻女性补丁池：已完成。新增 `scripts/frontendYoungFemalePortraitAssets.js`、`qa:young-female-portraits` / `qa:young-female-portraits:write` 和 `public/assets/ui/portraits/portrait-young-female-pool-qa-v1.json`，单独入库 24 张年轻成年女性立绘；候选源页经 Codex 视觉审核，确认不含中年女性、发福老态、男性化或中性化候选，且完整衣着、无露骨/挑逗/幼态/现代物/文字/水印。
- S73.10.8 manifest 与台账验证：已由 S73.9 统一素材 QA、S73.10.6 立绘压缩 QA、`test/frontendInkAssetsManifest.test.js` 和素材台账覆盖，测试能发现缺图、尺寸错配、未审核素材引用、敏感字段、硬编码路径和全量首屏加载风险。

约束：

- S74-S77 的所有人物显示都必须通过 manifest `portraitRef`、缩略图和 fallback 读取，不允许硬编码图片路径，不允许绕过审核状态。
- “全量完成”不等于“全量首屏加载”：首页、主叙事、人物谱牒、考试和舆图只按当前页面、当前身份、当前公开 NPC 和用户操作懒加载必要立绘。
- 女性立绘必须成年、端庄、服饰严整、身份明确、高颜值，可通过衣料层次、腰封、剪裁和站姿体现优雅成熟女性身形比例；不得露骨、挑逗、幼态、过度暴露或把身体部位当作卖点。
- 立绘 prompt 草案可由子代理做创意发散，但定稿、生成、视觉审核、入库和可用状态只能由 Codex 收口。

## 9. S74 React/Vite 迁移与信息架构

目标：建立新 React/Vite 默认前端和安全 API 层，直接替换旧单页壳。S74 起不再维护旧 `/` 与新 `/ink-client/` 双入口，旧原生前端文件可在实施中被替换或删除。

### S74.0 依赖治理与迁移契约

状态：已完成。S74.0 只完成依赖安装、lockfile、治理记录和迁移契约；默认 `/` 仍由旧前端提供，直到 S74.1 创建 `client/` 与 Express fallback。

需要资料：

- 本文档第 4 节依赖路线。
- 官方 React/Vite/Zustand/Vitest/Testing Library/Lucide 文档。
- 现有 `package.json`、server 静态资源逻辑和 browser smoke。

实现功能：

- 按治理模板记录 React、React DOM、TypeScript、Vite、`@vitejs/plugin-react`、React Router、Zustand、Lucide、Vitest、Testing Library、jsdom 和类型声明包。
- 新增 [FRONTEND_REACT_MIGRATION_CONTRACT.md](FRONTEND_REACT_MIGRATION_CONTRACT.md)。
- 在迁移契约里固定 React Router 模式：采用 Data Mode，使用 `createBrowserRouter` / `RouterProvider`、默认 basename `/`、route loader、pending UI、error boundary 和滚动/焦点恢复；不采用 Framework Mode，不让 React Router 接管 Express 后端。
- 安装依赖并更新 lockfile。
- 在迁移契约中预留 npm scripts 草案，实际写入 `package.json` 留给 S74.1 创建配置文件时完成，避免 S74.0 产生无配置的失败命令：
  - `dev:client`
  - `build:client`
  - `typecheck:client`
  - `test:client`
  - `preview:client`
- 明确 React 前端构建从 S74.1 起接管默认浏览器入口，实施时可以替换或删除旧 `public/index.html`、`public/app.js` 和 `public/styles.css`；`public/assets/`、S72 地图运行时和 vendor 资源按需保留。

验收：

- `npm install` 通过。
- `npm audit --omit=dev` 结果记录。
- `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check` 通过。
- `npm start` 仍可启动当前默认 `/` 并能 Mock 开局；新 React 默认入口验收从 S74.1-S74.7 执行。

### S74.1 Vite/TypeScript 默认前端

状态：已完成。S74.1 已创建 `client/`、Vite/TypeScript/Vitest 配置、最小 React Router Data Mode 多页壳、Express history fallback 和 focused React browser smoke；默认 `/` 由 `dist/client/` 构建产物接管，`public/assets/`、`public/vendor/`、`public/mapRenderer.js` 和 `public/mapPanel.js` 继续保留为素材与 S72 地图资源路径。

实现功能：

- 新增：
  - `client/index.html`
  - `client/src/main.tsx`
  - `client/src/App.tsx`
- `client/src/api/`
- `client/src/routes/`
- `client/src/pages/`
- `client/src/router.tsx`
  - `client/src/types/`
  - `client/src/state/`
  - `client/src/styles/`
  - `vite.config.mjs`
  - `tsconfig.client.json`
  - `vitest.config.mjs`
- Express 默认入口改为服务新 React 构建产物。React Router Data Mode 在 `/` base 下管理多页 SPA 路由，并要求 Express 为 `/game/:sessionId/*` 等前端路由提供 history fallback。
- `vite.config.mjs` 使用 `publicDir=false`、`outDir="../dist/client"` 和 `assetsDir="client-assets"`，避免 Vite 构建清空或抢占 S72/S73 的 `public/assets/`。
- `npm start` 通过 `prestart` 先构建 React client，再启动 Express；直接 `node server.js` 可服务已有构建产物。
- `npm run smoke:browser` 改为 S74.1 focused React smoke；旧原生前端 smoke 暂存为 `npm run smoke:browser:legacy` 供迁移参考。

验收：

- `npm run typecheck:client`
- `npm run test:client`
- `npm run build:client`
- `npm run smoke:browser` 更新为验证新默认前端。
- `node --test test/reactClientScaffold.test.js`

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

状态：已完成。S74.3 已把 `client/src/state/uiState.ts` 从静态入口标记扩展为 Zustand UI store，管理当前页面、会话号、安全玩家摘要、drawer/modal/surface、tab、action draft 和显示偏好；`gameSessionState` 在开局、读档、普通回合和交卷成功后同步安全摘要，主卷行动输入改由全局 action draft 驱动。顶部已提供轻量显示偏好抽屉与安全摘要 modal，作为 S74.4/S75 完整 shell 的状态基础。

实现功能：

- 用 Zustand 管理：
  - `sessionId`
  - 当前安全 player payload
  - 当前路由衍生的页面状态：home/game/map/people/archive/exam/ranking/court/settings
  - 设置抽屉状态
  - 当前 modal/surface
  - action draft
  - display preferences
- 不保存 raw worldState、raw provider payload 或 hidden ledger。

验收：

- store 单元测试覆盖开局、读档、返回首页、打开/关闭设置、action draft 清空。
- 刷新恢复只通过安全存档/player-state。

### S74.4 Shell 与 surface registry

状态：已完成。S74.4 已拆出 `AppShell`、`SurfaceHost`、overlay focus helper 和 `surfaceRegistry`；`SurfaceHost` 通过 drawer/modal/surface registry 管理显示偏好、设置、存档、安全摘要以及 `npc-profile`、`edict-draft`、`memorial-review`、`map-filter` 局部专题层。所有 overlay 支持 Esc 关闭、焦点回收和页面滚动锁定；路由切换会滚动归零并把焦点恢复到页面主体。专题层当前只显示安全占位与行动草稿入口，不读取 raw state、内部审计原文、模型原文、完整 prompt、本地路径或 key，不接入未审核素材或全量立绘池。

实现功能：

- 建立 `AppShell`、`HomeScreen`、`GameScreen`、`SettingsDrawer`、`SurfaceHost`。
- 建立 React Router Data Mode 路由表和页面组件：Home、Game、Map、People、Archive、Exam、Ranking、Court、Settings。
- 建立 surface registry：npc-profile、edict-draft、memorial-review、map-filter-drawer 等局部专题层。
- 所有全屏 surface 能 Esc 关闭并回收焦点。

验收：

- 组件测试覆盖路由导航、抽屉、全屏 modal、焦点回收、滚动恢复和键盘行为。

### S74.5 资产加载层

实现功能：

- `assetRegistry.ts` 读取 `ink-ui-manifest.json`。
- 支持按 usage/role/scene 获取素材、缩略图和 fallback。
- 未审核素材默认不可用。
- 支持 lazy loading 与 preload hints。

验收：

- manifest 引用错误会测试失败。
- 组件渲染缺图时显示纸底 fallback。

### S74.6 S72 地图运行时桥

实现功能：

- 旧 `public/app.js` 可删除或替换；新前端不依赖旧全局变量。
- 地图桥只通过 `window.QianqiuMapRenderer` / `window.QianqiuMapPanel` 或等价包装挂载到 React 容器。

验收：

- `/` 新版能启动 Mock 开局。
- `/game/:sessionId/map`、`/people`、`/archive` 等路由刷新后能通过安全 API 恢复。
- 无双重提交、无重复读档、无隐藏字段进入 DOM。

### S74.7 S74 默认入口验收

实现功能：

- 文档写明 Git revert 或恢复上一提交的回退方式，不保留产品内旧前端入口。
- 清理旧前端残留引用，确认 README、brief 和 smoke 都以新默认前端为准。

验收：

- S74 完成后默认 `/` 可用新前端玩 Mock 开局和完整书生路径关键入口。
- 仓库不要求 `/legacy.html`、`/ink-client/` 或旧单页壳继续可用。

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
- React Router 路由把 hidden refs、raw query 或 provider 内容写入 URL。
- 地图桥绕过玩家确认提交。

## 10. S75 首页与全局 Shell

目标：完成用户第一眼可见的水墨画卷首页与统一设置入口。S75 在默认 `/` 新前端上验收。

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

### S76.9 独立舆图页与地图重构

实现功能：

- 将 S72 地图从主界面小面板升级为 `/game/:sessionId/map` 独立“舆图”页。
- 主叙事页只保留小型入口、当前地点/路线摘要或小缩略图，不常驻完整地图。
- 舆图页使用更大的画布区域，适合桌面宽屏和移动横向/纵向查看。
- 左侧或底部提供图层筛选：地点、路线、事件、任所、科举路线、军务、商路、传闻。
- 右侧或底部提供所选地点/路线/事件详情、局势簿跳转、公开 evidence 摘要和行动草稿。
- 支持缩放查看、平移、重置视角、场景背景联动、tooltip、局势簿跳转、行动草稿。
- 优先复用 `public/mapRenderer.js` / `public/mapPanel.js` 作为 v1 bridge；后续可在 S77 后单开地图二期，重构为 route-aware renderer、图层配置和更完整地图素材包。
- 地图素材失败时回退到纸色静态底。

验收：

- 继续只读 `mapRuntimeView`。
- 地图按钮只回填行动草稿，不自动提交。
- URL 不保存坐标、hidden ref、raw query 或行动结果。
- canvas 非空、reduced-motion、资源失败 smoke 继续覆盖。

### S76.10 NPC 与玩家立绘接线

实现功能：

- `Portrait` 组件只接收 `portraitRef`、身份 fallback、情绪 token。
- NPC 列表/人物谱牒显示公开姓名、身份、关系、最近互动、可见记忆摘要。
- 重要 NPC 可出现专属立绘；普通 NPC 使用类型化立绘池。
- 玩家可在开局或身份变化时选择可用立绘。
- 所有人物立绘来源均为 S73.10 全量立绘池；新增剧情人物若暂未公开或未审核，只能显示身份 fallback。

验收：

- 未审核立绘不显示。
- 不读取 hidden NPC 私档、hidden motive、资产真数或未公开关系。
- 不一次性加载 S73.10 的 300-400 张全量立绘，只按当前页面和公开人物懒加载。

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

## 12. S77 总验收与归档

目标：把大重构收口为稳定可玩版本。

### S77.1 默认入口确认

实现功能：

- 确认 `/` 已由新 React 构建产物接管，不保留旧版 `/legacy.html` 或 `/ink-client/` 双入口要求。
- Express 为默认 React Router routes 提供静态 fallback，刷新 `/game/:sessionId/map`、`/game/:sessionId/people`、`/game/:sessionId/archive`、`/game/:sessionId/exam`、`/game/:sessionId/ranking` 等页面不 404。
- 清理 README、brief、smoke、文档和代码中对旧单页壳的必需依赖描述。
- 新增 `scripts/ensureClientBuild.js` 或等价机制，保证 `npm install && npm start` 不因缺 client build 直接坏掉。

验收：

- 新 clone 后按 README 启动可玩。
- 无 API Key 时 Mock 模式可用新前端完整走书生路径关键节点。

### S77.2 浏览器 smoke 扩展

覆盖：

- 首页。
- 设置抽屉。
- 存档/读档。
- 返回首页/继续本局。
- 开局。
- 主游戏普通回合。
- 地图。
- 多页路由刷新和前进/后退导航。
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
- S73.10 的 300-400 张全量立绘池不进入首屏 bundle，只通过缩略图、低清占位和按需请求进入页面。

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
- 活动台账压缩为归档入口；S73.10 全量立绘池作为已完成基础资产进入归档，后续再开皇帝玩法、场景 resolver、地图深度玩法或新增人物补丁。

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
- 新依赖能解决复杂 UI，但也会增加构建成本；S74 起不保留旧前端双入口，任何失败都通过 Git revert 或继续修复新前端收口。
- 大量素材会影响加载性能，S76 前必须引入懒加载、缩略图和 fallback；即使 S73.10 已完成全量立绘，也不能一次性加载大批立绘。
- 现有 `public/app.js` 体量过大，S74 应直接用新前端替换旧单页壳，并把迁移拆成小 patch，避免 S75-S76 变成难以审查的大改动。
- S73.10 全量立绘规模很大，需要以人物 `portraitRef`、manifest、台账和审核状态驱动，而不是把图片路径硬编码在渲染函数里。
- 皇帝、地方官、将领等专属操作先做前端草稿和入口预留；真实玩法后果必须走后续服务器 resolver，不让前端或模型直接改状态。
