# S72 PixiJS 水墨地图专项路线图

本文件是《千秋》PixiJS 水墨地图专项的实施规格。目标不是“放一张地图图”，而是建立能长期承接地理、任所、科举赶考、军务外交、商路、事件压力、NPC 关系和 AI proposal 的地图运行时。

## 1. 决策与目标

- 地图运行时采用 PixiJS，服务于流畅动效、图层合成、大量 marker / route / pressure effect 和后续玩法扩展。
- 视觉目标为水墨手绘风格：宣纸底、淡墨山川、手绘城池、朱砂/青绿少量点染、路线墨线、事件涟漪和低饱和古籍 UI。
- 地图素材优先由 Codex 使用 AI 生图生成原创资产；历史地图只作构图、地貌纹理或时代气质参考。
- 地图中文字、地点名、事件标签不得烘进底图，统一由前端按 `mapEntityRef` 和服务器 view 渲染，避免 AI 图片文字错误和后续改名返工。
- 地图显示坐标只用于前端布局，不是 canonical 地理真值，不参与科举资格、行军结果、任免、外交、战和、商路收益或 AI 裁决。
- 默认仍保持 `npm install && npm start` 可运行；新增 PixiJS 或资产加载策略必须先通过依赖治理记录。
- S72 期间项目协作以 Codex + Gemini CLI 为准：Codex 负责后端、素材、审核和提交；Gemini CLI 负责前端 PixiJS patch 和验证报告，不提交代码。

## 2. 非目标与安全边界

- 本阶段不引入远程存档、账号、多人与云同步。
- 不把 raw coordinate table、hidden enemy truth、hidden notes、raw SQLite rows、provider proposal、完整 prompt、本地路径或 key 暴露给浏览器或 prompt。
- 不让 PixiJS 前端直接裁决移动、行军、赶考、赴任、商路、战争、外交、案牍或财政后果。
- 不让 AI 或 Gemini patch 绕过服务器 resolver；AI 仍只能读取安全 `mapContextView` / capped summary，并通过 proposal-only 工具表达地理意图。
- 不把历史地图原图直接做成可发布资产；如因个人游玩需要参考或临时使用，也必须在 [MAP_ASSET_LEDGER.md](MAP_ASSET_LEDGER.md) 记录来源、作者、许可和用途说明。
- 不为地图引入构建步骤，除非后续路线图明确批准并更新 README、依赖治理和验证命令。
- 不在图片、manifest 或前端调试输出中写入本地绝对路径、provider key、隐藏事件编号或 raw table 名。

## 3. 协作分工

| 角色 | 主要职责 | 禁止事项 |
| --- | --- | --- |
| Codex | 后端地图 runtime view、API/schema、服务器裁决边界、AI 工具权限、Mock/no-key fallback、测试、素材生成、素材台账、Gemini patch 审核、最终提交 | 不把未审查的 Gemini patch 直接提交；不把素材来源只留在聊天里 |
| Gemini CLI | 前端 PixiJS 地图渲染、图层系统、动效、交互、响应式布局、浏览器验证截图/说明 | 不运行 `git add`、`git commit`、`git push`，不创建 PR，不改后端裁决逻辑，不回滚他人改动 |
| Codex 子代理 | 只读复审或明确 scoped patch；用于提交前风险检查 | 不提交、不推送、不创建 PR |

Gemini 的交付必须列出改动文件、核心实现、浏览器验证步骤、已知风险和未完成事项。Codex 必须审查 diff、运行验证、同步文档后再提交。

## 4. 后端实施规格（Codex）

### 4.1 合法信息入口

