# 《千秋》S70 AI 编排与权力工具归档

归档日期：2026-05-13。

本文件归档 S70.1-S70.14 的 AI 编排实现，供 S71 数据库玩法化、维护、安全检索和 redacted API 专项接手。规划源头仍见 [AI_ORCHESTRATION_ROADMAP.md](AI_ORCHESTRATION_ROADMAP.md)，稳定开发治理仍以 [DEVELOPMENT_GOVERNANCE.md](DEVELOPMENT_GOVERNANCE.md) 为锚点。

## 1. 归档结论

S70 已把《千秋》的 AI 从“叙事与评分器”推进为有身份、权限、记忆、工具和验收边界的世界行动者网络。当前 AI 仍不能直接写 canonical 状态、SQLite 业务表、审计表或 hidden 真值；模型只能生成叙事、受限 `statePatch`、关系/记忆建议，或按 actor 权限提交 `read` / `proposal` / `request_adjudication` 工具调用，服务器继续拥有状态边界、时间推进、科举晋级、官职任免、军事外交、财政刑名、地图移动和持久化裁决。

已完成能力：

- S70.1：固定 prompt pack 分层、工具协议契约、strict tool schema、provider-visible name 和 MiMo 工具调用 smoke。
- S70.2：固定 AI actor profile、T0-T6 authority tier、actor type、可见范围、工具组和 actor 工具 allowlist。
- S70.3：新增内部 `game_ai_tools` registry/runner、read/proposal/request-adjudication 执行链、cooldown、pending bridge 和 hidden-safe 工具审计摘要。
- S70.4：新增 NPC mind 基础、显著度排序、Mock/no-key proposal、可见关系变化和 `player_visible` 记忆候选。
- S70.5：新增朝议/科场制度场景 helper，支持 scene-local 多 actor proposal 收束，不推进全局时间、不写库。
- S70.6：新增压力事件工具协议和可见压力 source 校验，只返回 pending/rejected。
- S70.7：新增刑名、财政、军务、外交、科举、任免、赏罚和处分领域工具定义与 thin resolver bridge。
- S70.8：新增 task-aware 多模型路由、critic/safety review-only 约束和 `npm run eval:ai` 本地 AI 评测入口。
- S70.9：新增 session 级 AI 设置、浏览器 AI 设置面板、provider/model/budget route view 和 hidden-safe 调动摘要。
- S70.10：新增玩家官职月报，月末按玩家身份生成职位化公开月报、事件档案条目和 bounded AI 调动摘要。
- S70.11：新增自然语言跳时，把“学习一月/照旧处理一月”等请求拆为逐旬 batch tick，并支持考试/急件/重大事件中断。
- S70.12：新增 actor memory ledger、session summary、记忆 proposal 清洗、private/hidden memory 拒绝和 route `worldState` raw ledger 剥离。
- S70.13：新增 `mapContextView`、稳定 `mapEntityRef`、地图可见性和 `map.propose_route_or_geopolitical_move` 待裁决工具。
- S70.14：新增 `npm run smoke:provider:ai-first` 和 S70 JSON/SQLite AI-first parity 验收，把真实 MiMo 开局/普通长回合与月报、跳时、记忆、地图、critic/safety、AI 设置等服务器安全 surface 收束到归档验收入口。

## 2. 完成步骤索引

| ID | 摘要 | 主要证据 |
| --- | --- | --- |
| S70.1 | Prompt/tool 契约与 MiMo 工具 smoke | `docs/AI_PROMPT_ENGINEERING_CONTRACT.md`、`docs/AI_TOOL_PROTOCOL_CONTRACT.md`、`scripts/providerToolSmoke.js` |
| S70.2 | AI actor 权限模型 | `src/game/aiActorProfiles.js`、`test/aiActorProfiles.test.js` |
| S70.3 | 内部工具运行时 | `src/ai/gameAiToolRunner.js`、`test/gameAiToolRunner.test.js` |
| S70.4 | NPC mind 基础 | `src/game/npcMind.js`、`test/npcMind.test.js` |
| S70.5 | 制度场景 helper | `src/game/institutionScenes.js`、`test/institutionScenes.test.js` |
| S70.6 | 压力事件工具 | `src/game/aiEventProposal.js`、`test/aiEventProposal.test.js` |
| S70.7 | 领域工具协议 | `src/game/domainToolResolvers.js`、`test/domainToolResolvers.test.js` |
| S70.8 | 多模型路由与 eval | `src/ai/modelRoutePolicy.js`、`scripts/aiEvaluationRunner.js` |
| S70.9 | AI 设置与可观测 | `src/game/aiSettings.js`、`test/aiSettingsRoute.test.js` |
| S70.10 | 玩家官职月报 | `src/game/playerMonthlyBriefing.js`、`test/playerMonthlyBriefingRoute.test.js` |
| S70.11 | 自然语言跳时 | `src/game/timeSkip.js`、`test/gameTurnTimeSkip.test.js` |
| S70.12 | Actor memory 与 session summary | `src/game/actorMemoryLedger.js`、`src/game/sessionSummary.js` |
| S70.13 | 地图 AI 接口预留 | `src/game/mapContext.js`、`src/game/mapToolResolvers.js` |
| S70.14 | Provider AI-first smoke 与 S70 parity 归档 | `scripts/providerAiFirstSmoke.js`、`scripts/dualModeAcceptance.js` |

