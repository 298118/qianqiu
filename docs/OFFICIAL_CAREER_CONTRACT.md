# Official Career Outcome Contract

S42.1 adds the deep official-career domain contract on top of the S34 outcome
engine. S42.2 implements the first runtime slice: static offices/bureaus,
server-owned assignments, assessment dossiers, impeachment procedure state,
official-career v2 normalization, Mock action classification, and provider
office-forgery filtering. S42.3 renders that server-built view in the browser
and extends smoke coverage for direct official starts, post-palace officials,
assignments, assessment/risk hints, hidden-note non-leakage, and desktop/mobile
overflow.

S34 defines the server-owned official career outcome engine. It turns the post-palace official loop from meter movement into concrete career results: appointment, transfer, promotion, external posting, demotion, impeachment case, punishment, or retention.

S52.1 adds [官职、官署、任所与迁转数据库契约](OFFICIAL_POSTING_DATABASE_CONTRACT.md) and `src/game/officialPostingSchemas.js` as the database-domain schema for `bureaus`、`offices`、`cityJurisdictions`、`postings`、`assessmentRecords` and `transferRecords`. S52.2 adds `src/game/officialPostings.js` as a visible projection bridge from the official catalog, current career state, magistrate role state, and visible city/jurisdiction data into `worldState.officialPostings`、`officialPostingsView` and prompt context. S56.1 records the future SQLite `office_*` table contract in the same document, but does not create runtime tables or change route payloads. It does not replace this runtime contract, does not change `officialCareerView`, and does not let ordinary providers write `officialPostings`; actual appointments, transfers, assessments and punishments remain server-owned here.

S88.4 adds the first-month official experience loop on top of this contract.
`officialCareerView.firstMonthExperience` and `officialCareerView.courtEntry`
are server-derived public projections from the first-month assignment. Topic
surfaces and `topic_draft` may cite those projections only as draft evidence.
When the player later submits “入奏折队列 / 付朝议筹议 / 续记考成” through the
ordinary turn flow, `runOfficialCareerStep()` records a server-owned
`courtEntryResolutions` entry and exposes the latest public result through
`officialCareerView.courtEntry.latestResolution`, monthly briefing, and event
archive. These records may make bounded progress/assessment adjustments, but
they do not directly appoint, punish, impeach, or finalize long-term career
outcomes.

## S42.1 深度官场契约

目标：入仕后不再只是六项仪表变化和偶发升降，而是进入有官职、衙门、差遣、考成、人脉、政敌、弹劾、外放、处分和履历档案的长期生涯。S42.1 定义契约；S42.2 已实现字段、规则和 Mock 行动扩展；S42.3 已扩展浏览器 UI 与验收。

### 保留的不变量

- 完整主线仍由服务器保护：`scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`。
- 殿试入仕仍由 `src/game/promotions.js` 裁决，写入 `player.role = "official"`、`player.palaceRank`、`player.officeTitle` 和官场初始仪表。
- 直接 `official` 开局继续允许，首个官场回合可由服务器实授初职。
- Provider 普通回合仍不能写 `worldState.officialCareer`、`player.role`、`player.roleLabel`、`player.officeTitle`、`player.examRank`、`player.palaceRank` 或 `player.examHistory`。
- AI 可以生成叙事、来函、奏疏口吻、关系态度和受限 `statePatch.player` 仪表变化；服务器决定官职任免、差事归档、考成结算、弹劾成案、处分、存档和玩家可见性。
- S42.2 已将 `worldState.officialCareer.schemaVersion` 升至 `2`，通过 feature-level 归一化兼容旧 v1 存档；不需要提升 JSON storage envelope 版本。

### 官职、职名与位置

S42 后续实现必须区分三个概念：

- `player.officeTitle`：服务器拥有的实授官职或候勘身份，例如 `翰林院庶吉士`、`户部主事`、`苏州府推官`、`候勘官员`。普通 provider 不能写。
- `player.position`：玩家身份姿态或叙事位置，允许作为软描述，例如 `候选观政`、`署中办事`、`革职闲居`。后续若继续允许 provider patch，应过滤明显官职伪造，UI 不能把它当作任免裁决。
- `worldState.officialCareer.currentPosting`：服务器归一化后的当前官场履历位置，应优先镜像 `officeTitle`，在无官或候勘时记录 `候选观政`、`候勘官员` 或 `革职闲居` 等状态。

