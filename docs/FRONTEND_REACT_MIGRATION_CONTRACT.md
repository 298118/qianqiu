# 前端 React 迁移契约

本文档是 S74 的迁移契约。S74.0 批准并记录 React/Vite 前端工具链的引入方式；S74.1 已创建 `client/`、Vite 配置、TypeScript 配置、React Router Data Mode 路由和 Express history fallback，让 `dist/client/` 构建产物接管默认 `/`；S74.2 已补安全 API client；S74.3 已补 UI 状态层；S74.4 已补 shell 与 surface registry；S74.5 已补 manifest 驱动资产加载层和 `Portrait` 组件。后续 S74.6-S74.7 继续补 S72 地图桥和默认入口验收。

## 1. S74.0 决策

- 已安装精确版本依赖：`react@19.2.6`、`react-dom@19.2.6`、`react-router@7.15.1`、`zustand@5.0.13`、`lucide-react@1.16.0`。
- 已安装精确版本开发依赖：`typescript@6.0.3`、`vite@8.0.13`、`@vitejs/plugin-react@6.0.2`、`vitest@4.1.6`、`@testing-library/react@16.3.2`、`@testing-library/user-event@14.6.1`、`jsdom@29.1.1`、`@types/react@19.2.14`、`@types/react-dom@19.2.3`、`@types/node@25.8.0`。
- 当前本机验证 Node.js `v24.13.1`、npm `11.8.0`。S74 前端工具链要求 Node.js `20.19+`、`22.13+` 或 `24.0+`；不再以 Node.js 18 作为开发基线。
- S74.0 不新增 `client/`，不改 `server.js` 静态入口，不替换 `public/index.html` / `public/app.js` / `public/styles.css`，不运行素材 `--write` 脚本，不刷新 S73 manifest、立绘或 QA 报告。
- S74.1 已让新 React/Vite 前端直接接管默认 `/`。产品内不保留 `/ink-client/` 双入口或 `/legacy.html` 作为交付要求；回退方式是 Git revert 或恢复上一提交。

## 1.1 S74.1 更新

- 已新增 `client/index.html`、`client/src/main.tsx`、`client/src/App.tsx`、`client/src/router.tsx`、`client/src/pages/`、`client/src/routes/`、`client/src/api/`、`client/src/state/`、`client/src/types/` 和 `client/src/styles/`。
- 已新增 `vite.config.mjs`、`tsconfig.client.json` 和 `vitest.config.mjs`；Vite `root` 为 `client`，`publicDir=false`，生产输出为 `dist/client/`，bundle 资源目录为 `/client-assets/`，避免覆盖或抢占 `public/assets/`。
- `server.js` 已改为 API 优先，随后服务 `dist/client` 与 `public` 静态资源，最后只对 HTML 导航请求返回 `dist/client/index.html`。带扩展名的缺失资源、`/api/*` 请求和非 GET/HEAD 请求不会 fallback 成 HTML。
- `package.json` 已新增 `dev:client`、`build:client`、`typecheck:client`、`test:client`、`preview:client`、`smoke:browser:legacy`；`smoke:browser` 现在运行 S74.1 focused React smoke。`prestart` 会先运行 `build:client`，以保持 `npm install && npm start` 后默认 `/` 可打开新前端。
- S74.1 只建立最小多页前端与静态入口，不接入真实开局、读档、普通行动、考试提交、AI 设置或地图桥；这些仍归 S74.2-S76 小步。

## 1.2 S74.2-S74.5 更新

- S74.2 已新增 `client/src/api/qianqiuClient.ts`、`client/src/api/types.ts`、`client/src/state/gameSessionState.ts` 和 `client/src/routes/sessionId.ts`。React client 只调用 start/saves/player-state/turn/exam/AI settings/connection-test 安全接口；普通读档不调用 raw state route。
- S74.3 已将 `client/src/state/uiState.ts` 扩展为 Zustand UI store，保存当前 route page、`sessionId`、安全玩家摘要、drawer/modal/surface、tab、action draft 和 display preferences。
- `gameSessionState` 会在开局、读档、普通回合和交卷成功后同步安全玩家摘要；普通回合成功会清空 action draft。
- UI store 的安全摘要只抽取玩家公开摘要、叙事预览和 route view 存在标记，不保存完整 `worldState`、模型原文、内部审计原文、hidden ledger、完整 prompt、本地路径或 key。
- S74.4 已新增 `AppShell`、`SurfaceHost`、overlay focus helper 和局部 `surfaceRegistry`。抽屉、modal 和专题 surface 通过 registry 渲染，Esc 关闭后焦点回到触发按钮；路由切换执行滚动归零和页面主体焦点恢复。
- S74.4 的 `npc-profile`、`edict-draft`、`memorial-review`、`map-filter` 仍是安全占位与草稿入口；没有后端安全 projection 时不伪造人物、奏折、圣旨或舆图事实，也不导入 S73 全量立绘资产。
- S74.5 已新增 `client/src/assets/assetRegistry.ts`、`useAssetRegistry.ts` 和 `client/src/components/Portrait.tsx`。React runtime 通过 `/assets/ui/ink-ui-manifest.json` 读取 active manifest，按 `runtimeUsableReviewStatuses`、安全路径、fallback、缩略图、低清占位和 `allowEagerLoad=false` 建立 registry；组件只接收 `portraitRef`，不硬编码图片路径，不读取 planned 矩阵或本地 artifacts。
- S74.5 人物页只做安全谱牒预览：按 `usage="people_page"` 分页接入全部人物页可用立绘，每页渲染 8 张缩略图；女性高清重制覆盖优先列前，未重制女性立绘继续使用 manifest 原图。registry 不把 manifest 或图片路径写入 Zustand、URL、localStorage 或 sessionStorage。

