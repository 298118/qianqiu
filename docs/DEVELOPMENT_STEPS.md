# 《千秋》第二阶段开发路线图与进度台账

本文件仍是 Codex 与 Claude Code 共同维护的活动路线图。第一阶段路线图已归档到 [docs/PHASE_ONE_ROADMAP_ARCHIVE.md](PHASE_ONE_ROADMAP_ARCHIVE.md)，验收记录仍见 [docs/PHASE_ONE_ACCEPTANCE.md](PHASE_ONE_ACCEPTANCE.md)。

第二阶段从“可玩纵切”进入“可持续模拟”。目标不是推翻现有实现，而是在保持 `npm install && npm start`、Mock 默认可玩、服务器裁决状态边界的前提下，逐步增加世界深度、身份差异、真实 provider 验收和浏览器级质量门槛。

## 1. 使用规则

开发规范不变。每次开发开始时：

1. 读取 `AGENTS.md` 或 `CLAUDE.md`。
2. 读取 `docs/SHARED_CONTEXT.md`。
3. 读取 `docs/QIANQIU_DEVELOPMENT_BRIEF.md`。
4. 读取本文件，找到第一个 `TODO` 或 `IN_PROGRESS` 的小步骤。
5. 执行 `git status --short`，确认是否有别人留下的改动。

每次完成一个小步骤时：

1. 把对应步骤状态改为 `DONE`，填写完成日期、工具、提交哈希。
2. 在本文件的“进度记录”追加一条说明，写清完成了什么、验证了什么、留下了什么风险。
3. 更新 `docs/SHARED_CONTEXT.md`，让另一个工具看到最新交接信息。
4. 如果改动影响产品范围、架构、API、状态字段、提示词或验收标准，也同步更新 `docs/QIANQIU_DEVELOPMENT_BRIEF.md`、README 或相关架构文档。
5. 运行相关验证命令。
6. 用 Git 提交本次 coherent change。

状态值：

- `TODO`：未开始。
- `IN_PROGRESS`：正在做，下一位接手者应先检查工作树和上下文。
- `DONE`：已完成、已验证、已提交。
- `BLOCKED`：被外部条件阻塞，必须写明原因和解除条件。

## 2. 依赖与开源库策略

依赖策略不变：

- 只有当依赖能明显降低复杂度、提升可靠性、改善安全性或带来标准能力时才加入。
- 新增依赖必须记录在本文件的对应步骤和 README 中，说明用途。
- 优先选择维护活跃、文档清楚、常用、许可证友好的库。
- 前端继续保持无构建流程，除非本路线图后续明确升级。
- 核心游戏规则、科举晋级、状态边界、作弊惩罚不能完全交给模型或黑箱库。
- 加依赖后必须验证 `npm install` 和 `npm start`。

## 3. 第二阶段步骤总览

