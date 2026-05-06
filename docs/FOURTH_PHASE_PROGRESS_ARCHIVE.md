# 《千秋》第四阶段进度记录归档

本文件从 `docs/DEVELOPMENT_STEPS.md` 压缩迁出，保留第四阶段早期详细进度记录。当前活动路线图仍在 `docs/DEVELOPMENT_STEPS.md`；日常启动优先读取当前台账，只有追溯旧验证细节时再打开本归档。

### 2026-05-06

工具：Codex

步骤：development rule update

提交：current documentation commit

完成：
- 在 `AGENTS.md`、`CLAUDE.md`、`docs/QIANQIU_DEVELOPMENT_BRIEF.md` 和本台账中加入“项目内面向协作和玩家的输出优先中文”的开发规范。
- 适用范围明确为文档、交接记录、路线图台账、领域逻辑注释和前端可见文案；代码标识符、API/协议名、第三方术语、命令输出或外部工具清晰度需要时可使用英文。
- 同步 `docs/SHARED_CONTEXT.md`，记录本次低风险纯文档改动跳过提交前只读子代理审查。

验证：
- `git diff --check`

风险/遗留：
- 本次只修改开发规范文档，不改变运行时代码、测试、API、提示词或玩家存档。
- 既有英文历史记录不强制回译；新输出和后续文档改动按此规范优先中文。

下一步：
- 继续按当前路线图推进 S42.1 深度官场契约，或先做 S44.1 AI 调动/控制审查矩阵。

---

工具：Codex

步骤：S41.2

提交：2c45949

完成：
- 扩展 `testdata/aiEvalFixtures.js`，为 `opening`、`world_turn`、`official_career`、`emperor_court`、`minister_faction`、`local_magistrate`、`general_frontier`、`exam_question` 和 `exam_grading` 增加 schema-valid、历史语气合格的 prompt-pack 输出样本。
- 新增严格 JSON 红队 fixtures，离线 eval 会拒绝 Markdown fence、`model output:` 前缀、尾随说明和非 object 根节点；不改变运行时 `parseJsonFromText()` 的兼容解析。
- 新增现代词/现代治理腔、隐藏信息泄漏和 AI 越权红队 fixtures，覆盖科举出题夹带 `statePatch`、评卷生成 server-owned ranking、普通回合写入 `officialCareer` / `activeNpcRequest` / `longTermEvents` / `examCalendar` / `player.palaceRank` 等情况。
- 扩展 `test/prompts.test.js`，确认隐藏关系联系人、隐藏 faction 笔记和隐藏 recentIntent 不会进入 opening、turn、exam_question 或 exam_grading 的任务输入。

验证：
- `node --check testdata\aiEvalFixtures.js`
- `node --check test\aiEvalFixtures.test.js`
- `node --check test\prompts.test.js`
- `node --test test\prompts.test.js`
- `node --test test\aiEvalFixtures.test.js`
- `npm run eval:ai`
- `node --test test\remoteHelpers.test.js test\deepseekProvider.test.js`
- `$env:AI_PROVIDER='mock'; npm test` passed 207 tests
- `git diff --check`
- Read-only pre-commit subagent review found no blockers. Three P3 notes were addressed before commit: S41.2 scope wording now keeps real-provider tone acceptance in S47, hidden faction-specific prompt filtering is asserted, and unknown authority fixture expectations now fail explicitly.

风险/遗留：
- 本步骤是离线 fixtures/test 覆盖，不调用真实 provider，也不修改 provider 解析容错。真实 provider 输出质量、streaming 失败和 route 级 keyed 验收仍归 S47。
- 严格 JSON eval 比运行时 `parseJsonFromText()` 更严，目的是约束 prompt-pack 目标输出；不要把它误读为当前 provider 解析策略已经改成 hard strict。
- 现代词表保持窄范围，后续 S41/S44 可继续补红队样本，避免过宽词表误伤历史合理表述。

下一步：
- S42.1 定义深度官场契约，或先做 S44.1 AI 调动/控制审查矩阵，把 S41 的 prompt 权限继续扩展成系统级权限表。

---

工具：Codex

步骤：S41.1

提交：383881a

完成：
- 新增 `src/ai/promptPacks.js`，把 S41 的优秀提示词总纲整理为可维护 prompt pack 注册表：`world_turn`、`opening`、`exam_question`、`exam_grading`、`official_career`、`emperor_court`、`minister_faction`、`local_magistrate`、`general_frontier`。
- `src/ai/prompts.js` 现在为每个任务附带 `promptPack` 元数据并使用 pack 指令；普通回合按身份选择角色专属 pack，provider schema 名称仍保持 `opening`、`turn`、`examQuestion`、`grade`。
- 固定前缀把系统身份、JSON 严格性、服务器裁决边界、隐藏信息过滤、历史语气和 allowed patch keys 放在动态世界摘要之前，承接 S47.2 的 DeepSeek 缓存规划。
- 扩展 `test/prompts.test.js`，覆盖 S41 pack 名单、身份路由、稳定前缀、科举出题/评卷权限边界。

