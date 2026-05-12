# 《千秋》S70.1 AI 工具协议契约

本契约固定 `game_ai_tools` 的模型可见工具 envelope、proposal/result/request-adjudication schema、provider 兼容策略、审计和失败降级。核心原则只有一句：**模型请求工具，服务器执行工具；tool call 不是已经发生的世界事实。**

技术资料基线于 2026-05-12 核验：

- [OpenAI Function Calling](https://developers.openai.com/api/docs/guides/function-calling)：function/tool calling 用 JSON schema 定义工具，应用代码执行工具。
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)：strict schema 要求对象 `additionalProperties: false`，JSON mode 不等于 schema adherence。
- [Anthropic Define tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)：工具包含 `name`、`description`、`input_schema`，应用负责执行 client tools。
- [DeepSeek Function Calling](https://api-docs.deepseek.com/guides/function_calling/)：OpenAI-compatible function calling，模型本身不执行函数；strict mode 需单独验证。
- [MCP Architecture](https://modelcontextprotocol.io/docs/learn/architecture)：工具经 `tools/list` 发现，经 `tools/call` 执行。
- [Xiaomi MiMo-V2.5-Pro](https://mimo.xiaomi.com/mimo-v2-5-pro/)：官方强调长程 agentic / tool-use 能力；本项目必须用真实 smoke 固定其 OpenAI-compatible 返回形状。

这些资料只决定接口兼容方向，不授予模型额外权力。

## 1. 工具分层

S70 工具分三类：

| 类型 | 模型能做什么 | 服务器做什么 | 例子 |
| --- | --- | --- | --- |
| `read` | 请求读取 actor 可见摘要。 | 按身份、辖区、关系、情报可信度和 budget 返回 capped view。 | `world.read_visible_context`、`office.read_docket`、`memory.read_actor_memory`。 |
| `proposal` | 提交事件、关系、政务、刑名、军令、外交、记忆、地图等候选建议。 | 校验权限、证据、冷却、风险和 schema，决定 accepted/rejected/pending。 | `event.propose_incident`、`city.propose_policy`、`relationship.propose_delta`。 |
| `request_adjudication` | 请求服务器裁决高影响动作。 | 运行领域 resolver，写公开结果、隐藏后果引用和审计。 | `ruler.request_edict_adjudication`、`judicial.request_case_adjudication`、`office.request_appointment_adjudication`。 |

`server.*` 只能是内部 resolver bridge 或 audit label，不能出现在模型可见 tool list。后期如果包装内部 MCP server，`tools/list` 也只列 actor 可见的 `read/proposal/request_adjudication` 工具。

## 2. Tool Envelope

每个模型可见工具必须包含：

| 字段 | 要求 |
| --- | --- |
| `name` | 内部稳定名，使用领域命名空间，如 `world.read_visible_context`；不得以 `server.` 开头。 |
| `description` | 给模型看的说明，写清何时使用、何时不要使用、返回什么、不返回什么。 |
| `inputSchema` | JSON schema，模型可见参数；对象默认 `additionalProperties: false`，为跨 provider portability，首批要求 properties 全列入 `required`。 |
| `permission` | actor tier、actor type、工具组、readScope、proposalScope、visibilityBoundary、forbiddenScopes、辖区/证据要求。 |
| `resolver` | 服务器裁决入口；必须 `serverOwned: true`。 |
| `audit` | event type、参数摘要字段、redact 字段、是否记录 rejected、玩家可见 projection。 |
| `cooldown` | `none/actor/scene/jurisdiction/world` 与 turn 数，防止反复滥用。 |
| `mockFallback` | Mock/no-key 行为：deterministic、reject 或 pending。 |

可选字段：`riskTags`、`providerCompatibility`、`toolGroups`、`transactionBoundary`。

运行时代码入口：`src/ai/toolSchemas.js`。

## 3. Provider 可见转换

内部工具名可以用点分命名；OpenAI-compatible chat completions 和 Anthropic 工具名通常更偏向 `[A-Za-z0-9_-]`。因此 provider 适配层必须稳定转换：

```text
world.read_visible_context -> world_read_visible_context
judicial.request_case_adjudication -> judicial_request_case_adjudication
```

转换规则：

- provider-visible name 只用于模型接口；内部审计和 resolver 仍记录原始 `name`。
- 转换不得把 `server.*` 暴露给模型。
- provider 工具参数只包含 `inputSchema`；`permission`、`resolver`、`audit`、`cooldown`、`mockFallback` 保留在服务器侧。
- 工具结果回填给模型时只放 `toolResult.publicResult`、公开拒绝原因和必要 `auditRef`，不放 private refs 内容。

## 4. Strict Schema 规则

S70.1 首批工具参数 schema 采用保守 strict 子集：

- 顶层和嵌套 object 都必须 `additionalProperties: false`。
- 对象 properties 必须全部列入 `required`；需要可选语义时先用空字符串、空数组、`null` union 或后续明确兼容策略。
- 不使用通用 `object additionalProperties: true` 作为模型参数入口。
- 不把 raw SQL、raw table name、raw `worldState` patch、raw audit insert、local path、provider config、hidden note/id、完整 prompt 放进参数。
- provider 原始返回必须先解析并用 schema 校验，再交给权限检查和 resolver。

OpenAI Structured Outputs 对 strict schema 支持较强；DeepSeek strict mode、MiMo OpenAI-compatible 工具形状和 Anthropic tool schema 仍要分别 smoke，不做“兼容接口等于同等严格”的假设。

## 5. Proposal Schema

proposal 是模型的“建议”，不是事实。统一 envelope：

```text
proposalId
toolName
actorRef
intent
arguments
visibility
confidence
evidenceRefs
boundaryStatement
requestedFollowUp
```

要求：

- `actorRef` 至少含 `actorId`、`actorType`、`authorityTier`。
- `visibility` 只能是 `player_visible`、`actor_visible` 或 `server_private`。
- `confidence` 仅表示模型自信，不决定服务器采纳。
- `boundaryStatement` 必须承认“服务器裁决后才发生”。
- `arguments` 再由具体工具 `inputSchema` 校验。

服务器可把 proposal 转为 `accepted/rejected/pending`，并记录拒绝原因；未采纳 proposal 不得进入玩家事实账本。

## 6. Request-adjudication Schema

高影响工具必须走 request-adjudication：

```text
requestId
domain
toolName
actorRef
requestedAction
arguments
authorityBasis
evidenceRefs
riskDisclosure
visibleToPlayer
```

适用领域：

- `office` / `career`：任免、升迁、赏罚、弹劾。
- `judicial`：判案、拘捕、翻供、重罪处分。
- `military`：出兵、固守、会战、调粮。
- `diplomacy`：互市、和议、扣使、宣战。
- `exam`：评卷复核、荐卷、授官倾向。
- `event` / `time` / `memory` / `map`：事件成案、跳时、记忆、移动或地图事件。

返回只能是 `accepted`、`rejected`、`pending` 或 `failed`，并携带公开结果、拒绝理由、成本、follow-up hooks 和 audit ref。

## 7. Tool Result Schema

工具结果是服务器输出给模型的下一步上下文：

```text
status
toolName
actorRef
publicResult.summary
publicResult.visibleChanges
privateResultRefs
appliedEventIds
rejectionReasons
counterCosts
followUpHooks
auditRef
modelFollowUpHint
```

边界：

- `privateResultRefs` 只是服务器内部引用，不能展开给模型。
- `appliedEventIds` 只列安全公开 id；hidden event id 需另做 redaction。
- `rejected` 和 `pending` 必须被模型叙述为阻力、待议、证据不足或上级未决，不得说成已经发生。
- `failed` 不能写 session；应降级到 Mock/heuristic 或给玩家可读错误。

## 8. 审计与冷却

每次工具调用至少记录：

- actor 摘要：`actorId`、`actorType`、authority tier、辖区。
- tool name 与 provider-visible name。
- 参数脱敏摘要。
- 权限检查、cooldown 检查和 schema 检查结果。
- resolver status、公开结果、拒绝原因、成本和 follow-up hooks。
- provider/model/task type、耗时、重试和失败降级摘要。

不得记录或展示：完整 prompt、密钥、`.env`、本地路径、raw provider proposal、hidden ledger、raw audit payload、raw SQLite table row。

## 9. Provider 兼容矩阵

| Provider | S70.1 策略 |
| --- | --- |
| Mock | deterministic 工具结果与拒绝样例，保证 CI 和 no-key 回归。 |
| MiMo-V2.5-Pro | 主力真实 smoke；直接走 `chat/completions` + `tools` + `tool_choice`，记录 `choices[0].message.tool_calls`、工具参数编码、工具结果回填和后续 streaming 形状。 |
| OpenAI | 后续用 Responses/Chat 工具形状适配；strict schema 与 function calling 分开测试。 |
| DeepSeek | OpenAI-compatible function calling 可用但 strict mode 需单独验证；评卷 provider 仍不能获得工具写权。 |
| Anthropic | 适配 `tools` / `input_schema` 与 tool result blocks；工具描述需更高信号。 |
| MCP | S70 前期不启动外部 MCP server；若后期包装内部 MCP，只暴露自家工具层，不接通用外部工具。 |

`npm run smoke:provider:tools` 当前先固定 MiMo forced tool call 与 tool result roundtrip；`--full`、`--stream` 留给后续真实形状稳定后扩展。无 `MIMO_API_KEY` 时明确 skip；`MIMO_REQUIRED=1` 或 `--required` 时缺 key fail。

## 10. 禁止项

工具、MCP server、provider adapter 或 prompt 都不得暴露：

- 通用 SQL、raw table read/write、raw session patch、raw audit insert。
- `worldState` 任意 patch、`statePatch.worldState`、`write_anything`、`execute_code`、浏览器控制、外部 web search。
- hidden notes、hidden intent、未公开关系、未公开任所、弥封映射、保结密注、密档链、隐藏情报真值。
- provider key、base URL、`.env`、本地路径、完整 prompt。
- `server.*` 作为模型可见工具名。

多个模型、critic 或 safety 同意，也不能绕过 schema、权限、cooldown、resolver、clamp、visibility filter、科举晋级、官职任免、战争/外交裁决或持久化事务。

## 11. S70.1 验收命令

```bash
node --check src/ai/toolSchemas.js
node --check scripts/providerToolSmoke.js
node --test test/aiToolProtocolContract.test.js test/providerToolSmokeScript.test.js test/aiSchemas.test.js test/prompts.test.js
npm run check:docs-governance
npm run smoke:provider:tools
```

有真实 MiMo key 且要强制验收：

```bash
MIMO_REQUIRED=1 npm run smoke:provider:tools
```

在 Windows PowerShell 中可用：

```powershell
$env:MIMO_REQUIRED='1'; npm run smoke:provider:tools
```

## 12. 后续接点

- S70.2：把 `permission` 映射到 `aiActorProfile`、authority tier、actor tool allowlist 和角色视野。
- S70.3：实现 `game_ai_tools` registry、runner、resolver bridge、audit hook 和 Mock runner。
- S70.6：已落地 `event.propose_incident` 与 `event.request_incident_adjudication` 首批事件工具。事件工具使用 strict input schema，要求 `incidentKind`、`publicSummary`、`sourcePressureRefs`、`visibility`、`confidence`、`severity`、`cooldownKey`、`affectedRefs`、空 `privateResultRefs` 和 `riskTags`；默认 registry 会按 actor 权限过滤，resolver 只返回 `pending` / `rejected`，不写状态、SQLite、事件档案或成案审计。
- S70.7：继续补刑名、财政、军事、外交、科举、赏罚和任免工具；这些工具仍只能提交 proposal / request-adjudication，真正结算由服务器 resolver。
- S70.8/S70.14：补完整 provider prompt/tool eval、真实 MiMo required smoke、browser/JSON/SQLite parity 和归档。
