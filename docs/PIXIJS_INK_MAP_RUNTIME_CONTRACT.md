# S72.1 PixiJS 水墨地图运行时契约

本文件固定 S72.1 的交付：PixiJS 依赖治理、`mapRuntimeView` 安全契约、前端接线位置、响应式约束和后续 S72.2/S72.4 的交接边界。本步只立契约，不向运行时代码接入 PixiJS，不下载素材，不改变 `package.json`。

## 1. 本步结论

- 前端继续保持纯 HTML/CSS/JS，无 build step。
- PixiJS 采用浏览器 UMD bundle，不进入 `package.json`。正式接入时固定 `pixi.js@7.4.3`，使用 `dist/pixi.min.js`。
- 加载顺序采用本地 vendor 优先：`/vendor/pixi.min.js` 先加载，只有本地文件缺失或损坏时才使用固定 CDN fallback。这样默认本地游玩不依赖外网。
- 本地 vendor 文件应在 S72.4 接入时保存为 `public/vendor/pixi.min.js`，并同时保存 MIT license 说明或在台账中明确来源。S72.1 不提前提交第三方压缩文件。
- `assetSetId` 首版固定为 `ink-map-v1`，manifest 路径固定为 `public/assets/maps/ink-map-manifest.json`。真实图片素材仍由 S72.3 生成、视觉审核和登记。
- `mapRuntimeView` 只从安全 `mapContextView` 与玩家可见 route views 派生，显示坐标只服务 UI 布局，不代表 canonical 地理真值。
- Gemini CLI 后续 S72.4 前端 patch 必须遵循本契约；Gemini 可以按任务修改或新增前端文件，但不运行 Git 命令、不提交、不推送、不创建 PR。Codex 在 S72.2 先实现后端 view 与测试，并负责最终 diff 审核、暂存和提交。

## 2. 依赖治理记录

依赖/插件记录：

- 名称：`pixi.js`
- 类型：browser vendor runtime，不作为 npm runtime dependency 提交。
- 版本或范围：固定 `7.4.3`。
- 是否使用 `latest` 及理由：不使用。2026-05-14 通过 `npm view pixi.js version` 查得最新主版本为 `8.18.1`；S72 选择 `7.4.3` 是因为 7 系列有稳定 UMD 全量 bundle，适合当前无构建、传统 `<script>` 加载方式。
- 引入步骤：S72.1 只批准版本与加载策略；S72.4 才能提交 `public/vendor/pixi.min.js` 和前端接线。
- 负责人/工具：Codex 负责治理、下载来源核对、最终提交；Gemini CLI 可在 S72.4 使用已批准路径修改或新增前端文件，但不运行 Git 命令、不提交。
- 用途：水墨地图 canvas 渲染、图层合成、marker、route、pressure effect、hit testing 和后续地图动效。
- 替代的手写逻辑或人工流程：避免手写 canvas scene graph、texture cache、hit area、ticker 和 resize 生命周期。
- 影响范围：browser、docs、后续 browser smoke；S72.1 不影响 server、storage、AI provider 或 npm install。
- 许可证：MIT，来源为 `pixi.js` npm 包和 PixiJS GitHub 仓库。
- 维护状态：PixiJS 是活跃浏览器渲染库；S72 固定 7 系列最后版本以降低无构建接入风险。
- 安全与隐私：本地 vendor 不需要账户、密钥、遥测、postinstall、原生编译或 Node.js 二进制；CDN fallback 会产生浏览器外网请求，只在本地 vendor 失败时触发，并必须固定版本 URL。
- 备选方案：原生 Canvas 2D、SVG/DOM、Leaflet/OpenLayers。原生 Canvas 会让图层、纹理、动画和 hit testing 成本过高；SVG/DOM 对大量动效和缩放性能不稳；地图 GIS 库会带来不需要的真实地图假设。
- Mock/no-key 影响：无。Mock 默认可玩不能依赖真实 provider key，也不能依赖外网；缺 PixiJS 时地图面板显示静态等待/降级，不阻断文字游戏主流程。
- 安装与运行影响：S72.1 无 package 变更。S72.4 提交 vendor 后，`npm install && npm start` 仍不需要构建步骤。
- 验证命令：S72.1 运行 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`。S72.4 还需运行 `npm start` 或 browser smoke，并验证 canvas 非空、资源失败 fallback、窄屏不遮挡行动区。
- 回滚策略：删除 `public/vendor/pixi.min.js`、地图脚本、地图 DOM/CSS 和 `mapRuntimeView` route 接线；保留原文字叙事、行动输入和 `mapContextView` 安全接口。
- 文档落点：本文件、`docs/PIXIJS_INK_MAP_ROADMAP.md`、`docs/DEVELOPMENT_STEPS.md`、`docs/SHARED_CONTEXT.md`、`GEMINI.md`。
- 决策：批准 `pixi.js@7.4.3` UMD、本地 vendor 优先、固定 CDN fallback、无 build step。
- 后续复查：若未来升级 PixiJS 8 或改用 npm/bundler，必须重新走依赖治理并更新 README、brief、browser smoke 和回滚策略。

S72.4 推荐脚本顺序：

```html
<script src="/vendor/pixi.min.js"></script>
<script>
  window.PIXI || document.write('<script src="https://cdn.jsdelivr.net/npm/pixi.js@7.4.3/dist/pixi.min.js"><\\/script>');
