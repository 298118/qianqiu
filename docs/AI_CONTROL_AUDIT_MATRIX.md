# AI 调动与控制审查矩阵

S44.1 固定本项目“AI 影响游戏，但不拥有最终裁决”的系统边界。后续新增 prompt pack、状态字段、浏览器面板、真实 provider 验收或多实体世界模型时，必须先检查本矩阵；如果新增系统能被 AI 读取、生成、建议、排序或解释，就要同步补一行。

## 权限术语

- 可生成：AI 可以写叙事、题面、评语、来函口吻、传闻文本或 JSON 中的展示性字段；这些内容仍需 schema 校验。
- 可建议：AI 可以通过受限 `statePatch`、`relationshipChanges` 或 `examTrigger` 提出变化方向；服务器可以夹断、忽略、改写或拒绝。
- 可排序：AI 可以给出候选解释、倾向或显性排序建议，但榜单、职位、考试晋级、事件结局等 canonical 顺序仍由服务器生成。
- 可评分：AI 可以给出科举五维分数和考官评语；本地反作弊、扣分、排名、晋级和处分仍由服务器应用。
- 可解释：AI 可以解释当前局势、角色反馈和行动阻力；不能把隐藏状态伪装成角色已知事实。
- 不可写：AI 输出不得进入该持久字段；schema、remote normalization 和 `applyStatePatch()` 都应拒绝或忽略。
- 不可裁决：AI 不能决定晋级、任免、作弊处罚、存档写入、隐藏信息公开、长期事件结局、世界 tick 或回滚。

## 总原则

- 模型只拿到玩家可见或 prompt 专用的压缩摘要；隐藏联系人、隐藏 thread、官场 `hiddenNotes`、provider 配置和 `.env` 不进入 prompt/UI。
- 普通回合只允许 provider patch `src/ai/schemas.js` 和 `src/game/stateRules.js` 中的 provider-facing 字段；`turnCount`、`year`、`month`、`tenDayPeriod` 和其他服务器独占字段必须通过服务器模块用 `allowServerOwnedPatchKeys` 写入。
- 路由持久化前必须完成 schema 校验、patch 白名单、clamp、服务器后续结算、玩家可见 view 构造和 session 写入。
- 新增浏览器面板只能渲染 route payload 中的 player-facing view，不能从原始隐藏 ledger 或 provider 原文扫描关键状态。`public/app.js` 中少量 raw `worldState` 兼容 fallback 只用于旧 payload/开发兜底，不是后续面板的允许路径。

当前威胁模型是本地开发与本机浏览器游玩：游戏状态 API 会返回完整 `worldState` 给同一个本地客户端，浏览器约束是“玩家可见 UI 不从隐藏 ledger 渲染”。若以后支持不可信客户端、多人访问或远程托管，必须新增脱敏状态 API，不能继续把完整 `worldState` 当成公网玩家响应。另一个边界是普通真实 provider 调用可能在 adapter 层失败后 fallback 到 Mock 以保持可玩；`POST /api/ai/connection-test` 和 provider smoke 才是检查真实 provider 连通性与配置失败的依据。

## 系统矩阵

