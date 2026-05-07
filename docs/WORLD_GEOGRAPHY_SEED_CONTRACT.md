# 天下地理静态种子与实例化契约

S50.1 新增 `src/game/worldGeographySeeds.js`，为后续国家、城市、路线、边境和官署辖区数据库化提供静态种子。S50.2 新增 `src/game/worldGeography.js`，在每局 `worldState.worldGeography` 中实例化这些种子，并通过 `worldGeographyView` 与 capped prompt summary 暴露玩家/AI 可见地理。

当前仍不创建 SQLite 业务表，不新增浏览器地理面板，不替代 `treasury`、`grainReserve`、`publicOrder`、`borderThreat` 等既有顶层世界指标。

## 目标

- 先固定天下格局的静态名称和引用关系，避免 per-session 国家/城市实例化时临时拼接字符串。
- 给本国、邻国、首都、省府州县、驿路/漕河/关隘、边境压力面和官署辖区统一 id。
- 从第一步就标注初始可见性：玩家公开可知、身份可见、传闻可见和隐藏。
- 保持 AI/server 边界：模型不能直接写国家、城市、路线、边境或官署辖区；只能读取服务器过滤后的 projection。

## 种子范围

默认种子 `late-ming-north-china` 覆盖：

- 国家：大明、关外满洲政权、漠南蒙古诸部、朝鲜、琉球。
- 区域：北直隶、南直隶、山东、河南、山西边面、辽东关外、江南府县、南海海道。
- 城市：北京、南京、苏州、杭州、济南、开封、太原、大同、山海关、盛京、喀喇沁营地、汉城、广州、首里。
- 路线：京杭漕运北段、黄河河防线、大同入京边报驿路、山海关辽东通道、东南海道，以及隐藏的辽东暗路测试种子。
- 边境：山海关辽东边面、大同漠南边面、辽东朝鲜贡道、南海朝贡海道，以及隐藏情报测试种子。
- 官署辖区：吏部、户部、兵部、礼部、都察院、布政司、按察司、府州县的静态空间落点。

这些字段只描述“可落点在哪里”。动态国库、兵力、民心、城市诉讼、外交态度、战争开合、官员任免和任所指标仍由后续 per-session 状态与服务器模块裁决。

## 数据形状

`getDefaultWorldGeographySeed()` 返回归一化副本：

```javascript
{
  schemaVersion: 1,
  seedId: "late-ming-north-china",
  label: "明末天下基础种子",
  countries: [],
  regions: [],
  cities: [],
  routes: [],
  frontierZones: [],
  officeJurisdictions: []
}
```

主要字段：

- `countries[]`：`id`、`kind`、`name`、`shortName`、`polityType`、`rulerTitle`、`capitalCityId`、`cultureTags`、`governmentTags`、`visibility`、`intelConfidence`、`publicSummary`、`hiddenNotes`。
- `regions[]`：`id`、`countryId`、`name`、`level`、`seatCityId`、`visibility`、`publicSummary`。
- `cities[]`：`id`、`countryId`、`regionId`、`name`、`jurisdictionLevel`、`terrain`、`riverOrCoast`、`strategicTags`、`supervisingBureauIds`、`visibility`、`intelConfidence`、`publicSummary`、`hiddenNotes`。
- `routes[]`：`id`、`type`、`name`、`fromCityId`、`toCityId`、`viaCityIds`、`distanceLabel`、`seasonalRisk`、`strategicTags`、`visibility`、`publicSummary`、`hiddenNotes`。
- `frontierZones[]`：`id`、`name`、`countryId`、`neighborCountryId`、`cityIds`、`routeIds`、`status`、`pressureMetric`、`visibility`、`publicSummary`、`hiddenNotes`。
- `officeJurisdictions[]`：`id`、`bureauId`、`name`、`scope`、`countryIds`、`cityIds`、`routeIds`、`frontierZoneIds`、`officeTrack`、`visibility`、`publicSummary`、`hiddenNotes`。

## 可见性

`visibility` 当前允许：

- `public`：开局即可公开知道，如京师、漕运、主要边镇。
- `role_visible`：具备对应身份或公文视野才合理看到，如礼部贡道、都察院巡按、东南海道。
- `rumor`：只作传闻或粗略情报，如邻国都城和海道传闻。
- `hidden`：服务器保留，不能进入 view、prompt 或玩家 UI。

`buildWorldGeographySeedView()` 只返回非 hidden 行，并移除所有 `hiddenNotes`。S50.2 的 `buildWorldGeographyView()` 在每局账本层做更严格的角色视野过滤、hidden nested ref 裁剪和 prompt cap。

## 引用与校验

`validateWorldGeographySeed(seed)` 检查：