</script>
<script src="/mapRenderer.js"></script>
<script src="/mapPanel.js"></script>
<script src="/app.js"></script>
```

`mapPanel.js` 必须处理 `window.PIXI` 不存在的情况，显示“地图资料待生成”或等价静态降级，不得让 `app.js` 初始化失败。

## 3. `mapRuntimeView` 合法来源

`mapRuntimeView` 是给浏览器地图 runtime 的安全投影，不替代 `mapContextView`。后端只能从以下来源派生：

- `mapContextView`
- `worldGeographyView`
- `officialPostingsView`
- `localAffairsDocketView`
- `militaryDiplomacyView`
- `economicFiscalView`
- `examCalendarView`
- `eventArchiveView`
- `actorMemoryView`
- `sessionSummaryView`

禁止来源：

- raw coordinate table
- raw SQLite business rows
- raw audit
- provider payload / proposal
- 完整 prompt
- hidden notes / hidden intent
- hidden enemy truth
- 本地路径、密钥、环境变量

显示坐标和 layout seed 只用于 UI。服务器 resolver、AI 工具、科举资格、任免、军令、外交、财政、商路收益和移动结果不得把显示坐标当作事实来源。

## 4. `mapRuntimeView` 字段契约

首版 schema：

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
  mapBounds: {
    width: 2400,
    height: 1600,
    coordinateSpace: "normalized-image-space"
  },
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
      layout: {
        x: 0.62,
        y: 0.58,
        layer: "places",
        importance: 0.9,
        labelAnchor: "top"
      },
      style: {
        token: "city_prefecture",
        pressure: "calm",
        pulse: "none"
      },
      affordances: ["inspect", "draft_travel_action"],
      actionDraftRefs: ["draft-travel-city-nanjing"],
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
      affordances: ["inspect", "draft_route_action"],
      actionDraftRefs: ["draft-route-grand-canal"]
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
      sourceRefs: ["eventArchiveView:military_diplomacy:frontier-001"]
    }
  ],
  actionDrafts: {
    "draft-travel-city-nanjing": {
      id: "draft-travel-city-nanjing",
      targetRef: "map:geography:city:city-nanjing",
      label: "草拟赴南京行动",
      actionText: "整束行装，循驿路赴南京贡院。",
      requiresServerTurn: true
    },
    "draft-route-grand-canal": {
      id: "draft-route-grand-canal",
      targetRef: "map:geography:route:route-grand-canal",
      label: "草拟循漕路北上",
      actionText: "整点行囊，循漕路北上，沿途查问驿传与水程。",
      requiresServerTurn: true
    }
  },
  hiddenNotice: "mapRuntimeView 只含服务器安全投影与显示布局；不含 raw 坐标表、未公开敌情、模型原文、本地路径或密钥。"
}
```

