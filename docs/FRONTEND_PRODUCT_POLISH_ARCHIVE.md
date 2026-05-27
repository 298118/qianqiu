# S89-S90 React 产品 polish 专题归档

本文件归档 2026-05 下旬完成的 S89-S90 React 产品级体验打磨。它不是新的活动路线图，也不替代 Git history；它只把已经完成的前端 polish 范围、稳定边界、验证锚点和追溯入口整理成一份可读专题，避免未来 Codex 会话把 S89 长流水复制回 `docs/DEVELOPMENT_STEPS.md`。

本归档覆盖：

- S89.1-S89.68：React 产品 polish、玩家可见术语清洗、route 空态/读法深化、材质动效、CSS 预算、CSS token/surface/keyframe 语义化和首页 token 收敛。
- S90.1/S90.2：CSS 物理拆文件第二阶段、启动样式预算恢复和跨首页、主卷、舆图、人物、科举、皇榜、设置、专题层的一轮产品级读法 polish。
- S90.4：囊箧、史册、朝议和 `SurfaceHost` 深层读卷 polish。

详细逐步记录仍以迁出前的 `docs/DEVELOPMENT_STEPS.md` Git history、`docs/ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md`、`docs/QIANQIU_DEVELOPMENT_BRIEF.md` 和对应提交 diff 为准。

## 稳定边界

- 本专题全部工作只打磨现有 React 前端体验、CSS、客户端测试、browser smoke 和协作文档。
- 不新增新系统、新玩法、新 route、新后端 API、新存档字段、新 SQLite schema、新 AI 权限、新 prompt 能力、新依赖或新素材。
- 浏览器仍只消费服务器安全 view、AI 设置 view、地图 runtime view、考试安全快照、已审核 runtime manifest、已审核 `portraitRef`、本地草稿、本地显示偏好和 route/surface UI 状态。
- 浏览器不得裁决资源、身份、交易、委派、NPC 行动、经济结果、考试晋级、官职任免、地图行动、关系终局、婚姻、弹劾、定罪、背叛或 hidden 信息。
- `topic_draft`、`draftContext`、舆图行动、实体压力、领域后果、经济解释、NPC follow-up 和关系 evidence 仍必须由服务器从当前安全 view 重建复核。
- 地图坐标、layout、viewport、visual-only effect、NPC map anchor、runtime manifest 元数据和浏览器点击位置不得成为 prompt evidence 或服务器裁决事实。
- 完整书生路径继续受保护：`scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`。

## 范围总览

| 范围 | 状态 | 摘要 | 追溯入口 |
| --- | --- | --- | --- |
| S89.1-S89.10 | DONE | 玩家可见术语、移动端覆盖层、轻量专题页壳、设置/错误空态、首页旧案状态、人物/立绘、舆图交互、史册密度与证据清洗。 | `docs/QIANQIU_DEVELOPMENT_BRIEF.md` 的 S89.1-S89.10 摘要、迁出前 `docs/DEVELOPMENT_STEPS.md` Git history |
| S89.11-S89.19 | DONE | 舆图全关图层、舆图筛选专题、印匣/设置、身份中文标签、来函/账解证据读法、全局控件、朝议目录、科举/皇榜仪式读法、route recovery。 | `docs/QIANQIU_DEVELOPMENT_BRIEF.md` S89.11-S89.19 摘要、Git history |
| S89.20-S89.36 | DONE | CSS 预算瘦身、重复规则折叠、JS 分包预算、overlay 玻璃纵深、人物/舆图/首页/科举/皇榜/主卷/朝议材质动效、跨页追索读法。 | `docs/ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md` S89 压缩归档、Git history |
| S89.37-S89.63 | DONE | CSS token 与可访问性重构、CSS 物理模块 import 图、语义纸面 motion/surface utilities、状态色 token 化、控件/壳 token 化、motion keyframe 语义化。 | `docs/QIANQIU_DEVELOPMENT_BRIEF.md` S89.37-S89.63 摘要、Git history |
| S89.64-S89.68 | DONE | 首页背景、开卷案桌、朱印、样卷入口、开卷路径、旧案状态、身份选项和立绘选择态 token 化/复用。 | `docs/ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md`、提交 `948f59a0` 与 `091b9e5c` |
| S90.1/S90.2 | DONE | route 样式迁到页面级 import，`global.css` 回归 token/base/shell/controls/overlay/motion 启动图；新增舆图读图、人物/立绘、科举/皇榜、印匣/设置、专题层和错误空态 polish。 | 提交 `5d96bb4f` |
| S90.4 | DONE | 囊箧“四读”账解索引、史册“由史册成题”、朝议“材料入席”和 `SurfaceHost` 材料/证据/草稿读法。 | 提交 `fd0c8be7` |

