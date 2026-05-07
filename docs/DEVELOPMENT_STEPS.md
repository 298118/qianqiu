# 《千秋》时间专项开发路线图与进度台账

本文件是 Codex 与 Claude Code 共同维护的当前活动路线图与进度台账。第四阶段已经完成并归档，当前从 S48 起进入“时间专项”规划与执行。

- 第一阶段路线图已归档到 [docs/PHASE_ONE_ROADMAP_ARCHIVE.md](PHASE_ONE_ROADMAP_ARCHIVE.md)，验收记录见 [docs/PHASE_ONE_ACCEPTANCE.md](PHASE_ONE_ACCEPTANCE.md)。
- 第二阶段路线图已归档到 [docs/PHASE_TWO_ROADMAP_ARCHIVE.md](PHASE_TWO_ROADMAP_ARCHIVE.md)，验收记录见 [docs/PHASE_TWO_ACCEPTANCE.md](PHASE_TWO_ACCEPTANCE.md)。
- 第三阶段路线图已归档到 [docs/PHASE_THREE_ROADMAP_ARCHIVE.md](PHASE_THREE_ROADMAP_ARCHIVE.md)。
- 第四阶段路线图已归档到 [docs/PHASE_FOUR_ROADMAP_ARCHIVE.md](PHASE_FOUR_ROADMAP_ARCHIVE.md)，早期详细进度仍可在 [docs/FOURTH_PHASE_PROGRESS_ARCHIVE.md](FOURTH_PHASE_PROGRESS_ARCHIVE.md) 追溯。

## 1. 开发规范继承

开发规范不变。继续保持：

- `npm install && npm start` 可运行，默认打开 `http://localhost:3000`。
- Mock AI 默认完整可玩，真实 provider 只作为可选配置。
- 完整书生路径不得破坏：`scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`。
- AI 只能生成叙事、题目、评分建议、关系建议和受限 `statePatch`；服务器继续拥有时间推进、状态边界、科举晋级、作弊处罚、官场任免、长期事件、世界实体、世界议程和持久化裁决。
- 项目内协作文档、路线图、交接记录、领域注释和玩家可见文案优先使用中文。
- 每个 coherent change 必须更新 `docs/SHARED_CONTEXT.md`，必要时同步 README、产品 brief、架构/契约文档，并用 Git 提交。
- 关键决策不能只留在聊天记录里；会影响后续 Codex 或 Claude Code 接手的内容必须写入仓库文档。

### 子代理使用规则

- 用户已明确授权 Codex 和 Claude Code 在本仓库使用子代理；除非后续用户指令收窄或撤销，否则视为长期项目上下文。
- 对路线图阶段或步骤簇，应在可拆分为独立小步骤时主动使用子代理；不要把“较大步骤”理解为只能交给一个超大实现任务，优先按 `Sxx.y` 这类可审查粒度拆分。
- 子代理实施任务必须有清晰职责边界和文件/模块归属；多个实施子代理并行时，写入范围应尽量互不重叠。
- 每个实施子代理提示词必须明确：不得运行 `git add`、`git commit`、`git push` 或创建 PR；不得回滚他人改动；最终报告列出改动文件和验证命令。
- 子代理只产出受限 patch 与聚焦验证报告；主代理负责整合、最终验证、共享文档同步和唯一的连贯提交。
- 包含代码、测试、运行时行为、API/schema、提示词或验证工具变化的提交，暂存和提交前必须委派至少一个只读子代理审查最终 diff 与验证证据。主代理需向复审子代理提供 diff 与验证摘要；复审子代理只报告风险、遗漏、测试缺口和建议，不得编辑文件，也不得运行 Git 命令。
- 低风险纯文档改动可跳过子代理复审，但必须在 `docs/SHARED_CONTEXT.md` 或最终回复说明。
- 如果子代理意外创建提交，主代理必须把它视为未复审工作：检查 diff 和测试，在交接记录中说明事故，并避免继续让该子代理提交。

每次开发开始时：

1. 读取 `AGENTS.md` 或 `CLAUDE.md`。
2. 读取 `docs/SHARED_CONTEXT.md`。
3. 读取 `docs/QIANQIU_DEVELOPMENT_BRIEF.md`。
4. 读取本文件，选择第一个 `TODO` 或 `IN_PROGRESS` 的小步骤。
5. 执行 `git status --short`，确认是否有别人留下的改动。