字段要求：

- `schemaVersion`：整数。前端只接受已支持版本，未知版本显示等待/降级。
- `generatedAtTurn`：整数，用于前端判断是否覆盖当前地图；不得由前端自行递增。
- `layoutVersion`：显示布局版本，例如 `ink-layout-v1`。
- `assetSetId`：资产组版本，首版为 `ink-map-v1`。
- `viewportHint.centerRef`：首屏聚焦地点。必须能解析到当前 `refs` 中带有效 `layout` 的可渲染 ref；如果只能在安全 `mapContextView.mapEntityRefs` 中找到而没有 layout，后端应改用最近的可渲染安全 ref 或返回默认中心 fallback。
- `mapBounds`：基准显示尺寸。首版使用 2400x1600，坐标换算使用归一化空间。
- `layers`：前端图层顺序与默认显隐，只能使用批准 id。
- `refs`：安全地点/事件/任所 marker。每项必须有 `mapEntityRef`、`label`、`summary`、`layout`、`style.token`、`affordances`、`sourceView`。
- `routes`：安全路线。`fromRef`、`toRef`、`controlRefs` 必须引用当前可见 ref 或明确安全 route ref。
- `eventEffects`：只描述玩家可见压力效果，`severity` clamp 到 `0..1`。
- `actionDrafts`：以 draft id 为 key 的字典。自然语言 `actionText` 必须由服务器预渲染，前端严禁拼接“前往某地”这类行动语句。
- `hiddenNotice`：保留安全边界说明，便于测试和人工审查。

## 5. 后端 S72.2 验收口径

- 新增 `src/game/mapRuntimeConfig.js`，集中 layer id、style token、cap、坐标范围、字符串长度和默认 fallback。
- 新增 `src/game/mapRuntimeView.js`，提供 `buildMapRuntimeView(worldState, options)`、layout sanitization、ref 合并和 action draft 生成。
- 新增 layout seed 文件，只保存显示坐标、layer、label anchor 和 style token，不保存 hidden 事实。
- `mapRuntimeView.refs[].mapEntityRef` 必须来自当前安全 `mapContextView.mapEntityRefs` 或明确安全来源。
- 所有 layout 坐标 clamp 到 `0..1`；异常 layout 丢弃或回退。
- 字符串字段过滤 hidden/raw/path/key/SQL 污染。
- route payload 不返回素材本地路径、参考 URL、生成 prompt、raw layout 注释或 provider 输出。
- action draft 只填入玩家输入框，仍由玩家确认后走 `POST /api/game/turn`，不能直接调用 resolver 或改状态。
- Mock/no-key 模式有稳定地图数据，缺素材或缺 PixiJS 时不阻断文字主流程。
- 后端测试覆盖 `start`、`player-state`、`turn`、考试路由、JSON/SQLite parity 和 hidden/raw 红队。

## 6. 前端 S72.4 接线契约

### 6.1 DOM 位置

在 `public/index.html` 的 `.game-panel` 内，把地图面板插入 `#scholar-panel` 和 `#narrative` 之间：

```html
<aside class="scholar-panel" id="scholar-panel" hidden></aside>
<section id="map-panel" class="map-panel" hidden>
  <div id="map-canvas" class="map-canvas"></div>
  <div id="map-ui-layer" class="map-ui-layer" aria-live="polite"></div>
</section>
<article class="narrative" id="narrative">
```

理由：现有 `.game-panel` 是自上而下的游戏工作区。地图位于 scholar/status 信息之后、叙事文本之前，符合“宏观舆图 -> 本回叙事 -> 输入行动”的阅读顺序；地图作为独立 grid row，更容易限制高度，避免遮挡 narrative 和底部行动区。