| ID | 状态 | 目标 | 完成日期 | 工具 | 提交 |
| --- | --- | --- | --- | --- | --- |
| S20.1 | DONE | 归档第一阶段路线图，开启第二阶段活动规划，保持开发规范不变 | 2026-05-05 | Codex | 本次文档提交 |
| S21.1 | DONE | 定义第二阶段世界 tick 状态契约：时间推进、资源变动、事件队列、可见反馈 | 2026-05-05 | Codex | 本次 S21.1 提交 |
| S21.2 | DONE | 实现服务器拥有的 `worldTick` 模块，按回合或月份推进财政、粮储、民心、边患、腐败 | 2026-05-05 | Codex | 本次 S21.2 提交 |
| S21.3 | DONE | 将世界 tick 接入 `/api/game/turn`，确保玩家行动与自然世界变化共同进入事件历史 | 2026-05-05 | Codex | 70b14fd |
| S21.4 | DONE | 为世界 tick 增加自动化测试，覆盖数值边界、事件裁剪和 Mock 稳定性 | 2026-05-05 | Codex | 本次 S21.4 提交 |
| S22.1 | TODO | 扩展 NPC 与派系关系账本，记录人物立场、恩怨、人脉来源和近期意图 |
| S22.2 | TODO | 更新状态 patch 白名单和提示词摘要，让 provider 只能建议关系变化，服务器负责裁决 |
| S22.3 | TODO | 在 Mock 中加入人物/派系对玩家行动的可追踪反应 |
| S23.1 | TODO | 深化地方官身份：县库、乡绅、盗匪、诉讼、赋役、水利和地方民心 |
| S23.2 | TODO | 深化将领身份：兵员、军粮、士气、侦察、战役风险和边境态势 |
| S23.3 | TODO | 深化入仕官员身份：上官、同年、考成、升迁、弹劾和清浊操守 |
| S24.1 | TODO | 深化科举同场竞争：虚拟考生生成可查看文章、评语和风格差异 |
| S24.2 | TODO | 增加考试档案 UI，允许回看历次文章、题目、排名、复核和晋级原因 |
| S24.3 | TODO | 增加赶考成本、旅途事件、疲劳/心性影响和考前准备风险 |
| S25.1 | TODO | 增加真实 provider smoke 脚本，在有 key 时验证 start/turn/question/submit 四类调用 |
| S25.2 | TODO | 评估并实现真实 provider token streaming；无法流式的 provider 保持兼容降级 |
| S25.3 | TODO | 建立 AI 输出 eval fixtures，固定校验 JSON 合约、违规 patch、科举评卷和历史语气 |
| S26.1 | TODO | 引入浏览器自动化验收方案，优先覆盖本地页面加载、开局、localStorage 恢复 |
| S26.2 | TODO | 增加截图或 DOM 级 UI 验收，覆盖桌面/移动布局、考试弹窗和放榜详情 |
| S26.3 | TODO | 将浏览器验收结果写入文档，并保留手动验收清单作为 fallback |
| S27.1 | TODO | 完成第二阶段验收文档，记录新增深度、已知限制、真实 provider 状态和下一阶段候选 |

## 4. 分阶段详细步骤

### Phase 20: 文档切换与归档

目标：把第一阶段计划从活动台账中移出，明确第二阶段活动路线，同时不改变协作纪律。

- S20.1：新增第一阶段路线图归档文档；将本文件重置为第二阶段活动台账；在共享上下文、README 和开发文稿中记录阶段切换。
- 验证：`npm test` 仍通过；`git status --short` 只显示本次文档改动；最终用 Git 提交。

### Phase 21: 世界模拟主循环

目标：让世界在玩家行动之外也会推进，形成财政、粮储、民心、边患、腐败之间的长期牵引。

- S21.1：定义最小 tick 合约，明确何时推进时间、哪些字段会自然变化、哪些事件应进入玩家可见叙事。
- S21.2：实现 `src/game/worldTick.js`，服务器根据当前状态、角色、最近事件和基础规则生成自然变动。
- S21.3：接入 `/api/game/turn`，让 provider 叙事结果和服务器 tick 结果共同写入 session。
- S21.4：增加测试，确保 tick 不越界、不绕过 patch 规则、不破坏书生完整主线。

### Phase 22: NPC 与派系记忆

目标：让行动留下社会关系后果，而不是只改几个数值。

- S22.1：扩展人物和派系状态，记录立场、关系、近期意图和可见/隐藏信息。
- S22.2：更新 patch 规则、prompt 摘要和文档，保持服务器拥有最终合并权。
- S22.3：让 Mock 中的皇帝、大臣、官员、书生日常行动能引发 NPC 或派系反应。

### Phase 23: 身份深度扩展

目标：补齐第一阶段薄弱身份，并让入仕后的官场玩法更像独立生涯。

- S23.1：实现地方官基础闭环：审案、钱粮、乡绅、盗匪、灾荒、水利。
- S23.2：实现将领基础闭环：募兵、粮饷、士气、侦察、守边、出战。
- S23.3：深化 official：同年/上官/考成/升迁/弹劾与操守风险。

### Phase 24: 科举深度

目标：保留已跑通的科举主线，同时让考试更有竞争、记忆和代价。

- S24.1：虚拟考生不仅有分数，还能生成可查看文章和考官短评。
- S24.2：前端提供考试档案，回看历次题目、文章、评分、监试复核和榜单。
- S24.3：加入赶考成本、旅途事件和疲劳/心性影响，但不得破坏完整 scholar -> official 路径。

### Phase 25: 真实 Provider 与流式能力

目标：确认真实模型路径可用于开发和验收，而不是只停留在无 key fallback。

