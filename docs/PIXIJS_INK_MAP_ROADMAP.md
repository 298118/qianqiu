# S72 PixiJS 水墨地图专项路线图

本文件是《千秋》PixiJS 水墨地图专项的实施规格。目标不是“放一张地图图”，而是建立能长期承接地理、任所、科举赶考、军务外交、商路、事件压力、NPC 关系和 AI proposal 的地图运行时。

## 1. 决策与目标

- 地图运行时采用 PixiJS，服务于流畅动效、图层合成、大量 marker / route / pressure effect 和后续玩法扩展。
- 视觉目标为水墨手绘风格：宣纸底、淡墨山川、手绘城池、朱砂/青绿少量点染、路线墨线、事件涟漪和低饱和古籍 UI。
- 地图素材优先由 Codex 使用 `gpt-image-2` 生成原创资产；其他 AI 生图工具不得作为 S72 地图素材来源。生成后的素材必须由 Codex 使用视觉能力审核游戏基调、历史/水墨适配、图标可读性和同批一致性。
- 鼓励使用第三方优秀素材作为参考、纹理或直接资产候选，但直接入库前必须完成许可登记，并由 Codex 使用视觉能力审核是否符合《千秋》的水墨历史基调和现有素材一致性。
- 地图中文字、地点名、事件标签不得烘进底图，统一由前端按 `mapEntityRef` 和服务器 view 渲染，避免 AI 图片文字错误和后续改名返工。
- 地图显示坐标只用于前端布局，不是 canonical 地理真值，不参与科举资格、行军结果、任免、外交、战和、商路收益或 AI 裁决。
- 默认仍保持 `npm install && npm start` 可运行；新增 PixiJS 或资产加载策略必须先通过依赖治理记录。
- S72 期间项目协作以 Codex + Gemini CLI 为准：Codex 负责后端、素材、审核和 Git 提交；Gemini CLI 负责前端 PixiJS patch、必要前端上下文说明和验证报告，可以按任务修改或新增前端文件，但不运行 Git 提交/推送命令。
- S72.1 已固定运行时契约，详见 [PIXIJS_INK_MAP_RUNTIME_CONTRACT.md](PIXIJS_INK_MAP_RUNTIME_CONTRACT.md)：PixiJS 使用 `pixi.js@7.4.3` UMD，本地 vendor 优先、固定 CDN fallback，不进入 `package.json`，继续保持无 build step。

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
| Codex | 后端地图 runtime view、API/schema、服务器裁决边界、AI 工具权限、Mock/no-key fallback、测试、使用 `gpt-image-2` 生成素材、第三方素材筛选、素材视觉审核、素材台账、Gemini patch 审核、最终提交 | 不把未审查的 Gemini patch 直接提交；不把素材来源或视觉审核结论只留在聊天里；不使用其他 AI 生图工具生成 S72 地图素材 |
| Gemini CLI | 前端 PixiJS 地图渲染、图层系统、动效、交互、响应式布局、必要前端上下文说明、浏览器验证截图/说明；可按任务修改或新增 scoped frontend 文件 | 不运行 `git add`、`git commit`、`git push`，不创建 PR，不改后端裁决逻辑，不回滚他人改动，不自行生成或引入未登记素材 |
| Codex 子代理 | 只读复审或明确 scoped patch；用于提交前风险检查 | 不提交、不推送、不创建 PR |

Gemini 的交付必须列出改动文件、新增文件用途、核心实现、浏览器验证步骤、已知风险和未完成事项。Codex 必须审查 diff、运行验证、同步文档后再提交。只有明确标注为只读的任务才禁止 Gemini 编辑文件；普通 S72 前端 patch 允许保存文件改动。

## 4. 后端实施规格（Codex）

### 4.1 合法信息入口

- 继续以 `mapContextView` 为地图事实入口。任何新 view 都只能从现有安全 projection 派生：`worldGeographyView`、`officialPostingsView`、`localAffairsDocketView`、`militaryDiplomacyView`、`economicFiscalView`、`examCalendarView`、`eventArchiveView`、`actorMemoryView`、`sessionSummaryView`。
- 浏览器地图不得读取 raw SQLite 业务表、raw audit、provider payload、完整 prompt、hidden notes、hidden intent、hidden enemy truth 或本地路径。
- `mapRuntimeView` 是 S72 后端主交付物，建议由 `src/game/mapRuntimeView.js` 构建，并由 `src/routes/game.js` / `src/routes/exam.js` 跟随现有 route payload 返回。
- `mapRuntimeView` 不替代 `mapContextView`，而是在其上添加前端运行时所需的安全布局、样式 token、action affordance 和 asset manifest 版本。
- S72.1 正式字段、加载策略、前端接线和素材 manifest 边界以 [PIXIJS_INK_MAP_RUNTIME_CONTRACT.md](PIXIJS_INK_MAP_RUNTIME_CONTRACT.md) 为准。

### 4.2 `mapRuntimeView` 摘要

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
  actionDrafts: {
    "draft-travel-city-nanjing": {
      id: "draft-travel-city-nanjing",
      targetRef: "map:geography:city:city-nanjing",
      label: "草拟赴南京行动",
      actionText: "整束行装，循驿路赴南京贡院。",
      requiresServerTurn: true
    }
  },
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