| 系统 | AI 权限 | 服务器裁决与持久化 | 玩家可见性 | 当前证据 | S44.2 红队缺口 |
| --- | --- | --- | --- | --- | --- |
| AI 连接诊断 | 可生成一次开局 JSON，用于连通性与 schema 检查；可解释脱敏错误。 | `src/ai/diagnostics.js` 直接构造指定 provider，不创建 session，不写存档，不用 Mock fallback 掩盖真实 provider 失败；错误经 `redactSecrets()`。 | 开局页“AI 连接”显示 provider、模型摘要、耗时、streaming 能力、预览或脱敏错误。 | `src/routes/ai.js`、`test/aiDiagnostics.test.js`、`test/aiRoute.test.js`。 | 增加 partial/transformed key 泄漏、错误堆栈泄漏、指定 provider 与当前 provider 混淆探针。 |
| 开局叙事 | 可生成 `narrative` 和少量 `events`；不可写初始身份、年份、属性或隐藏状态。 | `createInitialState()` 校验身份和初始状态；`POST /api/game/start` 只在 opening 成功后写 session；route 构造各类 player-facing view。 | 玩家看到开局叙事、公开状态、身份面板和可见 view。 | `src/game/initialState.js`、`src/routes/game.js`、`src/ai/schemas.js`。 | 增加 opening 试图暴露隐藏 provider 配置、伪造身份权限、写入状态字段的 fixture。 |
| 普通自由回合 | 可生成叙事、`events`、展示性 `attributeChanges`；可建议 provider 白名单内的世界/玩家数值和 `relationshipChanges`；可建议 `examTrigger`。 | `normalizeProviderStatePatch()`、turn schema、`applyStatePatch()`、clamp 和 route follow-up 共同裁决；服务器按固定顺序执行关系、考试门禁、NPC、身份联动、tick、长期事件、官场和世界议程。若已有写卷考试，route 在调用 provider 前转入考试场景分支。 | 叙事、属性变化、人脉反馈、考试触发反馈、旬度/月度/大势/官场/议程 view；写卷中则显示科场局部反馈。 | `src/routes/game.js`、`src/ai/providers/remoteHelpers.js`、`src/game/stateRules.js`、`test/gameTurnRelationships.test.js`、`test/stateRules.test.js`。 | 增加一次性混合越权 patch 探针：同时伪造官职、考试名位、长期事件、议题和隐藏关系，确认全部被拒绝且安全字段仍可生效。 |
| SSE 流式回合 | 可流式生成顶层 `narrative` 字符串；不可在流式中提前提交状态。 | `streamTurn()` 缓冲完整 JSON，只有最终 payload 通过 schema/服务器结算后写 session；`streamingJson` 只抽顶层 `narrative`；后续失败不写存档。 | 浏览器先显示 pending 叙事；失败时移除未提交文本并显示错误。 | `src/utils/streamingJson.js`、`src/routes/game.js`、`test/streamingJson.test.js`、`test/streamingTurnRoute.test.js`。 | 增加 nested `statePatch.narrative`、半截 JSON、错误后重复 final_state、隐藏文本先流出再失败的浏览器/route 探针。 |
| 世界 tick / 全局时间 | AI 不可写 `turnCount`、日历推进、`tenDayPeriod` 或自然漂移；可在叙事中解释当旬/当月民情。 | `src/game/time.js` 归一化年月旬和格式化日期；`src/game/worldTick.js` 用服务器状态推进 上旬 -> 中旬 -> 下旬 -> 下月上旬，非月末返回轻量 `旬度` 反馈与小幅自然漂移，下旬 rollover 才执行完整月度资源/派系结算；route 用 server-owned patch 应用，并用 `worldTick.completedMonth` 门控长期事件与官场任期月份。 | 玩家看到 `[旬度]` 或 `[月度]` 反馈、事件、状态栏、存档和考试 UI 的年月旬；browser smoke 会检查关键日期面板包含 `上旬/中旬/下旬`。 | `docs/WORLD_TICK_CONTRACT.md`、`src/game/time.js`、`src/game/worldTick.js`、`test/time.test.js`、`test/worldTick.test.js`、`test/gameTurnTick.test.js`。 | 保持 provider 试图 patch `turnCount/year/month/tenDayPeriod` 同时触发考试窗口的跨模块探针，并覆盖非月末长期事件不递减。 |
| 普通回合考试触发 | AI 可建议 `examTrigger.shouldStart/level/reason`；不可直接创建或覆盖考试。 | `applyExamTrigger()` 检查 active writing exam、`canEnterExam()`、`canOpenExamInCalendar()`；拒绝原因进入 response，不写非法 `activeExam`。 | 玩家看到可入场或被拒原因，浏览器可打开合法考试。 | `src/routes/game.js`、`src/game/exams.js`、`src/game/examCalendar.js`、`test/providerLongRunScript.test.js`。 | 增加“已在写卷时 provider 请求另一场考试”“关闭考期最后一月流式触发失败”探针。 |
| 科举出题 | 可生成题面、题型、难度、要求、字数和推荐通过线；不可决定玩家是否有资格入场。 | `POST /api/exam/question` 先做考试等级、资格、日历窗口、盘费/赶考准备和未交卷复用；随后保存 server-owned `activeExam`。 | 玩家看到题面、要求、字数、准备情况和考试日历摘要。 | `src/routes/exam.js`、`src/game/examTravel.js`、`src/game/examCalendar.js`、`test/examTravel.test.js`、`test/examCalendar.test.js`。 | 增加 provider 题面夹带 `statePatch`、越级考试题、现代制度题、重复刷题绕过盘费探针。 |
| 科举局部时间 | AI 不裁决科场阶段、时辰、入场/交卷年月旬；浏览器按钮或写卷中 free-text 只作为玩家局部动作。 | `src/game/examSceneTime.js` 写 `activeExam.sceneTime`；`/api/exam/progress` 与写卷中的 `/api/game/turn` 不调用普通 provider、不运行全局 tick、不推进 `turnCount/year/month/tenDayPeriod`。 | 玩家看到场内阶段、局部步数、考试场景叙事和 `scene` cadence 反馈。 | `src/game/examSceneTime.js`、`src/routes/exam.js`、`src/routes/game.js`、`test/examSceneTime.test.js`、`test/examTravel.test.js`、`test/gameTurnExamTrigger.test.js`。 | 增加 provider/客户端试图跳阶段、错 examId 推进、写卷中 SSE 普通回合仍不滚旬的探针。 |
| 科举评分 | 可生成五维评分、考官评语和模型侧 authenticity echo；不可独自处罚或晋级。 | `checkEssayAuthenticity()` 本地复核；`applyAuthenticityPenalties()` 改写总分与评语；`applyExamPromotion()` 决定通过、降档、殿试入仕和严重作弊后果。 | 放榜页显示分数、复核、榜单、晋级/黜落原因和考试档案。 | `src/routes/exam.js`、`src/game/essayChecks.js`、`src/game/promotions.js`、`test/examRules.test.js`、`test/aiEvalFixtures.test.js`。 | 增加“AI 判抄袭但本地无证据”“AI 放过现代词”“AI 给 101 分/负分”“殿试严重作弊仍授官”的回归组合。 |
| 虚拟考生与榜单 | AI 当前不拥有 canonical 虚拟考生或榜单；grade schema 可承载 provider-shaped 样本，但 route 使用服务器生成。 | `generateVirtualCandidates()`、persistent cohort 和 `buildRanking()` 生成同场考生、文卷、榜次和同年记忆。 | 玩家看到同场文卷、名次、评语、强弱项和后续 rival 记忆。 | `src/game/candidates.js`、`src/game/examCalendar.js`、`src/routes/exam.js`。 | 增加 grade payload 夹带 provider 排名但服务器榜单不采纳的 route-level 探针。 |
| 关系变化 | AI 可建议顶层 `relationshipChanges`，只能指向既有、可见 character/faction，变化幅度受限；不可直接写 ledger。 | `ensureRelationshipLedger()` 归一化；`applyRelationshipChanges()` clamp、丢弃隐藏/未知目标、追加可见 notes；raw ledger 不进普通 patch。 | 玩家看到人脉簿、最近关系变动和必要的隐藏提示。 | `src/game/relationships.js`、`test/relationshipLedger.test.js`、`test/gameTurnRelationships.test.js`。 | 增加 provider 对 hidden contact/faction、超界 delta、伪造新 NPC、note 泄漏 hidden intent 的综合探针。 |
| 主动 NPC 请托 | AI 可生成相关叙事和关系建议；不可创建、替换、接受、拒绝或过期请求。 | `runActiveNpcRequestStep()` 调度、回应、过期和事件顺序；请求状态由服务器写 `worldState.activeNpcRequest`。 | 浏览器 `#active-request-panel` 显示可见来函/请托/期限；隐藏意图不公开。 | `src/game/activeRequests.js`、`test/gameTurnLongTermEvents.test.js`、`test/gameTurnRelationships.test.js`。 | 增加 provider 伪造 active request、把隐藏目标写进叙事、请求过期同回合越权接受的探针。 |
| 长期事件 | AI 可解释灾荒、边报、廷争等可见后果；不可排程、解决、删除或直接写队列。 | `runLongTermEventStep()` 依据服务器日历/指标调度和结算；server-owned patch 写入队列、冷却、近期归档和数值后果。 | 玩家看到 `[大势]` 反馈、长期事件 view 和世界议程派生摘要。 | `docs/LONG_TERM_EVENTS_CONTRACT.md`、`src/game/longTermEvents.js`、`test/longTermEvents.test.js`、`test/gameTurnLongTermEvents.test.js`。 | 增加 provider patch `longTermEvents.queue/recentResolved/cooldowns` 与隐藏归档泄漏探针。 |
| 官场任免与履历 | AI 可生成公文口吻、来函、传闻、关系态度和受限官场 meter 建议；不可授官、升降、弹劾成案、处分、起复或公开 hidden notes。 | `officialCatalog` 推断官署；`runOfficialCareerStep()` 推进差事/考成/弹劾流程并结算任免；`player.officeTitle`、`officialCareer` 和明显官职 `position` 由服务器保护。 | `officialCareerView` 和浏览器官场面板显示官署、差事、考成、关系、风险和履历档案。 | `docs/OFFICIAL_CAREER_CONTRACT.md`、`src/game/officialCareer.js`、`src/game/officialCatalog.js`、`test/gameTurnOfficialCareer.test.js`。 | 增加更多幻觉官职变体：空格、繁简、别称、低频官名、`position` 与 `officeTitle` 双通道混写。 |
| 身份与世界联动 | AI 可叙述角色行动背景并建议普通 meter；不可决定 compound 世界后果或 cooldown。 | `runRoleWorldCouplingStep()` 识别地方水利、将领战役、皇帝任免、大臣弹劾等关键行动，服务器写近期影响和冷却。 | 玩家看到 `[联动]` 行、相关状态、人脉与世界议程。 | `docs/ROLE_WORLD_COUPLING_CONTRACT.md`、`src/game/roleWorldCoupling.js`、`test/gameTurnRoleWorldCoupling.test.js`。 | 增加 provider patch cooldown/recentImpacts、重复触发绕过 cooldown、隐藏关系牵连泄漏探针。 |
| 多实体世界模型 / World Entities | AI 可读取可见 `worldEntities` prompt 摘要，并在叙事中解释朝廷衙门、地方士绅、书院、边镇、盐漕税赋和赈务压力；不可写实体账本、隐藏札记、`worldEntityImpacts` 或实体结局。 | `src/game/worldEntities.js` 创建/归一化 server-owned `worldState.worldEntities`，clamp/cap 实体指标并构造 `worldEntityView`；S45.2 的 `deriveWorldEntityInfluences()` / `applyWorldEntityInfluences()` 只从已经应用的服务器来源生成 bounded 影响；普通 `statePatch.worldEntities` 被 schema、remote normalization 和 `applyStatePatch()` 拒绝或忽略。 | 路由返回 `worldEntityView`，turn payload 额外返回本回合 server-owned `worldEntityImpacts`；隐藏实体、`hiddenNotes` 与 `recentNotes` 不进入 view/prompt。 | `docs/WORLD_ENTITIES_CONTRACT.md`、`src/game/worldEntities.js`、`test/worldEntities.test.js`、`test/gameTurnWorldEntities.test.js`、`test/prompts.test.js`。 | 后续若新增浏览器实体面板，要用 `worldEntityView` 而不是 raw ledger，并补 smoke 隐藏 token 扫描；`role_visible` 仍可作为后续身份视野切片。 |
| 世界议程 / World Threads | AI 可读取可见 prompt 摘要并解释议题；不可写 `worldThreads`、不可解决议题、不可替代来源系统。 | `ensureWorldThreadState()` 从 server-owned 来源派生、去重、排序、过滤隐藏 row 并构造 `worldThreadView`；S45.2 允许高压可见实体派生 `world_entity` 议题，并给议题挂 `relatedEntitySummaries`。 | 浏览器 `#world-thread-panel` 显示目标、期限、风险、相关对象、相关实体、介入提示和近归档余波；相关实体摘要来自可见 `worldEntityView`。 | `docs/WORLD_THREADS_CONTRACT.md`、`src/game/worldThreads.js`、`test/worldThreads.test.js`、`test/gameTurnWorldThreads.test.js`。 | 增加 legacy hidden `threads`、hidden `recentResolved`、provider `statePatch.worldThreads`、prompt 摘要泄漏的组合 fixture；若未来实体议题过多，再补去重/降噪规则。 |
| 存档与存档列表 | AI 不可写 session envelope、revision、metadata、文件路径或 provider 配置。 | `sessionStore` 负责安全 session id、envelope、atomic rename、revision、lock、metadata 脱敏和 skipped 文件。 | `GET /api/game/saves` 只显示 metadata；载入完整状态必须走 state route。 | `src/storage/sessionStore.js`、`test/sessionStore.test.js`、`test/saveListRoute.test.js`。 | 增加 provider 输出中夹带 session 路径/metadata、未来 schema 存档、并发 revision 冲突后的 AI 重试边界探针。 |
| 隐藏信息与视图过滤 | AI 只能读取 compact visible summary；不可公开隐藏关系、隐藏议题、隐藏实体、官场 hidden notes、密钥、provider 原始错误。 | 各 `build*View()` 与 prompt summary 负责过滤；diagnostics 错误脱敏；browser 只消费 view。 | 玩家可见信息需标明来源语气：公文、奏报、传闻、私信、角色自知或开发者诊断。 | `src/game/relationships.js`、`src/game/worldEntities.js`、`src/game/worldThreads.js`、`src/ai/prompts.js`、`test/prompts.test.js`、`test/browserSmokeScript.test.js`。 | 增加跨视图 hidden token corpus：关系 notes、NPC hidden intent、官场 hiddenNotes、world entity hiddenNotes、world thread hidden rows、provider key 片段。 |
| 浏览器显示 | AI 不直接控制 DOM 或读取 raw hidden ledger；只能通过 route payload 中的 narrative/view 间接呈现。 | `public/app.js` 渲染服务器 view；smoke 检查关键 selector、隐藏 token 和桌面/移动溢出。 | 玩家看到叙事、面板、考试、存档簿、AI 连接诊断；开发者看到 smoke 截图和测试输出。 | `public/app.js`、`scripts/browserSmoke.js`、`test/browserSmokeScript.test.js`、`docs/BROWSER_ACCEPTANCE.md`。 | 增加 AI 连接按钮浏览器 smoke、streaming 错误 UI、隐藏 token 多面板扫描和 save-list metadata 泄漏检查。 |

