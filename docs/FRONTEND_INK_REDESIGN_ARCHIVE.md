# 《千秋》S73-S77 前端水墨重构归档

归档日期：2026-05-19。

本文件归档 S73-S77 前端水墨重构专项完成范围，供后续前端玩法、素材补丁、地图二期和官署专题深化继续沿用。规划源头见 [FRONTEND_INK_REDESIGN_ROADMAP.md](FRONTEND_INK_REDESIGN_ROADMAP.md)，React 迁移契约见 [FRONTEND_REACT_MIGRATION_CONTRACT.md](FRONTEND_REACT_MIGRATION_CONTRACT.md)，视觉资产标准见 [FRONTEND_VISUAL_ASSET_GUIDE.md](FRONTEND_VISUAL_ASSET_GUIDE.md)，素材台账见 [FRONTEND_ASSET_LEDGER.md](FRONTEND_ASSET_LEDGER.md)。稳定开发治理仍以 [DEVELOPMENT_GOVERNANCE.md](DEVELOPMENT_GOVERNANCE.md) 为锚点。

## 1. 归档结论

S73-S77 已把《千秋》浏览器端从旧原生单页壳收束为 React + TypeScript + Vite + React Router Data Mode 的默认多页前端，并完成水墨宣纸视觉资产、首页画卷、右上角印匣、底部奏折、六类身份面板、科举考试全屏、皇榜放榜、独立舆图页、人物谱牒、专题 surface 扩展位、资源预算、安全污染防线和可访问性验收。

当前默认入口仍是 `npm install && npm start` 后打开 `http://localhost:3000`。`npm start` 会先确认 `dist/client/` 构建产物存在且未陈旧，必要时自动构建。旧 `public/index.html`、`public/app.js`、`public/styles.css` 和 `public/mapPanel.js` 仅作迁移参考，不再是交付入口；产品内不保留 `/legacy.html` 或 `/ink-client/` 双入口，失败回退依赖 Git。

稳定边界不变：

- 浏览器只组合 redacted player state、安全 route view、AI 设置 view、地图 `mapRuntimeView`、考试安全快照、精简运行时素材 manifest 和已审核 `portraitRef`。
- 普通读档继续优先走 `GET /api/game/player-state/:sessionId`，不读取 raw state、raw audit、provider proposal、完整 prompt、本地路径、key、hidden notes 或 hidden intent。
- S72 地图坐标和 `layoutPath` 只供浏览器布局使用，不进入 prompt、AI 工具、服务器 resolver、行动事实、URL 或本地存储。
- 所有人物显示只通过已审核 `portraitRef`、缩略图、低清占位和 fallback 懒加载；重要 NPC 专属池不被通用头像随机抽取；未公开人物只暴露安全 fallback。
- AI 快捷建议和专题拟稿都只生成行动草稿，不提交普通回合、不推进时间、不调用 resolver、不写 canonical state；真实后果继续由 `/api/game/turn` 与服务器裁决链处理。
- 显示偏好只写入本地白名单 `qianqiu.displayPreferences.v1`，不进入存档、服务器 canonical state、AI prompt、provider schema 或 SQLite。

## 2. 完成范围索引