- S25.1：新增可选 smoke 脚本，有 key 时按 provider 验证 start、turn、question、submit。
- S25.2：为支持的 provider 接入真正 token streaming；不支持时保留当前 SSE 兼容输出。
- S25.3：建立 eval fixtures，持续检查 provider JSON 合约、历史语气和非法 patch。

### Phase 26: 浏览器验收

目标：把“能打开”升级为“可重复验证的浏览器体验”。

- S26.1：选择并接入浏览器自动化工具，覆盖本地页面加载和 session 恢复。
- S26.2：增加桌面/移动布局、考试弹窗、放榜详情和输入区的 UI 验收。
- S26.3：更新手动验收文档，记录自动化能覆盖和仍需人工检查的部分。

### Phase 27: 第二阶段验收

目标：形成可交接的第二阶段版本。

- S27.1：记录第二阶段验收、命令、限制、真实 provider 状态和第三阶段候选。

## 5. 进度记录

按时间倒序追加。每条记录必须让另一个工具看得懂。

模板：

```text
日期：
工具：
步骤：
提交：
完成：
验证：
风险/遗留：
下一步：
```

### 2026-05-05

工具：Codex

步骤：S21.4

提交：本次 S21.4 提交

完成：
- 扩展 `test/gameTurnTick.test.js`，让测试服务器同时挂载游戏与考试路由，用 Mock 模式覆盖世界 tick 的路由级回归。
- 新增数值边界测试，确认极端财政、粮储、人口、民心、腐败、军心、边患和派系输入经 `/api/game/turn` 后仍落在 `NUMERIC_RANGES` 内，且未知派系不会被 tick 修改。
- 新增 provider+tick 事件裁剪测试，确认事件历史保留最近 20 条，并维持 provider event -> tick event 的追加顺序。
- 新增 15 回合 Mock 稳定性测试，覆盖跨两次年界后的 `year/month`、`turnCount`、事件历史上限和书生身份不被自然 tick 改写。
- 新增完整书生入仕回归测试，先运行 tick 集成后的自由回合，再完成童试、乡试、会试、殿试四级交卷，确认最终仍可成为 `official`，考试路由不额外推进月份或回合数。

验证：
- `node --check test/gameTurnTick.test.js`
- `node --test test/gameTurnTick.test.js` 通过，6 项测试全部通过。
- `git diff --check`
- `npm test` 通过，29 项测试全部通过。

风险/遗留：
- 本次只增强自动化覆盖，不改变运行逻辑；真实浏览器级验收仍留给 S26。

下一步：
- S22.1：扩展 NPC 与派系关系账本，记录人物立场、恩怨、人脉来源和近期意图。

工具：Codex

步骤：S21.3

提交：70b14fd

完成：
- `POST /api/game/turn` 现在会在 provider patch 和考试触发状态准备后运行 `runWorldTick()`。
- tick patch 通过 `applyStatePatch(worldState, worldTick.statePatch, { incrementTurnCount: false })` 应用，保证一次玩家行动只增加一次 `turnCount`。
- 事件历史按 provider events -> tick events 的顺序追加；JSON 响应和 SSE final payload 均包含 `worldTick: { summary, events, attributeChanges }`。
- 前端状态条显示年月，回合结算后会追加简短 `[月度]` 反馈，并把 tick 数值变化合并进属性变化条。
- 新增 `test/gameTurnTick.test.js` 覆盖 JSON 与 SSE 路由响应中的 tick 集成、跨年、事件顺序和单次回合计数。

验证：
- `node --check src/routes/game.js`
- `node --check public/app.js`
- `node --check test/gameTurnTick.test.js`
- `git diff --check`
- `npm test` 通过，25 项测试全部通过。

风险/遗留：
- S21.3 只完成路由与 UI 接入；更宽的重复回合稳定性、事件裁剪和完整 scholar -> official 回归仍留给 S21.4。
- tick 仍只在 `/api/game/turn` 运行，考试取题/交卷暂不消耗月份，符合 S21 最小契约。

下一步：
- S21.4：扩展自动化测试，覆盖 tick 数值边界、provider+tick 事件裁剪、Mock 多回合稳定性和完整书生入仕路径。

工具：Codex

步骤：S21.2

提交：本次 S21.2 提交