每次完成一个小步骤时：

1. 把对应步骤状态改为 `DONE`，填写完成日期、工具和提交说明或哈希。
2. 在“进度记录”追加一条记录，写清完成内容、验证命令、风险/遗留和下一步。
3. 更新 `docs/SHARED_CONTEXT.md`。
4. 如果改动影响产品范围、架构、API、状态字段、提示词、设置或验收标准，同步更新 `docs/QIANQIU_DEVELOPMENT_BRIEF.md`、README 或相关契约文档。
5. 确认新增文档、交接记录、路线图条目、领域逻辑注释和玩家可见文案优先使用中文；确需保留英文时应是代码/API/协议/第三方术语、命令输出或外部工具清晰度所需。
6. 运行相关验证命令。
7. 对非低风险纯文档改动执行只读子代理提交前审查。
8. 用 Git 提交本次 coherent change。

状态值：

- `TODO`：未开始。
- `IN_PROGRESS`：正在做，接手者应先检查工作树和上下文。
- `DONE`：已完成、已验证、已提交或随当前文档提交完成。
- `BLOCKED`：被外部条件阻塞，必须写明原因和解除条件。

## 2. 依赖、插件与开源参考策略

时间专项继续继承 S46.1 的依赖、插件与开源参考治理。后续新增或升级 `package.json` 依赖、开发工具、外部服务 SDK、Codex/Claude 插件工作流或开源参考时，必须先按 [依赖、插件与开源参考治理](DEPENDENCY_PLUGIN_GOVERNANCE.md) 记录和验证。

- 依赖或插件必须明显降低复杂度、提升可靠性、改善安全性、改善浏览器体验或提供成熟标准能力。
- 记录必须说明用途、运行入口、测试覆盖、替代方案、许可证、维护状态、安全/隐私影响、Mock/no-key 影响、文档落点和回滚策略。
- 优先选择维护活跃、文档清晰、常用、许可证友好的库；参考开源项目时记录借鉴点，不复制不明来源的大段实现。
- 前端继续保持无构建流程，除非本路线图或后续明确步骤批准升级。
- 核心游戏规则、时间推进、科举晋级、状态边界、作弊惩罚、官职任免和持久化不能完全交给模型或黑箱库。
- 加依赖后必须验证 `npm install`、`npm start` 和对应测试。

## 3. 时间专项目标

时间专项的目标是让《千秋》的长期模拟节奏更符合玩家体感：普通自由行动从“每回合推进一月”改为“每回合推进一旬”，一月三回合；同时避免把考试、廷议、审案、战斗等密集场景粗暴拉成“一输入十天”。

核心原则：

- **全局时间**：日常读书、拜访、办差、施政、经营关系等普通自由行动，默认每个有效回合推进一旬：上旬 -> 中旬 -> 下旬 -> 下月上旬。
- **月末结算**：世界自然漂移、长期事件月份递减、季节性事件、官场任内月份和考成周期等原“月度”系统，默认只在下旬进入下月上旬时完整结算；非月末旬只做轻量小结。
- **场景内时间**：考试、廷议、堂审、战斗、旅途遭遇、重大差事收束等应使用场景局部阶段；玩家在场景内多次输入时，只推进该场景的时辰/阶段，不自动消耗一旬。
- **玩家可见日期**：状态栏、存档、考试说明、事件反馈和相关 UI 使用“年月旬”，例如“崇祯十七年八月上旬”。
- **服务器拥有时间**：`year`、`month`、`tenDayPeriod` 和场景时间推进都属于服务器裁决；provider 不得通过普通 `statePatch` 写入。

## 4. 步骤总览