验证：
- `node --check src\ai\promptPacks.js`
- `node --check src\ai\prompts.js`
- `node --check test\prompts.test.js`
- `node --test test\prompts.test.js`
- `node --test test\aiEvalFixtures.test.js`
- `node --test test\remoteHelpers.test.js`
- `node --test test\deepseekProvider.test.js`
- `npm run eval:ai`
- `node --test test\examTravel.test.js` after a transient first full-suite failure in that file
- `$env:AI_PROVIDER='mock'; npm test` rerun passed 201 tests
- `git diff --check`
- Read-only pre-commit subagent review found no blockers. Two P3 notes were addressed before commit: non-turn prompt packs no longer inherit ordinary-turn patch-key guidance, and the S41.2 row now describes eval/red-team expansion.

风险/遗留：
- S41.1 不新增 schema 名称，不改 provider 模型路由，不扩大 Mock 行为；真实 provider 语气质量仍需 S41.2/S47 验收。
- 离线 eval fixtures 仍是基础版，S41.2 需要补历史语气、越权、隐藏信息和现代词红队用例。
- DeepSeek cache telemetry 尚未实现，后续 S47.2 读取 provider usage 中的命中/未命中 token。
- 第一次全量 `npm test` 在 `test\examTravel.test.js` 的完整书生入仕路径上出现一次 500/200 断言差异；该文件单独复跑通过，随后全量 Mock 测试复跑通过，未复现。

下一步：
- S41.2：把 prompt pack 拆出的稳定前缀接入离线 eval fixtures、红队样本和必要的 snapshot/稳定性测试。

---

工具：Codex

步骤：S47.2 planning scope update

提交：current documentation commit

完成：
- 参考 DeepSeek 官方“上下文硬盘缓存”说明，将提高缓存命中率加入第四阶段规划。
- 规划原则：稳定 prompt 前缀、动态上下文后置、记录 `prompt_cache_hit_tokens` / `prompt_cache_miss_tokens`，但不得为了缓存删减必要游戏上下文或影响叙事/推演效果。
- 将 S47.2 加入步骤总览，并在 Phase 41 prompt pack 与 Phase 47 provider 验收中记录缓存命中率优化方向和测试要求。

验证：
- `git diff --check`

风险/遗留：
- 本次只做文档规划，不实现 telemetry 或 prompt builder 变更。
- DeepSeek 缓存是官方标注的尽力而为机制，后续不应把 100% 命中率作为验收目标。

下一步：
- S41.1/S41.2 设计 prompt pack 时同步定义可缓存稳定前缀；S47.2 再实现命中率 telemetry 和 smoke 报告。

---

工具：Codex

步骤：S40.1-S40.2

提交：7927c02

完成：
- 将第三阶段路线图复制并冻结到 `docs/PHASE_THREE_ROADMAP_ARCHIVE.md`，把当前活动台账改为第四阶段 S40-S47。
- 保持开发规范不变，并把第四阶段优先级落到 AI 连接测试、优秀提示词、官场深度、世界议程、AI 权限审查、多实体世界和依赖/插件治理。
- 新增 `src/ai/diagnostics.js` 和 `src/routes/ai.js`，提供 `POST /api/ai/connection-test`，用于不落盘校验当前或指定 provider 的开局 JSON 能力、模型配置、耗时、streaming 能力和脱敏错误。
- 开局页加入 `AI 连接` 面板和“校验”按钮，浏览器通过 fetch 调用诊断路由并显示结果。
- DeepSeek 任务模型策略记录为：开局与科举评卷使用 `deepseek-v4-pro`，普通回合/流式叙事与考题生成使用 `deepseek-v4-flash`，`.env` 继续忽略真实密钥。
- 增加 AI 诊断路由、错误脱敏、DeepSeek 模型路由、远端 payload 规范化和提示词约束的 focused tests。

验证：
- `node --check server.js public/app.js src/ai/diagnostics.js src/routes/ai.js src/ai/providers/deepseek.js src/ai/providers/remoteHelpers.js src/ai/prompts.js src/game/stateRules.js`
- `node --check test/aiDiagnostics.test.js test/aiConnectionRoute.test.js test/deepseekProvider.test.js test/remoteHelpers.test.js test/prompts.test.js`
- `node --test test/aiDiagnostics.test.js test/aiConnectionRoute.test.js test/deepseekProvider.test.js test/remoteHelpers.test.js test/prompts.test.js`
- `$env:AI_PROVIDER='mock'; npm test`
- DeepSeek no-session diagnostic through `runAiConnectionTest({ provider: "deepseek" })` with ignored local `.env`: passed, `ok=true`, streaming supported, opening/question/grading models reported as configured.
- `$env:AI_PROVIDER='mock'; npm run smoke:browser`
- `git diff --check`

风险/遗留：
- 本步骤不继续调试 DeepSeek 的长回合推演质量；真实模型质量、历史语气和官场深度进入 S41-S47。
- 路由级连接测试不会写 session，也不会替代完整 provider smoke/long-run 验收。
- 提交前只读子代理审查无阻塞项。遗留风险：浏览器 smoke 尚未点击 `AI 连接` 按钮，当前由路由测试和人工/代码检查覆盖；错误脱敏覆盖完整配置密钥字符串，不主动识别变形或片段密钥，这应在 S47 扩展。

下一步：
- S41.1：制定并落地 prompt pack 总纲；S42.1：定义更深官场契约。