- 国家、区域、城市、路线、边境、官署辖区 id 不重复。
- 国家首都引用存在。
- 区域引用国家和治所城市存在。
- 城市引用国家和区域存在。
- 路线端点和经由城市存在。
- 边境引用本国、邻国、城市和路线存在。
- 官署辖区引用国家、城市、路线和边境存在。

测试还会确认 `cities[].supervisingBureauIds` 与 `officeJurisdictions[].bureauId` 都能在 `officialCatalog` 中找到。

## S50.2 每局地理账本

`src/game/worldGeography.js` 提供：

- `createInitialWorldGeographyState(worldState)`：新局从默认 seed 实例化 `worldState.worldGeography`。
- `normalizeWorldGeographyState(worldState)` / `ensureWorldGeographyState(worldState)`：旧档缺失或旧形状会补齐 seed 行、clamp 动态字段、裁剪列表上限，并用当前顶层世界指标刷新轻量压力快照。
- `buildWorldGeographyView(worldState)`：构造路由可见 projection，过滤 hidden 行、`hiddenNotes`、hidden nested refs，以及书生开局不应直接看到的 `role_visible` 行。
- `summarizeWorldGeographyForPrompt(worldState)`：给 `compactWorldState()` 使用的 capped 摘要，只保留少量国家、城市、路线、边境和官署辖区 highlights。

`worldState.worldGeography` 形状：

```javascript
{
  schemaVersion: 1,
  seedId: "late-ming-north-china",
  label: "明末天下基础种子",
  generatedAtTurn: 0,
  countries: [],
  regions: [],
  cities: [],
  routes: [],
  frontierZones: [],
  officeJurisdictions: [],
  recentNotes: []
}
```

每行保留 seed 的 id、名称、引用、可见性和公开摘要，并增加轻量动态字段：

- 国家：`status`、`statusLabel`、`pressure`、`stability`、`lastUpdatedTurn`。
- 城市：`status`、`pressure`、`stability`、`localOrder`、`taxBurden`、`grainStress`、`lastUpdatedTurn`。
- 路线：`status`、`statusLabel`、`risk`、`lastUpdatedTurn`。
- 边境压力面：`status`、`statusLabel`、`pressure`、`pressureMetric`、`lastUpdatedTurn`。
- 官署辖区：`priority`、`lastUpdatedTurn`。

这些字段是从当前顶层 `worldState` 派生的可见压力快照，用于叙事和检索，不是新的财政、外交或战争裁决来源。S50.2 不把国家/城市拆成 SQLite 表；默认 JSON 存档仍保存整份 `world_state`。

## View 与 Prompt Projection

游戏与考试路由现在返回 `worldGeographyView`。浏览器后续做“天下格局”或“任所地理”面板时必须读取这个 view，不要直接渲染 raw `worldState.worldGeography`。现有 API 为保持开发兼容仍随 payload 返回完整本地 `worldState`。

Prompt 中的 `worldGeography` summary 上限：

- `countries` 最多 4 条。
- `cities` 最多 6 条。
- `routes` 最多 4 条。
- `frontierZones` 最多 4 条。
- `officeJurisdictions` 最多 4 条。

`role_visible` 当前按身份做粗过滤：书生只看 public/rumor，入仕官员、皇帝、大臣、将领、地方官可以看到角色公文视野行。后续 S53 若做检索式 context assembler，可以把它细分到官署、任所、路引和人脉来源。

## AI 与服务器边界

- `worldState.worldGeography` 是 server-owned ledger。普通 provider 的 `statePatch.worldGeography` 会被 schema、remote normalization、`applyStatePatch()` 和 provider long-run 检查拒绝或忽略。
- AI 可以在收到可见 projection 后解释“山海关边报”“漕运阻滞”“江南钱粮”等公开事实，但不能裁决战争、外交、城市指标、官署任免或隐藏情报公开。
- 隐藏路线、隐藏边境、`hiddenNotes`、本地路径、审计 payload 和 provider 配置不得进入 prompt、route view 或浏览器面板。

## 后续边界

S50.2 已完成每局实例化、路由 projection 和 prompt projection。后续边界：

- S51/S52 再把 NPC、家族、官职、任所与城市进一步联动。
- S53 再考虑浏览器“天下格局”“任所地理”等信息面板，并接入更细的检索式 context assembler。
- 仍不替代现有 `treasury`、`grainReserve`、`publicOrder`、`borderThreat` 等顶层指标，直到后续迁移明确完成。

## 验证要求

- `node --check src\game\worldGeographySeeds.js`
- `node --check src\game\worldGeography.js`
- `node --check test\worldGeographySeeds.test.js`
- `node --check test\worldGeography.test.js`
- `node --test test\worldGeographySeeds.test.js test\worldGeography.test.js`
- `node --test test\gameTurnWorldGeography.test.js test\prompts.test.js test\stateRules.test.js test\aiSchemas.test.js test\remoteHelpers.test.js`
- `npm run check:docs-governance`
- `git diff --check`
