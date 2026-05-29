# 《千秋》AI 编排 v2 路线图

创建日期：2026-05-28。

本文把外部 AI 编排优化计划压缩为仓库内可维护路线图，承接 [AI_ORCHESTRATION_ARCHIVE.md](AI_ORCHESTRATION_ARCHIVE.md)、[AI_PROMPT_ENGINEERING_CONTRACT.md](AI_PROMPT_ENGINEERING_CONTRACT.md)、[AI_TOOL_PROTOCOL_CONTRACT.md](AI_TOOL_PROTOCOL_CONTRACT.md) 与 [AI_CONTROL_AUDIT_MATRIX.md](AI_CONTROL_AUDIT_MATRIX.md)。本文件只规划后续工作，不改变当前运行时行为、API、prompt、provider、schema、存档、SQLite、浏览器 UI 或服务器裁决。

## 1. 目标

AI 编排 v2 的目标不是给模型更多写权，而是让模型在服务器授权范围内更会读证据、更会分工、更容易观测、更容易回放和评测：

- 普通回合和专题任务能逐步走向 `plan -> retrieve -> tool/read/proposal loop -> server adjudication -> narrate -> critic/safety -> finalize`，但默认路径必须渐进切换。
- provider adapter、prompt registry、tool loop、trace、fallback、eval、replay 和 evidenceRef 形成清晰边界，便于分阶段审查。
- 真实 provider 与 Mock/no-key fallback 的表现可以通过指标、场景回放和安全扫描比较，而不是只凭主观感觉。
- 玩家看到的是历史语气、身份反馈、行动阻力和下一步选择；看不到 raw prompt、provider payload、内部 tool/result、resolver、SQLite 或密钥细节。

## 2. 不可破坏边界

以下边界在 Ticket 0-8 全部有效：

- 本路线图落地本身不改变运行时行为；任何后续实现默认先在测试、shadow 或显式 env flag 下运行。
- `npm install && npm start` 仍应默认可运行，`AI_PROVIDER=mock` 或无 key 情况仍应可玩。
- 真实 provider 是质量增强，不得成为本地启动和完整书生路径的门槛。
- 完整书生路径不得破坏：`scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`。
- AI 可以生成叙事、草稿、评分建议、关系建议、受限 proposal、tool call 或 request-adjudication；AI 不得直接写 canonical `worldState`、SQLite 业务表、审计表、hidden ledger、榜单、官职任免、科举晋级、作弊处罚、财政刑名军务外交结论或持久化事务。
- `server.*` 只能是内部 resolver 或 audit label，不能成为 model-visible tool、provider function name、MCP `tools/list` 条目或玩家可伪造 call。
- critic / safety_gate 永远 review-only，不调用工具，不请求裁决，不写状态。
- quick_action、topic_draft、NPC 对话、交易议价、委派计划、囊箧说明和前端草稿任务仍是 draft-only 或 proposal-only，不能推进时间或裁决后果。
- provider key、base URL、raw prompt、raw provider payload、本地路径、raw SQLite row、raw audit、hidden notes、hidden intent、未公开关系、未公开任所和 hidden raw rows 不得进入浏览器、prompt 安全上下文、公开 trace、baseline artifact 或事件档案。
- 浏览器只能消费服务器安全 view、本地 UI 状态和草稿；不得代替服务器裁决资源、身份、交易、NPC 行动、经济结果、考试晋级、官职任免、地图行动、关系终局、婚姻、弹劾、定罪、背叛或 hidden 信息。
- 后端契约、API/view 类型、安全 projection、AI schema/provider facade、storage adapter 和核心 resolver 新增或重构时，优先纳入 TypeScript 检查；TypeScript 类型不能替代 Ajv 与服务器 runtime 校验。

## 3. 当前基线