S42.2 新增 `src/game/officialCatalog.js` 作为轻量官职目录，避免把更多中文官名散落在规则里。目录项包含：

```json
{
  "id": "ministry_revenue_principal",
  "title": "户部主事",
  "rankBand": "low_central",
  "bureauId": "ministry_revenue",
  "track": "central_ministry",
  "jurisdiction": "京师",
  "duties": ["钱粮", "仓场", "奏销"],
  "eligibleFrom": ["六部观政进士", "翰林院庶吉士"],
  "outpost": false
}
```

`rankBand` 是游戏用轻量分层，不要求严格品级复刻；历史精确品级可在后续资料表中补充，但服务器规则先按分层、衙门和职责判断可玩后果。

### 衙门与部院

官场深度优先覆盖这些衙门抽象：

| `bureauId` | 玩家可见名 | 核心职责 | 常见差遣 |
| --- | --- | --- | --- |
| `hanlin_academy` | 翰林院 | 制诰、修史、经筵、馆阁清望 | 文书修撰、经筵讲章、科场监临 |
| `ministry_personnel` | 吏部 | 铨选、考成、升降、官缺 | 考成复核、官缺议拟、荐举查核 |
| `ministry_revenue` | 户部 | 钱粮、仓场、税赋、漕运 | 赈银核销、清丈、仓场查账、盐漕核算 |
| `ministry_rites` | 礼部 | 科举、礼制、学校 | 科场监临、典礼文案、学政奏报 |
| `ministry_war` | 兵部 | 军务、驿传、边报 | 军需核算、边饷催解、战报勘验 |
| `ministry_justice` | 刑部 | 案牍、复核、刑名 | 大案复核、疑狱平反、问拟覆奏 |
| `ministry_works` | 工部 | 河工、营缮、军器 | 河工督修、物料核价、城工验收 |
| `censorate` | 都察院 | 纠劾、巡按、风宪 | 弹章核实、巡按查访、贪墨线索 |
| `provincial_admin` | 布政司 | 地方钱粮与行政 | 府州钱粮、灾荒赈务、地方考成 |
| `provincial_judicial` | 按察司 | 地方案牍与监察 | 盗案审转、狱讼复核、官吏查参 |
| `prefecture_county` | 府州县 | 民政、税粮、治安、水利 | 断案平讼、劝农抚民、清丈修渠 |

S42.2 使用静态 JS 目录，不引入新依赖。AI prompt 读取的是玩家可见摘要，不能读取隐藏弹劾线索、未公开政敌意图或未来考成结果。

### 差遣与考成

差遣是 S42 深度官场的主要长期目标。S42.2 已将字段落在 `worldState.officialCareer.assignments`，由服务器创建、归一化、推进和归档。差遣条目包含：

- `id`
- `title`
- `kind`：`relief`、`land_survey`、`case_review`、`riverworks`、`military_supply`、`salt_transport`、`exam_supervision`、`memorial_drafting`、`audit`、`personnel_review`
- `bureauId`
- `sourceType` 与 `sourceId`：上官、衙门、同年、言官或地方来文
- `status`：`active`、`submitted`、`resolved`、`expired`、`failed`
- `year`、`month`、`dueTurn`、`deadlineUnit`：S48.5 后 `dueTurn` 仍存绝对 turn，归一化后的单位为 `deadlineUnit: "ten_day"`；默认差遣/弹劾期限按月份语义通过 `monthsToTurns()` 换算，玩家视图显示“尚余 X 旬（约 Y 月）”。缺少 `deadlineUnit` 的旧差遣/弹劾期限按 S48 前“一回合一月”语义一次性换算，避免旧档期限突然缩短。
- `progress`、`risk`、`publicStake`、`privatePressure`
- `visibleSummary`
- `hiddenNotes`：仅服务器和开发诊断可见，不能进入普通 prompt/UI
- `relatedContacts`、`relatedFactions`
- `resolution`：服务器结算后的功过、世界影响、人脉后果和是否形成 S43 World Thread

考成不应是单次升迁按钮。S42.2 已建立可解释的考成卷宗，至少综合：

- 当前官职和衙门职责是否匹配玩家行动。
- 差遣完成度、逾期、风险压低或扩大。
- `performanceMerit`、`superiorFavor`、`peerNetwork`、`cleanReputation`、`impeachmentRisk`、`integrity`。
- 世界指标变化，例如钱粮、民心、腐败、边患、地方治安。
- 可见关系账本中上官、士大夫、言官或地方士绅的态度。

