# 天下地理静态种子契约

S50.1 新增 `src/game/worldGeographySeeds.js`，为后续国家、城市、路线、边境和官署辖区数据库化提供静态种子。它是 catalog，不是每局动态状态表；本步骤不创建 SQLite 业务表，不写 `worldState.worldGeography`，不接 prompt，也不新增浏览器面板。

## 目标

- 先固定天下格局的静态名称和引用关系，避免 S50.2 实例化动态国家/城市时临时拼接字符串。
- 给本国、邻国、首都、省府州县、驿路/漕河/关隘、边境压力面和官署辖区统一 id。
- 从第一步就标注初始可见性：玩家公开可知、身份可见、传闻可见和隐藏。
- 保持 AI/server 边界：模型不能直接写国家、城市、路线、边境或官署辖区；未来只能读取服务器过滤后的 projection。

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

`buildWorldGeographySeedView()` 只返回非 hidden 行，并移除所有 `hiddenNotes`。它目前不由路由调用；S50.2 若要接入 prompt 或 session projection，必须继续只读这个过滤结果或更严格的角色视野 projection。

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

## AI 与服务器边界

- S50.1 不把地理种子放入 `worldState`，所以普通 provider 暂时没有 `statePatch.worldGeography` 可写入口。
- 未来 S50.2 若新增 `worldState.worldGeography` 或 prompt projection，必须同步更新 schema/stateRules/prompt tests，确认 provider 不能写该 server-owned ledger。
- AI 可以在收到可见 projection 后解释“山海关边报”“漕运阻滞”“江南钱粮”等公开事实，但不能裁决战争、外交、城市指标、官署任免或隐藏情报公开。
- 隐藏路线、隐藏边境、`hiddenNotes`、本地路径、审计 payload 和 provider 配置不得进入 prompt、route view 或浏览器。

## 后续边界

S50.2 应在这个静态 catalog 之上做每局实例化：

- 给每个 session 建立动态国家/城市行或 `worldState` 子树。
- 构造 capped 的玩家可见地理 projection。
- 让 prompt 只读取与当前身份、地点、世界议题和玩家输入有关的国家/城市/边境。
- 仍不替代现有 `treasury`、`grainReserve`、`publicOrder`、`borderThreat` 等顶层指标，直到后续迁移明确完成。

S53 再考虑浏览器“天下格局”“任所地理”等信息面板。

## 验证要求

- `node --check src\game\worldGeographySeeds.js`
- `node --check test\worldGeographySeeds.test.js`
- `node --test test\worldGeographySeeds.test.js`
- `npm run check:docs-governance`
- `git diff --check`