S70 已建立 AI actor、prompt/tool 契约、多模型路由、AI 设置、月报、跳时、记忆、地图接口、provider AI-first smoke 和 JSON/SQLite parity。S71-S88 之后，数据库玩法 resolver、安全 projection、世界实体、NPC/资产经济、人物与素材安全、React 安全 view 消费和产品级读法已有大量边界。v2 应复用这些基础，不重写稳定模块，不把旧单次 provider 调用一次性替换为新 runtime。

当前主要短板：

- 远程 provider 多数仍偏单次 structured JSON 调用，工具协议尚未成为通用多步 tool loop。
- provider adapter 能力、strict schema、工具调用形状和 usage/latency/fallback 观测还不够统一。
- prompt pack 版本、fixtures、质量指标和 doctor 检查还需工程化。
- eval 已能守 schema 与安全边界，但还缺 scenario replay、A/B 比较、工具选择准确率、长程记忆一致性和成本/延迟指标。
- 检索已安全，但 evidenceRef、混合排序、记忆压缩与回放证据链还可继续强化。
- trace 还需要能串起 prompt pack、retrieval counts、provider step、tool result、validation flags 和 fallback reason 的 public summary。

## 4. 目标架构

v2 建议新增的核心层：

- `AiTaskRuntime`：统一任务 envelope、provider 选择、schema 校验、guardrail、budget、fallback 和 trace。
- `ProviderAdapter`：统一 Mock、OpenAI、Anthropic、DeepSeek、MiMo 的 structured output、tool calls、usage 和 capability 声明。
- `GameToolLoop`：执行 model tool request、服务器 tool runner、safe tool result projection、budget 和 pending/rejected 语义。
- `PromptRegistry`：登记 promptId、promptVersion、sceneType、actorTypes、schemaName、fixtures、qualityRubrics 和 forbiddenFields。
- `SafeRetrieval + EvidenceRef`：只从 public/player-visible/actor-visible projection 生成 stable evidenceRef，不索引 raw/hidden。
- `Trace + Eval + Replay`：保存 redacted public summary，支持本地回放和场景指标。

推荐目录方向仅供后续 Ticket 采用，Ticket 0 不创建这些代码目录：

```text
src/ai/runtime/
src/ai/providers/
src/ai/tools/
src/ai/prompts/
src/ai/retrieval/
src/ai/eval/
scripts/ai*.js
testdata/aiScenarios/
```

## 5. 切换策略

AI v2 不应一开始接管默认 `/api/game/turn`。后续实现建议经历三层开关：

```text
AI_RUNTIME_V2=0      旧路径默认，v2 只跑测试
AI_RUNTIME_V2=shadow v2 旁路运行，只记录 public trace，不影响玩家结果
AI_RUNTIME_V2=1      v2 正式输出，旧路径保留 fallback
```

任何 env flag、shadow trace 或 debug endpoint 都必须默认 hidden-safe；不能保存 raw prompt、provider payload、worldState、hidden/private refs、key、baseURL、本地路径或 raw SQLite row。

## 6. Ticket 0-8 路线图

### Ticket 0：路线图与 baseline 准备

目标：把 AI v2 规划落到仓库，并固定当前 AI 编排结构的 hidden-safe baseline，方便后续 runtime、tool loop、trace 和 eval 改造前后对比。

本步已落地范围：

- 新增本文件。
- 新增 [AI_V2_BASELINE_REPORT.md](AI_V2_BASELINE_REPORT.md)，记录 baseline 结构摘要、artifact 位置、验证和边界。
- 新增 `scripts/aiBaselineSnapshot.js` 与 `npm run ai:baseline`，汇总 prompt pack、schema、model route、tool definitions、provider capabilities 和 smoke/eval 命令版本。
- 新增 `test/aiBaselineSnapshot.test.js`，验证 baseline JSON 不包含敏感值、raw-only 字段、内部 resolver 名称或本地路径。
- `npm run eval:ai` 继续运行原有 eval，并额外写出 hidden-safe JSON artifact 到 `artifacts/ai-eval/latest.json`。
- 不改变 provider facade、prompt 内容、tool 执行、route/API/schema、存档、SQLite、浏览器 UI 或服务器裁决。

