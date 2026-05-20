# S87 后端 route/API 响应类型覆盖归档

S87 已完成后端 route/API public response shape 首轮类型覆盖。该专项承接 S86 的渐进 TypeScript 地基，目标是在不把大型 route 文件整体迁移到 TypeScript、也不启用 whole-file `@ts-check` 的前提下，把最容易漂移的玩家 API 响应纳入 contract、局部 JSDoc helper、focused tests 和 `npm run typecheck:server`。

## 完成范围

- S87.1：扩展 `src/contracts/serverContracts.ts`，补齐 common route envelope、`CommonTurnViews`、start/state/player-state/turn/SSE、inventory/NPC/trade/delegation、exam question/progress/submit、AI settings/quick-actions/topic-draft/connection-test 等 public response contract。
- S87.1：扩展 `src/contracts/serverContracts.typecheck.ts`，断言 start/state/turn/exam response 的兼容 `worldState` 拒绝 raw ledger key，player-state response 为平铺安全 route views。
- S87.2：新增 `src/routes/routeResponses.js`，以局部 `@ts-check` JSDoc identity helper 覆盖 route response builders，避免给 `src/routes/game.js`、`src/routes/exam.js`、`src/routes/ai.js` 整文件开检查。
- S87.2：`buildCommonTurnViews()` 通过 `defineCommonTurnViews()` 标记为 `CommonTurnViews`，继续只聚合安全 view。
- S87.3：start/saves/state/player-state/turn/SSE preview/final payload 接入 response helper；兼容 `worldState` 继续使用 `buildClientWorldState()`，SSE preview contract 明确不含 `worldState`。
- S87.4：inventory、inventory-transfer、npcs、npc detail、npc-interaction、trade、npc-command route 接入专门 response helper，固定服务器裁决字段和公开 view。
- S87.5：exam `toExamPayload()`、progress 和 submit route 接入 exam response helper，固定 examProcedure/examinerPanel/examHonor/appointmentTrack 等 view 与 public `worldState` 边界。
- S87.6：AI connection-test、global/session settings、quick-actions 和 topic-draft route 接入 AI response helper，保留 provider/key 脱敏、scope、route policy view 和草稿建议边界。
- S87.7：新增 `test/routeResponseContracts.test.js`，在运行时检查 public route `worldState` 不得携带 `actorMemoryLedger`、`sessionSummary`、资产/背包/NPC/交易/委派/经济/主动来函等 raw ledger key；补强兼容 state route raw ledger 剥离断言。

## 安全边界

- S87 不改变 `npm start` 的 CommonJS 运行方式，不新增 server build 前置。
- S87 不把 `src/routes/game.js`、`src/routes/exam.js`、`src/routes/ai.js` 改为 TypeScript，也不对这些大型 route 使用 whole-file `@ts-check`。
- TypeScript/JSDoc 只固定 public response shape；Ajv、runtime guard、服务器白名单、clamp、hidden/raw 清洗、权限校验、反作弊、交易/资源/NPC/考试/官职裁决和持久化事务仍由既有 runtime 逻辑负责。
- AI settings POST 仍返回现有兼容 `settings` / `routePolicy` 字段，但 contract 明确它们属于 public-safe route response；前端仍应优先依赖 `aiSettingsView`、`aiInvocationSummaryView` 和 `aiControlAuditView`。
- 新增 `routeResponses` helper 会在运行时拒绝 public `worldState` 中出现 raw ledger key，避免 contract 与 `buildClientWorldState()` 删除清单漂移。

## 验证证据

- `node --check src/routes/game.js`
- `node --check src/routes/exam.js`
- `node --check src/routes/ai.js`
- `node --check src/routes/routeResponses.js`
- `npm run typecheck:server`
- `node --test test/routeResponseContracts.test.js test/gamePlayerStateRoute.test.js test/npcInventoryRoutes.test.js test/quickActionRoute.test.js test/topicDraftRoute.test.js test/aiSettingsRoute.test.js`
- `node --test test/examTravel.test.js test/mapRuntimeRoute.test.js test/streamingTurnRoute.test.js test/actorMemoryRoute.test.js`
- `node --test test/aiControlRedTeam.test.js test/examHonorsRoute.test.js test/appointmentTracksRoute.test.js test/gameSavesRoute.test.js test/safeWorldSearch.test.js test/topicSurfaceView.test.js`
- `npm run build:server:probe`
- `npm run typecheck:client`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`（985 项）
- `git diff --check`

提交前只读复审发现的 saves helper 缺口和 player-state 类型负例缺口已修复；最终结果以 `docs/DEVELOPMENT_STEPS.md` 最近进度记录为准。

## 后续建议

下一轮建议从 AI remote helper payload 与 SQLite derived build row 类型覆盖开始：先固定 remote helper/provider payload 的 public-safe envelope，再覆盖 SQLite 派生 row builder 的 JSDoc/TS 检查，继续避免一次性重写稳定 CommonJS 模块。