### 6.2 `app.js` 最小接线

在顶部状态区新增：

```javascript
let currentMapRuntimeView = null;
```

在 `renderPayloadWorldState(payload)` 中，在现有 `renderWorldState(...)` 调用后接入：

```javascript
currentMapRuntimeView = payload.mapRuntimeView || null;

if (window.QianqiuMapRenderer && currentMapRuntimeView) {
  window.QianqiuMapRenderer.update(currentMapRuntimeView);
} else if (window.QianqiuMapRenderer) {
  window.QianqiuMapRenderer.showWaitingState();
}
```

要求：

- payload 没有 `mapRuntimeView` 时显示等待/降级，不从 `worldState`、raw ledger 或 DOM 现有文本推导地图数据。
- marker 或 route 的 action draft 回调只能把服务器给出的 `actionDraft.actionText` 填入 `#action-input`。
- 玩家仍需点击现有 `#action-btn` 提交，前端不能直接改状态或伪造 map proposal result。
- `mapRenderer.js`/`mapPanel.js` 要能重复 update，不因切换存档或考试 payload 留下旧 marker。

### 6.3 CSS 与响应式约束

首版建议：

```css
.game-panel {
  grid-template-rows: auto auto auto minmax(0, 1fr) auto;
}

.map-panel {
  position: relative;
  height: clamp(200px, 24vh, 280px);
  min-height: 200px;
  overflow: hidden;
}

.map-ui-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}

.map-label,
.map-tooltip {
  max-width: min(18rem, calc(100% - 24px));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (prefers-reduced-motion: reduce) {
  .map-panel *,
  .map-panel *::before,
  .map-panel *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

约束：

- 地图高度使用 `clamp(200px, 24vh, 280px)` 作为当前验收上限，并在桌面游戏态将书生信息面板限制为可滚动摘要区，确保窄屏和桌面下 narrative 与 sticky action-area 仍可见。
- DOM overlay 默认 `pointer-events: none`，只有真正需要点击的按钮或控件局部恢复 `pointer-events: auto`。
- tooltip 和 label 必须做边界检测、截断或换行，不能压住行动按钮。
- `prefers-reduced-motion: reduce` 时，CSS 动画停止，并通知 Pixi ticker 降低或暂停水波纹、路线流动和 marker pulse。
- 桌面宽屏的地图/叙事分列可在 S72.6 作为 polish 增强；S72.4 首版以独立 row 为验收基线，避免一次性重写游戏主布局。

## 7. 素材与 manifest 契约

首版 asset set：

- `assetSetId`: `ink-map-v1`
- manifest: `public/assets/maps/ink-map-manifest.json`
- base map token: `ink-world-base-v1`
- paper texture token: `paper-texture-v1`
- route texture token: `ink-route-brush-v1`
- event texture token: `ink-effect-ripple-v1`
- icon tokens: `city_prefecture`、`city_county`、`exam_hall`、`relay_station`、`pass_fort`、`garrison`、`trade_port`、`frontier_pressure`、`legal_docket`、`edict`

S72.3 前不得把未生成、未登记、未视觉审核的图片写入 manifest。S72.4 如果先于完整素材完成，可以使用 CSS fallback 和简单 Graphics marker，但不得假称某图片资产已可用。

## 8. 后续分工

- S72.2：Codex 实现 `mapRuntimeView`、layout seed、测试和 route 接线。
- S72.3：Codex 使用 `gpt-image-2` 生成首批素材，做视觉审核，更新 manifest 和素材台账。
- S72.4：Gemini CLI 在本契约和已提交素材范围内实现前端 PixiJS shell，可以保存前端文件改动或新增必要前端文件，不运行 Git 命令，不创建 PR；Codex 审查 diff 后提交。
- S72.5 以后：地图点击、局势簿联动、行动草稿和服务器 proposal 继续保持前端只读、服务器裁决。
