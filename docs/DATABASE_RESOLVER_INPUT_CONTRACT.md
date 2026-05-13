# S71 数据库 Resolver 输入契约

本文是 S71.0 的正式契约，约束后续 `resolverInputContext` 以及财政、城市政策、刑名、军务外交、压力事件、多 actor 场景、NPC 记忆和 AI 调动审计面板的数据库输入边界。

当前步骤只定义契约和接入点，不改运行时代码、API、存档格式、SQLite schema 或 provider 行为。S71 仍只考虑本机 JSON/SQLite；不引入远程存档、账号体系、多人同步、云同步或托管数据库。

## 1. 目标与非目标

目标：

- 把 S49-S67 已有安全 projection 固定为服务器玩法 resolver 的只读输入。
- 为 S71.1 的 `src/game/resolverInputContext.js` 和 `test/resolverInputContext.test.js` 明确字段、来源、禁止源和验收矩阵。
- 让 JSON adapter 与 SQLite adapter 在 player-facing / resolver-facing 输入上保持 parity。
- 固定 AI 边界：AI 只能读取 actor 可见摘要、提交 proposal 或 request-adjudication；数据库写入、状态写入、事件成案和审计仍由服务器 resolver 裁决。
- 为 S71.4 redacted player API 预留边界：真正 hidden 私档、资产真数、隐藏动机、未公开任免、密档事件链和隐藏情报真值不得回填普通 state route。

非目标：

- 不新增 SQL migration、FTS、安全搜索、redacted API 或维护命令；这些分别留给 S71.2-S71.4。
- 不实现财政、刑名、军务外交或事件成案 resolver；这些留给 S71.5-S71.8。
- 不让 AI 执行 SQL、写 canonical `worldState`、写 SQLite 业务表、写审计表、执行任免、裁决战和、定案、调兵、结算财政或公开 hidden。
- 不把 raw SQLite row、raw audit、raw prompt、raw provider payload、完整 proposal 或本地路径作为 prompt/UI/resolver 的 truth source。

## 2. 分层关系

S71 的输入链路固定为：

```text
worldState snapshot
  -> server route views / safe retrieval rows / public event archive projection
  -> resolverInputContext
  -> server resolver
  -> validated state patch / adapter transaction / event archive / hidden-safe audit
  -> player-facing route views
```

关键边界：

- SQLite 派生表只能从 `world_sessions.world_state_json` 与服务器 view 单向修复；raw 派生表不反向改写 canonical 状态。
- `resolverInputContext` 是服务器内部证据包，不是模型可写字段，也不是玩家 API 新字段。
- 模型可以通过 S70 工具协议请求读取 actor 可见摘要，但工具结果仍必须来自经过过滤的 context 或 route view。
- 服务器 resolver 可以参考 context 证据和压力值，但不能把 SQLite 派生表当作独立 canonical truth。

## 3. `resolverInputContext` 顶层字段

S71.1 的实现应优先提供这个稳定形状；后续领域可在各自命名空间内加字段，但不得绕过 `safety` 与 `sourceViews`。

```javascript
{
  schemaVersion: "s71.resolverInputContext.v1",
  generatedAt: "2026-05-13T00:00:00.000Z",
  generatedAtTurn: 12,
  sessionId: "redacted-or-internal",
  identity: {
    actorId: "player",
    actorType: "player|npc|office|system",
    role: "scholar|official|magistrate|minister|general|emperor",
    authorityTier: "T0|T1|T2|T3|T4|T5|T6",
    sceneType: "turn|policy|case|military|diplomacy|event|memory|audit"
  },
  actor: {
    visibleScopes: [],
    jurisdictionRefs: [],
    allowedToolGroups: [],
    forbiddenToolGroups: []
  },
  scene: {
    sceneId: null,
    intentType: null,
    requestSummary: "",
    timeScope: { year: 1644, month: 1, tenDayPeriod: 1 }
  },
  geography: [],
  people: [],
  offices: [],
  economy: [],
  military: [],
  events: [],
  intel: [],
  player: [],
  map: [],
  memory: [],
  sourceViews: [],
  forbiddenSources: [],
  caps: {
    maxItemsPerDomain: 0,
    maxCharactersPerItem: 0,
    maxTotalCharacters: 0,
    truncation: []
  },
  safety: {
    localOnly: true,
    redactedPlayerApiRequiredForHiddenProfiles: true,
    rejectsRawTables: true,
    rejectsRawAudit: true,
    rejectsProviderPayload: true,
    rejectsPromptText: true,
    rejectsLocalPathsAndKeys: true,
    hiddenNotBackfilledToStateRoute: true,
    aiCannotWriteDatabase: true
  }
}
```