baseline 工具边界：

- baseline artifact 不得包含 key、baseURL、rawPrompt、providerPayload、worldState、hiddenNotes、localPath、rawSql 或 raw SQLite row。
- `artifacts/ai-baseline/latest.json` 与 `artifacts/ai-eval/latest.json` 均在 `artifacts/` 下，本地可重建、默认不入 Git。
- provider key 只记录为 `credentialConfigured` 布尔，不打印或保存具体 key、base URL 或 provider raw response。

验证：

```bash
npm run ai:baseline
node --test test/aiBaselineSnapshot.test.js
npm run eval:ai
npm run typecheck:server
npm run check:docs-governance
git diff --check
```

### Ticket 1：AI Task Runtime 骨架

目标：新增 runtime 骨架，但旧 provider facade 和默认运行路径继续可用。

本步已落地范围：

- 新增 `src/ai/runtime/aiTaskRuntime.js`、`aiTaskTrace.js`、`aiFallbackPolicy.js`、`aiBudgetManager.js` 与 `src/ai/providers/adapterContract.js`，形成旁路 `AiTaskRuntime` 骨架。
- `createAiTaskRuntime()` 与 `runAiTask()` 只在 Mock-only/test-only 边界内运行，先覆盖 `opening`、`quick_action`、`topic_draft` 三类低风险结构化任务；默认 `getProvider`、route/API 和旧 provider facade 不切换。
- runtime 会从 model route 收束预算，但 S92.2 三类任务强制 `toolBudget=0`、不请求 adjudication、不写 state、不调用服务器 resolver。
- ProviderAdapter 合约只接收/返回结构化 payload；旧 mock facade 可通过 `createProviderFacadeAdapter()` 包装为旁路 adapter。
- trace 只发布 public-safe 摘要，保留 task/route/provider/model/budget/validation/usage/tool/fallback 等 bounded metadata；raw prompt、provider payload、`worldState`、`statePatch`、key、base URL、本地路径和内部 `server.*` 引用会被丢弃或拒绝。
- fallback policy 为三类已支持任务生成 schema-valid Mock payload，并只记录 redacted fallback reason。

建议范围：

- 新增 `src/ai/runtime/aiTaskRuntime.js`、`aiTaskTrace.js`、`aiFallbackPolicy.js`、`aiBudgetManager.js`。
- 新增 `src/ai/providers/adapterContract.js`。
- 先实现 Mock-only 或测试-only 路径，覆盖 opening、quick_action、topic_draft 等低风险任务。
- trace 只输出 redacted public summary，并拒绝 raw prompt、provider payload、`worldState`、`statePatch`、key/path/base URL、`prompt=...` / `key=...` / `token=...` 敏感赋值和内部 `server.*` 引用。

验收：

```bash
node --test test/aiTaskRuntime.test.js test/aiTaskTrace.test.js test/aiFallbackPolicy.test.js
npm run eval:ai
npm run typecheck:server
npm run check:docs-governance
git diff --check
```

### Ticket 2：ProviderAdapter 与 strict structured output 渐进

目标：统一 provider adapter 契约，并让 OpenAI 等支持者按 route/capability 渐进启用 strict structured output。

建议范围：

- 新增或扩展 provider adapter contract、response normalizer 和 OpenAI adapter。
- 不删除旧 `src/ai/providers/openai.js`，先做兼容层。
- 测试使用 fake client，不调用真实网络。
- 不支持 strict 的 provider 必须降级到 `strict=false + Ajv validate + normalization/fallback`，不得直接信任 provider 输出。

S92.3 已落地范围：