- 继续以 `mapContextView` 为地图事实入口。任何新 view 都只能从现有安全 projection 派生：`worldGeographyView`、`officialPostingsView`、`localAffairsDocketView`、`militaryDiplomacyView`、`economicFiscalView`、`examCalendarView`、`eventArchiveView`、`actorMemoryView`、`sessionSummaryView`。
- 浏览器地图不得读取 raw SQLite 业务表、raw audit、provider payload、完整 prompt、hidden notes、hidden intent、hidden enemy truth 或本地路径。
- `mapRuntimeView` 是 S72 后端主交付物，建议由 `src/game/mapRuntimeView.js` 构建，并由 `src/routes/game.js` / `src/routes/exam.js` 跟随现有 route payload 返回。
- `mapRuntimeView` 不替代 `mapContextView`，而是在其上添加前端运行时所需的安全布局、样式 token、action affordance 和 asset manifest 版本。

### 4.2 `mapRuntimeView` 草案

```javascript
{
  schemaVersion: 1,
  generatedAtTurn: 12,
  layoutVersion: "ink-layout-v1",
  assetSetId: "ink-map-v1",
  playerFocusRef: "map:geography:city:city-suzhou",
  viewportHint: {
    centerRef: "map:geography:city:city-suzhou",
    zoom: "local",
    reason: "player_home_or_current_posting"
  },
  mapBounds: { width: 2400, height: 1600, coordinateSpace: "normalized-image-space" },
  layers: [
    { id: "base", label: "底图", order: 0, visible: true },
    { id: "routes", label: "通路", order: 20, visible: true },
    { id: "places", label: "城邑", order: 30, visible: true },
    { id: "events", label: "事势", order: 40, visible: true }
  ],
  refs: [
    {
      mapEntityRef: "map:geography:city:city-suzhou",
      entityType: "city",
      label: "苏州",
      summary: "江南府城，文脉繁盛。",
      visibility: "public",
      layout: { x: 0.62, y: 0.58, layer: "places", importance: 0.9, labelAnchor: "top" },
      style: { token: "city_prefecture", pressure: "calm", pulse: "none" },
      affordances: ["inspect", "draft_travel_action"],
      sourceView: "mapContextView",
      sourceRef: "map:geography:city:city-suzhou"
    }
  ],
  routes: [
    {
      mapEntityRef: "map:geography:route:route-grand-canal",
      label: "漕路",
      fromRef: "map:geography:city:city-suzhou",
      toRef: "map:geography:city:city-beijing",
      controlRefs: ["map:geography:city:city-nanjing"],
      layoutPath: [[0.62, 0.58], [0.55, 0.50], [0.47, 0.28]],
      style: { token: "water_route", activity: "trade" },
      affordances: ["inspect", "draft_route_action"]
    }
  ],
  eventEffects: [
    {
      id: "event-pressure-frontier-001",
      targetRef: "map:geography:frontier_zone:liaodong",
      kind: "military_pressure",
      severity: 0.7,
      label: "边警",
      animationToken: "ink_ripple_red",
      sourceRefs: ["eventArchiveView:military_diplomacy:..."]
    }
  ],
  actionDrafts: [
    {
      id: "draft-travel-city-nanjing",
      targetRef: "map:geography:city:city-nanjing",
      label: "草拟赴南京行动",
      actionText: "整束行装，循驿路赴南京贡院。",
      requiresServerTurn: true
    }
  ],
  hiddenNotice: "mapRuntimeView 只含服务器安全投影与显示布局；不含 raw 坐标表、未公开敌情、模型原文、本地路径或密钥。"
}
```

### 4.3 后端文件建议

- `src/game/mapRuntimeConfig.js`：cap、图层 id、style token、默认视野、性能上限、文案长度、layout schema 版本。
- `src/game/mapRuntimeView.js`：`buildMapRuntimeView(worldState, options)`、`sanitizeMapLayout(layout)`、`mergeMapRefsWithLayout(mapContextView, layout)`、`buildMapActionDrafts(...)`。
- `src/game/mapVisualLayout.js` 或 `src/game/mapVisualLayoutSeed.js`：内置首版显示布局。只保存归一化坐标和 label anchor，不保存 hidden 事实。
- `test/mapRuntimeView.test.js`：覆盖 ref 合并、layout sanitization、hidden/raw 污染过滤、action draft 安全和 cap。
- `test/mapRuntimeRoute.test.js`：覆盖 start/player-state/turn/exam payload 都返回安全 `mapRuntimeView`。
- `test/mapRuntimeParity.test.js` 或并入 dual-mode：覆盖 JSON/SQLite route view parity。

