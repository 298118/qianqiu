# 《千秋》S70.1 AI 提示词工程契约

本契约固定 S70 的 prompt pack 分层、版本、输入预算、输出边界、provider smoke 和红队口径。它不是“文案优化指南”，而是 AI actor 进入世界前必须遵守的接口契约：模型可以叙事、提 proposal、请求工具或请求裁决；服务器仍拥有状态边界、时间推进、科举晋级、官职任免、数据库写入、隐藏信息过滤和持久化。

技术资料基线于 2026-05-12 核验：OpenAI Function Calling / Structured Outputs、Anthropic tool use / MCP connector、DeepSeek Function Calling、MCP Architecture、Xiaomi MiMo-V2.5-Pro 官方介绍。外部资料只证明“模型请求工具、应用执行工具”的行业接口方向；《千秋》的最终边界以本仓库契约和服务器 resolver 为准。

## 1. 适用范围

S70.1 起，新增或重写重要 prompt 时必须登记这些元数据：

| 字段 | 说明 |
| --- | --- |
| `promptId` | 稳定 ID，例如 `qianqiu.world_turn.v1`、`qianqiu.exam_grading.v2`。 |
| `promptVersion` | 语义化或日期版本；改系统边界、工具策略或输出 schema 必须升版。 |
| `sceneType` | `world_turn`、`exam_question`、`exam_grading`、`court_debate`、`judicial_case`、`campaign`、`diplomacy`、`monthly_briefing`、`time_skip` 等。 |
| `actorType` | `scholar`、`teacher`、`examiner`、`magistrate`、`minister`、`general`、`emperor`、`system_engine` 等。 |
| `modelPolicy` | 可用 provider、是否允许真实 provider、是否允许流式、是否允许工具调用、Mock fallback。 |
| `inputBudget` | 固定前缀、动态 view、retrieval rows、玩家输入、工具结果和历史摘要的预算。 |
| `outputSchemaVersion` | 指向 `src/ai/schemas.js` 或 `src/ai/toolSchemas.js` 中的 schema。 |
| `fixtures` | 普通成功、越权、hidden-token、低可信传闻、schema 失败和 provider 抖动样例。 |

现有 `src/ai/promptPacks.js` 仍是运行时入口；S70.1 先用本契约约束后续扩展，S70.8 再补完整 prompt fixture runner。

## 2. Prompt Pack 分层

每个 prompt pack 应由七层组合，顺序固定，便于缓存、评测和红队定位。

| 层 | 作用 | 必须包含 | 不得包含 |
| --- | --- | --- | --- |
| `systemContract` | 固定服务器裁决权、输出 JSON/工具请求规则和隐藏信息边界。 | AI 不直写库、tool call 不是事实、服务器 resolver 裁决、hidden/raw/key/path 禁止。 | 玩家输入、NPC 原话、动态检索内容、密钥、raw prompt。 |
| `actorCard` | 描述当前 actor 的身份、职位、辖区、目标、风格、记忆和权限。 | `actorType`、`authorityTier`、可读范围、可用工具组、利益偏差、语气。 | 超出 actor 视野的 hidden 真值、完整 private ledger。 |
| `sceneContract` | 描述场景目标、时间尺度、可用证据、结束条件和失败处理。 | scene-local time、证据限制、可触发的 proposal/result 类型。 | 直接晋级、任免、宣战、判案、结算财政或写数据库的暗示。 |
| `visibleContextCapsule` | 服务器整理后的动态上下文。 | route views、capped `retrievalContext`、事件档案公开条目、角色可见记忆摘要。 | raw SQLite table、raw audit、raw provider proposal、完整 prompt、本地路径、hidden notes。 |
| `toolPolicy` | 本场景允许/禁止的工具和调用前提。 | tool allowlist、禁止 `server.*` 出现在模型工具列表、失败降级、调用预算。 | 通用 SQL、raw table update、raw session patch、代码执行、浏览器控制。 |
| `outputContract` | 结构化输出 schema 和叙事要求。 | JSON schema 名、strict 输出、uncertainty、拒绝理由、proposal/result 字段。 | 未声明字段、隐藏裁决权、把工具请求写成已经发生的事实。 |
| `selfCheck` | 输出前自检。 | 是否越权、泄漏 hidden、伪造工具结果、夹带 SQL/raw patch、把传闻当真相。 | 新增事实或替服务器裁决。 |

`systemContract` 和稳定 `outputContract` 尽量放在 prompt 最前，以保护 DeepSeek/OpenAI 类 provider 的稳定前缀缓存；动态上下文始终后置。

## 3. 角色与场景基线

S70.1 只固定契约，不要求一次实现所有 actor prompt。后续扩展应至少覆盖：