| 范围 | 摘要 | 主要证据 |
| --- | --- | --- |
| S73.0-S73.2 | 前端水墨重构规划、React Router 多页 SPA 决策、视觉资产指南、UI manifest schema 与素材台账 | `docs/FRONTEND_INK_REDESIGN_ROADMAP.md`、`docs/FRONTEND_VISUAL_ASSET_GUIDE.md`、`docs/FRONTEND_ASSET_LEDGER.md`、`public/assets/ui/ink-ui-manifest.json` |
| S73.3-S73.8 | UI 材质、首页资产、场景插画、身份背景、立绘风格基准、动效/fallback 素材生成、视觉审核和 manifest 入库 | `public/assets/ui/`、`public/assets/ui/asset-qa-report-v1.json`、`test/frontendInkAssetsManifest.test.js` |
| S73.9-S73.10 | 素材 QA、全量立绘矩阵、玩家池、通用 NPC、重要 NPC、状态/场景锚点、年轻女性补充、女性单张高清重制与压缩总括 QA | `docs/FRONTEND_PORTRAIT_MATRIX.md`、`public/assets/ui/portraits/*-qa-v1.json`、`scripts/frontendPortrait*.js` |
| S74.0-S74.7 | React/Vite/TypeScript/React Router 依赖治理、默认入口、Express history fallback、安全 API client、Zustand 状态层、shell/surface registry、asset registry、React 舆图桥和默认入口 smoke | `client/`、`server.js`、`scripts/ensureClientBuild.js`、`scripts/clientSmoke.js`、`docs/FRONTEND_REACT_MIGRATION_CONTRACT.md` |
| S75.1-S75.10 | 首页画卷、开局表单、朱印反馈、右上角印匣、案卷式存档/读档、返回首页/继续本局、显示偏好、底部奏折、快捷行动建议和 S75 browser smoke | `client/src/components/`、`client/src/state/`、`src/game/quickActionSuggestions.js`、`src/ai/prompts/quickAction*` |
| S76.1-S76.12 | 主游戏壳、书生/地方官/官员/大臣/将领/皇帝面板、科举考试、皇榜放榜、独立舆图页、人物谱牒、专题 surface 扩展位和 S76 总验收 | `client/src/pages/`、`client/src/surfaces/`、`scripts/clientSmoke.js` |
| S77.1-S77.6 | 默认入口确认、浏览器 history 与资源失败 smoke、视觉像素检查、安全污染防线、资源预算、可访问性与字体系统 | `scripts/clientBuildBudget.js`、`scripts/frontendRuntimeManifest.js`、`public/assets/ui/ink-ui-runtime-manifest.json`、`client/src/styles.css` |
| S77.7-S77.8 | 本归档与总验证 | 本文件、`docs/DEVELOPMENT_STEPS.md`、`docs/SHARED_CONTEXT.md` |

S78 官署专题玩法化已经在 S76.11 的专题 surface 基础上完成，新增 `topicSurfaceView`、`GET /api/game/topic-surface/:sessionId/:surfaceId` 和只读 `POST /api/ai/topic-draft/:sessionId`。它是 S73-S77 前端壳的直接后续使用者，但真实玩法后果仍由普通回合和服务器 resolver 裁决。

## 3. 素材与运行时口径

当前素材口径：

- `public/assets/ui/ink-ui-manifest.json` 是完整素材生产与 QA 源头，当前登记 642 个 active 素材。
- `public/assets/ui/ink-ui-runtime-manifest.json` 是 React 运行时读取的精简投影，只保留浏览器需要的路径、usage、fallback、review status、portraitRef、懒加载和必要运行时字段。
- `public/assets/ui/asset-qa-report-v1.json` 校验 active 素材、透明素材、深浅底合成、chroma-key 色边、路径、尺寸、缩略图、fallback、审核状态和敏感字段。
- `public/assets/ui/portraits/portrait-compression-qa-v1.json` 校验 596 张 active 立绘，其中 572 张属于 S73.10 全量池或补充池，覆盖主图、缩略图、低清占位、safeArea、focalPoint、移动裁切、文件预算和禁止 eager load。
- 玩家池 192 张、通用 NPC 188 张、重要 NPC 专属 72 张、状态/姿态与场景锚点 72 张、年轻成年女性补充 48 张；另有 S73.7 的 24 张基准立绘和 60 张女性/偏女性单张高清重制覆盖。

运行时资源边界：

- 首页不得请求完整 `ink-ui-manifest.json`，不得加载 PixiJS/mapRenderer 地图运行时，不得一次性请求全量立绘池。
- 舆图页才按需加载 `/vendor/pixi.min.js` 和 `/mapRenderer.js`，资源失败时显示安全中文 fallback。
- 人物页每页最多渲染当前公开人物 8 张，当前可见人物优先使用已审核主图以保证清晰，但不得越过当前页范围拉取全量池。
- 字体通过本地 `@fontsource` 包自托管，不走 CDN；新增字体需继续经过依赖治理、资源预算和可访问性降级。

## 4. API 与安全投影

S73-S77 前端只把以下入口视作浏览器合法数据来源：

```text
POST /api/game/start
GET /api/game/saves
GET /api/game/player-state/:sessionId
POST /api/game/turn
GET /api/ai/settings/:sessionId
POST /api/ai/settings/:sessionId
POST /api/ai/connection-test
POST /api/ai/quick-actions/:sessionId
GET /api/game/topic-surface/:sessionId/:surfaceId
POST /api/ai/topic-draft/:sessionId
POST /api/exam/question
POST /api/exam/progress
POST /api/exam/submit
```

`GET /api/game/state/:sessionId` 仍是短期开发兼容快照，普通浏览器读档不用它。`GET /api/dev/session-diagnostics/:sessionId` 默认关闭且只供本机诊断，不属于普通玩家路径。