服务器仍通过 `runOfficialCareerStep()` 或其 S42 后继统一裁决升降。AI 只能解释“为何上官这样看你”或生成“考成材料的文气”，不能给出 canonical 任命结果。

### 关系网络

官场网络应复用 `relationshipLedger` 的可见性规则，再通过官场 view 做领域化摘要。S42.2 不应另建一套绕过隐藏过滤的关系系统。

推荐关系标签：

- `superior`：直属上官。
- `same_year`：同年、同榜或馆阁同僚。
- `patron`：座主、房师、保举者。
- `student`：门生、被荐后进。
- `rival`：政敌、竞争官缺者。
- `censor`：言官、巡按、纠劾线。
- `local_gentry`：地方士绅、粮户、书院人物。
- `inner_court_hint`：内廷或近侍线索，只能在角色可知时显示。

AI 可生成来函、态度、请托与传闻；服务器决定关系是否存在、是否可见、数值变化是否 clamp、隐藏条目是否进入 prompt。任何“某政敌已密谋弹劾你”这类未公开信息必须以隐藏条目保存，普通玩家 UI 和普通 prompt 只能看到传闻级摘要。

### 弹劾与处分流程

S34 已有 `impeachment` 与 `punishment` 结果。S42.2 已把弹劾扩为流程，而不是一次性改职：

1. `risk_watch`：风险抬头，出现传闻、怨望或账目疑点。
2. `memorial_filed`：言官或政敌递弹章，玩家可见来源可能是公文、传闻或上官暗示。
3. `audit_open`：查账、问拟、候勘或巡按复核，差遣和人脉会影响风险。
4. `discipline_pending`：部议或廷推未定，`currentPosting` 可为 `候勘官员`。
5. `resolved`：留任、转任、降调、外放、罚俸、罢黜、起复或其他后果。

AI 可以生成弹章文字、流言氛围和人物反应；服务器决定流程阶段、证据是否成立、处分类型和履历记录。严重贪墨或作伪不得由 AI 直接判死局，必须经过服务器边界、数值阈值和可测试规则。

### 廷推、调任、外放、丁忧与起复

S42.2 可以先把这些作为履历结果或差遣后果，而不是完整政治制度模拟：

- `court_nomination`：廷推或部议推荐，提升 `promotionProspect`，但不直接授官。
- `transfer`：平调到同层级不同衙门，强调职责变化。
- `outpost`：外放府州县或按察/布政司属官，连接地方事务与 S43 世界议程。
- `mourning_leave`：丁忧，暂停官场考成，保留部分关系；是否起复由服务器后续裁决。
- `restoration`：起复或复官，必须解释前因、关系担保和风险残留。

这些结果如果进入 `careerHistory`，应保留 `type`、`label`、`officeTitleBefore`、`officeTitleAfter`、`reason`，并在 S42.2 追加必要的 `bureauId`、`assignmentId` 或 `procedureId` 时保持旧记录兼容。

### Browser view 契约

S42.3 前端只消费服务器构造的 view，不扫描 raw `worldState.officialCareer.hiddenNotes` 或 provider 文本。`officialCareerView` 的核心形态：

```json
{
  "active": true,
  "currentPosting": "户部主事",
  "bureau": { "id": "ministry_revenue", "name": "户部", "duties": ["钱粮", "仓场"] },
  "assignmentSummary": { "activeCount": 1, "urgentCount": 1, "latestTitle": "赈银核销" },
  "assessment": { "meritScore": 62, "riskScore": 34, "nextReviewInMonths": 5 },
  "networkSummary": { "superiors": 1, "sameYears": 2, "rivals": 1, "hiddenNotice": true },
  "procedureSummary": { "impeachmentStage": "risk_watch", "visibleNotice": "台谏风闻未定", "deadlineLabel": "第13回，尚余12旬（约4月）" },
  "recentOutcomes": []
}
```

玩家可扫描的面板目标是“官署/差事/履历/关系/风险”。S42.3 已在 `#official-career-panel` 内渲染官署、差事、考成、关系与风险、履历档案区块，并提供稳定 DOM selector 或 `data-*` 属性供 browser smoke 验收。隐藏信息只显示为“另有未明”“风闻未定”等摘要。

### Prompt 与 AI 控制

`official_career` prompt pack 读取的官场上下文应来自服务器摘要，例如 `summarizeOfficialCareerForPrompt()` 的后继版本。稳定前缀继续放在动态官场摘要之前，以兼容 DeepSeek 缓存规划。Prompt 只能要求 AI：