## 当前保护层

| 层级 | 作用 | 主要文件 |
| --- | --- | --- |
| Prompt pack | 在模型调用前声明 JSON 严格性、时代语气、隐藏信息限制和服务器边界。 | `src/ai/promptPacks.js`、`src/ai/prompts.js` |
| Model schema | 拒绝 provider-shaped payload 中的未知根字段、越权 `statePatch`、非法考试等级和超界评分。 | `src/ai/schemas.js`、`test/aiSchemas.test.js` |
| Remote normalization | 真实 provider 原文解析后先丢弃未知/服务器独占 patch，再交给统一 schema。 | `src/ai/providers/remoteHelpers.js`、`test/remoteHelpers.test.js` |
| State merge | `applyStatePatch()` 执行 provider/server 白名单、数值 clamp、事件裁剪和 official `position` 官职伪造过滤。 | `src/game/stateRules.js`、`test/stateRules.test.js` |
| Server follow-up | route 在 provider 后按固定顺序执行关系、考试门禁、NPC、身份联动、tick、长期事件、官场和议程同步。 | `src/routes/game.js`、`src/routes/exam.js` |
| Player-facing view | 各模块用 view 暴露可见摘要，隐藏 ledger 不直接给浏览器和普通 prompt。 | `src/game/*` view builders、`public/app.js` |
| Offline/keyed acceptance | no-network eval、route tests、provider smoke、browser smoke 分层检查 schema、语气、越权、布局和真实 provider 可达性。 | `testdata/aiEvalFixtures.js`、`scripts/providerSmoke.js`、`scripts/providerLongRun.js`、`scripts/browserSmoke.js` |