## 3. 稳定边界

- 完整书生路径仍必须保持：`scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`。
- AI 工具只表示模型请求、proposal 或 request-adjudication；`server.*` 只能是内部 resolver / audit label，不能成为模型可直接执行的工具。
- 真实 MiMo、DeepSeek、OpenAI、Anthropic 或 Mock 只影响叙事、建议质量、预算和审查力度，不能绕过 schema、actor 权限、hidden 过滤、promotion rule、appointment rule、battle/diplomacy/fiscal resolver 或持久化 transaction。
- `actorMemoryLedger`、`sessionSummary`、`playerMonthlyBriefing`、`mapContextView`、AI 设置和工具审计都有玩家可见 view；浏览器、prompt、事件档案和 smoke 只能读取服务器清洗后的 route view / capped summary。
- 当前不保存 NPC deep private memory、hidden enemy truth、raw coordinate table、raw provider payload、完整 prompt、raw SQLite row、raw audit、provider key、本地路径或 hidden 私档。后续若要保存真正 hidden 私档，必须先完成 S71 redacted player API 与 hidden-safe diagnostics。
- S70 归档时，地图移动、行军、赴任、押解、使节、商路、财政、刑名、外交、任免和赏罚只到 pending/rejected proposal；真实后果交给 S71 resolver。S71.5 已先把财政与城市政策接入服务器 resolver，其它领域仍按后续 S71 步骤推进。

## 4. 验收与回归入口

常用 S70 验收命令：

```bash
npm run eval:ai
npm run smoke:dual-mode -- --storage-only
npm run smoke:browser
node --test test/aiToolProtocolContract.test.js test/aiActorProfiles.test.js test/gameAiTools.test.js test/gameAiToolRunner.test.js
node --test test/npcMind.test.js test/institutionScenes.test.js test/aiEventProposal.test.js test/domainToolDefinitions.test.js
node --test test/modelRoutePolicy.test.js test/aiSettings.test.js test/playerMonthlyBriefing.test.js test/timeSkip.test.js test/actorMemoryLedger.test.js test/mapContext.test.js
```

真实 MiMo 验收入口：

```bash
MIMO_REQUIRED=1 AI_PROVIDER_TIMEOUT_MS=90000 npm run smoke:provider:tools
MIMO_REQUIRED=1 AI_PROVIDER_TIMEOUT_MS=90000 npm run smoke:provider:ai-first
```

`smoke:provider:tools` 当前实际执行 forced tool call 与 tool-result roundtrip，并保留 `multi_tool`、streaming tool delta 和 schema failure 的兼容矩阵记录；如 MiMo 工具协议后续用于正式多工具编排，应先扩展该脚本的 `--full` / `--stream` 实探。`smoke:provider:ai-first` 会真实调用 MiMo 开局和普通长回合 JSON，然后在内存中验证 S70 月报、跳时、记忆、地图 proposal、critic/safety review-only 和 AI 设置等服务器 surface；它不写 session，不打印 key、raw prompt、provider payload、SQLite row 或本地路径。

本轮本机 `.env` 存在 MiMo 配置时，`AI_PROVIDER_TIMEOUT_MS=90000 npm run smoke:provider:tools` 与 `AI_PROVIDER_TIMEOUT_MS=90000 npm run smoke:provider:ai-first` 均在真实 provider fetch 阶段失败：`fetch failed`，未打印密钥。无 key skip 分支已通过 `MIMO_API_KEY=` 覆盖；required keyed acceptance 需在可达 MiMo endpoint/key 环境复跑。

## 5. 残余风险与 S71 入口

- S70 的多数 AI-first surface 已可被真实 provider 触发或围绕真实 provider 验证，但 NPC mind、制度场景、月报长文、跳时 planner 和记忆提炼仍主要使用 deterministic server helper / Mock-no-key fallback；更深真实多 actor provider loop 留给 S71.9-S71.11 或后续 AI 专项。
- 本轮 keyed MiMo fetch 未在当前环境跑通；S70.14 已提供 required 开关、无 key skip 安全网和本地 AI-first parity，但真实 provider acceptance 需要后续在网络/base URL/key 可用环境确认。
- JSON/SQLite parity 已覆盖 S70 AI-first route views，但真实领域结算仍未落地；S71.1 起应把数据库 projection 做成服务器 resolver input，而不是 AI 直写入口。
- `smoke:dual-mode` 的 S67 large fixture 性能阈值历史上偶有本机 timing 抖动；失败时应单独复跑并记录是否仍是 `sqliteReadRepairMs` / fixture timing 波动。
- S71.0 应从 [DATABASE_GAMEPLAY_RESOLVER_ROADMAP.md](DATABASE_GAMEPLAY_RESOLVER_ROADMAP.md) 启动：先固定 resolver 输入契约、JSON/SQLite parity、hidden/raw 边界和 redacted API 方向，再进入财政、刑名、军务外交、压力事件、多 actor 场景、NPC 记忆账本和 AI 调动审计面板。
