# 《千秋》开发文稿与执行规范

## 1. 项目定位

《千秋》是一款 AI 驱动的历史模拟文字游戏。玩家穿越到真实或架空的中国古代历史环境中，扮演皇帝、大臣、将领、地方官、书生等身份，通过自然语言输入圣旨、政令、奏折、策论、文章或日常行动，由大语言模型推演王朝局势与个人命运。

本项目第一阶段必须交付一个可运行的浏览器游戏：

- 前端：纯 HTML + CSS + JavaScript。
- 后端：Node.js + Express。
- AI：适配器模式，支持 Mock、OpenAI、DeepSeek、Claude。
- 存储：默认本地 JSON session 文件；S49.3 后可选本地 SQLite session row adapter，便于调试和后续迁移。
- 默认体验：`npm install && npm start` 后访问 `http://localhost:3000` 即可游玩，默认不需要 API Key。

第一阶段最重要的完整体验是 **书生 -> 科举 -> 入仕**。

## 阶段状态（2026-05-07）

第一阶段已经完成并归档：

- 第一阶段验收记录：`docs/PHASE_ONE_ACCEPTANCE.md`。
- 第一阶段路线图归档：`docs/PHASE_ONE_ROADMAP_ARCHIVE.md`。

第二阶段已经完成本地验收，记录见 `docs/PHASE_TWO_ACCEPTANCE.md`；第二阶段路线图已归档到 `docs/PHASE_TWO_ROADMAP_ARCHIVE.md`。已接受的范围包括世界 tick、NPC/派系记忆、地方官与将领深度、入仕官员深度、科举竞争深度、真实 provider smoke/streaming 准备、AI eval fixtures 和浏览器自动化验收。

第三阶段已经完成并归档到 `docs/PHASE_THREE_ROADMAP_ARCHIVE.md`。已接受的范围包括桌面游戏态布局、普通回合服务器独占字段边界、开局 role 校验、关系可视化、主动 NPC、长期事件调度、官场结果、科举日历、身份与世界联动、真实 provider 长回合验收脚本、浏览器完整旅程验收、JSON 存档硬化、浏览器存档簿和 S39.1 审查硬化。

第四阶段 S40-S47.2 已完成并归档到 `docs/PHASE_FOUR_ROADMAP_ARCHIVE.md`。已接受的范围包括 AI 连接可见化、prompt pack 与 eval/red-team、深度官场、World Threads 世界议程、AI 权限审查矩阵、多实体世界模型、依赖/插件治理、provider/browser 验收扩展和 DeepSeek 缓存友好提示词结构。

S48 时间专项已完成并归档到 `docs/TIME_SPECIALTY_ROADMAP_ARCHIVE.md`。S48.3 已建立 `worldState.tenDayPeriod`、共享时间 helper、旧档上旬默认、provider 时间字段边界，并把普通自由行动改为每回合推进一旬；月末完整结算只在下旬进入下月上旬时发生。S48.4 已先把科举落成局部场景时间：考试入场、审题、拟纲、作答、誊清、交卷推进 `activeExam.sceneTime`，不消耗全局旬。S48.5 已把官场差事/弹劾、长期事件冷却、World Threads 期限标签、World Entities cadence 和 provider long-run 脚本适配到“旬回合 vs 月末月份”的语义。S48.6 已把状态栏、存档卡、考试日历、考试弹窗、考试档案和回合反馈统一显示“年月旬”，并让 browser smoke 与 provider long-run 检查这一节奏。

当前活动路线图：`docs/DEVELOPMENT_STEPS.md`，已切换为本地动态世界数据库专项。数据库方向见 `docs/DYNAMIC_WORLD_DATABASE_PLAN.md`。短期继续默认使用 JSON session 存档；S49.3 已把路由入口 `src/storage/sessionStore.js`、默认 JSON adapter、共享 `sessionRecord` helpers 与可选 SQLite adapter 分开，并让 JSON/SQLite 同跑 storage adapter contract tests。后续若要承载大量国家/邻国、城市、NPC、家族、官职任命、地方任所、事件记录和 AI 建议审计，应在当前 SQLite session row 原型上继续增加事件日志和 AI proposal ledger，最后逐步拆业务表。当前不规划远程存档、账号体系、多人同步、云端冲突解决或托管数据库。AI 不能直接写数据库或执行 SQL，只能提交结构化建议；服务器继续负责 schema、白名单、clamp、隐藏过滤、科举晋级、官职任免、长期事件、世界实体、世界议程和持久化事务。

开发规范不变。第 12 节和第 13 节仍是每次开发必须遵守的流程；Mock 默认可玩、真实 provider 可选、服务器拥有状态边界和科举规则这些要求继续有效。

稳定开发治理锚点见 `docs/DEVELOPMENT_GOVERNANCE.md`。重写路线图、交接文档或 brief 时不得删弱其中的必守规范；`npm run check:docs-governance` 和 `npm test` 会检查受保护内容。

## 2. 核心体验

玩家没有固定选项，主要通过自由文本行动推进游戏。AI 作为世界引擎，负责叙事、意图理解、出题、评分、角色反馈和世界变化建议；服务器负责状态存储、数值边界、晋级规则、作弊惩罚和持久化。

核心设计原则：

- 开放输入：玩家可以自由打字，不用被固定按钮限制。
- 结构化状态：世界必须有可追踪、可保存、可回放的状态对象。
- AI 有创造力，服务器有最终裁判权。
- Mock 模式必须足够完整，让没有 API Key 的开发者也能测试主线。
- 书生科举系统必须像真正的生涯路径，而不是单次问答。

## 3. 推荐项目结构

