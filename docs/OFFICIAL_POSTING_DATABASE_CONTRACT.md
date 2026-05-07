# S52 官职、官署、任所与迁转数据库契约

S52 是本地动态世界数据库专项中的官职任所切片。S52.1 先固定官署、官职、任所、城市辖区、考成和迁转记录的 schema/helper；S52.2 再把地方官/入仕官员任所与城市动态指标联动。

本切片仍不新增浏览器官职簿/任所地理面板，不新增 SQLite 业务表，不改变既有 `officialCareerView` route contract，也不让 AI 直接任命、调任、处分或写官职数据库。

## 范围

S52.1 新增运行时契约 helper：`src/game/officialPostingSchemas.js`。

该模块提供：

- `OFFICIAL_POSTING_SCHEMA_VERSION`
- `normalizeOfficialPostingSchemaBundle(input, worldState)`
- `buildOfficialPostingSchemaView(input, worldState)`
- `summarizeOfficialPostingSchemaForPrompt(input, worldState)`
- `canSeeOfficialPostingRow(row, worldState)`

该模块是 future ledger / future SQLite table 的 schema 契约，不会在 S52.1 写入 `worldState`、不接入 `compactWorldState()`、不改变 game/exam route payload、不新增 UI。当前运行时官场仍由 `src/game/officialCareer.js`、`src/game/officialCatalog.js` 和 `officialCareerView` 裁决与展示。

## 顶层 Bundle

```json
{
  "schemaVersion": 1,
  "generatedAtTurn": 0,
  "bureaus": [],
  "offices": [],
  "cityJurisdictions": [],
  "postings": [],
  "assessmentRecords": [],
  "transferRecords": [],
  "recentNotes": []
}
```

限制：

- `bureaus` 最多 48 行。
- `offices` 最多 160 行。
- `cityJurisdictions` 最多 160 行。
- `postings` 最多 256 行。
- `assessmentRecords` 最多 256 行。
- `transferRecords` 最多 160 行。
- 文本会裁剪为短句；数值会 clamp；非法 id、重复 id 和缺少关键字段的行会丢弃。

## 官署与官职目录

`bureaus` 表示静态或半静态官署目录，优先沿用 `officialCatalog.js` 的 `bureau.id`。

核心字段：

- `id`、`name`、`aliases`
- `level`：`court`、`provincial`、`prefecture`、`county`、`frontier`、`temporary`、`academy`、`censorate`、`military`
- `parentBureauId`、`capitalCityId`
- `jurisdictionIds`、`officeIds`
- `duties`、`authorityMetrics`、`riskTags`
- `visibility`、`knownToPlayer`、`intelConfidence`、`publicSummary`、`hiddenNotes`、`lastUpdatedTurn`

`offices` 表示官职目录，优先沿用 `officialCatalog.js` 的 `office.id` 和 `office.title`。S52.1 不要求严格复刻历史品级；当前仍使用游戏化 `rankBand`，后续若需要更细品级可在此契约上扩展。

核心字段：

- `id`、`title`、`aliases`
- `rankLabel`、`rankBand`
- `bureauId`、`track`
- `jurisdictionScope`：`court`、`province`、`prefecture`、`county`、`frontier`、`temporary`、`academy`、`censorate`、`military`
- `typicalCityIds`
- `requiredRankOrExam`
- `appointmentMethods`
- `normalTermMonths`
- `duties`、`authorityMetrics`、`promotionPathIds`、`riskTags`
- `outpost`
- `visibility`、`knownToPlayer`、`intelConfidence`、`publicSummary`、`hiddenNotes`、`lastUpdatedTurn`

## 城市辖区与任所

`cityJurisdictions` 表示官署和城市/区域之间的任所辖区关系。它应引用 S50.2 的 `worldGeography` id，而不是另造地理体系。

核心字段：

- `id`、`name`
- `bureauId`、`supervisingBureauId`
- `cityId`、`regionId`、`countryId`
- `jurisdictionScope`
- `availableOfficeIds`
- `routeIds`、`frontierZoneIds`
- `localMetrics.publicOrder`
- `localMetrics.taxCapacity`
- `localMetrics.lawsuits`
- `localMetrics.waterworks`
- `localMetrics.gentryInfluence`
- `localMetrics.disasterRisk`
- `localMetrics.militaryPressure`
- `localMetrics.academyLevel`
- `visibility`、`knownToPlayer`、`intelConfidence`、`publicSummary`、`hiddenNotes`、`lastUpdatedTurn`

S52.1 只定义这些字段和 projection。S52.2 才把地方官/入仕官员的任所行动与城市钱粮、治安、案牍、水利、士绅和灾荒指标联动。

## 任命、考成与迁转记录

`postings` 表示每局动态任命/官缺记录。它不是 `player.officeTitle` 的替代品，而是后续数据库化时的可索引履历行。

核心字段：

- `id`
- `officeId`、`officeTitle`
- `bureauId`
- `holderType`：`player`、`npc`、`vacant`、`unknown`
- `holderId`
- `status`：`active`、`acting`、`suspended`、`vacant`、`transferred`、`dismissed`、`mourning_leave`、`restoration_pending`
- `cityId`、`regionId`、`jurisdictionId`
- `superiorPostingId`
- `startedAt.year/month/tenDayPeriod/turn`
- `endedAt.year/month/tenDayPeriod/turn`
- `expectedReviewTurn`
- `termMonths`
- `performanceScore`
- `impeachmentRisk`
- `publicReputation`
- `visibility`、`knownToPlayer`、`intelConfidence`、`publicSummary`、`hiddenNotes`、`lastUpdatedTurn`

`assessmentRecords` 表示考成记录，覆盖公开考语、风险分、推荐方向和证据关联。

核心字段：