## S44.2 优先测试清单

1. 越权 patch 组合包：一个普通 turn 同时伪造 `activeExam`、`examCalendar`、`longTermEvents`、`officialCareer`、`roleWorldCoupling`、`worldEntities`、`worldThreads`、`player.examRank`、`player.officeTitle` 和隐藏关系目标，确认全部被 schema/normalizer/merge 层挡下。
2. 幻觉官职扩展：对 `player.position` 与 `player.officeTitle` 分别注入官职别称、空格拆分、繁简变体、目录外高官和“署理/护理/兼管”文本，确认 official 玩家不能被普通 provider 任免。
3. 非法晋级与考试门禁：provider 试图通过 `examTrigger` 越级、闭考期入场、已有写卷覆盖、殿试前直接入仕，确认 route 返回安全拒绝且 session 不变。
4. 隐藏信息泄漏：建立统一 hidden token fixture，覆盖关系、主动请求、长期事件、官场 notes、World Threads、provider 配置、浏览器多面板扫描和旧 payload/raw `worldState` fallback。
5. 作弊误判边界：AI 评分和本地 `checkEssayAuthenticity()` 意见不一致时，以本地复核和服务器晋级规则为准；严重作弊不得入仕。
6. 流式失败：流出顶层叙事后 provider 失败、流出 nested `statePatch.narrative`、半截 JSON 和重复 final payload 都不得写 session 或留下 pending 文本。