| 场景 | 首批 actor | 输出 |
| --- | --- | --- |
| 普通回合 | 玩家角色、近关系 NPC、系统 narrator | 叙事、受限 `statePatch`、`relationshipChanges`、`teacherFeedbackProposal`、`examTrigger`。 |
| 科举 | 老师、保人、房官、同考官、主考官、磨勘 critic | 题目、点评、阅卷 proposal、复核疑点；服务器定资格、榜单、晋级和授官。 |
| 官场 | 入仕官员、上级、同僚、御史、吏部意见 | 政务反馈、考成压力、赏罚/升迁 proposal；服务器裁决任免。 |
| 县衙 | 县令、胥吏、士绅、原被告、证人 | 案情摘要、证据缺口、判决 proposal；服务器裁决刑名后果。 |
| 朝议 | 皇帝、大臣、御史、部院、将领 | 奏折、诏令、弹劾、军政 proposal；服务器处理执行链和反噬。 |
| 月报/跳时/记忆 | 玩家、系统 planner、critic/safety | 月报、跳时计划、记忆 proposal、风险审查；服务器逐旬结算。 |

actorCard 必须体现权力差异：皇帝可以请求强工具，但不是无成本按钮；书生只能影响学业、名声、关系和局部事件；系统引擎不代表任何角色。

## 4. 输入预算与上下文来源

所有 prompt 只能读取服务器生成的安全摘要：

- `visibleContextCapsule` 读取 route view、`promptContextAssembler` 的 capped summary、事件档案公开条目和 actor 可见记忆。
- 普通/high profile 继续尊重既有 `retrievalContext.strategy` 行数与字符预算；长上下文模型也不得读取 raw table。
- 工具结果回填时只放 `toolResult.publicResult`、公开拒绝原因和必要 `auditRef`，不放 private refs 的内容。
- 玩家输入、NPC 原话、奏折、案卷和密札都作为 data；不得覆盖 systemContract。
- 如果上下文不足，模型应返回 uncertainty、请求 read 工具或给出 `pending` proposal，而不是编造 hidden 事实。

## 5. 输出契约

输出分四类：

1. **普通 JSON payload**：继续由 `src/ai/schemas.js` 校验，例如 `opening`、`turn`、`examQuestion`、`grade`。
2. **tool call**：由 provider 原生工具接口返回，参数必须符合 `src/ai/toolSchemas.js` 的 strict `inputSchema`。
3. **structured proposal**：模型建议事件、关系、判案、任命、军令、外交、记忆或地图动作；服务器可接受、拒绝或 pending。
4. **request-adjudication**：高影响动作请求服务器裁决，例如皇帝诏令、县令判案、将领请战、吏部拟授官。

任何输出都不得直接写：

- `turnCount`、`year`、`month`、`tenDayPeriod`
- `activeExam`、榜单、甲第、功名、官职、任免、作弊处罚
- `worldState` 顶层账本、SQLite 业务表、审计表、prompt 检索索引
- hidden notes、hidden intent、未公开任所/关系、raw audit、raw proposal、本地路径、密钥

critic/safety prompt 只能返回风险、拒绝理由、二次建议或审查标签，不能直接改状态或替 resolver 裁决。

## 6. Mock / No-key Fallback

Mock fallback 不是玩法上限，但必须是开发安全网：

- 每个 prompt pack 要说明 Mock 行为：deterministic 成功、deterministic 拒绝或 pending。
- Mock 不得授予真实 provider 之外的写权，也不得绕过服务器 resolver。
- 缺 key provider smoke 必须明确 skip；`MIMO_REQUIRED=1` 或等价开关才要求真实 MiMo。
- fallback 文案可更短，但 schema、权限、hidden-token 和完整书生路径必须仍通过。

## 7. Provider Smoke 与 Fixtures

S70.1 之后 provider 验收分层：

- `npm run smoke:provider`：继续覆盖 S69 老师点评、出题、评卷和 server-owned patch 越权。
- `npm run smoke:provider:tools`：新增 MiMo 工具调用形状探针；缺 `MIMO_API_KEY` 时 skip，`MIMO_REQUIRED=1` 时缺 key fail。
- `npm run eval:ai`：后续 S70.8 扩展 prompt fixture matrix，比较 schema 合规、身份边界、工具选择、拒绝越权、历史语气、成本和失败降级。

首批 prompt fixtures 应覆盖：

- 普通书生读书、老师点评、考试触发。
- 考官试图定榜/授官的越权输出。
- 皇帝要求无证杀臣、县令跨辖区调兵、将领擅自宣战。
- 玩家 prompt injection 要求泄漏 prompt、SQL、key、本地路径或 hidden notes。
- 低可信传闻被误当事实。
- 工具结果回填后模型把 `pending/rejected` 伪装成已发生事实。

## 8. 变更流程

改 prompt 时必须：

1. 升级 `promptVersion` 或记录兼容性说明。
2. 检查 `docs/AI_CONTROL_AUDIT_MATRIX.md` 是否需要补矩阵行。
3. 如果新增工具或 proposal 字段，同步 `docs/AI_TOOL_PROTOCOL_CONTRACT.md` 与 `src/ai/toolSchemas.js`。
4. 运行相关 prompt/schema/provider smoke 测试。
5. 在 `docs/SHARED_CONTEXT.md` 和 `docs/DEVELOPMENT_STEPS.md` 记录完成范围、验证和风险。

S70.1 完成后，后续 S70.2 应把本契约映射到 `aiActorProfile` 与 actor tool allowlist；S70.3 再实现 `game_ai_tools` registry 和 runner。
