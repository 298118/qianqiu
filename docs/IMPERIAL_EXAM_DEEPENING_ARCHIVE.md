# 《千秋》S68-S69 科举、读书、评卷与授官深化归档

归档日期：2026-05-12。

本文件归档 S68.1-S69.5 的科举深化实现，供 S70 AI prompt pack、工具协议、actor 权限和多 AI 编排接手。制度源头仍见 [IMPERIAL_EXAM_SYSTEM_CONTRACT.md](IMPERIAL_EXAM_SYSTEM_CONTRACT.md)，规划源头仍见 [IMPERIAL_EXAM_DEEPENING_ROADMAP.md](IMPERIAL_EXAM_DEEPENING_ROADMAP.md)。稳定开发治理仍以 [DEVELOPMENT_GOVERNANCE.md](DEVELOPMENT_GOVERNANCE.md) 为锚点。

## 1. 归档结论

S68-S69 已把“书生 -> 四级科举 -> 入仕”的旧压缩链路扩展为制度化生涯路径，同时保持外层 `child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official` API 兼容。

已完成能力：

- S68.1：固定明清原型与游戏压缩边界，明确 AI 老师、保人、同年、考官、吏部和皇帝只能提交 proposal，不能直接裁决资格、榜单、关系或官职。
- S68.2：新增 server-owned `studyProfile` / `studyProfileView`，把经义、制艺、策论、律例、史学、卷面、科场耐力和读书计划整理成可见读书簿。
- S68.3：新增老师点评、书院师友、同窗互评、小题训练、荐书和保结前置摘要；`teacherFeedbackProposal` 只能作为文本点评进入服务器清洗流程。
- S68.4：新增 `activeExam.procedure` / `examProcedureView`，展示童试三关、乡试/会试三场、多卷流程、保结、搜检、号舍、弥封、誊录、对读、磨勘、放榜和归档。
- S68.5：新增 `examinerPanelView`，把科场事故、多考官阅卷、服务器定分输入和 provider 考官建议拒绝摘要纳入交卷后、榜单前流程。
- S69.1：新增 `examHonorLedger` / `examHonorView`，从服务器定榜顺序写入解元、会元、状元、榜眼、探花、传胪、二甲/三甲次序和三元及第。
- S69.2：新增 `examNetwork` 安全快照，从定榜顺序、公开荣誉和脱敏阅卷摘要派生同年、房官、主考/座师和读卷官可见关系。
- S69.3：新增 `appointmentTrack` / `appointmentTrackView`，殿试后按甲第、榜次、荣誉、同年座师、官缺 projection 和籍贯回避裁决初授。
- S69.4：新增浏览器“科举档案”整合面板，组合读书簿、科场流程、多考官阅卷、榜单荣誉、同年/座师/考官和授官轨迹。
- S69.5：新增 Provider/Mock 验收守卫，`smoke:exam-s69` 完整跑通 Mock 四级科举到初授，真实 provider smoke 覆盖老师点评、出题、评卷和 S69 越权 patch 检查。

## 2. 完成步骤索引

| ID | 摘要 | 主要证据 |
| --- | --- | --- |
| S68.1 | 科举制度契约 | `docs/IMPERIAL_EXAM_SYSTEM_CONTRACT.md` |
| S68.2 | 读书账本与学业计划 | `src/game/studyProfile.js`、`test/studyProfile.test.js` |
| S68.3 | 老师点评、书院与同窗互动 | `teacherFeedbackProposal` schema、`test/gameTurnRelationships.test.js` |
| S68.4 | 科场制度流程 | `src/game/examProcedure.js`、`test/examProcedure.test.js` |
| S68.5 | 科场事件与多考官阅卷 | `src/game/examReview.js`、`test/examReview.test.js` |
| S69.1 | 榜单名次荣誉 | `src/game/examHonors.js`、`test/examHonors.test.js` |
| S69.2 | 同年、座师与考官网络 | `src/game/examNetworks.js`、`test/examNetworks.test.js` |
| S69.3 | 殿试初授与授官轨迹 | `src/game/appointmentTracks.js`、`test/appointmentTracks.test.js` |
| S69.4 | 浏览器科举档案面板 | `public/app.js`、`scripts/browserSmoke.js`、`test/browserSmokeScript.test.js` |
| S69.5 | Provider/Mock 验收 | `scripts/mockImperialExamAcceptance.js`、`scripts/providerSmoke.js`、`test/aiControlRedTeam.test.js` |

## 3. 稳定边界

- 完整书生路径仍必须保持：`scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`。
- AI 可生成题目、老师点评、文卷评语、考官建议、科场事件、同年/座师叙事和授官倾向；服务器仍拥有资格、考期、舞弊、评分复核、榜单、荣誉、同年座师关系、授官、任免和持久化裁决。
- 普通 provider patch 不能写 `studyProfile`、`examProcedure`、`examHonorLedger`、`appointmentTrack`、`activeExam`、`examCalendar`、`player.examRank`、`player.officeTitle` 或 `player.examHistory`。
- 浏览器和 prompt 只读 route view / capped summary：`studyProfileView`、`examProcedureView`、`examinerPanelView`、`examHonorView`、`relationshipView` / `worldPeopleView`、`appointmentTrackView`、`eventArchiveView` 和考试历史安全快照。
- 当前不保存弥封身份映射、保结密注、考官 hidden intent、模型原始建议、raw provider proposal、内部审计、隐藏榜单或 hidden 科场私档。若未来要保存这些内容，必须先做 redacted player API 和角色视野分层。
- 真实 provider 出题、评卷和 `examiner_reviews` 展示字段进入 route/history 前必须清洗 hidden token、raw provider/proposal、prompt/index/table 名、本地路径和 key 形状文本。

## 4. 验收与回归入口

常用验收命令：

```bash
npm run smoke:exam-s69
npm run smoke:provider
npm run smoke:provider:route
npm run smoke:browser
node --test test/examProcedure.test.js test/examReview.test.js test/examHonors.test.js test/examNetworks.test.js test/appointmentTracks.test.js
node --test test/aiControlRedTeam.test.js test/publicAppSource.test.js test/browserSmokeScript.test.js
```

S69.5 归档前已在本机 keyed `mimo-deepseek` 环境通过 `npm run smoke:provider` 和 `npm run smoke:provider:route`；无 key 环境仍应把 provider network gate 的 no-key skip 视为有效本地结果。`npm run smoke:exam-s69` 是 Mock/no-key 的科举深化主验收入口。

## 5. 残余风险与后续入口

- SQLite 科举派生表 parity 尚未单独拆表；当前科举深化数据仍主要存在 JSON `worldState`、route view、事件档案和安全历史快照中。是否需要 SQLite 科举派生表，应在 S71 数据库玩法化或后续维护专项中重新评估。
- 更长真实 provider long-run、route-level SSE keyed 验收和多 actor provider 验收留给 S70 后的 AI 编排专项。
- S70.1 应以 S68-S69 的老师、考官、吏部、皇帝 proposal-only 经验为样板，先固定 prompt pack 分层、工具 envelope、actor 权限和 Mock/provider smoke。
- S71 若保存 hidden 科场私档，必须先完成 redacted player API、hidden-safe diagnostics 和 role visibility 分层，不能把 hidden 真值回填普通 route `worldState`。