- `id`
- `postingId`、`officeId`、`bureauId`
- `holderType`、`holderId`
- `cycleId`
- `date.year/month/tenDayPeriod/turn`
- `status`：`draft`、`pending`、`resolved`、`archived`
- `meritScore`
- `riskScore`
- `recommendation`：`none`、`retention`、`promotion`、`transfer`、`outpost`、`demotion`、`impeachment`、`punishment`
- `publicFinding`
- `evidenceEventIds`
- `assignmentIds`
- `visibility`、`knownToPlayer`、`intelConfidence`、`publicSummary`、`hiddenNotes`、`lastUpdatedTurn`

`transferRecords` 表示任命、平调、升迁、外放、降调、处分、丁忧、起复或留任等迁转记录。

核心字段：

- `id`
- `holderType`、`holderId`
- `fromPostingId`、`toPostingId`
- `fromOfficeId`、`toOfficeId`
- `fromCityId`、`toCityId`
- `relatedAssessmentId`
- `date.year/month/tenDayPeriod/turn`
- `type`：`appointment`、`transfer`、`promotion`、`outpost`、`demotion`、`punishment`、`mourning_leave`、`restoration`、`retention`
- `status`：`proposed`、`approved`、`applied`、`rejected`、`cancelled`
- `publicReason`
- `relatedEventIds`
- `visibility`、`knownToPlayer`、`intelConfidence`、`publicSummary`、`hiddenNotes`、`lastUpdatedTurn`

## 可见性

S52.1 沿用人物域和地理域的可见性分层，并为官署同僚视野补充 `office_visible`：

- `public`：公开官署、官名、已发明文或玩家已知事实。
- `role_visible`：非书生身份、官署角色或公文视野可见。
- `office_visible`：与玩家当前官署、当前官职或当前任所相关时可见。
- `relationship_visible`：由师门、同年、上官、同僚、人情或私札得知；必须 `knownToPlayer: true` 才进入 view。
- `rumor`：传闻可见，`intelConfidence` 应低于正式档案。
- `hidden`：服务器可用，prompt/UI 不可见。

`buildOfficialPostingSchemaView()` 会过滤 hidden 行、`hiddenNotes` 和不可见考成/迁转记录。可见行中的嵌套引用也必须裁剪：

- 可见官署不得带出隐藏官职或隐藏辖区 id。
- 可见官职不得带出隐藏官署或隐藏迁转路径 id。
- 可见辖区不得带出隐藏官署或隐藏官职 id。
- 可见任命不得带出隐藏上官任命 id。
- 可见考成/迁转记录不得带出隐藏任命、隐藏官职、隐藏官署或隐藏考成 id。

`summarizeOfficialPostingSchemaForPrompt()` 只能读取 view，并进一步 cap 摘要数量：官署 6 条、官职 8 条、辖区 8 条、任命 8 条、考成 6 条、迁转 6 条。它不返回 `hiddenNotes`、隐藏 id、raw bundle、SQL 表名或本地路径。

## AI 与服务器边界

AI 可以：

- 在叙事中解释可见官署、官职职责、任所地理、公开考成和迁转传闻。
- 通过既有受限 `statePatch.player` 建议官场仪表，例如 `performanceMerit`、`superiorFavor`、`promotionProspect`、`impeachmentRisk`。
- 通过现有 `relationshipChanges[]` 建议既有可见人物/派系关系变化。
- 在未来 proposal 机制中提交 schema-valid 建议，由服务器审查。

AI 不可以：

- 通过普通 `statePatch` 写 `officialPostings`、`postings`、`assessmentRecords`、`transferRecords`、`worldState.officialCareer` 或 `player.officeTitle`。
- 直接任命、罢免、升迁、外放、处分、丁忧、起复或公开 hidden notes。
- 直接裁决城市财政、治安、水利、案牍、士绅关系、战争胜负、科举晋级或 SQL/table row 写入。
- 读取或输出 `hiddenNotes`、本地路径、provider key、raw prompt 或完整 raw ledger。

S52.1 已把 future `officialPostings` 作为 server-owned patch key 纳入边界测试：普通 provider payload 中夹带 `statePatch.officialPostings` 会被 AI schema 拒绝；remote normalization 和 provider long-run 会把它视为越权；普通 `applyStatePatch()` 不会覆盖服务器已有的 `worldState.officialPostings`。

## 与旧系统的关系

当前运行时仍使用：

- `src/game/officialCatalog.js`：静态官署/官职目录。
- `src/game/officialCareer.js`：服务器拥有的官场差遣、考成卷宗、弹劾流程、履历和任免结算。
- `officialCareerView`：浏览器官场面板的唯一数据来源。
- `worldGeographyView`：后续任所地理面板的地理 projection。
- `worldPeopleView`：后续人物谱牒/官场关系面板的人物 projection。

S52.1 不替换这些字段和视图，只把未来 `officialPostings` / SQLite `office_postings` 可用的数据形状固定下来。后续 S52.2 若写 per-session posting ledger，必须继续保留：

- 完整 `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official` 路径。
- `player.officeTitle`、`officialCareer.currentPosting`、新增 `officeId/currentPostingId` 的一致性。
- `officialCareerView` 的现有 browser contract。
- 默认 JSON + Mock 可玩。
- AI 不写数据库、不直接任免、不公开 hidden records。

## 验证

S52.1 focused 验证：

```powershell
node --check src\game\officialPostingSchemas.js
node --check test\officialPostingSchemas.test.js
node --test test\officialPostingSchemas.test.js test\stateRules.test.js test\aiSchemas.test.js test\remoteHelpers.test.js test\providerLongRunScript.test.js test\aiControlRedTeam.test.js
```

提交前还应跑相关官场/地理/人物测试、治理检查、Mock 全量测试和 `git diff --check`。