## 2. 依赖用途与边界

| 包 | 类型 | 版本 | 许可证 | 用途 | 边界 |
| --- | --- | --- | --- | --- | --- |
| `react` / `react-dom` | runtime | `19.2.6` | MIT | 组件化首页、全局 shell、考试/放榜全屏、身份专题和抽屉 | 只渲染服务器安全 projection；不使用 `dangerouslySetInnerHTML` 渲染 provider 文本 |
| `react-router` | runtime | `7.15.1` | MIT | 多页 SPA Data Mode 路由 | 不采用 Framework Mode，不接管 Express 后端，不把 hidden/raw/provider/prompt/path 写入 URL |
| `zustand` | runtime | `5.0.13` | MIT | 前端 UI/store 状态 | 只保存 `sessionId`、当前安全 payload、显示偏好、drawer/modal/tab/action draft；不得保存 raw session、raw audit、完整 prompt、provider payload、key 或 hidden ledger |
| `lucide-react` | runtime | `1.16.0` | ISC | 设置、存档、发送、返回、关闭等图标 | 仅按需 import 图标，视觉样式由本地 CSS 水墨/朱印语言控制 |
| `typescript` | dev | `6.0.3` | Apache-2.0 | `client/` 类型检查 | 不把后端 CJS 改成 ESM，不在根 `package.json` 增加 `"type": "module"` |
| `vite` / `@vitejs/plugin-react` | dev | `8.0.13` / `6.0.2` | MIT | React dev/build、React Fast Refresh、生产 bundle | dev server 仅本地开发；构建产物不覆盖 `public/assets/`、`public/vendor/` 或 S72 地图脚本 |
| `vitest` | dev | `4.1.6` | MIT | `client/` store、纯函数和组件测试 | 后端测试继续使用 Node.js `node --test` |
| `@testing-library/react` / `@testing-library/user-event` / `jsdom` | dev | `16.3.2` / `14.6.1` / `29.1.1` | MIT | React 交互、键盘、焦点、表单和抽屉测试 | 只作为本地/CI dev 依赖，不新增玩家运行时网络、账户、密钥或遥测 |
| `@types/react` / `@types/react-dom` / `@types/node` | dev | `19.2.14` / `19.2.3` / `25.8.0` | MIT | TypeScript 类型声明 | 仅辅助 `client/` 与配置文件类型检查 |

这些包不改变 AI provider 策略，不新增真实 provider key 要求，不改变 JSON/SQLite 存储语义，不把核心游戏规则、科举晋级、状态边界、任免、反作弊或持久化裁决交给前端。

`@types/node@25.8.0` 高于最低运行基线；S74.1 编写 TypeScript 配置和 Node-side Vite/Vitest helper 时不得使用 Node 25-only API，仍按 Node.js `20.19+`、`22.13+` 或 `24.0+` 可运行能力设计。

## 3. React Router 模式

S74 使用 React Router Data Mode：

- `createBrowserRouter` 和 `RouterProvider` 组成路由入口。
- 默认 basename 为 `/`。
- route loader 只调用安全 API：`POST /api/game/start`、`GET /api/game/saves`、`GET /api/game/player-state/:sessionId`、`POST /api/game/turn`、考试 API、AI settings API、玩家安全搜索 API，以及后续明确新增的安全 projection API。
- pending UI、error boundary、滚动恢复和焦点恢复在 React 内处理。
- Express 仍是 API 与静态资源服务器；React Router Framework Mode、SSR、server loader 和 React Router Vite framework 插件不进入当前规划。
- URL 只允许保存 `sessionId`、路由页名和公开页面状态。禁止把 hidden refs、raw query、provider payload、完整 prompt、本地路径、密钥、未公开 NPC 私档、未公开任免、行动裁决结果或 raw audit 写进 URL。

推荐路由仍为：

- `/`
- `/game/:sessionId`
- `/game/:sessionId/map`
- `/game/:sessionId/people`
- `/game/:sessionId/archive`
- `/game/:sessionId/exam`
- `/game/:sessionId/ranking`
- `/game/:sessionId/court`
- `/game/:sessionId/settings`

## 4. 构建与静态资源契约