### 4.4 后端验收

- `mapRuntimeView.refs[].mapEntityRef` 必须能在当前 `mapContextView.mapEntityRefs` 中找到或有明确安全来源。
- layout 坐标必须 clamp 到 `0..1`，异常坐标回退或丢弃。
- 文案字段必须走 hidden/raw/path/key/SQL 污染过滤。
- route payload 不返回 raw layout source 注释、生成 prompt、素材本地路径或参考图 URL。
- action draft 只生成自然语言草稿或 proposal 入口，不写 `worldState`，不推进时间。
- Mock/no-key 模式下地图仍有稳定可见数据。

## 5. 前端实施规格（Gemini CLI）

### 5.1 接入原则

- S72.1 前不要接入 PixiJS 依赖。加载方式必须在依赖治理中记录：优先本地 vendor 固定版本；若临时 CDN，必须固定版本并提供本地 fallback，避免本地游玩强依赖外网。
- 保持纯 HTML/CSS/JS，无 build step。
- 不改后端 resolver、AI schema、存档格式、`.env`、`data/sessions/`、SQLite 文件或 `node_modules/`。
- 前端只读 `mapRuntimeView` / `mapContextView`；不得从兼容 `worldState` raw ledger 推导 hidden 地图信息。

### 5.2 前端文件建议

- `public/vendor/pixi.min.js` 或 `public/lib/pixi.min.js`：若选择 vendor 固定版本，记录来源、版本、license 和校验方式。
- `public/mapRenderer.js`：封装 PixiJS `Application`、layer containers、asset loading、render/update/destroy、resize、hit testing。
- `public/mapPanel.js`：封装 DOM 面板、tooltip、legend、action draft bridge、与现有 `app.js` 的轻量接口。
- `public/app.js`：只做最小接线：保存 `currentMapRuntimeView`，在 `renderPayloadWorldState(payload)` 后调用地图面板 update。
- `public/styles.css`：地图面板、canvas 容器、tooltip、legend、移动端布局、reduced motion。
- `public/assets/maps/ink-map-manifest.json`：地图资产 manifest，由 Codex 生成和维护。

### 5.3 PixiJS 图层

| 图层 | 容器 | 内容 | Gemini 注意事项 |
| --- | --- | --- | --- |
| base | `baseLayer` | 宣纸底图、整体水墨纹理 | 不在 canvas 中渲染中文地名；底图可降级为 CSS 背景 |
| terrain | `terrainLayer` | 山脉、水系、雾化墨迹 | 首版可并入 base，后续拆分 |
| routes | `routeLayer` | 陆路、漕路、海道、行军线 | 使用 Graphics 或纹理线；动态流动需可关闭 |
| places | `placeLayer` | 城邑、贡院、关隘、军镇、商埠 marker | marker 状态来自 style token；hit area 稳定 |
| effects | `effectLayer` | 灾情、边患、案牍、商路波动、科期提示 | 限制同屏动画数量，支持 severity cap |
| selection | `selectionLayer` | 当前选中 ref、玩家焦点、hover 高亮 | 不改变状态，只做视觉反馈 |
| labels | DOM overlay | 中文地名、tooltip、legend | 中文文字优先 DOM/CSS，避免 canvas 字体糊和缩放抖动 |

### 5.4 前端状态与接口

`mapRenderer.js` 建议暴露：

```javascript
window.QianqiuMapRenderer = {
  create(container, options),
  update(mapRuntimeView),
  focusRef(mapEntityRef, options),
  setLayerVisible(layerId, visible),
  destroy()
};
```

`create()` 回调建议：

