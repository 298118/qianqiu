# 《千秋》S88 全面系统打磨路线图

本路线图承接 S81-S87：不做临时补丁，不追求“最小实现点”，而是在默认可运行、内容保护、服务器裁决和可审查粒度不受损的前提下，系统提升《千秋》的完整游戏体验、玩法深度、AI 世界引擎、前后端质量和长期可维护性。

## 1. 总原则

- 完整书生路径继续作为第一优先级验收：`scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`，任何打磨不得破坏读书、应考、阅卷、放榜、同年座师、授官和入仕后的首轮官场体验。
- 复杂功能按后端/API/AI/前端/验证/文档拆分，前端只消费安全 API/view，不裁决资源、身份、交易、NPC 行动、经济结果、官职、考试晋级或隐藏信息。
- AI 是世界引擎，但只负责叙事、题目、评分建议、关系建议、受限 `statePatch` 或 structured proposal；服务器继续拥有 schema 校验、白名单、clamp、安全清洗、科举晋级、官职任免、资源扣减、经济月结、NPC 后果和持久化。
- 浏览器、prompt 和玩家 API 不暴露 raw audit、provider payload、完整 prompt、本地路径、key、hidden notes、hidden intent、`privateSignalTags`、未公开任所、未公开关系或 raw ledger。
- 新增数值、阈值、概率、间隔、UI cap、fixture 规模或 prompt budget 时，优先进入 `src/config/GameConfig.js` 或领域 `src/game/*Config.js`。

## 2. S88 小步骤

| ID | 目标 | 后端 / API | AI 权限与降级 | 前端 | 测试 | 文档 |
| --- | --- | --- | --- | --- | --- | --- |
| S88.0 | 系统打磨路线图与边界复核 | 不改运行时；确认 S87 后当前边界、工作树和下一步切片 | 固定后续每步必须声明 read scope、tool permissions、proposal boundary、server adjudication、audit 和 Mock/no-key fallback | 不改 UI | docs governance、diff check | 新增本文件，同步台账、brief、共享上下文 |
| S88.1 | AI remote helper/provider public-safe envelope | 把 `remoteHelpers` 的 prompt task、provider requester、validated payload 纳入后端 typecheck；AI connection public response 增加 forbidden field contract；provider fallback 日志和诊断错误统一脱敏 | 模型原始文本只在 helper 内部经 `parseJsonFromText -> normalizeModelPayload -> validatePayload`；provider SDK response、request body、prompt、base URL、key、本地路径不得进入 public envelope；Mock fallback 保持默认可玩 | 不改页面，仅保护 `/api/ai/connection-test` 与 provider fallback 可见摘要 | `npm run typecheck:server`、remote/modelRoute/diagnostics/connection focused tests、route response contract、AI settings/audit tests、`npm test` | brief/README 记录 S88.1 安全边界，台账记录实现与验证 |
| S88.2 | SQLite derived row builder 类型边界 | 覆盖 `SqliteWorldSessionRow`、prompt retrieval、safe search、repair status 和首批 row builder JSDoc/TS contract；保持 `world_sessions.world_state_json -> server views -> derived rows` 单向修复 | AI 不能执行 SQL 或写 `geo_*`、`people_*`、`office_*`、`event_archive_index`、`prompt_retrieval_index`、`safe_search_index`、audit 表 | 不改 UI | `npm run typecheck:server`、SQLite prompt/safe/session focused tests、storage adapter contract | brief/台账/共享上下文同步 SQLite row 边界 |
| S88.3 | 书生主线补强一轮 | 深化读书计划、备考压力、考试入场前后反馈、授官后首月差事；保持四级 API 兼容 | 老师、房官、主考、吏部、皇帝只提 proposal；服务器定分、定榜、授官和入仕首轮官署差事 | 科举档案与主卷反馈更连贯，空状态提示下一步 | `npm run smoke:exam-s69`、exam focused tests、official career tests | 科举/brief/台账同步 |
| S88.4 | 入仕官员首轮官场体验 | 官方履历、差遣、考成、上官同僚、奏折回执和首月月报形成闭环 | AI 可生成官署意见和月报文气；任免、差遣成败、绩效与弹劾风险由服务器裁决 | 主卷官员面板和朝议/奏折入口突出“本月差事” | official career、monthly briefing、browser smoke | brief/官场契约同步 |
| S88.5 | 六身份循环矩阵 | 皇帝、大臣、将领、地方官、书生、入仕官员各自建立代表性行动、反馈、风险和长期后果矩阵 | 按身份限制 read scope 与 tool allowlist；低权限身份不能读 hidden 军务/任所/私档 | 身份面板显示本身份核心事务、风险、待办和可用专题 | role tests、turn role coupling tests、client tests | 台账和 brief 更新身份矩阵 |
| S88.6 | 官场与世界后果追踪 | 奏折、政令、军务、刑名、财政、外交、地方事务、任免、朝议、月报、长期事件统一增加可追踪后果 refs | AI 只拟稿/建议/请求裁决；服务器 resolver 写事件、后果、审计摘要和安全 views | 史册、朝议、主卷、地图都能追溯“由何事引发/下一步何时回响” | domain resolver focused tests、event archive/search tests | 更新相关契约与 AI 控制矩阵 |
| S88.7 | NPC 与关系深化 | 主动来函、论道、切磋、求爱、婚姻、引荐、请托、弹劾、背叛、行贿、人情债进入专门 resolver 分层 | 私人目标与 `privateSignalTags` 只用于服务器内部排序；公开 API/prompt/browser 只见清洗后的意图与结果摘要 | 人物页“来函/礼法/交易/委派”操作效率提升 | NPC active/relationship/safety tests、route red-team | NPC 契约/brief/台账同步 |
| S88.8 | 资产、囊箧、交易、委派与经济解释性 | 资源扣减、交易成交、委派回禀、经济月结和关系变化增加可解释 trace；资源仍服务器裁决 | AI 可解释物品效果、议价理由、任务回禀文案；不能直接写账本 | 囊箧、交易、委派和县令/官员经济面板显示“为何变化” | inventory/trade/delegation/npc economy tests、client tests | NPC/经济契约同步 |
| S88.9 | React 前端操作与状态打磨 | 不新增裁决；补 loading、empty、error、低动效、移动端、文本溢出和快捷操作状态 | AI quick action/topic draft 仍只写草稿；失败走 local fallback | 首页、读档、主卷、舆图、人物、囊箧、史册、科举、皇榜、朝议、设置逐页 polish | `npm run typecheck:client`、`npm run test:client`、`npm run build:client`、`npm run smoke:browser` | 前端归档/README 更新 |
| S88.10 | PixiJS 水墨地图行动入口 | 复用 `mapRuntimeView`，把局势、移动、事件、地方事务、军务外交、NPC 活动和行动草稿串成浏览入口；坐标仍只用于浏览器布局 | 地图 AI 工具只读 `mapContextView` capped summary 和 stable refs，不读显示坐标 | 地图 tooltip、筛选、草稿、事件态势、移动路线更可用 | map runtime/browser smoke/canvas checks | 地图契约/素材台账同步 |
| S88.11 | 视觉、立绘与氛围一致性 | 不硬编码本地路径，不显示未审核素材，不一次性加载全量立绘池 | AI 生成或第三方素材入库前必须视觉审核；女性立绘成年、端庄、服饰完整 | 统一古典中文氛围，readable first, ornamental second | asset QA、portrait QA、runtime manifest、browser smoke | 资产台账/视觉指南同步 |
| S88.12 | Mock/真实 provider 长循环验收与归档 | Mock 默认完整可玩；真实 provider 可选增强，覆盖长叙事、多 actor、工具、月报、跳时、记忆、地图、NPC/经济 | 真实 provider 失败不成为启动门槛；JSON 经 schema/白名单/server resolver 后才影响状态 | 不新增 UI 裁决；设置页清楚显示 provider 可用性 | `npm test`、provider smoke、exam smoke、browser smoke、dual-mode storage | S88 归档、共享上下文和台账收束 |