- S74.1 新增 `client/`、`vite.config.mjs`、`tsconfig.client.json` 和 `vitest.config.mjs`。
- Vite 构建产物进入 `dist/client/`，由 Express 优先服务 React 构建产物并对前端路由提供 history fallback。
- Vite bundle 资源使用 `/client-assets/`，避免和 S72/S73 运行时素材路径 `/assets/...` 冲突。
- `public/assets/` 继续保存 S72/S73 已审核素材；`public/vendor/`、`public/mapRenderer.js` 和 `public/mapPanel.js` 继续作为 S72 地图运行时资源来源，直到 S76.9 以安全桥接方式包装。
- Vite `publicDir` 不得指向现有 `public/` 并在 build 时清空该目录；任何 build 清理只能作用于 React 构建输出目录。
- 默认 `npm start` 必须保持可运行。S74.1-S74.7 每步若引入构建前置条件，必须提供清楚的本地启动路径或自动构建/降级策略。

## 5. npm 脚本

S74.1 已把脚本写入 `package.json`：

| 脚本 | 命令 | 语义 |
| --- | --- | --- |
| `dev:client` | `vite --config vite.config.mjs` | 本地 React dev server |
| `build:client` | `vite build --config vite.config.mjs` | 生产构建 |
| `typecheck:client` | `tsc --project tsconfig.client.json --noEmit` | `client/` 类型检查 |
| `test:client` | `vitest --config vitest.config.mjs run` | React 单元/交互测试 |
| `preview:client` | `vite preview --config vite.config.mjs` | 本地预览构建产物 |
| `smoke:browser` | `npm run build:client && node scripts/clientSmoke.js` | S74.1 React 默认入口、history fallback、移动端和 hidden/raw 防线 smoke |
| `smoke:browser:legacy` | `node scripts/browserSmoke.js` | 旧原生前端浏览器 smoke 保留为迁移参考 |

## 6. 安全与素材边界

- React 前端只能组合 route view、redacted player state、AI 设置 view、地图 runtime view、考试安全快照和后续新增的安全 projection。
- 普通读档使用 `GET /api/game/player-state/:sessionId`，不得为了方便改回 raw `GET /api/game/state/:sessionId`。
- S73.10 立绘只能通过 manifest 中已审核的 `portraitRef`、缩略图、低清占位和 fallback 懒加载使用。不得硬编码图片路径、显示未审核素材或一次性加载全量立绘池。
- S72 地图继续只读 `mapRuntimeView`；地图按钮只能生成或回填行动草稿，玩家仍需提交普通回合，服务器仍拥有移动、案件、军务、财政、外交和任免裁决。
- 前端本地存储不得写入 key、base URL、完整 prompt、provider 原始输出、raw audit、hidden notes、hidden intent、未公开关系或未公开任所。

## 7. 验证与回滚

S74.0 验证：

- `npm install`
- `npm audit --omit=dev`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`
- `npm start` 本地启动检查
- `git diff --check`

S74.1 及后续新增 client 文件后追加：

- `npm run typecheck:client`
- `npm run test:client`
- `npm run build:client`
- `npm run smoke:browser`

S74.1 已验证：

- `npm run typecheck:client`
- `npm run test:client`
- `node --test test/reactClientScaffold.test.js`
- `npm run build:client`
- `npm run smoke:browser -- --screenshots artifacts/s74-frontend-smoke`
- Browser 插件手动打开 `http://127.0.0.1:3200/` 与 `/game/s74-browser/map`，确认 React entry、history fallback、无横向溢出和无 hidden token 泄漏。

回滚策略：

- Git revert S74.0 提交，恢复 `package.json`、`package-lock.json` 和本契约/文档变更。
- 重新执行 `npm install` 让 lockfile 和 `node_modules` 回到上一提交解析。
- 若 S74.1+ 已创建 `client/` 或 Express fallback，按对应提交一并 revert。
- 回滚不需要迁移存档，不影响 JSON session、SQLite session、AI provider 配置或 S73 素材。

## 8. 官方资料

- React 创建应用与 TypeScript 说明：[Creating a React App](https://react.dev/learn/start-a-new-react-project)、[Using TypeScript](https://react.dev/learn/typescript)。
- Vite React/TypeScript 与 Node 要求：[Getting Started | Vite](https://vite.dev/guide/)。
- React Router 模式和 Data Router API：[Picking a Mode](https://reactrouter.com/start/modes)、[createBrowserRouter](https://reactrouter.com/api/data-routers/createBrowserRouter)、[RouterProvider](https://reactrouter.com/api/data-routers/RouterProvider)。
- Zustand hook store：[Introduction - Zustand](https://zustand.docs.pmnd.rs/getting-started/introduction)。
- Vitest TypeScript/测试说明：[Writing Tests | Vitest](https://vitest.dev/guide/learn/writing-tests)。
- Testing Library user-event：[Introduction](https://testing-library.com/docs/user-event/intro)。
- Lucide tree-shakable 图标说明：[Lucide](https://lucide.dev/)。