```javascript
{
  onSelectRef(ref) {},
  onHoverRef(ref) {},
  onActionDraft(actionDraft) {},
  onLoadError(error) {}
}
```

`app.js` 接线要求：

- payload 中如果有 `mapRuntimeView`，优先使用；没有则可显示“地图资料待生成”，不要从 raw state 硬拼。
- 点击 marker 后，更新地图选中态，并联动现有“局势簿”或显示安全 tooltip。
- 点击 action draft 时，把 `actionText` 填入 `#action-input`，由玩家确认后走现有 `POST /api/game/turn`。
- 不在前端自行调用地图 tool resolver，不伪造 proposal result。

### 5.5 动效与性能预算

- 桌面目标 60fps，低端或窄屏至少保持可操作；动画过多时优先降级 effects，不牺牲输入响应。
- 首版 cap 建议：可见地点 80、可见路线 40、动态效果 12、同时 pulse marker 16。最终数值进入配置模块。
- 使用 `requestAnimationFrame` / Pixi ticker 时要支持暂停：页面隐藏、面板折叠、`prefers-reduced-motion: reduce` 时降低或停止动画。
- texture 只加载一次，切换存档时复用 cache；资源失败时显示静态 fallback。
- resize 使用 debounce 或 `ResizeObserver`，避免连续重建 Pixi app。
- 中文 label 使用 DOM overlay，跟随 viewport transform 更新位置；长地名截断或换行，不能遮挡核心按钮。

### 5.6 视觉规范

- 主色：宣纸白、淡墨灰、焦墨、朱砂、石青、石绿。避免整屏紫蓝渐变、现代霓虹、厚重卡片堆叠。
- 地图面板应像案头舆图：薄边、纸纹、印章式状态点、墨线动效。
- 地图 UI 是工具面板，不做营销 hero，不在地图上写玩法说明大段文字。
- 图标形态应可一眼区分：府城方印、县城圆点、贡院院门、驿站旗、关隘关门、军镇牙旗、商埠舟货、灾情裂纹/涟漪。
- 事件严重度通过透明度、涟漪半径、朱砂浓淡表达，不使用刺眼闪烁。

### 5.7 Gemini 交付格式

Gemini 每次完成 frontend patch 后，必须在报告中列出：

- 改动文件。
- 新增/修改的前端接口。
- 如何运行本地验证。
- 浏览器验证结果：桌面和窄屏、canvas 非空、资源失败 fallback、tooltip/label 不重叠。
- 已知风险和下一步建议。
- 明确声明未运行 `git add`、`git commit`、`git push`，未创建 PR，未改后端裁决逻辑。

## 6. 素材实施规格（Codex）

详细流程见 [MAP_ASSET_GUIDE.md](MAP_ASSET_GUIDE.md)，素材登记见 [MAP_ASSET_LEDGER.md](MAP_ASSET_LEDGER.md)。

首版素材建议：

- `ink-world-base-v1.webp`：无文字水墨大底图，建议 2400x1600 或 2048x1365。
- `paper-texture-v1.webp`：可平铺宣纸纹理，低对比。
- `ink-route-brush-v1.png`：路线笔触纹理。
- `map-icons-ink-v1.png` 或分文件 PNG/WebP：府城、县城、贡院、驿站、关隘、军镇、商埠、灾情、边患、诏令、案牍、队伍、船队。
- `ink-effect-ripple-v1.png`：事件涟漪/墨晕纹理。
- `ink-map-manifest.json`：资产 id、路径、尺寸、用途、版本、fallback 和 license 摘要。

AI 生图约束：

- 底图无文字、无现代边框、无罗盘英文、无图例文字、无水印。
- 图标需留足透明边距，统一视角和墨色，不混入真实文字。
- 透明图标优先生成纯色 chroma-key 背景后本地抠 alpha，复杂透明需求再走专门透明工作流。
- 每次生成都记录 prompt、模型/工具、日期、参考素材、后处理和最终项目路径。

## 7. S72 小步骤