字段说明：

- `identity`：只记录当前 resolver 所需的 actor/scene 身份，不授予额外权限。
- `actor`：由 S70 actor profile 过滤得到；用于裁剪 jurisdiction、tool group 和 visibility，不作为模型自报事实。
- `scene`：只保存当前 resolver 请求摘要与时间范围，不能保存 raw prompt 或 provider 原文。
- `geography` / `people` / `offices` / `economy` / `military` / `events` / `intel` / `player` / `map` / `memory`：只放安全 evidence item。
- `sourceViews`：列出本 context 实际使用过的 view 名、domain、数量和 cap。
- `forbiddenSources`：固定本次构建拒绝的来源类别，便于测试与审计，不记录具体本地路径或 key。
- `caps`：记录裁剪规则和溢出摘要，避免 large fixture 下 prompt/context 线性膨胀。
- `safety`：运行时可用于测试断言；不得由客户端或 provider patch。

## 4. 允许来源

`resolverInputContext` 只允许从这些安全来源构建：

| 来源 | 可进入领域 | 备注 |
| --- | --- | --- |
| `worldGeographyView` | `geography`、`map`、`events` | 只用公开地理、城市、国家、边防、路线、辖区和压力摘要；不含 raw 坐标表或 hidden enemy truth。 |
| `worldPeopleView` / `relationshipView` | `people`、`memory`、`events` | 只用当前 actor 可见 NPC、家族、关系、人情债和公开关系摘要。 |
| `officialPostingsView` / `officialCareerView` | `offices`、`player`、`events` | 只用公开任所、官署、官缺、考成、履历和辖区摘要。 |
| `localAffairsDocketView` | `offices`、`economy`、`people`、`events` | 只用案牍类型、压力、公开地点、公开涉事群体和待办摘要。 |
| `economicFiscalView` | `economy`、`events` | 只用府库、税粮、粮价、盐漕、赈济、债务和市场公开压力。 |
| `militaryDiplomacyView` | `military`、`map`、`events` | 只用边防、驻军、粮道、外交接触、传闻可信度和授权摘要。 |
| `historicalEventArchiveView.publicChains` | `events`、`intel` | 只用公开事件链，不读取 `sealedChains`。 |
| `intelligenceRumorView.publicRumors` | `intel`、`events` | 只用 actor 可见传闻、可信度、来源标签和公开摘要。 |
| `eventArchiveView` | `events`、`memory` | 只用公开事件档案 projection、分页摘要和安全 refs。 |
| `informationPanelPageView` | `events`、`player` | 只能作为服务器已分页 view 的复用，不得读取 raw backing table。 |
| `actorMemoryView` / `sessionSummaryView` | `memory`、`player` | 只用当前 actor 可见记忆和玩家经历摘要；不读 raw ledger。 |
| `playerMonthlyBriefingView` | `player`、`offices`、`economy`、`military` | 只用玩家公开月报与下月待办线索。 |
| `mapContextView` | `map`、`geography`、`military` | 只用稳定 `mapEntityRef`、可见路线和 movement affordance。 |
| capped `retrievalContext` safe rows | 对应 domain | 只能使用已从安全 view 同步的 compact row，并保留 `sourceView`。 |
| 受控 fixture projection | 测试 | 只能用于测试，必须遵守同一 schema、cap 和 hidden-token 扫描。 |

## 5. 禁止来源

以下来源不得进入 `resolverInputContext`、prompt、浏览器、普通 route view 或 AI 工具结果：

- raw SQLite business table：`geo_*`、`people_*`、`office_*`、`event_archive_index`、`prompt_retrieval_index`。
- raw session/audit table：`world_sessions`、`world_state_json`、`event_log`、`ai_change_proposals`。
- raw `worldState` hidden ledger：hidden NPC 私档、资产真数、隐藏动机、未公开关系、未公开任所、密档事件链、隐藏情报真值、raw `actorMemoryLedger`、raw `sessionSummary`。
- raw provider material：provider payload、raw proposal、raw tool call arguments、raw function-call delta、完整 provider error body。
- prompt material：完整 prompt、system contract 原文、prompt retrieval 内部排序日志、local prompt pack path。
- secrets and paths：`.env`、API key、token-plan key、base URL credential、Windows/Linux 本地路径、`file://`、数据库绝对路径。
- server-only machinery：`allowServerOwnedPatchKeys` 的调用意图、内部 `server.*` resolver 名称、未脱敏 stack trace、SQL text、migration checksum internals。
- role-forbidden view：actor 当前身份不可见的 high-confidence 情报、sealed event chain、private memory 或 hidden diagnostic。

