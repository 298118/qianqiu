# S86 TypeScript 后端渐进迁移与 Rust 评估规划

本文是《千秋》后端 TypeScript 渐进迁移和 Rust 使用边界的活动规划。它不是一次性重写计划，而是把类型系统优先补到最容易漂移、最影响安全边界和后续维护的地方。

## 1. 当前判断

当前前端已经是 React + TypeScript + Vite，后端、脚本和 Node 测试仍以 CommonJS JavaScript 为主。最近检查到的规模约为：

- `client/` 下 TypeScript / TSX 文件约 48 个，约 1.45 万行。
- `server.js`、`src/`、`scripts/`、`test/` 下 JavaScript 文件约 379 个，约 12.8 万行。

这个体量继续使用纯 JavaScript 仍能运行，但维护风险会逐步集中在以下边界：

- 后端实际 API/view response 与 `client/src/api/types.ts` 手写类型漂移。
- `worldState`、server-owned ledger、安全 projection 和兼容 `worldState` 过滤边界字段多、链路长。
- AI schema、provider facade、Mock fallback、Ajv 校验和 server resolver 的输入输出契约复杂。
- JSON/SQLite adapter、派生表修复和安全 view 之间需要长期保持一致。

因此，结论是：后端需要进入 TypeScript 迁移，但必须渐进、可回滚、可审查。

## 2. 总原则

- 不做全仓 `.js -> .ts` 的大爆破，不为了语言迁移重写稳定模块。
- 先建立类型检查和共享契约，再迁移高风险模块，最后再决定是否切换后端编译产物。
- `npm install && npm start`、默认 `AI_PROVIDER=mock`、完整书生路径和 JSON 默认存档必须持续可用。
- TypeScript 类型只能做开发期约束，不能替代 Ajv、服务器白名单、clamp、hidden/raw 清洗、权限校验或持久化事务。
- 后端新增或重构的契约、API/view 类型、安全 projection、AI schema/provider facade、storage adapter 和核心 resolver，优先使用 TypeScript；暂不迁移的 JavaScript 至少应通过 JSDoc / `.d.ts` 纳入 TypeScript 检查。
- 前端继续只消费安全 API/view，不因为共享类型而获得 raw ledger、hidden dossier、provider payload、完整 prompt、本地路径或 key 的读取权。
- Rust 不进入当前核心玩法重写；只有在有性能证据且能隔离为可选工具时再评估。

## 3. 非目标

- 不把 Express、AI provider、游戏 resolver、存档系统一次性改成 Rust。
- 不引入远程存档、账号体系、多人同步、云数据库或托管服务。
- 不用类型迁移顺手重构玩法规则、AI 权限、SQLite schema、前端信息架构或素材 pipeline。
- 不因为 TypeScript 迁移降低 runtime validation、Mock/no-key fallback 或安全 projection 测试覆盖。

## 4. S86 小步骤

| ID | 状态 | 目标 | 范围 |
| --- | --- | --- | --- |
| S86.1 | TODO | 后端 TS 检查地基 | 新增 `tsconfig.server-check.json` 与 `npm run typecheck:server`，优先 `allowJs` / `checkJs` 覆盖入口、契约和高风险模块，不改变 `npm start` 运行方式。 |
| S86.2 | TODO | 契约清点与共享类型骨架 | 清点 API response、安全 view、AI task、session record、storage row 和 frontend API 类型，建立 type-only contract 目录和命名规范。 |
| S86.3 | TODO | 安全 view 与状态边界纳入类型检查 | 先让 `clientWorldState`、`redactedState`、route view builder、`stateRules` 和近期 raw ledger 剥离清单进入 JSDoc/TS 检查。 |
| S86.4 | TODO | AI schema 与 provider facade 类型化 | 为 AI tasks、tool envelope、provider response、Mock fallback 和 route policy 建立 TS 类型或 declaration，继续以 Ajv/runtime schema 为最终门禁。 |
| S86.5 | TODO | Storage/session 类型化 | 为 JSON envelope、SQLite session row、派生表 row、安全 repair/sync helper 建类型，验证 JSON/SQLite parity 不变。 |
| S86.6 | TODO | 小范围 `.ts` 试点 | 选择 1 到 3 个低副作用纯模块试点从 JS 转 TS，决定 CommonJS 输出、source map、dev/watch 和测试接线，不切换全后端。 |
| S86.7 | TODO | 后端 TS 验收和迁移规范固化 | 将 `typecheck:server` 纳入相关验证口径，记录允许保留 JS、必须迁移 TS、允许 Rust 评估的边界，并归档 S86。 |