完成：
- 新增 `src/game/worldTick.js`，实现纯服务器 `runWorldTick(worldState)`，返回 `{ statePatch, attributeChanges, events, summary }`，并保持输入状态不被原地修改。
- `worldTick` 现在会推进 `year/month`，处理 12 月跨年，按确定性公式推演府库、粮储、人口、民心、贪腐、军心、边患和既有核心派系的小幅漂移。
- `createInitialState()` 新增 `worldState.month = 1`；`stateRules` 新增 `year/month` 白名单和数值裁剪，并支持 `applyStatePatch(..., { incrementTurnCount: false })`，为 S21.3 避免 tick 二次增加 `turnCount` 做准备。
- provider turn schema/prompt 不再允许模型 patch `year/month`；模型只能读取压缩后的日历上下文，日历推进保留给服务器 tick。
- 新增 `test/worldTick.test.js`，并扩展 `test/stateRules.test.js`，覆盖初始月份、跨年、不修改考试/晋级字段、数值裁剪、派系边界和无二次回合计数。

验证：
- `node --check src/game/worldTick.js`
- `node --check src/game/stateRules.js`
- `node --check src/game/initialState.js`
- `node --check src/ai/prompts.js`
- `node --check src/ai/schemas.js`
- `node --check test/worldTick.test.js`
- `node --check test/stateRules.test.js`
- `node --check test/aiSchemas.test.js`
- `npm test` 通过，23 项测试全部通过。
- `git diff --check` 通过。

风险/遗留：
- `worldTick` 仍未接入 `/api/game/turn`，玩家暂时还看不到月度反馈。
- tick 公式目前是首版确定性模型，只覆盖全局资源和核心派系；后续 NPC/地方官/将领深度仍在 S22/S23。

下一步：
- S21.3：在 `/api/game/turn` 中先应用 provider patch，再运行 `runWorldTick()`，用 `{ incrementTurnCount: false }` 应用 tick patch，并按 provider events -> tick events 的顺序写入事件历史和响应。

工具：Codex

步骤：S21.1

提交：本次 S21.1 提交

完成：
- 新增 `docs/WORLD_TICK_CONTRACT.md`，定义第二阶段最小世界 tick 契约：服务器拥有、每个有效自由行动推进一个月、月份跨年规则、自然资源变动范围、事件反馈形态和验收标准。
- 更新 `docs/ARCHITECTURE.md`，记录 S21.2-S21.4 接入时必须保持的服务器边界、单次 `turnCount` 增量、白名单/clamp 复用和完整书生主线保护。
- 更新 `docs/QIANQIU_DEVELOPMENT_BRIEF.md`，把 S21.1 契约写入长期产品/架构说明，明确下一步实现 `src/game/worldTick.js`。

验证：
- `npm test` 通过，18 项测试全部通过。
- `git diff --check` 通过。

风险/遗留：
- 本次只完成契约定义，尚未新增 `worldState.month` 或 `src/game/worldTick.js`。
- `/api/game/turn` 还未显示世界 tick 反馈，需在 S21.3 接入。

下一步：
- S21.2：实现纯服务器模块 `src/game/worldTick.js`，返回 `{ statePatch, attributeChanges, events, summary }`，并准备 S21.3 路由接入。

工具：Codex

步骤：S20.1

提交：本次文档提交

完成：
- 新增 `docs/PHASE_ONE_ROADMAP_ARCHIVE.md`，把第一阶段路线图和验收状态归档为只读历史。
- 将 `docs/DEVELOPMENT_STEPS.md` 切换为第二阶段活动路线图，保留原有开发规范、依赖策略和交接纪律。
- 第二阶段规划聚焦世界 tick、NPC/派系记忆、地方官/将领/入仕官员深度、科举深度、真实 provider 验收和浏览器自动化验收。
- 同步更新共享上下文、开发文稿和 README，让后续 Codex 与 Claude Code 从第二阶段台账接手。

验证：
- `npm test` 通过，18 项测试全部通过。
- `git diff --check` 通过。

风险/遗留：
- 本次只做文档与路线图切换，不修改运行代码。
- S20.1 的最终提交哈希以本次 Git 提交为准，最终回复会说明。

下一步：
- 从 S21.1 开始定义世界 tick 的最小状态契约和验收标准。