实现与测试应把这些 token 作为污染探针；一旦出现，context 构建必须拒绝、降级或脱敏，并在 audit summary 中只记录安全原因码。

## 6. Evidence Ref 契约

每条 evidence item 至少包含：

```javascript
{
  refId: "evidence:domain:stable-id",
  sourceView: "economicFiscalView",
  sourceId: "city:jiangning",
  domain: "economy",
  visibility: "public|player_visible|role_visible",
  confidence: 0.72,
  label: "江宁县粮价偏高",
  summary: "本旬粮价上扬，赈济案牍压力较高。",
  relatedRefs: ["city:jiangning", "docket:grain-relief"],
  scopeRefs: ["jurisdiction:jiangning"],
  generatedAtTurn: 12,
  freshness: "current|recent|archival"
}
```

规则：

- `sourceView` 必须是允许来源之一；不得写 raw table 名。
- `sourceId` 可以是安全 view ref，不得是 SQLite rowid、数据库文件路径或审计内部 id。
- `visibility` 必须由服务器计算，不能由 provider 自报。
- `confidence` 必须 clamp 到 `0..1`；未知可信度用保守默认值。
- `summary` 必须经过 hidden/raw/provider/prompt/path/key/SQL 污染清洗。
- `relatedRefs` 与 `scopeRefs` 只放稳定游戏 ref，用于辖区、证据和地图范围检查。
- private / hidden refs 必须清空或转为服务器内部不可见计数，不能返回给 AI 或浏览器。

## 7. AI 权限与服务器写入边界

AI 可做：

- 读取 actor 可见的 context 摘要。
- 通过 S70 工具协议提交 read、proposal 或 request-adjudication。
- 为财政、刑名、军务、外交、事件、记忆或场景给出叙事、理由、风险和候选 action。

AI 不可做：

- 写 `resolverInputContext`。
- 执行 SQL 或直接读 raw SQLite table。
- 写 canonical `worldState`、SQLite 业务表、`event_archive_index`、`prompt_retrieval_index`、`event_log` 或 `ai_change_proposals`。
- 直接任免、定案、裁决战和、调兵、征税、开仓、定榜、授官、处分、公开 hidden、推进全局时间或修改 revision。
- 把 tool call、proposal、模型多数意见或 retrieval row 伪装成已经发生的世界事实。

服务器必须做：

- 构建、裁剪、过滤和审计 `resolverInputContext`。
- 校验 actor profile、工具权限、辖区、证据来源、cooldown、proposal schema 和污染 token。
- 通过领域 resolver 生成 server-owned patch，并且只用 `allowServerOwnedPatchKeys` 这类内部机制写服务器字段。
- 在 adapter transaction 中写 session、派生表、事件档案和审计摘要。
- 对玩家 route、prompt、浏览器和开发诊断分别做 redaction。

## 8. JSON/SQLite Parity 与测试矩阵

S71.1 必须覆盖：

| 维度 | JSON | SQLite | 预期 |
| --- | --- | --- | --- |
| 同一 session 输入 | 从 JSON snapshot 和 server view 构建 | 从 SQLite adapter 读同一 `world_state_json` 后构建 | `resolverInputContext` player-facing / resolver-facing evidence 相同，忽略生成时间和内部顺序差异。 |
| 派生表污染 | 不适用 | 人为污染 `geo_*` / `people_*` / `office_*` / prompt index row | 读档从 `world_state_json -> server view` 单向修复，context 不采信污染 raw row。 |
| hidden canary | raw snapshot 内存在 hidden token | raw SQLite / index 内存在 hidden token | context、audit summary、prompt retrieval、route view 不出现 hidden token。 |
| large fixture cap | 大量国家/城市/NPC/事件 | 同等 fixture 导入 SQLite | context 条数、字符数、耗时和内存受 cap 控制。 |
| actor visibility | 书生、地方官、大臣、将领、皇帝 | 同左 | 每种身份只见自身 role/jurisdiction 允许的 evidence。 |
| missing SQLite support | 不适用 | `node:sqlite` 不可用 | 维护/双模式测试受控 skip；JSON 默认可玩不受影响。 |