- 新增 `src/ai/providers/providerResponseNormalizer.js`，支持 Responses `output_text`、Responses `output[].content[].text`、Chat `choices[].message.content` / content parts、parsed object 和 usage 摘要，最终仍调用 `normalizeModelPayload()` 与 `validatePayload()`。
- 新增 `src/ai/providers/openaiAdapter.js`，支持 OpenAI Responses / Chat-compatible fake client 与 `requestJson` 注入；route 显式 `allowStrictSchema` 且 capability 支持时发送 `json_schema strict:true`，否则保持 `strict:false`。
- strict schema 请求被 provider 拒绝时，以非 strict schema 请求重试；坏 JSON、schema 失败或 raw/provider 污染不进入 ok payload，而交由 runtime fallback。
- `src/ai/providers/openai.js`、`getProvider()`、streaming、route/API、prompt/tool 权限、存档和服务器裁决均未切换。

验收：

```bash
node --test test/openaiAdapter.test.js test/providerResponseNormalizer.test.js
npm run eval:ai
npm run smoke:provider:tools
```

真实 key 环境可选：

```bash
OPENAI_REQUIRED=1 AI_PROVIDER=openai AI_PROVIDER_TIMEOUT_MS=90000 npm run smoke:provider:tools
ANTHROPIC_REQUIRED=1 AI_PROVIDER=anthropic AI_PROVIDER_TIMEOUT_MS=90000 npm run smoke:provider:tools
```

### Ticket 3：Agentic Tool Loop v2 Mock-first

目标：让 Mock provider 先跑通完整 tool loop，再接真实 provider。

建议范围：

- 新增 `src/ai/tools/gameToolLoop.js`、`toolCallNormalizer.js`、`toolGuardrails.js`、`toolResultProjector.js`。
- 支持 read tool、proposal、request_adjudication 的 pending/rejected mock result。
- 强制 tool budget，proposal/request_adjudication 顺序执行。
- tool result 回填模型时只包含 `publicResult`、公开拒绝原因、必要 `auditRef` 和 `modelFollowUpHint`。

S92.4 落地状态（2026-05-29）：

- 已新增 `src/ai/tools/gameToolLoop.js`、`toolCallNormalizer.js`、`toolGuardrails.js`、`toolResultProjector.js` 和 `test/aiToolLoop.test.js`、`test/aiToolLoopRedaction.test.js`。
- 当前为旁路 Mock/test-only 工具循环：支持 static `modelSteps` 与 fake/mock provider `generateOrRequestTools()`，可以跑 read -> proposal/request_adjudication -> final payload 的本地闭环；默认普通 turn、真实 provider tool calling、streaming 和 runtime v2 输出仍未切换。
- provider-visible tool list 只输出 function name、description、input schema；tool result projector 只输出 `status`、`publicResult`、`rejectionReasons`、`auditRef`、`modelFollowUpHint`。full server result、developer audit、resolver label、permission/cooldown/mockFallback、private refs、raw provider payload、prompt、key、base URL、本地路径、`worldState`、`statePatch` 和内部 `server.*` 不进入模型回填。

验收：

```bash
node --test test/aiToolLoop.test.js test/aiToolLoopRedaction.test.js test/aiToolProtocolContract.test.js
npm run smoke:provider:tools
```

### Ticket 4：Prompt Registry v2

目标：给 prompt pack 加版本、元数据、fixtures 和 doctor 检查，不破坏旧 prompt API。

建议范围：

- 新增 `src/ai/prompts/registry.js` 和少量 fragments/packs。
- 先迁移 `world_turn` 与 `topic_draft` 或等价低风险 pack。
- 保持现有 `buildPromptInstructions` 兼容。
- 每个 pack 必须登记 promptId、promptVersion、sceneType、actorTypes、taskType、schemaName、fixtures、supportsTools、qualityRubrics、forbiddenFields。

验收：

```bash
node scripts/aiPromptPackDoctor.js
node --test test/aiPromptRegistry.test.js test/prompts.test.js
npm run eval:ai
```

### Ticket 5：AI Eval v2 场景回放

目标：新增 scenario-based eval，不替代旧 `npm run eval:ai`。

S92.5 已落地范围（2026-05-29）：