S44.2 baseline 已覆盖：

- `test/aiControlRedTeam.test.js` 用 route-level 恶意 provider 覆盖混合越权 patch（含 `worldEntities`）、隐藏关系目标、非法考试触发、provider-owned 科举候选/榜单、AI 与本地反作弊意见冲突、严重作弊不得晋级，以及流式失败后不落盘。
- `testdata/aiEvalFixtures.js` 与 `test/aiEvalFixtures.test.js` 增加混合越权离线 fixture，确认 opening/turn schema 拒绝跨系统状态写入。
- `test/stateRules.test.js` 扩大官职幻觉 guard，覆盖空格、繁体、署理/护理/兼管和常见英文官名。
- `test/aiDiagnostics.test.js` 覆盖长密钥片段脱敏；`src/routes/game.js` 的 SSE `error` 事件也复用 `redactSecrets()`，避免 provider 错误文本直接泄漏已配置 key 或片段。

仍留给后续的更细验收：

- 浏览器自动化仍主要通过既有 smoke helper 验证 pending 文本回滚；S44.2 新增的是 route 层不落盘和 error 脱敏，不保证失败前已流出的网络文本从未到达客户端。
- `POST /api/exam/question` 仍依赖 provider schema 校验题面结构；若未来要防御自定义 provider 绕过 adapter，需要为题面 `passScore/wordCount/requirements` 增加 route-level sanity clamp。
- 统一 hidden token corpus 目前覆盖 prompt/eval、relationship/world thread/browser helper 与 S44 route views；完整 `worldState` 本地 API 仍按当前威胁模型保留内部状态。

## 维护规则

- 新增 AI 可读摘要时，必须说明隐藏字段如何过滤，并补 prompt/input 测试。
- 新增 AI 可写/可建议字段时，必须同时更新 schema、remote normalization、`applyStatePatch()` 白名单、clamp 和 S44 矩阵。
- 新增服务器拥有 ledger 时，必须补“provider 不能 patch 该 ledger”的 schema/eval/route 测试，并通过 view 暴露玩家可见部分。
- 新增浏览器面板时，必须只读 route view，补 hidden token 和响应式 smoke；不得扫描 raw `worldState` 中的隐藏 ledger。
