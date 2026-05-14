# Gemini CLI Project Instructions

本文件是 Gemini CLI 在《千秋》仓库中的项目上下文。请先阅读本文件，再阅读 `AGENTS.md`、`docs/SHARED_CONTEXT.md`、`docs/QIANQIU_DEVELOPMENT_BRIEF.md`、`docs/DEVELOPMENT_STEPS.md` 和 `docs/PIXIJS_INK_MAP_ROADMAP.md`。

## 你的当前角色

- 当前专项是 S72 PixiJS 水墨地图。
- 你负责前端：PixiJS 地图渲染、图层系统、动效、交互、响应式布局和浏览器验证说明。
- Codex 负责后端、地图 runtime view/API/schema、AI/server 权限、素材生成、素材台账、最终审核和提交。
- 你可以产出 scoped frontend patch，但不能提交代码。

## 禁止事项

- 不要运行 `git add`、`git commit`、`git push`，不要创建 PR。
- 不要回滚他人改动。
- 不要修改 `.env`、`data/sessions/`、`data/audit/`、SQLite 数据库、`node_modules/`、`artifacts/` 或 `backup/`。
- 不要打印、读取或整理 API key、本地绝对路径、raw prompt、raw audit、hidden notes、hidden intent 或 hidden enemy truth。
- 不要改后端裁决逻辑、AI provider schema、地图 resolver、考试晋级、官职任免、存档格式或 SQLite 表结构，除非 Codex 明确把某个后端小任务交给你。
- 不要让前端直接写游戏状态；地图 action 必须走玩家确认后的普通行动或服务器 proposal/resolver。
- 不要从兼容 `worldState` raw ledger 推导隐藏地图信息；地图 UI 只读服务器安全 view。

## 前端允许范围

优先在这些文件内工作：

- `public/index.html`
- `public/app.js`
- `public/styles.css`
- `public/mapRenderer.js`（如需要新增）
- `public/mapPanel.js`（如需要新增）
- `public/vendor/` 或 `public/lib/`（仅在 S72.1 依赖治理批准后）
- `public/assets/maps/`（只使用 Codex 已登记素材）

新增 PixiJS 依赖前必须确认 S72.1 已完成。若使用 CDN，必须固定版本，并提供本地 fallback；优先本地 vendor 固定版本，保持无 build step。

## 必守技术边界

- 前端继续 plain HTML/CSS/JS，无构建步骤。
- UI 文案使用中文。
- 地图中文标签优先用 DOM/CSS 渲染，不烘进图片。
- PixiJS 负责 canvas 图层、marker、路线和动效；DOM 负责 tooltip、legend、按钮和可读中文。
- 支持 `prefers-reduced-motion`，动效可降级。
- 窄屏不能出现文本溢出、按钮遮挡或 canvas 空白。
- 资源失败时要有静态 fallback，不让主游戏不可用。

## 推荐接线点

- 在 `public/index.html` 的 `.game-panel` 内加入地图面板容器，但不要覆盖 narrative 和 action area。
- 在 `public/app.js` 中保存 `currentMapRuntimeView`，在 `renderPayloadWorldState(payload)` 接收 payload 后更新地图。
- 如果 payload 没有 `mapRuntimeView`，地图面板显示等待状态，不要从 raw state 拼 hidden 信息。
- 地图点击 ref 后可以联动现有局势簿或填充行动草稿到 `#action-input`；玩家点击“行动”后继续走现有 `POST /api/game/turn`。

## 交付报告格式

每次交付请用中文报告：

- 改动文件。
- 新增/修改的前端接口。
- 验证命令和浏览器验证结果。
- 桌面与窄屏表现。
- canvas 是否非空，资源失败 fallback 是否可用。
- tooltip/label 是否重叠。
- 已知风险和需要 Codex 提供的后端字段或素材。
- 明确声明：未运行 `git add`、`git commit`、`git push`，未创建 PR，未改后端裁决逻辑。

## 首个建议任务

在 Codex 完成 S72.1 前，请先做只读前端约束报告：

```text
阅读 GEMINI.md、docs/SHARED_CONTEXT.md、docs/PIXIJS_INK_MAP_ROADMAP.md、public/index.html、public/app.js、public/styles.css。
不要编辑文件，不要运行 git 命令。
请报告：地图面板适合插入的 DOM 位置、app.js 最小接线点、CSS 响应式约束、PixiJS vendor/CDN 对前端的影响、需要 Codex 后端提供的 mapRuntimeView 字段。
```

Codex 会基于你的报告固定后端契约和依赖治理，再安排正式前端 patch。
