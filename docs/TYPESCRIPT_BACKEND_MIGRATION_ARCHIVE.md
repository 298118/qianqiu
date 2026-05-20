# S86 后端 TypeScript 渐进迁移归档

本文归档 S86.1-S86.7 的首轮完成范围。S86 的目标不是把后端一次性改写为 TypeScript，而是在不改变 `npm start`、Mock 默认可玩、JSON 默认存档和服务器裁决边界的前提下，建立后端类型检查、共享契约、风险边界类型化和后续迁移规范。

## 完成范围

| ID | 状态 | 完成内容 | 验证 |
| --- | --- | --- | --- |
| S86.1 | DONE | 新增 `tsconfig.server-check.json` 与 `npm run typecheck:server`。server check 使用现有 TypeScript 依赖、`allowJs` 和选择性 `@ts-check`，覆盖 `server.js`、`src/contracts/**/*.ts`、安全 projection、AI facade/route policy 和 storage/session 边界，不改变 `npm start`。 | `npm run typecheck:server` |
| S86.2 | DONE | 新增 `src/contracts/serverContracts.ts` 和 `src/contracts/runtimeGuards.ts`，建立 type-only contract 骨架，清点 API response、安全 route view、AI task/provider/tool envelope、session record、storage adapter 和 SQLite row 命名。 | `npm run typecheck:server`、`npm run build:server:probe` |
| S86.3 | DONE | `clientWorldState`、`redactedState` 和 `stateRules` 已纳入 `@ts-check`；contract 固化 `RAW_LEDGER_KEYS`、`RawLedgerExcludedWorldState`、`PlayerVisibleState`、`PlayerStateEnvelope`、`SafeRouteViews`、`GameStartResponse`、`GameStateResponse`、`PlayerStateResponse` 和 `GameTurnResponse`，继续保护 raw ledger 剥离和 provider/server-owned patch 边界，并用 compile-time fixture 断言 raw ledger 不能进入 public route worldState。 | `node --test test/redactedState.test.js test/gamePlayerStateRoute.test.js test/stateRules.test.js` |
| S86.4 | DONE | `src/ai/index.js` 和 `src/ai/modelRoutePolicy.js` 纳入 `@ts-check`；contract 固化 `AiTaskType`、`AiProviderName`、`AiModelRoute`、`AiModelRoutePolicy`、`AiProviderResponse`、`AiProviderFacade` 和 `AiToolEnvelope`。Ajv schema 和 server resolver 仍是最终门禁。 | `node --test test/aiSchemas.test.js test/remoteHelpers.test.js test/modelRoutePolicy.test.js test/aiToolProtocolContract.test.js` |
| S86.5 | DONE | `sessionRecord`、`sessionStore`、JSON adapter 和 SQLite adapter 纳入 `@ts-check`；contract 固化 `SessionMetadata`、`SessionRecord`、`SaveListEntry`、`SessionStorageAdapter`、`SqliteWorldSessionRow` 和 `BaseSqliteDerivedRow`，不改变 JSON/SQLite 读写语义。 | `node --test test/sessionStoreAdapterContract.test.js test/sqliteNpcInventoryTables.test.js test/sqliteNpcInventoryAdapterIntegration.test.js` |
| S86.6 | DONE | 新增低副作用 `.ts` 试点：`src/contracts/serverContracts.ts` 为 type-only contract，`src/contracts/runtimeGuards.ts` 为纯 guard/helper；新增 `tsconfig.server-probe.json` 与 `npm run build:server:probe`，验证 Node16/CommonJS 输出、declaration 和 source map 到 `.tmp/server-ts-probe`。生产运行时不直接 require `.ts`，`.tmp/` 已加入 Git 忽略。 | `npm run build:server:probe` |
| S86.7 | DONE | 将 `typecheck:server` 纳入 S86 后续验证口径，并固化“允许保留 JS、必须纳入 TS 检查、允许 Rust 评估”的边界。 | `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`、提交前只读复审 |

## 迁移规范

- 允许保留 JS：稳定、低风险、很少改动的 CommonJS 模块可以继续保留 `.js`，但被安全/API/AI/storage 边界依赖时应至少进入 `typecheck:server` 或补充 contract 类型。
- 必须纳入 TS 检查：新增或重构后端契约、API/view response、安全 projection、AI schema/provider facade、storage adapter、session record、SQLite row、核心 resolver 输入输出时，优先使用 `.ts` type-only contract 或在 JS 中启用 `@ts-check` + JSDoc。
- 不允许为了类型通过而放宽 runtime 安全：TS 类型不能替代 Ajv、服务器白名单、clamp、hidden/raw 清洗、权限校验、SQLite 事务、Mock/no-key fallback 或 redaction tests。
- `.ts` 试点边界：短期只允许 type-only contract、纯 helper、离线验证或低副作用模块进入 `.ts`。若要让生产 runtime 直接使用编译产物，必须另开步骤设计 `dist/server`、source map、watch、Node test 路径和 `npm start` 兼容。
- Rust 边界：Rust 仍不进入 Express routes、AI 编排、resolver、科举晋级、交易/婚姻/弹劾结果或 canonical persistence。只有已有 profiling 证据，且可隔离为可选 CLI/WASM/离线工具，不影响 `npm install && npm start` 时才进入评估。

## 后续建议

- 下一轮可把 `src/routes/game.js` 的 `buildCommonTurnViews` response shape 通过 JSDoc typedef 与 `SafeRouteViews` 对齐，但不要在同一步强行全文件 `@ts-check`。
- 逐步把 AI schema 名称、provider remote helper 入站 payload 和 SQLite 派生表 build rows 用 contract 类型标注；每次扩大检查面都先跑 focused tests。
- 如果未来前端要复用后端 contract，只能 import type-only 文件或生成的 `.d.ts`，不得让浏览器 import 后端 runtime、raw ledger 或 resolver。