## 玩家可见读法成果

- 首页与旧案：旧案 loading/empty/error/ready 互斥显示，旧案读取失败只在案架内安全重试；异常案卷 id 不生成读档链接；样卷和开卷路径使用玩家可见口径。
- 主卷与六身份循环：本卷案桌、本旬行止笺、身份角色读法、快捷建议、草稿状态、错误空态和基础控件反馈更明确；主卷仍只提交普通回合行动草稿。
- 书生、科举、皇榜：读书计划、备考压力、入场/落墨/候批、放榜、同年座师、授官过渡和仪式材质已完成首轮 polish；考试规则、等级和晋级仍由服务器裁决。
- 舆图：图层摘要、地点/驿路/近事说明、全关图层空态、筛选专题、tooltip 和移动端 note 已统一为玩家读图语言；舆图行动仍只写本地草稿并由服务器重建复核。
- 人物与立绘：人物谱牒、人物详情、主动来函、礼法/交易/委派、交游议题、高清立绘查看器和画卷三读已完成产品化；人物关系终局和 hidden 后果仍由服务器裁决。
- 囊箧与经济：流转候批笺、账解证据读法、经济 trace 过滤和 S90.4 “囊箧四读”已完成；浏览器不结算资源扣减、成交、赠予、借用或关系回响。
- 史册与后果：史册密度、近次线索、证据侧栏、史册追索笺、跨页追索和 S90.4 “由史册成题”已完成；事件、领域后果、实体余波和来函证据只作公开读卷提示。
- 朝议与专题层：朝议目录、官署议程、跨页追索、材料入席、专题层 loading/error/empty/selected 与材料/证据/草稿读法已完成；专题层仍不新增后端 surface 类型或裁决能力。
- 印匣与设置：右上角印匣仍是唯一显眼设置入口，显示偏好只写本地白名单，AI 设置仍使用既有安全 API，Mock/no-key fallback 继续作为默认可玩路径。

## CSS 与视觉架构成果

- `global.css` 启动图已从约 200 KiB 级别压回约 80 KiB，保留 token、base、shell、controls、overlay、全局移动布局和低动效入口。
- 首页、主卷、舆图/史册、人物/囊箧、科举/皇榜等 route 样式改由对应 React 页面入口导入。
- 产品样式全集仍由 `test/reactClientScaffold.test.js` 递归读取 CSS import 图，保护历史 selector、semantic hook、预算和 route module placement。
- 语义 CSS utilities 已覆盖 `.paperMotionCard`、`.paperMotionInteractive`、`.paperMotionDraft`、`.paperMotionSelected`、`.paperMotionEmpty`、`.paperMotionPanel`、`.paperMotionSurface` 等重复纸面状态。
- token 化已覆盖共享纸面、状态色、基础控件、状态行、utility surface、全局壳 chrome、首页背景/案桌/朱印/样卷/旧案/身份/立绘选择态和 motion keyframe 阴影色。
- keyframe 名已从 S89 编号迁到语义名，browser smoke 继续验证低动效关闭和运行时 `animationName` 查询。