- 生成符合时代的叙事、公文、私札、传闻或人物反馈。
- 建议受限关系变化和受限 `player` 仪表变化。
- 解释差遣利害、上官态度和风险来源。

Prompt 不得要求 AI：

- 任命、罢免、授予具体新官职。
- 改写 `officialCareer`、`officeTitle`、`role`、`examRank`、`examHistory`。
- 公开隐藏政敌、内廷线索或未公开弹章。
- 裁决考成、廷推、处分或起复最终结果。

### S42.2 与 S42.3 验收边界

S42.2 实现时至少验证：

- 旧 v1 `officialCareer` 存档可归一化。
- Provider 越权写官职、差事、弹劾流程、隐藏关系会被拒绝或过滤。
- Mock 官方行动能推进差遣/考成/人脉/弹劾风险，但官职变化仍由服务器结算。
- 直接 `official` 开局和完整科举入仕路径都仍可用。
- 惩罚、革职或候勘不破坏科举履历和存档读取。

S42.3 已验证：

- `officialCareerView` 或新增官场 view 不泄漏隐藏字段。
- 官署/差事/履历/关系/风险面板在桌面和移动端不横向溢出。
- 浏览器 smoke 覆盖直接 official 开局、入仕后至少两回合、一个差遣、一次考成或风险提示。
- 真实 provider 验收可跳过无 key，Mock 默认仍完整可玩。

## Authority Boundary

Ordinary AI/provider turns may still update bounded official career meters through `statePatch.player`:

- `superiorFavor`
- `peerNetwork`
- `performanceMerit`
- `promotionProspect`
- `impeachmentRisk`
- `cleanReputation`
- other already-whitelisted non-title player/world meters

Providers must not directly write:

- `worldState.officialCareer`
- `player.role`
- `player.roleLabel`
- `player.officeTitle`
- `player.examRank`
- `player.palaceRank`
- `player.examHistory`

The route applies ordinary provider patches through the provider-facing whitelist. The official outcome engine then runs as a server follow-up and applies title/role/career-history changes with `{ incrementTurnCount: false, allowServerOwnedPatchKeys: true }`.

S42.2 filters ordinary provider `player.position` patches while the player is an official: obvious office titles or catalog-recognized appointments are ignored, while soft posture/location descriptions can still pass through the existing clamp/whitelist path. S52.2 extends that same obvious-office-title guard to `magistrate` starts so local-official soft position text cannot become a hidden appointment channel or mislead the official-posting bridge.

## Persisted State

`worldState.officialCareer` is server-owned:

```json
{
  "schemaVersion": 2,
  "tenureMonths": 0,
  "reviewCycleMonths": 12,
  "lastReviewTurn": null,
  "lastReviewYear": null,
  "currentPosting": "未授",
  "bureauId": null,
  "careerHistory": [],
  "pendingOutcome": null,
  "cooldowns": {},
  "cooldownUnit": "ten_day",
  "assignments": [],
  "assessmentDossier": {
    "cycleId": "1644-career",
    "meritScore": 0,
    "riskScore": 0,
    "lastUpdatedTurn": null,
    "notes": [],
    "pendingRecommendation": null
  },
  "impeachmentProcedure": {
    "stage": "none",
    "sourceType": null,
    "sourceId": null,
    "openedTurn": null,
    "dueTurn": null,
    "deadlineUnit": "ten_day",
    "risk": 0,
    "visibleNotice": "",
    "hiddenNotes": [],
    "lastUpdatedTurn": null
  }
}
```

`careerHistory` is capped to the latest 8 records. Each resolved record contains:

- `id`
- `type`
- `label`
- `status`
- `year`
- `month`
- `tenDayPeriod`
- `turn`
- `officeTitleBefore`
- `officeTitleAfter`
- `reason`

Supported `type` values are `appointment`, `transfer`, `promotion`, `outpost`, `demotion`, `impeachment`, `punishment`, and `retention`.

## Route Order

`POST /api/game/turn` now resolves in this order:

1. Provider turn output.
2. Provider-facing `applyStatePatch()`.
3. Provider relationship suggestions through `applyRelationshipChanges()`.
4. Exam trigger setup.
5. Active NPC request handling.
6. Monthly world tick.
7. Long-term event scheduler.
8. Official career action/outcome engine.
9. Event history append in provider -> active request -> world tick -> long-term event -> official career order.
10. Session persistence.