- 新增 `src/ai/eval/aiScenarioRunner.js` 与 `src/ai/eval/aiMetrics.js`，支持 `runtime_task`、`mock_provider_task`、`tool_loop` 和 `static_payload` 四类 Mock-only 场景回放。
- 新增 `testdata/aiScenarios/s92-5-core.json`，首批覆盖 opening runtime、普通 turn mock provider、topic draft pending 边界和 tool loop 预算边界；当前采用 JSON fixture，暂不新增 YAML 依赖。
- 新增 `scripts/aiEvalV2.js` 与 `npm run eval:ai:v2`，输出 summary-only artifact 到 `artifacts/ai-eval-v2/latest.json`，artifact 只包含 schema version、场景数量、指标汇总和失败摘要，不保存 raw prompt、provider payload、`worldState`、`statePatch`、hidden notes、密钥、本地路径或内部 resolver。
- 首批指标已落地：`schema_valid`、`hidden_leak`、`server_bypass`、`historical_anchor`、`tool_budget_ok`、`pending_not_fact`、`latency_ms`、`fallback_reason`。
- 旧 `npm run eval:ai`、默认 provider facade、真实 provider、普通 turn 路径、runtime 输出、tool loop 输出和服务器裁决均未切换；S92.5 只新增本地回放与测试工具。

建议范围：

- 新增 scenario runner、metrics 和首批 YAML/JSON fixtures。
- 首批指标：schema_valid、hidden_leak、server_bypass、historical_anchor、tool_budget_ok、pending_not_fact、latency_ms、fallback_reason。
- 默认只用 Mock provider，不调用真实 provider，不保存 raw prompt/provider payload。

验收：

```bash
npm run eval:ai:v2
node --test test/aiScenarioRunner.test.js
npm run eval:ai
```

### Ticket 6：EvidenceRef 与安全检索升级

目标：让 prompt/context/tool proposal 统一引用 stable evidenceRef。

建议范围：

- 新增 `src/ai/retrieval/evidenceRefResolver.js` 与 retrieval ranker。
- 渐进接入 `src/ai/promptContextAssembler.js`。
- 只允许 public/player_visible/actor_visible projection。
- evidenceRef summary 必须过滤 raw/provider/prompt/path/key/hidden/SQLite 污染。

验收：

```bash
node --test test/evidenceRefResolver.test.js test/promptContextAssembler.test.js
npm run eval:ai
npm run typecheck:server
```

### Ticket 7：Trace 与 provider health

目标：统一 AI public trace summary 与 provider 失败分类。

建议范围：

- 扩展 `aiTaskTrace`，新增 provider health manager。
- public trace 只包含 traceId、taskKind、taskType、promptPackId、promptVersion、provider/model、latency、status、fallbackReason、retrieval counts、tool counts、validation flags。
- provider health 分类至少包含 missing_key、timeout、schema_invalid、rate_limit、network_error、tool_shape_mismatch、safety_reject。

验收：

```bash
node --test test/aiTaskTraceRedaction.test.js test/providerHealthManager.test.js
npm run eval:ai
npm run smoke:provider:route
```

### Ticket 8：前端 AI Debug 面板与反馈入口

目标：只展示 public trace summary 和玩家反馈，不暴露内部 prompt/tool/provider 细节。

建议范围：

- 新增 safe trace endpoint 时必须对齐 route response helper、server contracts 或局部 JSDoc typedef。
- 前端只展示 task、provider/model、latency、status、fallback、tool count、retrieval domain count、validation flags。
- 玩家反馈枚举可为：有用、出戏、忘记前情、太短、太长、不符合身份。
- 不能显示 raw prompt、provider payload、hidden/private refs、key、baseURL、本地路径、raw SQLite row。

验收：

```bash
node --test test/aiTraceRoute.test.js
npm run typecheck:server
npm run typecheck:client
npm run smoke:browser
npm run eval:ai
```

## 7. 通用验证矩阵

本节中的 `eval:ai:v2`、`aiPromptPackDoctor.js`、`aiToolSchemaDoctor.js` 等 v2-only 命令，需由对应 Ticket 新增后才纳入当前必跑项；在脚本尚未存在时，只把它们视为该 Ticket 的验收目标。

