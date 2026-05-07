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
- 包含代码、测试、运行时行为、API/schema、提示词或验证工具变化的提交，暂存和提交前必须委派至少一个只读子代理审查最终 diff 与验证证据。低风险纯文档改动可跳过，但必须在共享上下文或最终回复说明。

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
5. 运行相关验证命令。
6. 对非低风险纯文档改动执行只读子代理提交前审查。
7. 用 Git 提交本次 coherent change。

状态值：

- `TODO`：未开始。
- `IN_PROGRESS`：正在做，接手者应先检查工作树和上下文。
- `DONE`：已完成、已验证、已提交或随当前文档提交完成。
- `BLOCKED`：被外部条件阻塞，必须写明原因和解除条件。

## 2. 时间专项目标

时间专项的目标是让《千秋》的长期模拟节奏更符合玩家体感：普通自由行动从“每回合推进一月”改为“每回合推进一旬”，一月三回合；同时避免把考试、廷议、审案、战斗等密集场景粗暴拉成“一输入十天”。

核心原则：

- **全局时间**：日常读书、拜访、办差、施政、经营关系等普通自由行动，默认每个有效回合推进一旬：上旬 -> 中旬 -> 下旬 -> 下月上旬。
- **月末结算**：世界自然漂移、长期事件月份递减、季节性事件、官场任内月份和考成周期等原“月度”系统，默认只在下旬进入下月上旬时完整结算；非月末旬只做轻量小结。
- **场景内时间**：考试、廷议、堂审、战斗、旅途遭遇、重大差事收束等应使用场景局部阶段；玩家在场景内多次输入时，只推进该场景的时辰/阶段，不自动消耗一旬。
- **玩家可见日期**：状态栏、存档、考试说明、事件反馈和相关 UI 使用“年月旬”，例如“崇祯十七年八月上旬”。
- **服务器拥有时间**：`year`、`month`、`tenDayPeriod` 和场景时间推进都属于服务器裁决；provider 不得通过普通 `statePatch` 写入。

## 3. 步骤总览

| ID | 状态 | 目标 | 完成日期 | 工具 | 提交 |
| --- | --- | --- | --- | --- | --- |
| S48.1 | DONE | 归档第四阶段规划，开启时间专项路线图，并保持开发规范不变 | 2026-05-07 | Codex | current documentation commit |
| S48.2 | TODO | 建立全局旬制日历基础：`tenDayPeriod`、共享时间 helper、旧档默认上旬、provider 时间字段边界 |  |  |  |
| S48.3 | TODO | 改造普通回合与世界 tick：每回合推进一旬，非月末轻量小结，月末完整结算 |  |  |  |
| S48.4 | TODO | 建立场景内时间框架，并优先把科举考试改成多阶段局部时间 |  |  |  |
| S48.5 | TODO | 适配长期事件、官场任期/差事、世界议程、世界实体和脚本验收的月末/旬度语义 |  |  |  |
| S48.6 | TODO | 完成前端日期展示、浏览器 smoke、provider long-run 和完整书生入仕验收 |  |  |  |

## 4. 实施规划

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

## 5. 风险与默认决策

- 不把所有输入硬解释为十天。只有普通全局行动默认消耗一旬；场景内动作由场景规则裁决。
- 不让考试被“每输入十天”吞掉。科举是第一个必须细化的场景。
- 不改变开题、交卷、读档、开局的全局时间推进：这些操作默认不额外推进旬，除非后续步骤明确设计为场景结算。
- 不改变开发规范、AI/server 权限边界、Mock 默认可玩、真实 provider 可选、JSON 存档路线或无构建前端栈。
- 旧存档无需迁移文件；读取时缺少 `tenDayPeriod` 即按上旬补齐。

## 6. 进度记录

### 2026-05-07

工具：Codex

步骤：S48.1

提交：current documentation commit

完成：

- 将第四阶段路线图归档为 `docs/PHASE_FOUR_ROADMAP_ARCHIVE.md`。
- 将当前活动台账切换为“时间专项”路线图，综合本会话确定的旬制、月末结算、考试多阶段和场景内时间原则。
- 明确开发规范不变，后续实现仍需更新 shared context、运行验证、使用 Git，并在非低风险纯文档改动前执行只读子代理复审。

验证：

- `git diff --check`

风险/遗留：

- 本步骤只做规划与文档切换，不改变运行时代码。
- 后续 S48.2 开始才新增 `tenDayPeriod` 和时间 helper。

下一步：

- 开始 S48.2：建立全局旬制日历基础、旧档默认上旬和 provider 时间字段边界。