- PixiJS 加载方式已由 S72.1 固定：`pixi.js@7.4.3` UMD，本地 `public/vendor/pixi.min.js` 优先，固定 CDN fallback，仅在本地 vendor 缺失或损坏时触发；不进入 `package.json`，不引入 build step。
- 保持纯 HTML/CSS/JS，无 build step。
- 不改后端 resolver、AI schema、存档格式、`.env`、`data/sessions/`、SQLite 文件或 `node_modules/`。
- 前端只读 `mapRuntimeView` / `mapContextView`；不得从兼容 `worldState` raw ledger 推导 hidden 地图信息。

### 5.2 前端文件建议

- `public/vendor/pixi.min.js`：S72.1 已批准的 `pixi.js@7.4.3` UMD vendor 文件；提交时记录来源、版本、license 和校验方式。
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

AI 生图与素材准入约束：

- AI 生成地图素材统一由 Codex 使用 `gpt-image-2` 完成；不使用其他 AI 生图工具作为正式素材来源。
- 底图无文字、无现代边框、无罗盘英文、无图例文字、无水印。
- 图标需留足透明边距，统一视角和墨色，不混入真实文字。
- 透明图标优先生成纯色 chroma-key 背景后本地抠 alpha，复杂透明需求再走专门透明工作流。
- 每次生成都记录 prompt、模型/工具、日期、参考素材、后处理、Codex 视觉审核结论和最终项目路径。
- 第三方优秀素材可以作为参考、纹理或直接资产候选；直接进入 `public/assets/maps/` 或 manifest 前，必须登记许可/来源并通过 Codex 视觉审核。
- Codex 视觉审核至少判断：是否符合《千秋》水墨历史基调、是否与已有素材色彩/笔触/视角一致、缩放后是否可读、是否存在现代元素/水印/文字误生成、是否含本地路径/key/hidden 真值。

## 7. S72 小步骤

| ID | 状态 | Owner | 目标 | 交付与验证 |
| --- | --- | --- | --- | --- |
| S72.0 | DONE | Codex | 确认 PixiJS 水墨地图方向，切换当前协作台账为 Codex + Gemini CLI | 本路线图、素材台账模板、`DEVELOPMENT_STEPS` 和 `SHARED_CONTEXT` 同步；不改运行时代码 |
| S72.1 | DONE | Codex，Gemini 提供前端约束 | PixiJS 依赖治理与 runtime 契约 | 新增 [PIXIJS_INK_MAP_RUNTIME_CONTRACT.md](PIXIJS_INK_MAP_RUNTIME_CONTRACT.md)；固定 `pixi.js@7.4.3` UMD、本地 vendor 优先和固定 CDN fallback；固定 `mapRuntimeView` 字段、DOM/app/CSS 接线、manifest 与 S72.2/S72.4 验收边界 |
| S72.2 | TODO | Codex | 后端地图 runtime view 与布局契约 | 新增/扩展安全 view、配置、测试；确保 raw/hidden/坐标污染不外泄 |
| S72.3 | TODO | Codex | 水墨底图、图标、纹理与素材 manifest | 使用 `gpt-image-2` 生成项目内 AI 资产；第三方素材可筛选但必须登记许可；所有入库素材先经 Codex 视觉审核；更新素材台账；基础图片尺寸/透明度/加载检查 |
| S72.4 | TODO | Gemini CLI，Codex 审核提交 | PixiJS 地图 shell 与图层系统 | Gemini 可修改/新增前端文件并交付 patch；桌面/移动浏览器截图或说明；Codex 审查 diff 后提交 |
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
- 素材已落入项目目录并登记来源；AI 生成资产明确记录 `gpt-image-2`、prompt、后处理和 Codex 视觉审核结论；第三方素材记录许可、用途和 Codex 视觉审核结论。
- 资源加载失败时有静态 fallback，地图面板不让游戏主流程不可用。
- `prefers-reduced-motion` 下动态效果明显减少或停止。

## 9. Gemini 前端交接

Gemini 的首个只读前端约束报告已经由用户转交给 Codex，并已沉淀到 [PIXIJS_INK_MAP_RUNTIME_CONTRACT.md](PIXIJS_INK_MAP_RUNTIME_CONTRACT.md)。后续 Gemini 进入 S72.4 前端 patch 时，必须先阅读本路线图、运行时契约、`GEMINI.md`、`public/index.html`、`public/app.js` 和 `public/styles.css`，并遵守以下边界：

- 可修改或新增前端 patch 范围内文件，也可新增必要前端上下文说明文件；不运行 `git add`、`git commit`、`git push`，不创建 PR。
- 不从 raw `worldState`、SQLite、prompt、provider payload 或 hidden ledger 推导地图数据。
- 如果 `mapRuntimeView` 缺失或 `window.PIXI` 不可用，显示等待/静态降级，不阻断主文字流程。
- 浏览器验证报告需覆盖桌面和窄屏、canvas 非空、资源失败 fallback、tooltip/label 不重叠、`prefers-reduced-motion` 降级。

## 10. 下一步建议

执行 S72.2：Codex 基于 S72.1 契约实现后端 `mapRuntimeView`、layout seed、route payload 和测试。S72.3 再生成并审核 `ink-map-v1` 素材；Gemini 在 S72.2/S72.3 交付可用后进入 S72.4 前端 shell。
