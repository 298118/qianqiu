# S51 人物、家族、资产、田产与关系 Schema / 桥接契约

S51 是本地动态世界数据库专项的人物域切片。S51.1 先固定 NPC、家族、资产、田产、关系与可见性 schema；S51.2 在此基础上桥接当前 `characters`、`relationshipLedger` 和可见 `activeNpcRequest`。

本切片仍不新增浏览器人物/家产面板，不新增 SQLite 业务表，不替换旧 `relationshipView` / `activeNpcRequestView`，也不让 AI 直接创建人物或改写家产。S51.2 新增的 `worldState.worldPeople` 是当前可见旧系统数据的安全 projection，不是隐藏人物私档总库。

## 范围

S51.1 新增运行时契约 helper：`src/game/worldPeopleSchemas.js`。

该模块只提供：

- `WORLD_PEOPLE_SCHEMA_VERSION`
- `normalizeWorldPeopleSchemaBundle(input, worldState)`
- `buildWorldPeopleSchemaView(input, worldState)`
- `summarizeWorldPeopleSchemaForPrompt(input, worldState)`
- `canSeeWorldPeopleRow(row, worldState)`

S51.2 新增 `src/game/worldPeople.js`，提供：

- `createInitialWorldPeopleState(worldState)`
- `normalizeWorldPeopleState(worldState)`
- `ensureWorldPeopleState(worldState)`
- `buildWorldPeopleView(worldState)`
- `summarizeWorldPeopleForPrompt(worldState)`

该模块从旧 `characters[]`、`relationshipLedger.characters`、`relationshipLedger.factions` 和 `buildActiveNpcRequestView()` 派生安全桥接行。它会写入每局 `worldState.worldPeople`，但只保存当前角色可见 projection：hidden legacy 目标、自定义 hidden worldPeople 行、`hiddenNotes` 和 `hiddenIntent` 不进入 raw `worldState.worldPeople`，因为现有本地 route 仍随 payload 返回完整 `worldState`。

## 顶层 Bundle

```json
{
  "schemaVersion": 1,
  "generatedAtTurn": 0,
  "npcs": [],
  "households": [],
  "assets": [],
  "estates": [],
  "relationships": [],
  "recentNotes": []
}
```

限制：

- `npcs` 最多 128 行。
- `households` 最多 64 行。
- `assets` 最多 128 行。
- `estates` 最多 128 行。
- `relationships` 最多 256 行。
- 文本会裁剪为短句；数值会 clamp；非法 id、重复 id 和缺少关键字段的行会丢弃。

## NPC 行

NPC 是未来人物表的主行，覆盖现有 `characters[]` 不能承载的家世、官署、资产和风险信息。

核心字段：

- 身份：`id`、`name`、`courtesyName`、`genderLabel`、`age`、`alive`
- 地理：`homeCityId`、`currentCityId`
- 家族：`householdId`、`family.fatherId`、`family.motherId`、`family.spouseIds`、`family.childrenIds`、`family.marriageAllianceTags`
- 官场：`currentOfficeId`、`currentPostingId`、`rankLabel`、`bureauId`、`factionId`
- 能力：`skills.literarySkill`、`skills.administration`、`skills.legalJudgment`、`skills.militaryCommand`、`skills.diplomacy`、`skills.learning`
- 性情：`temperament.ambition`、`temperament.loyalty`、`temperament.integrity`、`temperament.caution`、`temperament.temper`
- 社会资本：`reputation`、`influence`、`patronagePower`、`peerNetwork`
- 经济：`wealthCash`、`landMu`、`debts`、`annualIncomeEstimate`、`assetIds`、`estateIds`
- 风险：`health`、`legalRisk`、`impeachmentRisk`、`resentmentRisk`
- 信息：`visibility`、`knownToPlayer`、`intelConfidence`、`publicSummary`、`hiddenIntent`、`hiddenNotes`、`lastUpdatedTurn`

能力、性情、社会资本和风险指标均为 `0..100`；`wealthCash`、`landMu`、`debts`、`annualIncomeEstimate` 为非负整数。`hiddenIntent` 与 `hiddenNotes` 只可保留在 raw bundle / future ledger，不得进入 view 或 prompt summary。

## 家族、资产与田产行

`households` 表示家族/户。它不是 NPC 的重复字段，而是多个 NPC、田产、资产和婚姻网络的共同归属。

核心字段：

- `id`、`familyName`、`seatCityId`
- `wealthScore`、`landMu`、`prestige`、`gentryRank`
- `marriageNetworkScore`、`debtPressure`、`politicalAlignment`、`familyRisk`
- `memberNpcIds`、`estateIds`、`assetIds`
- `visibility`、`knownToPlayer`、`intelConfidence`、`publicSummary`、`hiddenNotes`、`lastUpdatedTurn`

`assets` 表示非田产资产，如现金、铺面、矿山、仓储、债务、俸禄或经营权益。`kind` 允许 `cash`、`shop`、`mine`、`granary`、`debt`、`stipend`、`business`、`other`。资产必须有 `ownerType` 和 `ownerId`；当 owner 是隐藏 NPC 或隐藏家族时，资产 view 不得泄漏。

`estates` 表示田产或庄田。核心字段包括 `ownerType`、`ownerId`、`cityId`、`regionId`、`landMu`、`tenantHouseholds`、`rentGrainEstimate`、`taxBurden`、`waterworks`、`disputeRisk`、`status`。`status` 允许 `held`、`leased`、`disputed`、`mortgaged`、`lost`、`unknown`。