```text
.
  package.json
  README.md
  .env.example
  AGENTS.md
  CLAUDE.md
  server.js
  data/
    sessions/
      .gitkeep
  docs/
    QIANQIU_DEVELOPMENT_BRIEF.md
  src/
    ai/
      index.js
      prompts.js
      schemas.js
      providers/
        mock.js
        openai.js
        anthropic.js
    config/
      env.js
    game/
      initialState.js
      stateRules.js
      exams.js
      candidates.js
      examTravel.js
      history.js
    routes/
      game.js
      exam.js
    storage/
      sessionStore.js
      jsonSessionAdapter.js
      sqliteSessionAdapter.js
      sessionRecord.js
    utils/
      sse.js
      json.js
  public/
    index.html
    styles.css
    app.js
```

## 4. 初始技术方案

`package.json` 建议依赖：

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "latest",
    "ajv": "latest",
    "cors": "latest",
    "dotenv": "latest",
    "express": "latest",
    "nanoid": "latest",
    "openai": "latest"
  }
}
```

`.env.example` 建议字段：

```text
PORT=3000
CORS_ALLOWED_ORIGINS=
AI_PROVIDER=mock
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_BASE_URL=
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_OPENING_MODEL=deepseek-v4-pro
DEEPSEEK_TURN_MODEL=deepseek-v4-flash
DEEPSEEK_EXAM_QUESTION_MODEL=deepseek-v4-flash
DEEPSEEK_GRADE_MODEL=deepseek-v4-pro
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
```

AI provider 约定：

- `mock`：默认模式，必须完整可玩。
- `openai`：使用 OpenAI Responses API，支持流式输出和结构化 JSON。
- `deepseek`：使用 OpenAI-compatible adapter，通过 base URL 和 API key 接入。默认 `DEEPSEEK_MODEL` 是兜底模型；可用 `DEEPSEEK_OPENING_MODEL`、`DEEPSEEK_TURN_MODEL`、`DEEPSEEK_EXAM_QUESTION_MODEL`、`DEEPSEEK_GRADE_MODEL` 按任务覆盖。推荐策略是开局和科举评卷走 `deepseek-v4-pro`，普通回合/流式叙事和出题走 `deepseek-v4-flash`。
- `anthropic`：使用 Claude Messages API，支持 SSE 流式输出。

CORS 约定：默认只允许无 `Origin` 请求和当前 `PORT` 对应的本机应用 Origin；如需从其他开发前端或工具跨 Origin 调用本地 API，使用逗号分隔的 `CORS_ALLOWED_ORIGINS` 显式放行，不使用通配 `*`。

## 5. 世界状态模型

后端维护结构化 `worldState`，至少包含：

```javascript
{
  sessionId: "string",
  year: 1644,
  month: 1,
  tenDayPeriod: 1, // 1=上旬，2=中旬，3=下旬；玩家可见为“明1644年正月上旬”
  dynasty: "明",
  turnCount: 0,
  treasury: 1000,
  grainReserve: 800,
  population: 5000,
  publicOrder: 70,
  taxRate: 30,
  corruption: 60,
  armySize: 200,
  armyMorale: 65,
  borderThreat: 40,
  factions: {
    eunuchs: 50,
    scholarOfficials: 40,
    militaryLords: 30
  },
  characters: [
    {
      id: "C01",
      name: "张居正",
      role: "首辅",
      loyalty: 80,
      ambition: 70,
      skill: 95,
      alive: true
    }
  ],
  eventHistory: [],
  activeExam: null,
  player: {
    id: "P1",
    role: "scholar",
    name: "未定",
    health: 100,
    gold: 10,
    examRank: null,
    palaceRank: null,
    officeTitle: null,
    academia: 10,
    literaryTalent: 10,
    adaptability: 10,
    mentality: 10,
    reputation: 10,
    examHistory: [],
    teacher: null,
    studiedBooks: [],
    connections: [],
    personalPower: 0,
    courtControl: 0,
    mandate: 0,
    position: "寒窗士子",
    faction: "士林",
    influence: 0,
    integrity: 60
  }
}
```

其他身份可扩展 `player` 字段：

- 皇帝：`personalPower`、`courtControl`、`mandate`、`position`、`faction`。
- 大臣：`position`、`faction`、`influence`、`integrity`。
- 入仕官员：`officeTitle`、`position`、`faction`、`influence`、`integrity`、`superiorFavor`、`peerNetwork`、`performanceMerit`、`promotionProspect`、`impeachmentRisk`、`cleanReputation`。
- 将领：`command`、`troops`、`supply`、`battleReputation`、`scouting`、`campaignRisk`。
- 地方官：`countyName`、`localTreasury`、`localOrder`、`gentryRelations`、`banditPressure`、`pendingLawsuits`、`corveeBurden`、`waterworks`。

状态更新规则：

- AI 只能返回 `statePatch`，不能直接覆盖整个状态。
- 服务器通过白名单合并 patch。
- 所有数值字段必须 clamp 到合理区间。
- `eventHistory` 只保留最近 20 条。
- 考试晋级、作弊惩罚、最终身份转换必须由服务器执行。

## 6. 后端 API

### `POST /api/game/start`

创建新 session。

请求字段：

- `dynasty`
- `year`
- `role`
- `playerName`
- `background`
- `customSetting`

当前实现会显式校验 `role`：缺省或空值按 `scholar` 处理，其他值必须是 `scholar`、`emperor`、`minister`、`general`、`magistrate` 或 `official`。未知身份返回 400，不创建 session。S31.3 决定允许浏览器直接以 `official` 开局，因为后端初始状态、Mock 回合和前端身份面板都已经支持入仕官员循环；书生通过科举入仕仍是必须保护的核心路径。

返回：

- `sessionId`
- `worldState`
- `narrative`

### `GET /api/game/state/:sessionId`

读取当前 session 状态。

### `GET /api/game/saves`

读取本地存档列表。返回脱敏 metadata，包括 `sessionId`、`storageSchemaVersion`、`revision`、创建/更新时间、玩家名、身份、朝代年月旬、回合数、科名、官职和摘要；不会返回完整 `worldState`、原始关系账本、隐藏联系人、provider 配置或本地文件/数据库路径。JSON adapter 下损坏或未来版本的 `.json` 文件会进入 `skipped` 列表，不会被自动删除；SQLite adapter 也必须使用同一公开错误口径。S38.3 后，浏览器开局页会显示最近存档，游戏内状态栏“存档”按钮会打开同一存档簿；载入时仍通过 `GET /api/game/state/:sessionId` 读取完整状态并更新 `localStorage["qianqiu.sessionId"]`。

### `POST /api/game/turn`

处理自由行动。返回 `text/event-stream`。

请求字段：

- `sessionId`
- `input`

SSE 事件：

- `narrative_chunk`
- `state_preview`
- `final_state`
- `error`

当前实现中，客户端发送 `Accept: text/event-stream` 或 `?stream=1` 时启用 SSE；未请求 SSE 的调用仍返回普通 JSON，用于测试脚本和旧客户端兼容。S25.2 后，OpenAI Responses、DeepSeek chat completions、Anthropic Messages 适配器在 SSE turn 中可通过 `streamTurn()` 返回真实 token streaming；服务端只从结构化 JSON token 流中抽取顶层 `narrative` 字符串作为 `narrative_chunk`，完整 `turn` JSON 仍必须通过 Ajv schema 后才会应用状态。若不支持流式或没有提前抽取到叙事，则保留当前完成后分块的兼容输出。若已经向浏览器发送过真实 provider 叙事后流式调用失败，路由只发 `error` 并保持 session 不变，浏览器会移除未提交的临时叙事文本。无论哪种响应形态，状态 patch、事件追加、考试触发和 session 保存仍由服务器执行。

S43.2/S45.2 后，游戏与考试路由会返回服务器归一化的 `worldThreadView`。该视图来自 `worldState.worldThreads`，把主动 NPC 请托、长期事件、官场差遣/结果、角色世界联动、世界实体压力、边事、派系压力和地方案链整理为玩家可见的跨月议题摘要；浏览器“世界议程”面板会显示议题目标、期限、风险、相关人物/派系/衙门/指标/实体、玩家可介入点和近归档余波。AI 可读 prompt 摘要，但普通 provider 不得通过 `statePatch.worldThreads` 直接写入；议程面板只提示自由行动方向，不替代来源系统结算。

S45.2 后，游戏与考试路由会返回服务器归一化的 `worldEntityView`。该视图来自 `worldState.worldEntities`，把朝廷衙门、地方士绅、书院同门、军镇边墙、盐漕税赋和灾荒赈务整理为玩家可见的制度实体摘要；AI prompt 只读取 capped 可见摘要，普通 provider 不得通过 `statePatch.worldEntities` 直接写入。普通回合中，AI 允许的状态变化、世界 tick、关系/主动 NPC、长期事件、身份联动和官场结果会通过服务器 helper 转成 bounded `worldEntityImpacts`，再由 World Threads 读取可见实体摘要；实体仍不替代来源系统结算。

普通回合的 `examTrigger` 不能直接创建考试。服务端会先确认当前名位可进入该考试，再检查服务器拥有的科举日历窗口；若玩家已有未交卷的 `activeExam`，新的触发请求会被拒绝并保留原题、`examId` 和写卷状态。

S48.3 后，普通自由行动的全局时间每次只推进一旬：上旬 -> 中旬 -> 下旬 -> 下月上旬。`worldTick` 会在非月末返回轻量 `[旬度]` 反馈和小幅自然漂移；只有下旬进入下月上旬时才执行完整 `[月度]` 结算、长期事件月份递减/调度和官场任期月份推进。`turnCount` 仍表示玩家有效输入次数，每次普通回合只加 1。

S48.4 后，已有写卷考试时的 `POST /api/game/turn` 会进入考试场景分支：服务器推进 `activeExam.sceneTime` 和 `worldTick.cadence = "scene"` 反馈，不调用普通回合 provider、不推进 `turnCount/year/month/tenDayPeriod`，也不运行世界 tick。考试局部阶段当前为 `entry`、`question_review`、`outline`、`drafting`、`fair_copy`、`submitted`。

S48.5 后，仍以 turn 保存的短期字段必须标明语义：主动 NPC 请托继续显示剩余回合；官场差事与弹劾流程默认把四个月换算成十二个旬回合，并在 `officialCareerView` 与 `worldThreadView` 中显示“尚余 X 旬（约 Y 月）”；长期事件 `remainingMonths` 与冷却仍按月末结算，内置冷却用 `monthsToTurns()` 存成绝对 turn。`worldEntityImpacts` 会读取 `worldTick.cadence`：考试等 `scene` cadence 不产生实体影响，长期事件实体影响只在月末产生。

### `POST /api/ai/connection-test`

不落盘校验当前或指定 AI provider 的基础连接与 JSON 适配能力。该接口用于开局页“AI 连接”面板和开发者配置检查，不创建 session，不写入 `data/sessions/`，也不通过 Mock fallback 掩盖真实 provider 的缺 key 或网络/模型错误。

请求字段：

- `provider`：可选。缺省时使用当前 `AI_PROVIDER`；支持 `mock`、`openai`、`deepseek`、`anthropic`、`claude`。

返回字段：

- `ok`
- `provider`
- `configuredProvider`
- `checkedAt`
- `latencyMs`
- `supportsStreaming`
- `models`
- `openingEventCount`
- `narrativePreview`
- `error`

错误文本必须经过密钥脱敏。DeepSeek 诊断会返回默认模型和任务模型摘要；当前推荐为开局/科举评卷使用 `deepseek-v4-pro`，普通回合/流式叙事/考题生成使用 `deepseek-v4-flash`。

S47.1 后，`npm run smoke:browser -- --check-ai-connection` 会在开局前点击同一“AI 连接”面板并确认 Mock 诊断成功、未写 `qianqiu.sessionId`、未进入游戏态；`npm run smoke:provider:route` 会在有真实 provider key 时通过最小 Express 路由 POST 本接口，检查模型摘要、streaming 能力、开局 JSON、错误脱敏和无 session 写入。按本轮范围，不新增模型费用或速度台账；既有 `latencyMs` 只作为即时连接诊断字段保留。

### `POST /api/exam/question`

生成并保存当前考试题目。

请求字段：

- `sessionId`
- `level`

返回：

- `examId`
- `level`
- `examName`
- `examQuestion`
- `questionType`
- `difficulty`
- `requirements`
- `wordCount`
- `passScore`
- `promotionRank`
- `entryPreparation`
- `sceneTime`
- `worldState`

第一版实现中，接口会复用尚未交卷的 `activeExam`，避免同一场考试反复刷题；若 `activeExam` 只是由自由行动触发的简略入场记录，则该接口负责补齐题目、要求、字数、通过线和保存后的状态。
当前实现中，新生成题目前会先由服务器应用赶考准备：按考试等级扣除盘费，金钱不足时转化为小幅疲劳、心性或声望风险，并写入 `activeExam.entryPreparation`。该步骤不推进 `turnCount`、`year`、`month` 或 `tenDayPeriod`，也不改变晋级规则；已存在的未交卷考试会被复用，不会 retroactively 再扣盘费。S48.4 后，取题会写入或保留 `activeExam.sceneTime`，合法下旬触发考试后即使普通旬制已进入下月上旬，正式题目仍继承原入场年月旬与开放 snapshot。

### `POST /api/exam/progress`

推进考试弹窗内的局部阶段，不评分、不交卷、不运行普通世界 tick。

请求字段：

- `sessionId`
- `examId`
- `action`

返回：

- 当前考试题面 payload
- `sceneTime`
- `examScene`
- `worldTick`，其中 `cadence = "scene"`
- `narrative`
- `worldState`

该接口只允许当前 `activeExam` 为写卷状态且 `examId` 匹配。审题、拟纲、作答、誊清等动作只增加考试局部步数和阶段，不推进 `turnCount`、`year`、`month` 或 `tenDayPeriod`。浏览器考试弹窗的阶段按钮使用本接口。

### `POST /api/exam/submit`

提交科举文章，评分、排名并更新状态。返回可流式或普通 JSON；第一版可用普通 JSON，后续再做流式评卷叙事。

请求字段：

- `sessionId`
- `examId`
- `essay`

返回：

- `score`
- `authenticityCheck`
- `virtualCandidates`
- `ranking`
- `promotionResult`
- `sceneTime`
- `examStartedAt`
- `examSubmittedAt`
- `worldState`

当前实现中，`/api/exam/submit` 使用普通 JSON 返回；服务器会先做本地反作弊检查，再调用 provider 评分，并在服务端应用作弊扣分。文章、评分、复核结果、虚拟考生、榜单与 `promotionResult` 会保存到 `player.examHistory`，同时清空 `activeExam`。随后 `src/game/promotions.js` 执行服务器自有晋级规则：童试/乡试/会试通过后分别写入 `player.examRank = "秀才" / "举人" / "贡士"`；殿试通过后写入 `player.examRank = "进士"`、`player.role = "official"`、`player.roleLabel = "入仕官员"`，记录 `palaceRank` 与 `officeTitle`，并种下入仕官员的上官、同年、考成、升迁、弹劾风险和清操初始仪表。严重作伪会强制黜落，按当前名位降一档并扣减声望与心性。
S24 后，虚拟考生不仅有分数，还包含可回看的 `essay`、`style`、`examinerComment`、`strengths` 和 `weaknesses`；赶考准备信息会作为 `entryPreparation` 随考试记录保存。S48.4 后，`sceneTime`、`examStartedAt`、`examSubmittedAt` 也随考试记录保存。前端放榜页和考试档案会显示本人案卷、科场时间、五维评卷、监试复核、同场榜单、同场文卷和晋级/黜落原因。

## 7. AI JSON 合约

### 通用推演返回

```json
{
  "narrative": "叙事文本",
  "statePatch": {},
  "attributeChanges": [
    {
      "path": "player.academia",
      "before": 10,
      "after": 13,
      "reason": "研读《孟子》三日"
    }
  ],
  "events": ["某年某月，玩家入岳麓书院求学。"],
  "examTrigger": {
    "shouldStart": false,
    "level": null,
    "reason": ""
  }
}
```

### 科举考官返回

```json
{
  "score": {
    "content_quality": { "score": 85, "comment": "义理清晰。" },
    "argument_strength": { "score": 78, "comment": "论证尚可。" },
    "literary_style": { "score": 90, "comment": "文气雅正。" },
    "classical_format": { "score": 65, "comment": "格式略松。" },
    "historical_appropriateness": { "score": 88, "comment": "合乎时风。" },
    "overall_score": 81,
    "rank": "二甲",
    "detailed_feedback": "文章义理清晰，唯中股对仗稍欠工整。"
  },
  "authenticity_check": {
    "copy_detection": { "is_copy": false, "similar_passage": "" },
    "anachronism_detection": { "has_anachronism": false, "details": [] },
    "style_consistency": { "consistent": true, "note": "" },
    "ghostwriting_probability": 0
  },
  "virtual_candidates": [],
  "ranking": []
}
```

服务器强制规则：

- `copy_detection.is_copy === true` 时，总分强制为 0。
- `ghostwriting_probability > 0.7` 时，总分扣 20，名次降一档。
- 出现明显现代词或时代错误时，服务器可额外扣分。
- 殿试通常不淘汰贡士，只定甲第；严重作弊例外。

## 8. 科举生涯路径

书生初始身份路径：

```text
寒窗 -> 童试 -> 秀才 -> 乡试 -> 举人 -> 会试 -> 贡士 -> 殿试 -> 进士 -> 入仕
```

考试层级：

| level | 名称 | 通过后身份 | 内容 |
| --- | --- | --- | --- |
| `child_exam` | 童试 | 秀才 | 经义简答，200-400 字古文 |
| `provincial_exam` | 乡试 | 举人 | 策论，500-800 字古文 |
| `metropolitan_exam` | 会试 | 贡士 | 八股文，800-1500 字 |
| `palace_exam` | 殿试 | 进士 | 时政策论，定一甲/二甲/三甲 |

日常行动需要支持：

- 拜师。
- 研读典籍。
- 游学交友。
- 辩论经义。
- 代写书信或文章谋生。
- 赶考。
- 直接参加考试。

属性影响建议：

- `academia`：经义掌握与基础学识。
- `literaryTalent`：文采、辞章与典故。
- `adaptability`：临场机辩、策论应变。
- `mentality`：长线稳定、抗压与考试发挥。
- `reputation`：师友推荐、乡里名声与榜上竞争。
- `gold`：赶考、拜师、读书成本。

## 9. 前端设计

必须包含：

- 开局设定页：朝代、年份、身份、姓名、家境、自定义背景。
- AI 连接面板：在开局页显示当前 provider 的不落盘连接校验入口，展示模型摘要、耗时、streaming 能力和脱敏错误。
- 主游戏页：顶部状态栏，中间叙事历史区，底部多行自由输入框。
- 书生面板：科举进度、下一考试、学识、文采、机辩、心性、声望、师承、已读书。
- 身份面板：皇帝、大臣、将领、地方官、入仕官员展示关键权力/操守/影响指标、专属身份状态、府库粮储、朝局派系与可行动提示；入仕官员额外展示上官、同年、考成、升迁、弹劾、清操仪表和服务器结算出的官场履历。S42.3 已把 `officialCareerView` 的官署、差事、考成、关系摘要和弹劾流程摘要渲染进浏览器官场面板。
- 考试界面：题目、要求、大文本输入区、提交按钮。
- 放榜界面：玩家与虚拟考生排名、分数、名次、详细考官评语。

视觉方向：

- 宣纸底色。
- 墨色正文。
- 朱砂红强调。
- 古风但不牺牲可读性。
- 移动端可用。

## 10. Mock 模式要求

Mock 不是占位符，必须是可玩引擎。

Mock 需要支持：

- 不同行动类型的基础识别：读书、拜师、游学、赚钱、赶考、施政、圣旨。
- 书生属性成长。
- 科举出题。
- 文章评分。
- 虚拟考生生成。
- 榜单排名。
- 晋级和入仕。
- 皇帝基础行动：赈灾、用人、征税筹饷、军事备边、廷议听政。
- 大臣基础行动：上疏谏言、经营人脉、督办公务、弹劾攻讦。
- 入仕官员行动：奉上官差遣、经营同年、办理考成、谋求升迁、弹劾贪墨、观政学习、断案平讼、劝农抚民和贪墨风险。

Mock 分数可结合：

- 文章长度。
- 古文风格词汇。
- 是否包含现代词。
- 当前玩家属性。
- 考试层级难度。
- 随机浮动。

## 11. 提示词要点

通用世界引擎 System Prompt 必须强调：

- 当前时代、年份、玩家身份、玩家摘要。
- 按历史逻辑和生产力水平推演。
- 考虑连锁反应。
- 输入不可行时委婉指出。
- 叙事应有古意但可读，像史传、奏牍、县志和士林笔记之间的游戏化折中；避免现代管理黑话、网文腔和直接暴露“系统规则”的表述。
- 每次叙事至少带一个具体历史锚点，例如衙门、地名、钱粮、军务、学政、灾异、民情、人物称谓或制度名。
- AI 可以建议关系变化、事件线索、官场暗流、考题和评语，但不能直接裁决晋级、任免、作弊处罚、存档写入或隐藏情报公开。
- 只输出严格 JSON。

科举考官 Prompt 必须强调：

- 严格、公正、符合时代。
- 五维评分：内容质量、论证力度、文笔修辞、文体格式、历史语境。
- 检测抄袭、时代错误、文风一致性、代笔概率。
- 给出具体可指导的评语。
- 只输出严格 JSON。

出题 Prompt 必须强调：

- 按朝代、年份、考试等级生成题目。
- 题目不重复。
- 童试偏四书五经，乡试偏实务策论，会试偏八股规范，殿试偏时政。

第四阶段提示词工作必须进一步拆成可测试 prompt pack：

- `world_turn`：普通自由行动与世界推演，读取可见关系、长期议题、角色身份和服务器边界。
- `opening`：开局叙事，突出身份处境、时代压力和可行动线索。
- `exam_question`：按朝代/年份/考试等级生成题目，避免重复、现代问题表述和超时代议题。
- `exam_grading`：科举考官评分、防作弊、文风一致性和具体改进意见。
- `official_career`：官场差遣、考成、弹劾、升迁、外放、派系压力和衙门职责。
- `emperor_court`、`minister_faction`、`local_magistrate`、`general_frontier`：分别服务圣旨廷议、上疏党争、县政民情和边镇军务。

每个 prompt pack 都要配套离线 eval fixtures，覆盖历史语气、JSON 严格性、越权拒绝、隐藏信息不泄露和现代词/时代错误识别。

S41.1 已将 prompt pack 总纲落入运行时代码：`src/ai/promptPacks.js` 维护固定前缀、服务器边界、语气契约、AI 权限契约和输出契约；`src/ai/prompts.js` 继续使用既有 provider schema 名称（`opening`、`turn`、`examQuestion`、`grade`），但为任务附带 `promptPack` 元数据并按身份选择 `world_turn`、`official_career`、`emperor_court`、`minister_faction`、`local_magistrate` 或 `general_frontier` 指令。这样 DeepSeek/OpenAI/Anthropic 的当前模型路由和 JSON schema 不被放大改动，S41.2 再扩展离线 eval fixtures 与红队用例。

S41.2 已补充离线 prompt-pack eval/red-team fixtures：每个 prompt pack 至少有一条 schema-valid、历史语气合格的输出样本；测试会拒绝 Markdown/prose 包裹的非严格 JSON，捕捉现代词和现代治理腔，捕捉隐藏联系人/隐藏案卷泄漏，捕捉科举出题夹带 `statePatch`、评卷生成 canonical ranking、普通回合写入 server-owned ledger 等越权样本。`src/ai/prompts.js` 的任务输入测试还会确认隐藏关系条目不会进入 opening、turn、exam_question 或 exam_grading 的动态上下文。S41.2 不改变运行时 provider 解析策略；真实 provider 质量验收仍在 S47 扩展。

DeepSeek 上下文硬盘缓存优化必须纳入 prompt pack 设计，但不得影响游戏效果：

- 稳定前缀优先：把系统身份、服务器边界、JSON 合约、固定术语表、固定示例和不随回合变化的时代/身份规则放在请求最前。
- 动态内容后置：当前世界摘要、可见关系、长期议题、玩家输入、考试文章和本回合具体 schema 附件放在稳定前缀之后。
- 不为缓存删上下文：不能为了提高命中率牺牲必要局势信息、角色视野、官场深度、历史语气、反作弊判断或叙事质量。
- 不做缓存计数记录：根据 2026-05-07 最新范围，本阶段不读取或保存 provider usage 的缓存命中/未命中 token 计数，也不在 diagnostics/smoke 中新增命中率字段。
- 可测试：同一 prompt pack 的固定前缀应有快照或等价测试，确认动态数据变化不会无意改动稳定前缀。

## 11.1 AI 调动与控制审查

第四阶段必须把“AI 影响游戏方方面面”落实为可审查的权限矩阵，而不是把最终裁决交给模型。

S44.1 已新增 `docs/AI_CONTROL_AUDIT_MATRIX.md` 作为当前权限矩阵入口。后续新增 AI 可读摘要、可建议字段、服务器拥有 ledger、浏览器面板或真实 provider 验收时，必须同步检查并更新该矩阵。

审查对象至少包括：

- 开局叙事、普通回合、科举出题、科举评分、虚拟考生、关系变化、主动 NPC、长期事件、官场任免、世界 tick、存档、隐藏信息、作弊处罚和浏览器显示。
- 每个系统都要标明 AI 权限：可生成、可建议、可排序、可解释、不可写、不可裁决。
- 每个系统都要标明服务器裁决点：schema、白名单、clamp、晋级、任免、作弊惩罚、持久化、可见性过滤和回滚。
- 每个系统都要标明玩家可见性：公文、奏报、传闻、私信、角色自知、隐藏暗流或开发者诊断。
- 对越权 patch、幻觉官职、非法晋级、隐藏信息泄漏、作弊误判和流式失败增加 red-team/eval 测试。

S44.2 已按该矩阵补上第一批 red-team/eval 基线：普通回合混合越权 patch、官职幻觉变体、非法考试触发与服务器门禁、隐藏 token view 过滤、AI 与本地反作弊冲突、provider-owned 科举候选/榜单无效、流式失败不落盘，以及 SSE provider 错误脱敏。浏览器 pending 文本截图验收和自定义 provider 绕过 adapter 的题面 sanity clamp 仍可作为后续硬化项。

## 12. 开发过程注意事项

每次开发都必须做：

1. 先读 `AGENTS.md` 或 `CLAUDE.md`，再读本文件。
2. 读取 `docs/SHARED_CONTEXT.md`，确认 Codex 与 Claude Code 共享的最新上下文。
3. 读取 `docs/DEVELOPMENT_STEPS.md`，确认当前应执行的小步骤和历史进度。
4. 执行 `git status --short`，确认当前工作树。
5. 判断是否有别人未提交或未说明的改动，不要覆盖。
6. 将本次任务涉及的设计变更写回文档或 README。
7. 每次 coherent change 结束前更新 `docs/SHARED_CONTEXT.md`，写清当前状态、关键决策、验证结果和下一步建议，确保 Codex 与 Claude Code 都能看见。
8. 每次开始、完成、阻塞或调整开发步骤时更新 `docs/DEVELOPMENT_STEPS.md`，写明步骤 ID、完成内容、验证结果和提交哈希。
9. 保持 Mock 模式可运行。
10. 项目内面向协作和玩家的输出尽量使用中文，尤其是文档、交接记录、路线图台账、领域逻辑注释和前端可见文案；只有代码标识符、API/协议名、第三方术语、命令输出或外部工具理解需要时再使用英文。
11. 完成后至少运行与本次改动相关的验证命令。
12. 再次执行 `git status --short`。
13. 对包含代码、测试、运行时行为、API/schema、提示词或验证工具变化的 coherent change，在暂存和提交前至少委派一个只读子代理审查最终 diff 与验证结果。主代理必须在审查提示词中提供最终 diff 和验证摘要；审查子代理不得编辑文件或运行任何 Git 命令。纯文档低风险改动可以跳过，但要在共享上下文或最终回复说明。
14. 用 Git 提交本次 coherent change。
15. 在最终回复中说明改了什么、验证了什么、提交哈希是什么。

这些流程的稳定锚点是 `docs/DEVELOPMENT_GOVERNANCE.md`；如需调整子代理、Git、文档同步、依赖治理、AI/server 边界、中文输出或验证门禁，必须同步更新该文件和 `scripts/checkGovernanceDocs.js`。

大步开发可以使用子代理并行推进，但必须保持主代理负责收束。用户已明确授权 Codex 和 Claude Code 在本仓库使用子代理；除非后续用户指令收窄或撤销该授权，否则把它视为长期项目上下文。这里的“大步”既包括单个复杂实现，也包括路线图中的阶段或步骤簇；像 S25 这样的阶段，可以把 S25.1、S25.2、S25.3 这种互相独立的小步骤分别交给子代理推进：

- 优先把阶段内的小步骤作为委派粒度，而不是等到一个子任务大到难以审查时才使用子代理。例如：一个子代理负责 S25.1 真实 provider smoke 脚本，另一个子代理调研或实现 S25.2 streaming 兼容性。
- 只在步骤能拆成清楚、互不重叠的写入范围时使用子代理。
- 给每个子代理指定文件或模块所有权，并提醒其不要回退或覆盖他人改动。
- 子代理提示词必须明确禁止 `git add`、`git commit`、`git push` 和创建 PR，并要求子代理最终列出改动文件与 focused verification 命令。
- 子代理只能完成局部实现和 focused verification，不能执行 `git commit`、`git push` 或创建 PR。
- 提交前审查子代理必须只读：只检查主代理提供的 diff、测试证据、风险和遗漏，不修改文件、不暂存、不提交、不运行 Git 命令。
- 主代理必须审查子代理 diff、补齐跨模块契约、运行最终验证、更新共享文档，并在确认合并后统一 Git 提交。
- 如果子代理误提交，主代理必须把该提交视为未审查工作，先检查 diff 与验证结果，在交接记录中说明纠正措施，再继续后续开发。
- 如果子代理结果冲突或不完整，主代理以仓库既有契约、Mock 默认可玩、服务器拥有状态边界和完整 scholar -> official 路径为准进行整合。

不要做：

- 不要把关键决策只留在聊天记录里。
- 不要只更新 `AGENTS.md` 或只更新 `CLAUDE.md`，跨工具上下文必须进入 `docs/SHARED_CONTEXT.md`。
- 不要完成路线图中的步骤却不更新 `docs/DEVELOPMENT_STEPS.md`。
- 不要让真实 API Key 成为本地启动的必要条件。
- 不要让 AI 原始输出直接改写完整世界状态。
- 不要绕过服务器的科举晋级和作弊规则。
- 不要把 `data/sessions/*.json`、`.env`、`node_modules/` 提交进仓库。
- 不要在一个提交里混入无关重构。

## 13. Git 规范

推荐提交信息：

```text
docs: add development brief
feat: implement scholar exam flow
fix: validate exam score penalties
test: add mock exam progression checks
chore: update env example
```

每个提交应满足：

- 可以独立解释。
- 不包含密钥和本地 session 数据。
- 与最终回复描述一致。
- 如果改了行为，包含验证信息。

## 14. 验收标准

第一阶段完成时必须满足：

- `npm install && npm start` 能启动。
- `http://localhost:3000` 能打开。
- 无 API Key 时，Mock 模式能完整游玩书生主线。
- 书生可以通过四级科举并入仕。
- 皇帝、大臣身份有基础自由输入反馈。
- 考试文章会被保存到玩家记录。
- 放榜界面包含虚拟考生和玩家排名。
- AI JSON 有 schema 校验和失败降级。
- README 说明安装、配置、启动和 provider 切换。

## 15. 归档阶段与本地数据库专项摘要

第三阶段以“长期模拟骨架、关系可视化、官场结果、科举日历、身份联动和验收硬化”为中心，已完成并归档到 `docs/PHASE_THREE_ROADMAP_ARCHIVE.md`。第四阶段以“AI 连接、提示词、官场深度、世界议程、AI 权限、多实体世界、依赖治理和 provider/browser 验收”为中心，已完成并归档到 `docs/PHASE_FOUR_ROADMAP_ARCHIVE.md`。S48 时间专项已归档到 `docs/TIME_SPECIALTY_ROADMAP_ARCHIVE.md`。当前活动台账见 `docs/DEVELOPMENT_STEPS.md`。

S48 时间专项归档结论：

1. 全局旬制：普通自由行动从“一回合一月”改为“一回合一旬”，按“上旬 -> 中旬 -> 下旬 -> 下月上旬”推进，三回合才进入下一个月。
2. 月末大结算：世界自然漂移、长期事件月份递减、季节性事件、官场任内月份和考成周期等原月度系统，默认只在下旬进入下月上旬时完整结算；非月末旬只做轻量小结。
3. 场景内时间：考试、廷议、堂审、战斗、赶考途中遭遇和重大差事收束等密集场景应使用局部阶段，玩家在场景内多次输入时只推进该场景的时辰/阶段，不自动消耗一旬。
4. 科举优先细化：考试将优先拆成入场、发题/审题、拟纲、作答、誊清、交卷等局部阶段；开题、拟纲、作答不推进全局旬，交卷后仍保存考试记录、虚拟考生、榜单、晋级结果和考试档案。
5. 日期展示：玩家可见日期统一向“年月旬”靠拢，例如“崇祯十七年八月上旬”；状态栏、存档、考试日历、考试弹窗、考试档案和回合反馈都要同步。
6. 服务器拥有时间：`turnCount`、`year`、`month`、`tenDayPeriod` 和场景时间推进都属于服务器裁决；provider 不得通过普通 `statePatch` 写入。S48.3 已完成 `tenDayPeriod` 基础、旧档默认上旬、存档 metadata、provider 边界、普通回合旬推进和月末结算门控；S48.4 已完成科举 `activeExam.sceneTime`、`/api/exam/progress` 和写卷中普通输入转场景推进。

S42.1 已把深度官场契约写入 `docs/OFFICIAL_CAREER_CONTRACT.md`：S34 现有结果引擎继续作为运行时基础；后续 S42.2/S42.3 必须按契约区分服务器拥有的 `officeTitle`、软描述 `position`、归一化 `officialCareer.currentPosting`，并通过服务器 view 暴露官署、差事、考成、人脉、弹劾流程、调任外放、处分和履历档案。AI 只能生成叙事、公文口吻、来函、传闻和受限仪表建议，不能裁决任免、考成、处分、起复或隐藏信息公开。

S42.2 已落地第一批运行时深度：`src/game/officialCatalog.js` 维护静态官职/衙门目录；`officialCareer.schemaVersion = 2` 归一化 `bureauId`、`assignments`、`assessmentDossier` 和 `impeachmentProcedure`；官场回合会根据玩家输入推进差遣、考成和弹劾流程，但任免升降仍由服务器结算；普通 provider 对 `player.position` 的明显官职伪造会被过滤。`officialCareerView` 已暴露官署、差事、考成、关系和风险摘要，隐藏 notes 不进入 prompt 或 UI。

S42.3 已落地浏览器体验：`#official-career-panel` 现在按服务器 view 展示官署、差事、考成、关系与风险、履历档案；browser smoke 覆盖直接 official 开局、首回合实授、后续赈务差事、考成/关系/弹劾流程摘要、隐藏文本不泄漏，以及桌面/移动横向溢出。

S43.2 已在 `worldThreadView` 上补充 `goal`、`deadlineLabel`、`riskLabel`、`riskTone`、`relatedLabels`、`interventionHints` 和 `followUpHint`，并把它渲染为浏览器“世界议程”检查视图。它只做归一化、可见性过滤、prompt/API 摘要和前端检查，不替代原有结算器；后续若要让多个来源合并成同一案件、或让议题拥有更明确的多阶段结局，应继续由服务器来源模块提供可审查状态。

S45.1 已新增 `docs/WORLD_ENTITIES_CONTRACT.md` 和 `src/game/worldEntities.js`。`worldState.worldEntities.schemaVersion = 1` 是 server-owned 多实体账本，初始覆盖吏部、户部、都察院、地方士绅、河工案牍、县学书院、同年文社、边镇军镇、边墙堡寨、盐漕通道、田赋商税和灾荒赈务；`worldEntityView` 暴露分组可见实体和高压 highlights，`compactWorldState()` 暴露 `worldEntities` prompt 摘要。隐藏实体与 `hiddenNotes` 不进入 view/prompt；普通 provider patch `worldEntities` 会被 schema/normalizer/state boundary 拒绝或忽略。S45.2 已接入服务器来源影响写入、`worldEntityImpacts` 和 World Threads 可见实体摘要。

S46.1 已把依赖、插件与开源参考的引入流程落入 `docs/DEPENDENCY_PLUGIN_GOVERNANCE.md`。后续新增或升级 `package.json` 依赖、开发工具、外部服务 SDK、Codex/Claude 插件工作流或开源参考时，必须先说明问题、用途、许可证、维护状态、安全/隐私影响、Mock/no-key 影响、验证命令、文档落点和回滚策略；这一步不新增运行时依赖。

所有时间专项实现仍需满足基础验收：默认 Mock 可运行，完整 scholar -> official 路径不得被破坏，真实 provider 不得成为本地启动必要条件，服务器继续拥有状态边界、时间推进、科举晋级、作弊惩罚、长期事件结果、官场授官升降、角色-世界联动后果和持久化裁决。

本地数据库专项也必须满足同一边界：默认 JSON/Mock 路径不得被破坏；`sessionStore` facade 的 route payload、revision、legacy 迁移、脱敏存档簿和 `mutateSession` 语义是 SQLite 适配器也必须遵守的 contract。S49.3 的 SQLite 原型只是一行一 session、本地 `world_sessions` 表和 JSON `world_state`，通过 `STORAGE_ADAPTER=sqlite` 可选开启；它不引入账号、远程存档、多人同步或托管数据库。数据库只增强本机索引、审计、长期存储和检索式 prompt context，不把核心裁决交给 AI、SQL 或黑箱库。当前数据库专项不规划远程存档、账号体系、多人同步、云端冲突解决或托管数据库；`session_id` 只表示本机不同存档。

## 16. 历史实现笔记归档

S11-S38.3 的逐步实现笔记已经迁入 `docs/QIANQIU_DEVELOPMENT_HISTORY_ARCHIVE.md`，第四阶段路线图已经迁入 `docs/PHASE_FOUR_ROADMAP_ARCHIVE.md`，S48 时间专项路线图已经迁入 `docs/TIME_SPECIALTY_ROADMAP_ARCHIVE.md`，避免每次开发启动都读取数百行历史记录。当前必读 brief 只保留产品定位、核心契约、运行规范、AI/服务器边界、S48 归档摘要、本地数据库专项边界和验收标准；需要追溯旧阶段细节时再打开归档文件。