| ID | 状态 | Owner | 目标 | 交付与验证 |
| --- | --- | --- | --- | --- |
| S72.0 | DONE | Codex | 确认 PixiJS 水墨地图方向，切换当前协作台账为 Codex + Gemini CLI | 本路线图、素材台账模板、`DEVELOPMENT_STEPS` 和 `SHARED_CONTEXT` 同步；不改运行时代码 |
| S72.1 | TODO | Codex，Gemini 提供前端约束 | PixiJS 依赖治理与 runtime 契约 | 更新依赖治理记录；决定 CDN/vendor/npm；若选 CDN 必须固定版本并提供本地 fallback，避免运行时强依赖外网；固定 `mapRuntimeView` 字段草案；验证 docs governance |
| S72.2 | TODO | Codex | 后端地图 runtime view 与布局契约 | 新增/扩展安全 view、配置、测试；确保 raw/hidden/坐标污染不外泄 |
| S72.3 | TODO | Codex | 水墨底图、图标、纹理与素材 manifest | 生成项目内资产；更新素材台账；基础图片尺寸/透明度/加载检查 |
| S72.4 | TODO | Gemini CLI，Codex 审核提交 | PixiJS 地图 shell 与图层系统 | 前端 patch；桌面/移动浏览器截图或说明；Codex 审查后提交 |
| S72.5 | TODO | Codex + Gemini CLI | 地图与游戏系统联动 | 点击 ref 联动局势簿/行动草稿；服务器权限校验；地图 action 不直写状态 |
| S72.6 | TODO | Gemini CLI，Codex 提供素材 | 水墨动效与视觉 polish | 路线流动、事件涟漪、marker 状态、降级模式；浏览器动效验证 |
| S72.7 | TODO | Codex | 验收、性能与安全回归 | `npm test` 或相关 node tests、browser smoke、canvas 非空/帧率/资源失败降级、JSON/SQLite parity |
| S72.8 | TODO | Codex | 专项归档 | 将完成范围、风险和后续地图玩法迁入归档，压缩活动台账 |

## 8. 首轮验收标准

- 地图面板在 `npm start` 后本地浏览器可打开，默认 Mock 模式可用。
- PixiJS canvas 加载稳定，桌面和窄屏下无空白、无严重遮挡、无文本溢出。
- 地图至少显示核心城邑、路线、当前玩家相关地点和 1-2 类事件压力。
- 地图点击只读取安全 view 并触发前端选择、信息面板联动或行动草稿；不直接修改状态。
- 后端测试证明地图 view 不暴露 raw coordinate table、hidden enemy truth、hidden notes、provider proposal、完整 prompt、本地路径或 key。
- 素材已落入项目目录并登记来源；AI 生成资产有 prompt 和使用说明。
- 资源加载失败时有静态 fallback，地图面板不让游戏主流程不可用。
- `prefers-reduced-motion` 下动态效果明显减少或停止。

## 9. 给 Gemini 的首个任务建议

Gemini 不应直接开始写 PixiJS 实现。首个 Gemini 任务应是只读前端约束报告：

```text
阅读 GEMINI.md、docs/SHARED_CONTEXT.md、docs/PIXIJS_INK_MAP_ROADMAP.md、public/index.html、public/app.js、public/styles.css。
不要编辑文件，不要运行 git 命令。
请报告：地图面板适合插入的 DOM 位置、app.js 最小接线点、CSS 响应式约束、PixiJS vendor/CDN 对前端的影响、需要 Codex 后端提供的 mapRuntimeView 字段。
```

Codex 收到该报告后执行 S72.1，固定依赖与契约，再让 Gemini 进入 S72.4 前端 patch。

## 10. 下一步建议

先执行 S72.1：Codex 固定 PixiJS 依赖治理、`mapRuntimeView` 草案和 Gemini patch 边界；Gemini 在该契约下再开始 S72.4 前端 shell。这样前端可以大胆做精美动效，后端仍守住《千秋》的服务器裁决和 AI 权限边界。