## 关系行

未来关系表不只连接玩家和 NPC，也可以连接 NPC、家族、派系、衙门、官职、城市、国家、资产和田产。

核心字段：

- `id`
- `sourceType` / `sourceId`
- `targetType` / `targetId`
- `relationship`
- `trust`
- `resentment`
- `obligation`
- `patronage`
- `fear`
- `rivalry`
- `stance`
- `recentIntent`
- `recentNotes`
- `visibility`、`knownToPlayer`、`intelConfidence`、`publicSummary`、`hiddenNotes`、`lastUpdatedTurn`

`sourceType` / `targetType` 允许：`player`、`npc`、`household`、`faction`、`bureau`、`office`、`city`、`country`、`estate`、`asset`。

`relationship`、`obligation`、`patronage` 为 `-100..100`；`trust`、`resentment`、`fear`、`rivalry` 为 `0..100`。AI 仍不能直接写关系表；当前普通回合的合法路径仍是顶层 `relationshipChanges[]`，且只针对既有可见 `character` / `faction` ledger 目标。S51.2 若扩展到新关系表，必须保留 delta、可见目标、clamp 和服务器裁决。

## 可见性

S51.1 统一人物域可见性枚举：

- `public`：公开身份、奏报、族谱或玩家已知事实。
- `role_visible`：只有非书生身份、官署角色或已知关系可合理看到。
- `relationship_visible`：通过师门、同年、人情、私信或亲族关系得知；必须 `knownToPlayer: true` 才进入 view。
- `rumor`：传闻可见，`intelConfidence` 应低于正式档案。
- `hidden`：服务器可用，prompt/UI 不可见。

`buildWorldPeopleSchemaView()` 会过滤 hidden 行、`hiddenNotes`、`hiddenIntent` 和不可见关系。可见行中的嵌套引用也必须裁剪：

- 可见 NPC 不得带出隐藏家族、隐藏资产、隐藏田产、隐藏父母/配偶/子女 id。
- 可见家族不得带出隐藏成员、隐藏资产或隐藏田产 id。
- 资产/田产 owner 是隐藏 NPC 或隐藏家族时，该资产/田产不进入 view。
- 关系两端若指向隐藏 NPC、隐藏家族、隐藏资产或隐藏田产，该关系不进入 view。

`summarizeWorldPeopleSchemaForPrompt()` 只能读取 view，并进一步 cap 摘要数量：NPC 8 条、家族 6 条、资产 6 条、田产 6 条、关系 10 条。关系摘要可以携带 capped 可见 `recentNotes`，用于把 active request 近期札记交给 prompt；它不返回 `hiddenNotes`、`hiddenIntent`、隐藏 id 或 raw bundle。

## AI 与服务器边界

AI 可以：

- 在叙事中解释可见人物、家族、人情、田产纠纷或资产压力。
- 通过现有 `relationshipChanges[]` 建议既有可见关系的有限变化。
- 在未来 proposal 机制中提交 schema-valid 建议，由服务器审查。

AI 不可以：

- 通过普通 `statePatch` 写 `worldPeople`、`npcs`、`households`、`assets`、`estates` 或 `relationships`。
- 新造隐藏联系人、公开隐藏家产、直接改 NPC 财富/田亩/债务。
- 决定官职任免、科举晋级、家产归属裁判、田产诉讼结局或 SQL/table row 写入。
- 读取或输出 `hiddenIntent`、`hiddenNotes`、本地路径、provider key 或完整 raw prompt。

S51.2 的测试已锁定：普通 provider payload 中夹带 `statePatch.worldPeople` 会被 AI schema 拒绝；即使非 schema 路径调用 `applyStatePatch()`，也不会覆盖服务器拥有的 `worldState.worldPeople`。Remote normalization、provider long-run、route red-team 和审计脱敏也覆盖 `worldPeople` 越权。

## 与旧系统的关系

当前运行时仍使用：

- `worldState.characters[]`：薄人物列表。
- `worldState.relationshipLedger`：服务器拥有的关系记忆。
- `worldState.activeNpcRequest`：服务器调度的单条主动请托。
- `player.gold`、`player.localTreasury` 等分散资产字段。

S51.2 不替换这些字段，只在本契约之上做桥接：

- 从 `characters[]` 和 `relationshipLedger.characters` 派生可见 NPC 行，NPC id 沿用旧 `C01` 这类 id。
- 从 `relationshipLedger.characters` / `relationshipLedger.factions` 派生 `player -> npc/faction` 关系行；hidden legacy 目标不写入 `worldPeople`。
- 从 `buildActiveNpcRequestView()` 读取可见请求，把“当前请托”写入对应关系的 `recentNotes`；请求调度、回应和过期仍由 `src/game/activeRequests.js` 裁决。
- 游戏、SSE 和考试 route 额外返回 `worldPeopleView`；`compactWorldState()` 额外放入 capped `worldPeople` prompt summary。
- 仍保留旧字段，直到浏览器 UI、存档迁移和未来 SQLite 业务表都有对应测试。

## 验证

S51 focused 验证：

```powershell
node --check src\game\worldPeopleSchemas.js
node --check src\game\worldPeople.js
node --check test\worldPeopleSchemas.test.js
node --check test\worldPeopleBridge.test.js
node --test test\worldPeopleSchemas.test.js test\worldPeopleBridge.test.js
```

提交前还应跑相关边界测试、治理检查、Mock 全量测试和 `git diff --check`。