建议测试文件：

- `test/resolverInputContext.test.js`
- `test/resolverInputContextRedaction.test.js`
- `test/resolverInputContextParity.test.js`
- 后续领域 resolver 可按 `test/fiscalCityResolver.test.js`、`test/judicialResolver.test.js`、`test/militaryDiplomacyResolver.test.js` 拆分。

S71.0 本身不新增这些测试文件；本契约只固定 S71.1 的测试目标。

## 9. Redaction 与红队矩阵

后续实现至少覆盖这些污染类别：

| 类别 | 示例 | 预期 |
| --- | --- | --- |
| raw table token | `geo_cities`、`world_state_json`、`event_log` | context 拒绝或清洗；audit 只记原因码。 |
| provider/proposal token | `raw provider payload`、`statePatch`、`tool_calls` | 不进入 evidence summary；provider 建议只能作为 proposal 进入独立校验链。 |
| prompt token | `systemContract`、完整 prompt 片段 | 不进入 context、route、diagnostics。 |
| hidden token | `hidden intent`、密档链、隐藏情报真值 | 不进入普通 route；真正 hidden 保存必须等 S71.4 redacted API。 |
| path/key token | `C:\\...`、`/mnt/...`、`file://...`、`sk-...`、`tp-...` | 清洗或拒绝；不打印完整值。 |
| SQL token | `SELECT * FROM`、`DROP TABLE` | 拒绝为证据或 action；AI 工具不得执行 SQL。 |
| jurisdiction spoof | 书生引用军务密报、县令引用外省案牍 | 按 actor profile 与 `scopeRefs` 拒绝或裁剪。 |
| source spoof | evidence 自称 `sourceView: rawTable` 或伪造 high confidence | sourceView 只能来自 allowlist，confidence 由服务器重算。 |

## 10. 与后续步骤的交接

S71.1 实现入口：

- 新增 `src/game/resolverInputConfig.js`：schema version、domain cap、字符 cap、默认可信度、source allowlist、forbidden token、actor visibility presets。
- 新增 `src/game/resolverInputContext.js`：
  - `buildResolverInputContext(worldState, options)`
  - `filterResolverInputForActor(context, actorProfile)`
  - `createResolverEvidenceRefs(context)`
  - `summarizeResolverInputForAudit(context)`
  - `assertResolverInputSafe(context)` 或等价测试 helper
- 新增测试：至少覆盖 schema、allowlist、forbidden source、actor visibility、JSON/SQLite parity、large fixture cap 和 hidden-token 防线。

S71.1 当前初版已提供上述两个模块和 `test/resolverInputContext.test.js`。实现从既有 server view 构造 geography/people/offices/economy/military/events/intel/player/map/memory evidence buckets，并在候选 evidence 参与 cap 前先运行 forbidden-source 扫描，避免被截断的污染行逃过最终 context 检查。

S71.2-S71.4 不得改变本契约的核心边界：

- migration/维护命令可以检查和修复 SQLite，但输出必须脱敏，dry-run 不改库。
- 安全搜索只能索引 player-facing projection；FTS5 不可用时使用安全 fallback。
- redacted API 完成前，不得把 hidden 私档保存到普通玩家可见 route。

S71.5-S71.12 的 resolver、场景、记忆和面板都必须复用 `resolverInputContext` 或显式记录为何不适用，并在 AI 控制矩阵中补充权限、证据、写入和验收边界。

## 11. S71.0 验收清单

- 本文明确 local-only、redacted API 前置、hidden 不回填普通 state route、AI 不直写 DB。
- `docs/DATABASE_GAMEPLAY_RESOLVER_ROADMAP.md` 指向本文作为 S71.0 契约源。
- `docs/AI_CONTROL_AUDIT_MATRIX.md` 固定 S71 的 AI read/proposal/request-adjudication 权限与禁止源。
- `docs/DEVELOPMENT_STEPS.md` 保持 S71.0-S71.12 ID、依赖和进度。
- `docs/SHARED_CONTEXT.md` 记录 S71.0 状态、验证、边界和下一步。
- `README.md` 与 brief 的重要文档入口包含本文。
- 验证命令至少运行 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。
