# Gemini CLI Project Instructions

本文件是 Gemini CLI 在《千秋》仓库中的项目上下文。请先阅读本文件，再阅读 `AGENTS.md`、`docs/SHARED_CONTEXT.md`、`docs/QIANQIU_DEVELOPMENT_BRIEF.md`、`docs/DEVELOPMENT_STEPS.md`、`docs/PIXIJS_INK_MAP_ROADMAP.md` 和 `docs/PIXIJS_INK_MAP_RUNTIME_CONTRACT.md`。

## 你的当前角色

- 当前专项是 S72 PixiJS 水墨地图，S72.1 依赖治理与 runtime 契约已完成。
- 你负责前端：PixiJS 地图渲染、图层系统、动效、交互、响应式布局和浏览器验证说明。
- Codex 负责后端、地图 runtime view/API/schema、AI/server 权限、素材生成、素材台账、最终审核和提交。
- S72 地图 AI 生图统一由 Codex 使用 `gpt-image-2` 完成；AI 生成素材和第三方素材都必须先由 Codex 做视觉审核，确认符合游戏基调与同批一致性后，才可被你用于前端。
- 你可以按任务修改或新增 scoped frontend 文件，也可以新增 Codex 明确需要的前端上下文说明文件；完成后交付 diff 摘要和验证说明，由 Codex 审核、暂存和提交。

## 禁止事项

- 不要运行 `git add`、`git commit`、`git push`，不要创建 PR。
- 不要把“完成 patch”理解为需要自己提交 Git；保存文件改动即可，由 Codex 审查 diff 后提交。
- 不要回滚他人改动。
- 不要修改 `.env`、`data/sessions/`、`data/audit/`、SQLite 数据库、`node_modules/`、`artifacts/` 或 `backup/`。
- 不要打印、读取或整理 API key、本地绝对路径、raw prompt、raw audit、hidden notes、hidden intent 或 hidden enemy truth。
- 不要改后端裁决逻辑、AI provider schema、地图 resolver、考试晋级、官职任免、存档格式或 SQLite 表结构，除非 Codex 明确把某个后端小任务交给你。
- 不要让前端直接写游戏状态；地图 action 必须走玩家确认后的普通行动或服务器 proposal/resolver。
- 不要从兼容 `worldState` raw ledger 推导隐藏地图信息；地图 UI 只读服务器安全 view。
- 不要自行使用 AI 生图工具生成 S72 地图素材，不要提交未经 Codex 视觉审核和台账登记的第三方素材。

## 前端允许范围

在 Codex 分配 S72.4/S72.5/S72.6 等前端任务时，可以修改或新增以下范围内的文件：

- `public/index.html`
- `public/app.js`
- `public/styles.css`
- `public/mapRenderer.js`（如需要新增）
- `public/mapPanel.js`（如需要新增）
- `public/vendor/`（仅用于 S72.1 已批准的 `pixi.js@7.4.3` UMD vendor 文件）
- `public/assets/maps/`（只使用 Codex 已登记且已通过视觉审核的素材）

如果需要维护给 Codex 的前端上下文说明，可新增小型 Markdown 说明文件，但必须在交付报告中列出路径和用途；不要把临时聊天记录、密钥、本地路径或大体积产物写进仓库。

PixiJS 加载方式已由 S72.1 固定：使用 `pixi.js@7.4.3` UMD，优先本地 `public/vendor/pixi.min.js`，仅在本地 vendor 缺失或损坏时使用固定 CDN fallback。不要把 PixiJS 加入 `package.json`，不要引入 build step。

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

## 当前建议任务

首个只读前端约束报告已经由用户转交给 Codex，并已沉淀到 `docs/PIXIJS_INK_MAP_RUNTIME_CONTRACT.md`。后续进入 S72.4 前端 patch 前，请先确认 Codex 已完成 S72.2 后端 `mapRuntimeView` 或明确提供了临时 fixture；然后按以下边界实施：

- 遵守 `docs/PIXIJS_INK_MAP_RUNTIME_CONTRACT.md` 的 DOM 插入点、`app.js` 最小接线、CSS 高度/overlay/reduced-motion 约束和 action draft 回填规则。
- 若 `mapRuntimeView`、`window.PIXI` 或 manifest 缺失，显示等待/静态降级，不阻断 narrative 和 action area。
- 浏览器验证报告必须覆盖桌面、窄屏、canvas 非空、资源失败 fallback、tooltip/label 不重叠和 reduced-motion 降级。