## 3. 当前优先切片

S88.1 与 S88.2 已完成，当前正在推进 S88.3。S88.3 的目标是补强完整书生主线：深化读书计划、备考压力、考试入场前后反馈、阅卷/放榜后的同年座师网络、授官过渡和入仕后的首月差事。第一个切片已让殿试授官 resolver 按服务器授官轨迹 seed 入仕首月差事，并由 `npm run smoke:exam-s69` 断言殿试后 `officialCareerView` 与最终 session 均有首月任务；兼容 `worldState` 公共响应同步递归剥离嵌套 hidden/raw/provider/prompt/statePatch 字段。第二个切片把考试取题后的盘费、路途、保结、准考缺口、学业维度、体力心态和读书计划整理为服务器拥有的 `entryPreparation.preparationPressure` / `entryFeedback`，再经 public sanitizer 进入直接 `entryPreparation`、兼容 `worldState`、`examProcedureView`、`studyProfileView.examPreparation`、React 书生面板和科举页侧栏；AI 与前端都不能写这些压力结果，只能读取安全摘要或写行动草稿。第三个切片新增服务器拥有的 `examAftermathView`，从定榜、科名荣誉、公开同年座师网络和授官轨迹整理放榜后摘要、公开联系人、下一步草稿建议和权限边界，并把快照写入 `examHistory.examAftermath`；React 皇榜页只读该 view，不自行推断关系、名次或官职。第四个切片深化 `studyProfileView.nextPlan`，把原本的下旬计划扩展为三旬窗口、补弱强度、当前/目标分、晨午暮日课、复盘节点、风险提示、首课草稿和权限边界；React 书生面板只读这些字段并把“执行首课”写入奏折草稿，client smoke 会检查日课/复盘/首课按钮。后续继续补考试入场后反馈。所有晋级、榜单、授官、读书属性、同年座师关系和官署差事成败继续由服务器裁决；老师、房官、主考、吏部和皇帝等 AI actor 只提供叙事、题目、评分建议或受限 proposal。