## 5. 推荐实施顺序

第一阶段先做 S86.1-S86.2。目标不是“马上写 TS”，而是让仓库先知道哪些边界需要类型保护，并能在不改运行方式的情况下发现明显字段漂移。

第二阶段做 S86.3-S86.5。优先覆盖安全 view、AI schema 和 storage/session，因为这些地方一旦漂移，会直接影响玩家可见内容、AI 权限、hidden 信息过滤和存档修复。

第三阶段做 S86.6-S86.7。只有当前两阶段稳定后，才把少量纯模块改成 `.ts` 并评估是否需要后端编译输出。若试点导致 `npm start`、Node test、smoke 或开发体验明显变差，应回退到 JSDoc/检查式迁移。

## 6. 技术路线建议

- 保持当前 CommonJS 运行口径，短期不设置 package-level `"type": "module"`。
- 初始 `typecheck:server` 使用现有 `typescript` devDependency，不新增编译依赖。
- 初始阶段允许 JS + JSDoc + `.d.ts` 并存；`.ts` 文件只在试点阶段引入。
- 共享类型不得让浏览器 import 后端 runtime 代码；type-only contract 应与 server resolver 分离。
- 若后续切换编译产物，应单独设计 `dist/server`、source map、watch、Node test 路径、stack trace 和 `npm start` 兼容。
- 类型命名要反映安全边界，例如 `RawWorldState`、`PlayerVisibleState`、`NpcActiveRequestView`、`SqliteNpcActiveRequestRow`，避免把 raw ledger 和 view 混用。

## 7. 验证口径

每个 S86 coherent change 至少按范围运行：

- `npm run typecheck:server`，S86.1 后新增。
- `npm run typecheck:client`，涉及共享契约或前端 API 类型时必须运行。
- 聚焦 Node tests，例如 route、schema、storage parity、安全 redaction 或 AI safety tests。
- `npm run check:docs-governance` 和 `node --test test/documentationGovernance.test.js`，涉及治理、路线图或 brief 时运行。
- `npm test`，当迁移影响共享契约、runtime 行为、测试工具、provider facade、storage adapter 或安全 view 时运行。
- `git diff --check`。

## 8. Rust 使用边界

当前不建议用 Rust 重写核心游戏。Rust 只有在满足以下条件时才进入规划：

- 已有 profiling 或大规模 fixture/smoke 数据证明 Node 版本成为瓶颈。
- 可以隔离为可选 CLI、WASM worker 或离线工具，不影响 `npm install && npm start` 默认可玩。
- 输入输出是明确 JSON 或文件契约，不直接读取 `.env`、raw session、hidden 私档、provider payload 或 SQLite 私表。
- 有 Node 侧 wrapper、Mock/no-key fallback、跨平台 Windows 验证和回滚方式。

可评估候选：

- 大规模世界内容索引、导入导出、脱敏校验或压缩。
- SQLite 维护、健康检查、批量 repair 或只读分析工具。
- 地图布局、路径计算、资产批处理等纯计算模块。

暂不适合 Rust 的范围：

- Express routes、AI provider 编排、prompt/schema 裁决、核心回合 resolver、科举晋级、官职任免、交易/婚姻/弹劾结果和 canonical persistence。

## 9. 回滚策略

- S86.1-S86.5 不改变运行产物，回滚应只涉及配置、类型声明、JSDoc 和文档。
- S86.6 若引入 `.ts` 试点，必须保持试点模块小、依赖少、测试集中；失败时可退回原 JS 模块。
- 任何时候都不得为了迁移通过类型检查而放宽安全过滤、删除 Ajv schema、扩大浏览器 view 或绕过服务器裁决。