| ID | 状态 | 目标 | 完成日期 | 工具 | 提交 |
| --- | --- | --- | --- | --- | --- |
| S48.1 | DONE | 归档第四阶段规划，开启时间专项路线图，并保持开发规范不变 | 2026-05-07 | Codex | `1e7bcd3` + follow-up docs fixes |
| S48.2 | TODO | 建立全局旬制日历基础：`tenDayPeriod`、共享时间 helper、旧档默认上旬、provider 时间字段边界 |  |  |  |
| S48.3 | TODO | 改造普通回合与世界 tick：每回合推进一旬，非月末轻量小结，月末完整结算 |  |  |  |
| S48.4 | TODO | 建立场景内时间框架，并优先把科举考试改成多阶段局部时间 |  |  |  |
| S48.5 | TODO | 适配长期事件、官场任期/差事、世界议程、世界实体和脚本验收的月末/旬度语义 |  |  |  |
| S48.6 | TODO | 完成前端日期展示、浏览器 smoke、provider long-run 和完整书生入仕验收 |  |  |  |

## 5. 实施规划

### S48.1：归档与规划切换

范围：

- 把第四阶段活动路线图归档到 `docs/PHASE_FOUR_ROADMAP_ARCHIVE.md`。
- 将本文件重置为时间专项路线图与进度台账。
- 同步 README、产品 brief 和 shared context 的当前重点指针。
- 本步骤是低风险纯文档切换，不改变运行时代码、测试、API 或存档。

验证：

- `git diff --check`

### S48.2：全局旬制日历基础

范围：

- 新增共享时间 helper，集中维护 `TURNS_PER_MONTH = 3`、旬标签、年月旬格式化、旬推进、月数/旬数/回合数换算、旧值归一化等能力。
- `worldState` 新增服务器拥有字段 `tenDayPeriod: 1 | 2 | 3`，分别表示上旬、中旬、下旬；旧存档缺失时按上旬归一化，不提升 `storageSchemaVersion`。
- `stateRules`、AI schema/eval、provider long-run 和 red-team 覆盖 `tenDayPeriod`：普通 provider 不能写 `year`、`month` 或 `tenDayPeriod`。
- 存档 metadata 增加 `tenDayPeriod`，但不暴露完整内部状态之外的新敏感信息。
- 涉及 AI 可读摘要、server-owned ledger、浏览器面板或 provider 验收时，同步检查 `docs/AI_CONTROL_AUDIT_MATRIX.md` 是否需要补充时间字段边界。

验收：

- 初始状态为正月上旬。
- 缺少 `tenDayPeriod` 的旧档读取后按上旬显示和推进。
- provider 伪造时间字段被拒，安全字段仍可生效。

### S48.3：普通回合与世界 tick 旬制

范围：

- `POST /api/game/turn` 普通自由行动默认推进一旬。
- `runWorldTick()` 或其替代结构返回本回合时间推进结果：非月末旬只输出轻量旬度反馈和小幅/按比例资源漂移；下旬进入下月上旬时执行原月度完整结算。
- 月末才滚动 `month/year`，腊月下旬后一回合进入次年正月上旬。
- 保持 `turnCount` 仍表示玩家有效输入回合数，每次普通回合只加 1。
- 事件反馈区分 `[旬度]` 与月末 `[月度]` 或 `[大势]`，不让小结淹没 provider 叙事。

验收：

- 上旬一回合到中旬，中旬一回合到下旬，下旬一回合到下月上旬。
- 腊月下旬后一回合年份 +1、月份回到正月、旬回到上旬。
- 非月末不触发长期月份递减或季节事件，月末触发。

### S48.4：场景内时间与科举多阶段

范围：

- 建立场景内时间语义：全局普通行动消耗一旬，`activeScene` 或特定 `activeExam` 场景行动只推进局部阶段。
- 优先改造科举：
  - `/api/exam/question` 创建或复用考试时不推进全局旬。
  - `activeExam` 增加局部阶段字段，例如入场、发题、审题、拟纲、作答、誊清、交卷。
  - 考试期间的场景动作推进考试阶段或时辰，不让每次输入消耗十天。
  - `/api/exam/submit` 完成考试、评分、榜单、晋级和考试档案保存；是否记录本场发生在某年某月某旬由服务器统一写入。
- 先为廷议、审案、战斗、旅途遭遇预留同一套场景时间接口或数据形态；除非范围可控，不在本步骤一次性重做所有场景。

验收：

- 开题、拟纲、作答等考试内动作不推进 `tenDayPeriod`。
- 考试提交后仍保存考试记录、虚拟考生、榜单、晋级结果和完整 scholar -> official 路径。
- 考试窗口仍按月份开放；开场月上/中/下旬都可入场。
- 下旬合法触发考试后，即使全局随后进入下月上旬，自动开题仍复用保存的开放 snapshot，不误判错过。

