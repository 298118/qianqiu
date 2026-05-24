# S88 全面系统打磨阶段性归档

本文件归档 S88 全面系统打磨在 2026-05-20 至 2026-05-24 的阶段性成果。它取代 `docs/DEVELOPMENT_STEPS.md` 中原有的 S88 长表和逐日长流水；后续接手只需先读共享上下文、活动台账和本归档，必要时再查具体提交 diff。

S88 原规划见 [QIANQIU_POLISHING_ROADMAP.md](QIANQIU_POLISHING_ROADMAP.md)。本归档不是新的活动路线图；若继续其中某个方向，应在 `docs/DEVELOPMENT_STEPS.md` 新开 S89 或更具体的小步骤。

## 范围总览

| 范围 | 阶段性状态 | 归档摘要 |
| --- | --- | --- |
| S88.0 | DONE | 新增全面打磨路线图，确认 S88 覆盖书生主线、多身份循环、官场后果、AI 世界引擎、NPC/关系、资产经济、React、PixiJS、视觉立绘、后端类型安全和 provider 验收。 |
| S88.1 | DONE | 加固 AI remote helper/provider public-safe envelope，把 remote helper task/requester、public response 和 provider fallback 日志纳入类型/安全出口，拒绝 raw provider payload、完整 prompt、base URL、key、本地路径、`statePatch` 或 `worldState` 外泄。 |
| S88.2 | DONE | 固定 SQLite derived row builder 类型边界，覆盖 world session、prompt retrieval、safe search、repair status、maintenance diagnostics 和 row builder JSDoc/contract；SQLite 派生表继续只从 `world_sessions.world_state_json` 单向修复。 |
| S88.3 | DONE | 完成书生主线补强一轮：殿试授官后生成首月差事，备考压力与入场反馈进入安全 view，放榜后同年座师/授官过渡更完整，读书计划三旬化，考试场内阶段反馈可见。 |
| S88.4 | DONE | 完成入仕官员首轮官场体验七片：官署首月、奏折朝议入口、首月回署裁决、朝议/部院/御前跟进、跨身份奏议回应、长期官场后果信号和皇帝/部院续办链路。 |
| S88.5 | STAGED | 建立 `roleCycleView` 六身份循环矩阵，当前身份展开事务/风险/入口/AI read scope/工具权限/proposal 边界/服务器裁决；非当前身份只显示待任占位。地方官市价、将领舆图/战事档案接入低风险 resolver，React 增加六身份矩阵与权责边界 polish。 |
| S88.6 | STAGED | 新增 `domainConsequenceView` 公开领域后果追踪，接入 resolver input、topic surface、topic draft、安全搜索、SQLite safe-search、事件档案、world thread、地图/史册入口和角色可见性红队；公开 `publicEchoRef` 与 canonical echo 审计链。 |
| S88.7 | STAGED | 深化 NPC 与关系：主动来函 resolver trace、关系行动 trace、后续簿、follow-up resolution、长期记忆/world thread、follow-up evidence、关系行动 evidence、实体压力、`worldEntityView.recentImpacts`、史册实体归档和 browser DOM canary。 |
| S88.8 | STAGED | 建立 `economyTraceView` 资产/囊箧/交易/委派/市价/NPC 月账解释，接入响应、人物页、主卷、resolver/topic/search/SQLite、topic draft 和普通/SSE/true streaming 重校验。 |
| S88.9 | STAGED | React 前端操作与状态防线：route-local session guard、专题层案卷绑定、人物/囊箧/科举/皇榜安全空态、overlay 焦点、移动端/长文本/低动效 polish、route recovery、草稿/session 绑定、NPC/囊箧 mutation 防串扰。 |
| S88.10 | STAGED | PixiJS 舆图行动入口：舆图行动牌和 `map-runtime` draftContext、服务器重建 `mapRuntimeView` 复核、true streaming 回归、NPC 来函/关系行动 visual-only 舆图锚点；地图 layout、坐标和 visual-only refs 不能成为服务器 evidence。 |
| S88.11 | STAGED | 视觉与立绘一致性：runtime manifest 生成层 QA、assetRegistry 消费层 QA、browser smoke runtime manifest 请求/字段/成年立绘/lazy-load/重要 NPC 池隔离守门。 |
| S88.12 | STAGED | Mock/真实 provider 长循环验收首轮：no-key runtime fallback、provider long-run 经济 tick 与 `economyTraceView` 验收、真实 provider 缺 key 自动 skip/显式点名失败边界。 |