每个 AI v2 代码票至少运行：

```bash
npm run typecheck:server
npm run eval:ai
node --test test/*.test.js
```

改 prompt、schema、tool 时额外运行：

```bash
node scripts/aiPromptPackDoctor.js
node scripts/aiToolSchemaDoctor.js
npm run eval:ai:v2
npm run smoke:provider:tools
```

改 provider adapter 时额外运行：

```bash
npm run smoke:provider:tools
npm run smoke:provider:ai-first
npm run smoke:provider:route
```

前端或 debug 面板相关运行：

```bash
npm run typecheck:client
npm run test:client
npm run smoke:browser
```

文档和治理相关运行：

```bash
npm run check:docs-governance
git diff --check
```

有真实 key 且需要 required 验收时运行：

```bash
MIMO_REQUIRED=1 AI_PROVIDER_TIMEOUT_MS=90000 npm run smoke:provider:tools
MIMO_REQUIRED=1 AI_PROVIDER_TIMEOUT_MS=90000 npm run smoke:provider:ai-first
OPENAI_REQUIRED=1 AI_PROVIDER=openai AI_PROVIDER_TIMEOUT_MS=90000 npm run smoke:provider:tools
ANTHROPIC_REQUIRED=1 AI_PROVIDER=anthropic AI_PROVIDER_TIMEOUT_MS=90000 npm run smoke:provider:tools
```

缺 key skip 是允许的；显式 required smoke 缺 key、不可达或 schema/tool shape 失败时不得被 Mock fallback 掩盖。

## 8. 回滚策略

- Ticket 0 只新增文档与本地 baseline/eval 工具，回滚即删除本文件、baseline 报告、baseline 脚本、对应测试和 npm script，并还原 eval artifact 写出逻辑；不影响运行时 AI 路径。
- Ticket 1-7 应默认保持旧 runtime 路径；失败时可关闭 `AI_RUNTIME_V2` 或停用新脚本。
- Ticket 2 strict schema 失败时按 route/provider 降级到 strict=false，并保留 Ajv/runtime 校验。
- Ticket 3 tool loop 超时、预算耗尽或 tool shape mismatch 时返回 fallback 或 rejected，不写 session。
- Ticket 4 prompt registry 迁移失败时单 pack 回退旧 `promptPacks.js` 入口。
- Ticket 5 eval v2 失败不得阻断旧 eval，除非后续明确升为门槛。
- Ticket 8 trace endpoint 或前端 debug 面板出现泄漏风险时先禁用 endpoint，保留本地 redacted trace。

## 9. 质量 Rubric

AI v2 的质量评分可以在 eval/replay 中逐步落地：

```text
20% schema/safety
15% tool correctness
15% evidence grounding
15% historical tone
10% role consistency
10% memory continuity
10% player actionability
5% latency/cost
```

schema/safety 是硬门槛。只要出现 hidden leak、server bypass、raw key/path/prompt/provider payload/SQLite row 泄漏，整体失败。

## 10. 维护规则

- 后续主代理若把 AI v2 作为活动步骤，应同步 [SHARED_CONTEXT.md](SHARED_CONTEXT.md) 和 [DEVELOPMENT_STEPS.md](DEVELOPMENT_STEPS.md)，必要时同步开发 brief、README、AI 控制矩阵、prompt 契约或 tool 契约。
- 新增 route/API response shape 时必须对齐 `src/contracts/serverContracts.ts` 或局部 JSDoc typedef，并运行 `npm run typecheck:server`。
- 新增 prompt/schema/tool 必须有测试和 eval fixture。
- 新增依赖、外部 tracing、MCP、LangGraph、检索库或 provider SDK 前，必须走依赖治理记录。
- 后续实施应继续中文记录范围、验证、风险、skip 条件和回滚方式；纯英文只用于代码标识符、命令、第三方术语或外部协议清晰度。