Game and exam routes return top-level `officialCareerView`. Turn routes also return `officialCareer: { summary, events, attributeChanges, outcome }`. The turn route passes player input into `runOfficialCareerStep()`, so official actions can create or advance server-owned assignments, assessment dossier notes, and impeachment procedure stages before any settlement outcome is considered.

SSE `state_preview` and `final_state` include the same official career fields. Browser UI renders turn feedback as `[官场结算]` narrative lines.

## Settlement Rules

The engine runs only while `player.role === "official"`.

Under S48, `officialCareer.tenureMonths` advances only on `worldTick.completedMonth`, so three ordinary ten-day turns equal one official month. S42.2 first classifies Mock/player text for official-domain actions such as relief, land survey, case review, riverworks, military supply, salt transport, exam supervision, memorial drafting, personnel review, transfer request, outpost request, mourning leave, restoration, or impeachment/audit. Matching actions update `assignments`, `assessmentDossier`, and `impeachmentProcedure`; canonical office changes still happen only through the settlement rules below. First appointment and per-action差事 feedback may still happen on an ordinary turn, but review-cycle month accounting waits for month end. It may settle when:

- the player has no `officeTitle`, causing first real appointment;
- impeachment risk is severe enough for immediate review;
- promotion momentum, merit, and superior favor are high enough for accelerated review;
- the review cycle reaches 12 official months;
- the post-tick calendar reaches a new year and the current year has not been reviewed.

Inputs include official meters, assignment progress/risk, assessment dossier scores, impeachment procedure risk, public corruption, and visible relationship ledger scores for the superior/contact and scholar-official faction. The model can influence bounded meters and narrative, but the server chooses the actual career result.

## Outcomes

- `appointment`: grants a first concrete office such as `六部观政进士`.
- `promotion`: advances the official posting ladder and resets part of promotion momentum.
- `transfer`: moves to another central office without a full rank rise.
- `outpost`: sends the player to an external/local post while keeping the broad official role.
- `demotion`: lowers title/influence after poor merit or favor.
- `impeachment`: marks a formal impeachment case and sharply reduces promotion prospects.
- `punishment`: severe scandal can remove the player from office and return role display to `书生`.
- `retention`: records a review with no title change.

Relationship consequences are returned as bounded suggestions and merged through `applyRelationshipChanges()`. The official engine does not mutate the raw relationship ledger directly.

## Browser Contract

The browser consumes `officialCareerView`, not raw provider text. It renders `#official-career-panel` only when the player is an official. S48.6 displays career-history dates as 年月旬 by reading each outcome's `tenDayPeriod`; legacy records without that field normalize to 上旬. Stable selectors include:

- `#official-career-panel[data-current-posting][data-pending-review][data-impeachment-stage]`
- `.official-career-bureau[data-bureau-id]`
- `.official-career-bureau-duty`
- `.official-career-assignment-summary`
- `.official-career-assignment[data-assignment-id][data-assignment-kind][data-assignment-status][data-bureau-id]`
- `.official-career-assignment-progress`
- `.official-career-assignment-risk`
- `.official-career-assessment[data-pending-recommendation]`
- `.official-career-assessment-note`
- `.official-career-network`
- `.official-career-procedure[data-impeachment-stage]`
- `.official-career-current`
- `.official-career-history`
- `.official-career-outcome`
- `data-outcome-id`
- `data-outcome-type`
- `data-outcome-status`
- `data-office-title`
- `data-outcome-turn`

S42.3 browser smoke checks direct official start, deterministic first appointment, post-palace official state, one `relief` assignment from a Mock official action, assessment/network/procedure blocks, hidden text token non-leakage, current-outcome marking, screenshot capture, and horizontal overflow across desktop/mobile official panels.

## Verification

Focused coverage:

- `test/officialCareer.test.js`
- `test/officialCatalog.test.js`
- `test/gameTurnOfficialCareer.test.js`
- `test/officialRole.test.js`
- `test/browserSmokeScript.test.js`

Full S34 verification should include:

```powershell
node --check src\game\officialCareer.js
node --check src\routes\game.js
node --check src\routes\exam.js
node --check public\app.js
node --check scripts\browserSmoke.js
node --test test\officialCareer.test.js test\gameTurnOfficialCareer.test.js test\officialRole.test.js
npm test
npm run smoke:browser -- --screenshots artifacts/browser-smoke/s34
git diff --check
```