关键安全视图包括：`studyProfileView`、`examProcedureView`、`examinerPanelView`、`examHonorView`、`appointmentTrackView`、`officialCareerView`、`officialPostingsView`、`localAffairsDocketView`、`militaryDiplomacyView`、`economicFiscalView`、`eventArchiveView`、`historicalEventArchiveView`、`worldPeopleView`、`relationshipView`、`mapRuntimeView`、`actorMemoryView`、`sessionSummaryView`、`aiSettingsView`、`aiControlAuditView`、`topicSurfaceView` 和 redacted player state。浏览器不能从 raw SQLite table、raw audit、provider payload、完整 prompt、本地路径、key、hidden ledger 或未公开私档中补全事实。

## 5. 验收与回归入口

S77.8 总验证应至少覆盖：

```bash
npm test
npm run typecheck:client
npm run test:client
npm run build:client
npm run smoke:browser -- --screenshots artifacts/s77-frontend-ink
npm run smoke:exam-s69
npm run smoke:dual-mode -- --storage-only
npm run check:docs-governance
node --test test/documentationGovernance.test.js
git diff --check
```

2026-05-19 总验证已通过：

- `node --check scripts/clientSmoke.js`
- `node --check scripts/clientBuildBudget.js`
- `npm test`：933 项通过。
- `npm run typecheck:client`
- `npm run test:client`：66 项通过。
- `npm run build:client`
- `npm run smoke:browser -- --screenshots artifacts/s77-frontend-ink`：通过；运行时 manifest 为 642 assets、3 fallbacks、689022/2396314 bytes；构建预算为 JS 458.8 KiB、CSS 58.1 KiB、fonts 26288.4 KiB、client-assets 26805.4 KiB。Vite 继续提示 `/assets/ui/...` 运行时资源不在 build time 解析，这是既有预期，不是失败。
- `npm run smoke:exam-s69`：通过；完整科举链最终进入 `official`，官职为翰林院修撰。
- `npm run smoke:dual-mode -- --storage-only`：通过；JSON/SQLite 导入、地理修复、安全审计 projection、S70 AI-first parity、large fixture、prompt 策略、局势簿分页、SQLite 读修复、性能门槛和 hidden-token 防线均为 ok。
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `git diff --check`

建议前端或素材相关改动继续补跑：

```bash
node --check scripts/clientSmoke.js
node --check scripts/clientBuildBudget.js
node --test test/reactClientScaffold.test.js
node --test test/browserSmokeScript.test.js
node --test test/frontendInkAssetsManifest.test.js
npm run qa:frontend-assets
npm run qa:portrait-compression
```

说明：

- `npm run smoke:browser` 是 React 默认入口 smoke，无 `--url` 时显式固定 Mock；覆盖首页开局、印匣、存档/读档、返回首页/继续本局、普通回合、舆图、人物、史册、考试、放榜、朝议专题、移动端、history、资源失败 fallback、视觉像素、资源预算、reduced-motion、按钮文本溢出和污染扫描。
- `npm run smoke:exam-s69` 是完整 `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official` 晋级链守门。
- `npm run smoke:dual-mode -- --storage-only` 是 JSON/SQLite 本地增强、large fixture、prompt 检索、局势簿分页和 SQLite 读修复守门。
- Provider smoke 仍只在配置真实 key 时运行；无 key 环境应受控 skip。

## 6. 后续入口

- 若继续深化皇帝、朝议、堂审、军议、任免、案件或财政后果，应从新的 S79 或后续小步骤开题，继续沿用 `topicSurfaceView`、AI 草稿 proposal-only、服务器 resolver 裁决和 audit 记录。
- 若继续扩展地图，应从 S72/S76.9 的 `mapRuntimeView` 与 React `InkMapRuntimeBridge` 安全边界开题，不把显示坐标变成 prompt 或服务器事实。
- 若继续补人物资产，应沿用 S73.10 的 manifest、QA sidecar、缩略图、低清占位、视觉审核和运行时精简投影流程；未入 manifest/QA 的 artifacts 不得直接被前端引用。
- 若继续调整字体、动效或视觉预算，应同步依赖治理、build budget、browser resource timing、reduced-motion 和文本溢出验收。
- 若新增前端可见数据域、角色面板、NPC 私档摘要或 prompt 检索入口，必须先定义 AI read scope、actor intelligence、tool permissions、proposal boundaries、server adjudication、audit records 和 Mock/no-key fallback。