## 安全与测试守门

S89/S90 polish 增加并持续维护以下守门：

- 玩家可见工程词清洗：raw、provider、prompt、path、key、hidden、schema、manifest、draftContext、resolver、safe view 等不得进入玩家读法。
- 路由安全：畸形案卷不会写入 UI session 指针、不会请求受保护案卷 API、不会打开本地专题层或展示旧案卷安全投影。
- 本地草稿安全：快捷建议、舆图 tooltip、史册/人物/专题按钮和经济/囊箧读法只写本地行动草稿，不调用回合提交或 resolver。
- 素材安全：React runtime 只请求精简 runtime manifest；不得请求完整 source manifest，不显示未审核素材或本地 artifacts 路径。
- 移动端与低动效：browser smoke 覆盖移动端首页、主卷、舆图、人物、囊箧、史册、科举、皇榜、朝议、印匣和低动效路径，继续检查横向溢出和按钮/链接文本溢出。
- CSS 预算：`npm run budget:client` 与 source canary 同时守住 build 预算和源码聚合预算；后续新增 CSS 应优先复用 token/utilities 或继续拆分 route entry。

## 验证锚点

S89.68 最新完整验证锚点：

- focused scaffold
- 组合 CSS canary
- `node --check scripts/clientSmoke.js`
- `node --test test/reactClientScaffold.test.js`（99 tests）
- `npm run typecheck:client`
- 串行 Vitest（6 files / 134 tests）
- `npm run qa:runtime-manifest`
- `npm run build:client`
- `npm run budget:client`
- 直接 `node scripts/clientSmoke.js`
- `npm test`（1213 tests）

S90.1/S90.2 完整验证锚点：

- `npm run typecheck:client`
- `npm run typecheck:server`
- `npm run build:client`
- `npm run budget:client`
- `npm run qa:runtime-manifest`
- `node --check scripts/clientSmoke.js`
- `node --test test/reactClientScaffold.test.js`
- `npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1`
- `npm run check:docs-governance`
- `git diff --check`
- `npm test`
- `npm run smoke:browser -- --screenshots artifacts/s90-polish-smoke`

S90.4 完整验证锚点：

- `node --test test/reactClientScaffold.test.js`（101 tests）
- `npm run typecheck:client`
- `node --check scripts/clientSmoke.js`
- `npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1 client/src/__tests__/App.test.tsx`（74 tests）
- `npm run build:client`
- `npm run budget:client`
- `npm run check:docs-governance`
- `git diff --check`
- `npm test`（1215 tests）
- `npm run smoke:browser -- --screenshots artifacts/s90-4-polish-smoke`

S90.4 有一次与完整 `npm test` 并行运行的 browser smoke 在首页 `networkidle` 超时；单独重跑同命令通过，失败未命中 S90.4 断言。

## 后续维护建议

- 继续前端 polish 时，在 `docs/DEVELOPMENT_STEPS.md` 新开可审查小步骤；不要把 S89.1-S89.68 长流水复制回活动台账。
- CSS 后续工作优先继续预算瘦身、route entry 拆分、token/utilities 复用和 source canary 收敛。
- 如果继续体验打磨，应优先围绕具体页面/route/状态切片展开，例如首页旧案、主卷身份循环、人物交互、舆图触控、科举仪式、设置印匣或专题层焦点，而不是一次性大范围改写。
- 包含代码、测试、运行时行为或验证工具变化的提交前仍必须委派只读子代理复审最终 diff 与验证证据。

## 归档记录

2026-05-27：S90.3 将 S89/S90 已完成 React 产品 polish 整理为本专题归档。本轮只改文档索引和交接记录，不改运行时代码、前端行为、后端 API/schema、AI 权限、prompt、provider、SQLite schema、存档格式、runtime manifest、素材 manifest 或服务器裁决；按低风险纯文档规则跳过提交前子代理复审。