### S48.5：长期系统与月末语义适配

范围：

- `longTermEvents.remainingMonths` 只在月末完整结算时递减；调度、解决和季节事件判断也只在月末运行。
- 官场 `officialCareer.tenureMonths` 只在月末增加；首次授官仍可在入仕后的第一个官员回合立即结算。
- 官场差事、弹劾、考成等原本语义上代表“数月”的期限按三回合一月换算；主动 NPC 请托这类明确按“回”计的短期响应保留回合语义。
- World Threads 的 `deadlineLabel`、`remainingMonths`、`turnsRemaining` 文案要准确区分“旬回合”和“月份”。
- World Entities、role/world coupling、provider long-run 的服务器效果模拟同步读取新的 tick 结果，不让脚本仍假设一回合一月。

验收：

- 长期事件非月末不递减，月末才递减并可调度/解决。
- 官场任内月份三回合才增加一月，首次授官不延迟。
- 世界议程中按回合计的请托仍显示剩余回合，按月计的大势仍显示剩余月份。

### S48.6：前端与验收收束

范围：

- 前端状态栏、存档卡、考试日历、考试弹窗、考试档案、回合反馈显示“年月旬”。
- `worldTick`/旬度反馈在浏览器叙事区清晰显示，不遮挡、不溢出。
- Browser smoke 设置考试合法窗口时同时设置旬；完整书生四级科举入仕路径继续通过。
- Provider long-run 校验 `tenDayPeriod` 范围和时间推进节奏；无 key 跳过策略不变。
- 更新 README、产品 brief、架构文档、World Tick、Exam Calendar、Long Term Events、Official Career、Browser Acceptance 等稳定契约。

验收命令建议：

- `node --check <changed runtime/test/script files>`
- `node --test test/worldTick.test.js test/gameTurnTick.test.js test/longTermEvents.test.js test/officialCareer.test.js test/examCalendar.test.js test/examTravel.test.js`
- `node --test test/browserSmokeScript.test.js test/providerLongRunScript.test.js`
- `npm run eval:ai`
- `$env:AI_PROVIDER='mock'; npm test`
- `$env:AI_PROVIDER='mock'; npm run smoke:browser`
- `git diff --check`

## 6. 风险与默认决策

- 不把所有输入硬解释为十天。只有普通全局行动默认消耗一旬；场景内动作由场景规则裁决。
- 不让考试被“每输入十天”吞掉。科举是第一个必须细化的场景。
- 不改变开题、交卷、读档、开局的全局时间推进：这些操作默认不额外推进旬，除非后续步骤明确设计为场景结算。
- 不改变开发规范、AI/server 权限边界、Mock 默认可玩、真实 provider 可选、JSON 存档路线或无构建前端栈。
- 旧存档无需迁移文件；读取时缺少 `tenDayPeriod` 即按上旬补齐。

## 7. 进度记录

### 2026-05-07

工具：Codex

步骤：S48.1

提交：`1e7bcd3 docs: start time specialty roadmap`；子代理规范修复为 current follow-up documentation commit

完成：

- 将第四阶段路线图归档为 `docs/PHASE_FOUR_ROADMAP_ARCHIVE.md`。
- 将当前活动台账切换为“时间专项”路线图，综合本会话确定的旬制、月末结算、考试多阶段和场景内时间原则。
- 明确开发规范不变，后续实现仍需更新 shared context、运行验证、使用 Git，并在非低风险纯文档改动前执行只读子代理复审。
- 后续修正：恢复 S48.1 重写时被压缩掉的完整子代理使用规则；该规范继续作为时间专项开发的强制流程。
- 后续审查修正：恢复依赖/插件/开源参考治理入口，子代理授权主体恢复为 Codex 和 Claude Code，并补回中文输出检查、复审报告口径和 AI 权限矩阵检查提醒。

验证：

- `git diff --check`

风险/遗留：

- 本步骤只做规划与文档切换，不改变运行时代码。
- 后续 S48.2 开始才新增 `tenDayPeriod` 和时间 helper。

下一步：

- 开始 S48.2：建立全局旬制日历基础、旧档默认上旬和 provider 时间字段边界。
