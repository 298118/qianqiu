# S87 后端 route/API 响应类型覆盖规划

本文是 S86 后端 TypeScript 渐进迁移后的下一轮专项。目标不是把大型 route 文件一次性改成 TypeScript，而是先把最容易漂移、最影响前端和安全边界的 route/API response shape 纳入可检查契约。

## 1. 当前判断

S86 已建立 `npm run typecheck:server`、`src/contracts/serverContracts.ts`、`src/contracts/runtimeGuards.ts` 和少量高风险模块的选择性 `@ts-check`。当前后端仍以 CommonJS JavaScript 运行，`npm start` 不依赖 `dist/server`。

下一轮最值得优先补的是 route response：

- `src/routes/game.js` 聚合了开局、读档、player-state、turn、SSE、inventory、NPC、trade、delegation 和兼容 state route，字段来源多、历史兼容多。
- `buildCommonTurnViews` 是多条 game route 共享的响应 view 聚合点，一旦字段遗漏或 raw ledger 回流，前端、prompt 和安全 projection 都会受影响。
- 考试 route 与 AI route 的 response 已被 React 和 provider 设置面板持续消费，手写前端类型与服务端实际返回仍可能漂移。
- S81-S85 后新增 inventory/NPC/trade/delegation/economy/active request/relationship action 等 view，适合用契约先固定 public shape。

因此，S87 的结论是：继续推进 TypeScript，但先做 response contract 和局部 JSDoc typedef，不做大型 route whole-file `@ts-check` 或 `.js -> .ts` 大迁移。

## 2. 总原则

- 后端 route/API response shape 新增或重构时，必须对齐 `src/contracts/serverContracts.ts` 或局部 JSDoc typedef，并运行 `npm run typecheck:server`。
- 优先给 response builder、route helper、局部 payload 变量和共享 contract 加类型；大型 route 文件只在切片稳定后逐段纳入检查。
- 不得为了启用类型检查一次性 whole-file `@ts-check` `src/routes/game.js`、`src/routes/exam.js` 或 `src/routes/ai.js` 这类高耦合 route 文件。
- 类型不能替代 Ajv、runtime guard、服务器白名单、clamp、hidden/raw 清洗、权限校验、反作弊或持久化事务。
- 前端继续只消费安全 API/view；共享类型不得让浏览器 import 后端 runtime、raw ledger、provider payload、完整 prompt、本地路径或 key。
- route 类型覆盖必须保护兼容 `worldState` 的 raw ledger 剥离，不得把 `actorMemoryLedger`、`sessionSummary`、`marketPriceLedger`、`npcEconomyLedger` 或未来 hidden 私档回填给玩家 payload。

## 3. 非目标

- 不把 `src/routes/game.js`、`src/routes/exam.js`、`src/routes/ai.js` 一次性改成 `.ts`。
- 不改变 `npm start` 的 CommonJS 运行方式，不新增 server build 作为启动前置。
- 不顺手重构玩法规则、经济结算、考试晋级、NPC 行动、AI 权限或 SQLite schema。
- 不为了类型通过而放宽安全 projection、删除 runtime 校验、扩大 player-state 可见字段或让前端裁决资源/交易/关系/任务结果。
- Rust 仍不进入 route、AI 编排、resolver 或 canonical persistence；本专项只处理 TypeScript/JSDoc 契约。

## 4. S87 小步骤

| ID | 状态 | 目标 | 范围 |
| --- | --- | --- | --- |
| S87.1 | TODO | Route response contract 扩展 | 扩展 `src/contracts/serverContracts.ts`，补 common route envelope、turn response、安全 route views、inventory/NPC/trade/delegation/exam/AI route 的 public response 轮廓；补 typecheck fixture 断言 raw ledger 不可进入玩家 response。 |
| S87.2 | TODO | `buildCommonTurnViews` 局部类型边界 | 给 `src/routes/game.js` 内 `buildCommonTurnViews` 及其返回值增加局部 JSDoc typedef 或小型 response builder helper；先覆盖共享 view bundle，不整文件 `@ts-check`。 |
| S87.3 | TODO | start/state/player-state/turn response 对齐 | 对齐 `POST /api/game/start`、`GET /api/game/player-state/:sessionId`、兼容 `GET /api/game/state/:sessionId`、`POST /api/game/turn` 和 SSE 完整 JSON payload 的类型边界，保护 metadata、redaction 和兼容 `worldState` 剥离口径。 |
| S87.4 | TODO | Inventory/NPC/trade/delegation route payload 类型 | 覆盖 `inventory`、`inventory-transfer`、`npcs`、`npc`、`npc-interaction`、`trade`、`npc-command` response shape，固定服务器裁决字段和公开 view，拒绝客户端伪造 outcome、资源、关系或任务结果。 |
| S87.5 | TODO | Exam route payload 类型 | 覆盖 `POST /api/exam/question|progress|submit` 的 payload 与 `toExamPayload` 输出，确保 examProcedure/examinerPanel/examHonor/appointmentTrack 等 view 与前端消费类型一致。 |
| S87.6 | TODO | AI route response 类型 | 覆盖 `GET/POST /api/ai/settings/global`、兼容 session settings、`quick-actions` 和 `topic-draft` response shape，固定 provider/key 脱敏、scope、route policy view 和草稿建议边界。 |
| S87.7 | TODO | S87 验收与归档 | 汇总 typecheck、focused route tests、docs governance、client typecheck 或 smoke 证据；更新 brief、README、共享上下文和活动台账；必要时归档 S87 并列出下一轮 AI remote helper payload / SQLite derived build row 类型覆盖。 |

## 5. 推荐实施顺序

第一步做 S87.1。先让 contract 描述现在已经存在的 public response，不在 route 里大改逻辑。

第二步做 S87.2-S87.3。`buildCommonTurnViews` 和 start/player-state/turn 是 route response 的主干，优先覆盖能减少后续所有 API 漂移。

第三步做 S87.4-S87.6。按业务簇覆盖 NPC/资产/储物/交易/委派、考试和 AI route；每个簇用 focused tests 证明 runtime response 仍与契约一致。

最后做 S87.7。把完成范围迁入归档或在台账中标明下一轮待办，避免活动路线图长期堆 DONE 长表。

## 6. 验证口径

每个 S87 coherent change 至少按范围运行：

- `npm run typecheck:server`。
- 涉及共享前端 API 类型时运行 `npm run typecheck:client`。
- 对应 focused Node route tests，例如 `test/gamePlayerStateRoute.test.js`、`test/gameTurn*.test.js`、`test/npcInventoryRoutes.test.js`、`test/exam*.test.js`、`test/aiSettingsRoute.test.js`、quick-actions/topic-draft 相关测试。
- 涉及治理、路线图、brief 或 README 时运行 `npm run check:docs-governance` 与 `node --test test/documentationGovernance.test.js`。
- 涉及 API/schema、运行时行为、验证工具或共享契约时运行 `npm test`，并在提交前执行只读子代理复审。
- `git diff --check`。

## 7. 回滚策略

- S87.1-S87.6 默认只增加 contract、JSDoc、局部 helper 和测试，不改变 route 运行入口；失败时可退回本步新增类型与测试。
- 如果局部 `@ts-check` 暴露大量历史隐式 any，应先拆小 helper 或补 typedef，不应为通过检查重写整条 route。
- 若发现 contract 与 runtime 不一致，优先修正 response builder 或安全 projection，再修正前端类型；不得用扩大玩家 payload 或删除 redaction 的方式让类型“对齐”。
