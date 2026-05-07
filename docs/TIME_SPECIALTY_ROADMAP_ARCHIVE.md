# 《千秋》S48 时间专项路线图归档

归档日期：2026-05-07

本文件保存 S48 时间专项的已完成规划、关键决策和验收摘要。当前活动台账已经切换到 `docs/DEVELOPMENT_STEPS.md` 的 S49 动态世界数据库专项；开发规范不在本归档中维护，稳定规则以 `docs/DEVELOPMENT_GOVERNANCE.md` 和当前活动台账的保护段为准。

## 归档范围

S48 的目标是把《千秋》的长期模拟节奏从“普通回合一月”调整为“普通回合一旬”，并为考试这类高密度场景建立局部时间，避免玩家每次输入都被硬解释为十天。

已接受范围：

| ID | 结果 | 提交 |
| --- | --- | --- |
| S48.1 | 归档第四阶段规划，开启时间专项路线图，并恢复开发规范保护 | `1e7bcd3` 及后续文档修复 |
| S48.2 | 建立 `tenDayPeriod`、共享时间 helper、旧档默认上旬、provider 时间字段边界 | `15e078f`、`8d93b8c` |
| S48.3 | 普通回合改为上旬 -> 中旬 -> 下旬 -> 下月上旬，月末才完整结算 | `ef767c6` |
| S48.4 | 建立考试局部场景时间，新增 `/api/exam/progress`，写卷中普通输入不消耗全局旬 | `54afc38` |
| S48.5 | 适配长期事件、官场期限、World Threads、World Entities 和 provider long-run 的旬度/月末语义 | `50d228b` |
| S48.6 | 前端日期展示、browser smoke、provider long-run 和完整书生入仕路径验收收束 | `6bcfb77` |

## 稳定结论

- 全局普通自由行动默认推进一旬：上旬 -> 中旬 -> 下旬 -> 下月上旬。
- `turnCount` 仍表示玩家有效输入次数；`year/month/tenDayPeriod` 由服务器裁决。
- 下旬进入下月上旬时才执行完整月度结算：长期事件月份递减、季节事件、官场任内月份和考成周期等都按月末推进。
- 非月末旬只做轻量 `[旬度]` 反馈和小幅自然漂移。
- 考试已先落地局部场景时间：入场、审题、拟纲、作答、誊清、交卷推进 `activeExam.sceneTime`，不推进全局年月旬。
- 玩家可见日期使用“年月旬”：状态栏、存档卡、考试日历、考试弹窗、考试结果/档案、官场履历和回合反馈都显示上旬/中旬/下旬。
- 官场差事和弹劾期限按月换算为旬回合；主动 NPC 短期请托继续保留按回合响应；World Threads 通过 `deadlineUnit` 区分回合、旬和月份。
- World Entities 读取 `worldTick.cadence`：考试等 `scene` cadence 不产生实体影响，长期事件实体影响只在月末入账。
- provider long-run 已按 `worldTick.timeAdvance` 验证一月三旬，并在内存模拟中复用服务器拥有的世界实体和世界议程效果。

## 验收摘要

S48.6 收束时通过的主要验证：

- `npm run check:docs-governance`
- `npm run eval:ai`（12 tests passed）
- `$env:AI_PROVIDER='mock'; npm test -- --test-concurrency=1`（291 tests passed）
- `$env:AI_PROVIDER='mock'; npm run smoke:browser`（14 screenshots checked）
- `git diff --check`

代表性 focused 验证覆盖：

- `src/game/time.js`
- `src/game/worldTick.js`
- `src/game/examSceneTime.js`
- `src/game/officialCareer.js`
- `src/game/longTermEvents.js`
- `src/game/worldThreads.js`
- `src/game/worldEntities.js`
- `scripts/providerLongRun.js`
- `scripts/browserSmoke.js`

## 遗留方向

- 考试之外的廷议、堂审、战斗、旅途遭遇和重大差事收束仍可接入 scene-local time，但不再属于当前活动专项。
- 移动端写卷草稿持久化、更多密集场景阶段按钮和更细的场景日志可作为后续体验增强。
- 数据库专项必须继承 S48 的时间语义：数据库记录、事件日志、AI proposal 审计和 prompt projection 中涉及时间时，应保存或显示明确的年月旬、场景局部阶段和 cadence。