`STAGED` 表示该方向已有多个可运行 coherent slice 和验证锚点，但仍可继续深化；它不表示功能关闭或无需后续打磨。

## 稳定边界

- S88 全部切片继续保护 `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official` 完整路径。
- 浏览器只写本地草稿或 route/surface 状态；资源、身份、交易、NPC 行动、经济结果、考试晋级、官职任免、地图行动、关系终局、婚姻、弹劾、定罪、背叛和 hidden 信息仍由服务器裁决。
- AI 是世界引擎，但只能读取安全 view、生成叙事/建议/proposal 或受限 structured payload；不能直接执行 SQL、写 canonical state、业务表、raw ledger 或审计表。
- `topic_draft`、`draftContext`、舆图行动、实体压力、领域后果、经济解释、NPC follow-up 和关系 evidence 都必须由服务器从当前安全 view 重新校验；伪造 refs、raw/provider/prompt/path/key/hidden/SQLite 污染和 visual-only refs 不得进入裁决。
- SQLite 派生行、`event_archive_index`、`prompt_retrieval_index` 和 `safe_search_index` 只是本地安全索引，不是玩家 API、prompt 或 resolver 的 canonical truth source。
- 立绘与 UI 资产只能通过 runtime manifest、已审核 `portraitRef`、缩略图、低清占位和 lazy-load budget 消费；不得显示未审核素材、完整 source manifest、本地 artifacts 路径或 provider/key/raw/prompt 字段。

## 主要验证锚点

S88 各切片已在对应提交中运行过不同组合的 focused tests、client tests、browser smoke、provider smoke 和完整测试。归档后可优先参考以下常用入口：

- `npm run typecheck:server`
- `npm run typecheck:client`
- `npm run test:client -- --pool=vmForks --maxWorkers=2`
- `npm run build:client`
- `AI_PROVIDER=mock npm run smoke:browser`
- `npm run smoke:exam-s69`
- `npm run smoke:provider:long`
- `npm run qa:runtime-manifest`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`
- `git diff --check`

对包含代码、测试、运行时行为、API/schema、提示词或验证工具的后续提交，仍必须在暂存和提交前委派只读子代理审查最终 diff 与验证证据。低风险纯文档压缩可跳过，但要写入共享上下文或最终回复。

## 后续候选方向

- 将 S88.5-S88.12 中仍标记为 `STAGED` 的方向拆成新的 S89/S90 小步骤，不继续在 S88 长表内追加。
- S88.9 可继续做 loading/empty/error/mobile/operation polish，但仍只处理浏览器安全消费和本地草稿，不引入前端裁决。
- S88.7 可继续深化关系后果、婚姻/比武/论道后续和 NPC 主动来函来源，但必须先设计 AI read scope、工具权限、proposal 边界、服务器裁决和 Mock/no-key fallback。
- S88.12 可继续真实 keyed provider 长跑证据、streaming 兼容和 provider route smoke；无 key 环境仍不能成为本地启动门槛。
- S88.11 可继续素材 QA 消费层巡检；任何 AI 生成或第三方视觉资产入 manifest 前都必须视觉审核历史/水墨适配、可读性、一致性和安全字段。

## 归档记录

2026-05-24：按用户要求压缩当前上下文，并把 `docs/DEVELOPMENT_STEPS.md` 中 S88 活动长表归档到本文件。本轮只改文档，不改代码、API/schema、运行时行为、提示词、验证工具或素材 manifest；按低风险纯文档规则跳过提交前子代理复审。
