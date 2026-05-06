# 《千秋》开发文稿与执行规范

## 1. 项目定位

《千秋》是一款 AI 驱动的历史模拟文字游戏。玩家穿越到真实或架空的中国古代历史环境中，扮演皇帝、大臣、将领、地方官、书生等身份，通过自然语言输入圣旨、政令、奏折、策论、文章或日常行动，由大语言模型推演王朝局势与个人命运。

本项目第一阶段必须交付一个可运行的浏览器游戏：

- 前端：纯 HTML + CSS + JavaScript。
- 后端：Node.js + Express。
- AI：适配器模式，支持 Mock、OpenAI、DeepSeek、Claude。
- 存储：本地 JSON session 文件，便于调试和后续迁移。
- 默认体验：`npm install && npm start` 后访问 `http://localhost:3000` 即可游玩，默认不需要 API Key。

第一阶段最重要的完整体验是 **书生 -> 科举 -> 入仕**。

## 阶段状态（2026-05-06）

第一阶段已经完成并归档：

- 第一阶段验收记录：`docs/PHASE_ONE_ACCEPTANCE.md`。
- 第一阶段路线图归档：`docs/PHASE_ONE_ROADMAP_ARCHIVE.md`。
- 当前活动路线图：`docs/DEVELOPMENT_STEPS.md`，已切换为第三阶段规划与进度台账。

第二阶段已经完成本地验收，记录见 `docs/PHASE_TWO_ACCEPTANCE.md`；第二阶段路线图已归档到 `docs/PHASE_TWO_ROADMAP_ARCHIVE.md`。已接受的范围包括世界 tick、NPC/派系记忆、地方官与将领深度、入仕官员深度、科举竞争深度、真实 provider smoke/streaming 准备、AI eval fixtures 和浏览器自动化验收。

第三阶段已经在 `docs/DEVELOPMENT_STEPS.md` 开启。第三阶段目标是先修正桌面游戏态布局、普通回合服务器独占字段边界和开局 role 校验，再推进关系可视化、主动 NPC、长期事件调度、官场结果、科举日历、身份与世界联动、真实 provider 长回合验收、浏览器完整旅程和存档迁移规划。

开发规范不变。第 12 节和第 13 节仍是每次开发必须遵守的流程；Mock 默认可玩、真实 provider 可选、服务器拥有状态边界和科举规则这些要求继续有效。

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
AI_PROVIDER=mock
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_BASE_URL=
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
```

AI provider 约定：

- `mock`：默认模式，必须完整可玩。
- `openai`：使用 OpenAI Responses API，支持流式输出和结构化 JSON。
- `deepseek`：使用 OpenAI-compatible adapter，通过 base URL 和 API key 接入。
- `anthropic`：使用 Claude Messages API，支持 SSE 流式输出。

## 5. 世界状态模型

后端维护结构化 `worldState`，至少包含：

```javascript
{
  sessionId: "string",
  year: 1644,
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

当前实现中，客户端发送 `Accept: text/event-stream` 或 `?stream=1` 时启用 SSE；未请求 SSE 的调用仍返回普通 JSON，用于测试脚本和旧客户端兼容。S25.2 后，OpenAI Responses、DeepSeek chat completions、Anthropic Messages 适配器在 SSE turn 中可通过 `streamTurn()` 返回真实 token streaming；服务端只从结构化 JSON token 流中抽取顶层 `narrative` 字符串作为 `narrative_chunk`，完整 `turn` JSON 仍必须通过 Ajv schema 后才会应用状态。若不支持流式或没有提前抽取到叙事，则保留当前完成后分块的兼容输出。若已经向浏览器发送过真实 provider 叙事后流式调用失败，路由只发 `error` 并保持 session 不变。无论哪种响应形态，状态 patch、事件追加、考试触发和 session 保存仍由服务器执行。

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
- `worldState`

第一版实现中，接口会复用尚未交卷的 `activeExam`，避免同一场考试反复刷题；若 `activeExam` 只是由自由行动触发的简略入场记录，则该接口负责补齐题目、要求、字数、通过线和保存后的状态。
当前实现中，新生成题目前会先由服务器应用赶考准备：按考试等级扣除盘费，金钱不足时转化为小幅疲劳、心性或声望风险，并写入 `activeExam.entryPreparation`。该步骤不推进 `turnCount`、`year` 或 `month`，也不改变晋级规则；已存在的未交卷考试会被复用，不会 retroactively 再扣盘费。

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
- `worldState`

当前实现中，`/api/exam/submit` 使用普通 JSON 返回；服务器会先做本地反作弊检查，再调用 provider 评分，并在服务端应用作弊扣分。文章、评分、复核结果、虚拟考生、榜单与 `promotionResult` 会保存到 `player.examHistory`，同时清空 `activeExam`。随后 `src/game/promotions.js` 执行服务器自有晋级规则：童试/乡试/会试通过后分别写入 `player.examRank = "秀才" / "举人" / "贡士"`；殿试通过后写入 `player.examRank = "进士"`、`player.role = "official"`、`player.roleLabel = "入仕官员"`，记录 `palaceRank` 与 `officeTitle`，并种下入仕官员的上官、同年、考成、升迁、弹劾风险和清操初始仪表。严重作伪会强制黜落，按当前名位降一档并扣减声望与心性。
S24 后，虚拟考生不仅有分数，还包含可回看的 `essay`、`style`、`examinerComment`、`strengths` 和 `weaknesses`；赶考准备信息会作为 `entryPreparation` 随考试记录保存。前端放榜页和考试档案会显示本人案卷、五维评卷、监试复核、同场榜单、同场文卷和晋级/黜落原因。

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
- 主游戏页：顶部状态栏，中间叙事历史区，底部多行自由输入框。
- 书生面板：科举进度、下一考试、学识、文采、机辩、心性、声望、师承、已读书。
- 身份面板：皇帝、大臣、将领、地方官、入仕官员展示关键权力/操守/影响指标、专属身份状态、府库粮储、朝局派系与可行动提示；入仕官员额外展示上官、同年、考成、升迁、弹劾、清操仪表和服务器结算出的官场履历。
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
10. 完成后至少运行与本次改动相关的验证命令。
11. 再次执行 `git status --short`。
12. 用 Git 提交本次 coherent change。
13. 在最终回复中说明改了什么、验证了什么、提交哈希是什么。

大步开发可以使用子代理并行推进，但必须保持主代理负责收束。用户已明确授权 Codex 和 Claude Code 在本仓库使用子代理；除非后续用户指令收窄或撤销该授权，否则把它视为长期项目上下文。这里的“大步”既包括单个复杂实现，也包括路线图中的阶段或步骤簇；像 S25 这样的阶段，可以把 S25.1、S25.2、S25.3 这种互相独立的小步骤分别交给子代理推进：

- 优先把阶段内的小步骤作为委派粒度，而不是等到一个子任务大到难以审查时才使用子代理。例如：一个子代理负责 S25.1 真实 provider smoke 脚本，另一个子代理调研或实现 S25.2 streaming 兼容性。
- 只在步骤能拆成清楚、互不重叠的写入范围时使用子代理。
- 给每个子代理指定文件或模块所有权，并提醒其不要回退或覆盖他人改动。
- 子代理提示词必须明确禁止 `git add`、`git commit`、`git push` 和创建 PR，并要求子代理最终列出改动文件与 focused verification 命令。
- 子代理只能完成局部实现和 focused verification，不能执行 `git commit`、`git push` 或创建 PR。
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

## 15. 第三阶段规划摘要

第二阶段以“让世界更像会自行运转的历史模拟器”为中心，已完成本地验收并归档。第三阶段活动台账见 `docs/DEVELOPMENT_STEPS.md`，第二阶段路线图归档见 `docs/PHASE_TWO_ROADMAP_ARCHIVE.md`。

第三阶段优先级顺序：

1. 地基修复：修复桌面游戏态布局过窄问题，扩展浏览器 smoke；收紧普通 provider patch 中的服务器独占字段；校验开局 role。
2. 关系可视化与主动 NPC：把 `relationshipLedger` 做成玩家可检查的联系人/派系面板，并让 NPC/派系能主动请托、施压、求援或索取回报。
3. 长期事件调度器：让 world tick 从确定性资源漂移升级为季节、灾荒、边报、朝争和地方案件链组成的长期事件年表。
4. 官场结果引擎：让入仕后的考成、升迁、弹劾、调任、外放、降调和罢黜由服务器拥有的结算规则触发。
5. 科举日历与持久竞争者：加入考期窗口、备考月程、错过考期、师长推荐，并让虚拟同场考生跨考试延续为竞争者、同年或官场人脉。
6. 身份与世界联动：让地方官、将领、皇帝和大臣行动对 world tick、长期事件与关系账本产生复合后果。
7. 验收与存档：增加 keyed real-provider 长回合验收、完整浏览器旅程和存档迁移规划。

所有第三阶段实现仍需满足基础验收：默认 Mock 可运行，完整 scholar -> official 路径不得被破坏，真实 provider 不得成为本地启动必要条件，服务器继续拥有状态边界、科举晋级、作弊惩罚、长期事件结果、官场授官升降和持久化裁决。

## S11 Provider Integration Note (2026-05-05)

The first real-provider slice is implemented without changing the default local experience:

- `AI_PROVIDER=mock` remains the default and needs no API key.
- `AI_PROVIDER=openai` uses the OpenAI SDK Responses API with `OPENAI_API_KEY`, optional `OPENAI_BASE_URL`, and `OPENAI_MODEL`.
- `AI_PROVIDER=deepseek` uses the OpenAI SDK against `DEEPSEEK_BASE_URL` for OpenAI-compatible chat completions with `DEEPSEEK_API_KEY` and `DEEPSEEK_MODEL`.
- `AI_PROVIDER=claude` and `AI_PROVIDER=anthropic` use `@anthropic-ai/sdk` Messages API with `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`.
- `AI_PROVIDER_TIMEOUT_MS` controls real provider request timeout and defaults to 30000.
- All real provider methods build prompts through `src/ai/prompts.js`, parse JSON through `src/utils/json.js`, validate through Ajv schemas in `src/ai/schemas.js`, retry once on call/parse/schema failure, and then fall back to Mock.
- The server still owns patch whitelisting, numeric clamps, exam gates, promotion rules, anti-cheat penalties, candidate ranking, and persistence.

## S13 Quality Gate Note (2026-05-05)

The repository now has a dependency-free automated test entrypoint:

```bash
npm test
```

`npm test` uses Node.js' built-in `node --test` runner. The first suite covers server-owned state patch boundaries, numeric clamps, event-history trimming, JSON session persistence, AI JSON schemas, exam gates/readiness, promotion and severe-cheating consequences, local essay penalties, and virtual candidate ranking. Route-level tests that start temporary Express servers use `test-helpers/fetchSafeServer.js` so random OS ports do not land on Fetch's blocked-port list.

Manual end-to-end acceptance lives in `docs/MANUAL_ACCEPTANCE.md`. It should be used for the browser/API pass before phase-one acceptance, especially to verify the complete scholar -> official route and the emperor/minister/official role loops in Mock mode.

State patch boundary note: `statePatch.factions` is now merged only into existing numeric faction keys. Providers may adjust known faction scores but cannot introduce arbitrary faction names by replacing the full factions object. S31.2 further splits the patch boundary into provider-facing and server-owned keys: ordinary provider turn schemas reject `activeExam`, `characters`, `eventHistory`, `player.examRank`, and `player.examHistory`, and default `applyStatePatch()` ignores those fields if a non-schema provider returns them. Internal server code that needs calendar or exam-owned fields must opt in with `allowServerOwnedPatchKeys`.

## S14 Documentation And Phase-One Acceptance Note (2026-05-05)

Phase-one documentation is now split by purpose:

- `README.md` is the quick-start and project orientation entrypoint. It covers install, scripts, `.env` fields, provider switching, current playable scope, API overview, project structure, and handoff documents.
- `docs/ARCHITECTURE.md` is the current implementation map for developers. It records runtime shape, request flow, API contracts, AI provider contracts, state fields, state patch rules, exam rules, persistence, and verification expectations.
- `docs/MANUAL_ACCEPTANCE.md` remains the human/browser click-through checklist.
- `docs/PHASE_ONE_ACCEPTANCE.md` records the first automated Mock-mode phase-one acceptance pass.

The 2026-05-05 S14 acceptance pass verified `npm install`, `npm test`, static asset loading, health, the complete scholar -> official path, saved exam history, short/modern/copy exam integrity penalties, and emperor/minister/official role-loop smoke checks. It did not call real providers because no API keys are present, and it did not run screenshot/browser automation because Playwright is unavailable in this workspace.

## S21.1 World Tick Contract Note (2026-05-05)

Phase two starts with a server-owned world tick contract, recorded in `docs/WORLD_TICK_CONTRACT.md`.

The minimal contract is:

- Add a top-level `worldState.month` field in the implementation slice, defaulting to `1`.
- Advance one in-game month after each successful free-text turn; roll month 12 to 1 and increment `year`.
- Keep `turnCount` to one increment per player turn, even when provider changes and tick changes both apply.
- Let the server compute natural changes to treasury, grain reserve, population, public order, corruption, army morale, border threat, and existing numeric faction keys.
- Apply tick output through the same state whitelist and numeric clamp boundary as provider patches.
- Append short visible tick events after provider events, capped by the existing event-history limit.
- Do not let the tick alter exam rank, active exams, promotion fields, session identity, or the complete scholar -> official path.

S21.2 should implement `src/game/worldTick.js` as a pure module that returns `{ statePatch, attributeChanges, events, summary }`. S21.3 should wire that result into `/api/game/turn`, and S21.4 should add automated coverage for month/year rollover, clamps, event trimming, Mock-mode stability, and the full scholar path.

## S21.2 World Tick Module Note (2026-05-05)

`src/game/worldTick.js` now implements the minimal server-owned monthly tick as a pure module:

- `worldState.month` defaults to `1`.
- `runWorldTick(worldState)` returns `{ statePatch, attributeChanges, events, summary }` and does not mutate the input state.
- The tick advances one month, rolls month 12 to month 1 with `year + 1`, and computes deterministic natural changes for treasury, grain reserve, population, public order, corruption, army morale, border threat, and known numeric faction keys.
- Tick patches intentionally avoid player exam rank, active exams, exam history, promotion fields, session identity, role changes, scholar attributes, gold, and health.
- `src/game/stateRules.js` now whitelists/clamps `year` and `month`, and `applyStatePatch()` accepts `{ incrementTurnCount: false, allowServerOwnedPatchKeys: true }` for server-owned follow-up patches so S21.3 can integrate the tick without double-counting `turnCount`.
- Provider turn schemas and prompts do not allow models to patch `year` or `month`; models may read the compact calendar context, but calendar movement is reserved for server-owned code.

S21.3 connects the tick to `/api/game/turn`: provider output is applied first, exam-trigger state is prepared when requested, `runWorldTick()` runs against the updated state, and the tick patch is applied with `{ incrementTurnCount: false }`. Provider events are appended before tick events, and the route returns concise `worldTick` feedback through both JSON and SSE final payloads.

## S21.3 World Tick Route Integration Note (2026-05-05)

`POST /api/game/turn` now advances the server-owned world tick after every successful free-text turn:

- One player action still increments `worldState.turnCount` exactly once.
- `worldState.year/month` advance through the tick, not through provider output.
- Tick resource changes and faction drift pass through `src/game/stateRules.js` with normal whitelist/clamp protection.
- The response includes `worldTick: { summary, events, attributeChanges }`; the browser displays the current month in the status strip and appends short monthly feedback after the provider narrative.
- The complete scholar -> exam -> official path remains unchanged; exam submission/question routes still do not run a tick in the minimal S21 slice.

## S22.1 Relationship Ledger Note (2026-05-05)

S22.1 adds the first server-owned NPC/faction relationship ledger without changing provider authority:

- `worldState.relationshipLedger` records character and faction social memory: `stance`, `relationship`, `resentment`, `networkSource`, `recentIntent`, `visible`, and `lastUpdatedTurn`.
- `src/game/relationships.js` owns ledger creation, normalization, legacy-session backfill, and compact summaries.
- New sessions create ledger entries from current `characters` and existing numeric `factions`; game/exam routes backfill older JSON sessions through `ensureRelationshipLedger()`.
- Relationship values are clamped to `-100..100`; resentment is clamped to `0..100`; invented ledger ids are dropped.
- Providers still cannot patch `relationshipLedger`. The AI turn schema rejects it and `applyStatePatch()` ignores it.

## S22.2 Relationship Suggestion Note (2026-05-05)

S22.2 adds the controlled provider suggestion path while keeping the relationship ledger server-owned:

- Turn prompts now include a compact visible-only `relationshipLedger` summary so models can reason about known NPC/faction social context.
- Provider turn output may include top-level `relationshipChanges`; this is separate from `statePatch` and represents suggestions only.
- `relationshipChanges` entries must target an existing visible character or faction id and use bounded deltas: `relationshipDelta` in `-12..12`, `resentmentDelta` in `-10..10`.
- `src/game/relationships.js` applies suggestions through `applyRelationshipChanges()`, drops hidden/invented targets, caps text fields, updates `lastUpdatedTurn`, and normalizes the ledger before persistence.
- `/api/game/turn` returns the normalized applied changes as `relationshipChanges` in JSON and SSE payloads.
- S22.3 makes Mock produce concrete relationship suggestions for scholar, emperor, minister, and official turns through the same path. S23.1 extends the same suggestion path to local magistrate turns, and S23.2 extends it to general turns. Mock classifies the resolved action from its own patch output, targets only visible ledger entries, and still relies on the route to call `applyRelationshipChanges()` before persistence.
- The browser narrative now appends concise `[人脉]` feedback for applied relationship changes.

## S23.1 Local Magistrate Note (2026-05-05)

S23.1 adds a dedicated local magistrate loop while keeping the server-owned state boundary unchanged:

- Magistrate sessions now seed `player.countyName`, `localTreasury`, `localOrder`, `gentryRelations`, `banditPressure`, `pendingLawsuits`, `corveeBurden`, and `waterworks`.
- These local fields are included in turn prompts, AI turn schemas, and `applyStatePatch()` whitelist/clamp rules. Numeric local fields are server-clamped; provider output still cannot change role, promotion fields, active exams, or relationship ledger state directly.
- Mock magistrate turns recognize case hearings, money/grain work, gentry mediation, anti-bandit policing, corvee labor, and waterworks. They may update local county meters and modest global fields such as public order, treasury, grain reserve, population, corruption, and existing numeric factions.
- Magistrate relationship reactions use the existing top-level `relationshipChanges` suggestion path and are persisted only by the route-owned `applyRelationshipChanges()` merge.
- The browser role panel now renders magistrate-specific local meters and action hints.

## S23.2 General Role Note (2026-05-05)

S23.2 adds a dedicated military command loop while keeping the server-owned state boundary unchanged:

- General sessions now seed `player.command`, `troops`, `supply`, `battleReputation`, `scouting`, and `campaignRisk`.
- These military fields are included in turn prompts, AI turn schemas, and `applyStatePatch()` whitelist/clamp rules. Numeric military fields are server-clamped, and promotion/exam/relationship-ledger authority remains server-owned.
- Mock general turns recognize recruitment, supply/pay work, drill, scouting, fortification, campaign action, and routine camp work. They may update local command meters and limited global fields such as treasury, grain reserve, army size, army morale, border threat, public order, and existing numeric factions.
- General relationship reactions use the existing top-level `relationshipChanges` suggestion path and are persisted only by the route-owned `applyRelationshipChanges()` merge.
- The browser role panel now renders general-specific status, action hints, military meters, troop/supply counts, and border pressure.

## S23.3 Official Role Note (2026-05-06)

S23.3 deepens the post-palace official loop while keeping ordinary turns inside the server-owned state boundary:

- Official sessions and palace-exam promotion now seed `player.superiorFavor`, `peerNetwork`, `performanceMerit`, `promotionProspect`, `impeachmentRisk`, and `cleanReputation`.
- These official career fields are included in turn prompts, AI turn schemas, and `applyStatePatch()` whitelist/clamp rules. Numeric official fields are server-clamped, and ordinary turns still cannot grant `officeTitle`, palace rank, role promotion, or relationship ledger state directly.
- Mock official turns now recognize assessment/promotion work, impeachment, observation under superiors, casework, relief/farming, peer networking, bribery, and routine office work. They may update official career meters and limited global fields such as corruption, public order, grain reserve, population, and existing numeric factions.
- Palace promotion appends a visible official superior contact while preserving the complete scholar -> official path; relationship reactions still use the top-level `relationshipChanges` suggestion path and are persisted only by the route-owned `applyRelationshipChanges()` merge.
- The browser role panel now renders official-specific status, action hints, and career meters for superiors, peers, merit, promotion, impeachment risk, and clean-name standing.

## S24 Exam Depth Note (2026-05-06)

S24 deepens the imperial examination loop while preserving the server-owned promotion and anti-cheat boundaries:

- Virtual same-field candidates now include inspectable essay profiles with title/body/excerpt/word count, style label, examiner comment, strengths, and weaknesses. Ranking remains server-built and still favors the player on score ties.
- Exam entry now has server-owned preparation cost and travel risk through `src/game/examTravel.js`. `/api/exam/question` applies level-specific cost and funded/shortfall effects through the normal state whitelist/clamp path with `{ incrementTurnCount: false }`, then stores `entryPreparation` on `activeExam`.
- `/api/exam/submit` preserves `entryPreparation` in `player.examHistory` and returns `examQuestion`, `essay`, and `entryPreparation` for immediate frontend rendering.
- The browser result modal now includes 本场案卷 and 同场文卷 sections, and panels show an 考试档案 button when historical exam records exist.
- The S24.1 candidate data slice was accidentally committed by a subagent as `80db3d2`; Codex reviewed it during S24 integration. Future subagents are explicitly forbidden from committing, pushing, or creating PRs.

## S25.1 Real-Provider Smoke Note (2026-05-06)

S25.1 adds an optional keyed smoke path without changing the default Mock experience:

- `npm run smoke:provider` runs `scripts/providerSmoke.js`.
- In default `AI_PROVIDER=mock` mode, the script auto-selects only real providers whose required key exists: `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, or `ANTHROPIC_API_KEY`. If no real-provider keys are present, it skips successfully.
- `npm run smoke:provider -- --provider openai|deepseek|anthropic|claude|all` can target a specific provider; targeted real providers fail fast when their required key is missing.
- The smoke calls real provider factories directly instead of `getProvider()`, so Mock fallback cannot hide provider failures.
- The smoke verifies the provider-method equivalents of start, turn, question, and submit/grade. It validates provider JSON through the existing schemas, prints concise summaries, and does not start Express or write session files.
- `test/providerSmokeScript.test.js` covers provider aliasing, key-based selection, missing-key failure, and the no-key skip path without making network calls.

## S25.2 Real-Provider Streaming Note (2026-05-06)

S25.2 adds true turn token streaming for keyed real providers while preserving the server-owned state boundary:

- OpenAI uses Responses API `stream: true` and consumes `response.output_text.delta`.
- DeepSeek uses OpenAI-compatible chat completions with `stream: true` and consumes `choices[0].delta.content`.
- Anthropic/Claude uses Messages `client.messages.stream()` and consumes text or JSON deltas, while using the final parsed message when available for validation.
- `src/ai/providers/remoteHelpers.js` buffers the complete streamed JSON and validates it through the existing `turn` schema before returning.
- `src/routes/game.js` only streams visible `narrative_chunk` text by extracting the top-level `narrative` JSON string with `src/utils/streamingJson.js`; state patching, relationship changes, world tick, persistence, and `final_state` still wait for complete schema-valid JSON.
- Mock and unsupported providers keep the existing SSE compatibility path: generate the full turn first, then chunk the final narrative.
- `npm run smoke:provider -- --stream --provider openai|deepseek|anthropic|claude` optionally exercises the real-provider streaming path in keyed environments.
- If visible provider narrative has already been sent and the stream later fails validation, the route emits `error` and leaves the session unchanged rather than falling back to Mock with contradictory visible text.

## S25.3 AI Output Eval Fixture Note (2026-05-06)

S25.3 adds a no-network AI output fixture gate without changing default Mock playability:

- `npm run eval:ai` runs `test/aiEvalFixtures.test.js`.
- Fixtures live in `testdata/aiEvalFixtures.js` and cover valid provider-shaped opening, turn, exam-question, and grade payloads.
- The eval gate parses raw model-like text through `src/utils/json.js`, validates final payloads through `src/ai/schemas.js`, and applies focused checks for historical tone, unsafe JSON contracts, ordinary-turn authority risks, patch clamping, faction score safety, grade bounds, and local exam authenticity penalties.
- S25.3 intentionally keeps live provider calls out of `npm test`; keyed network checks remain in `npm run smoke:provider`.
- Provider faction patches now clamp existing faction scores to `0..100` while still dropping invented faction keys.

## S26.1 Browser Smoke Note (2026-05-06)

S26.1 introduces repeatable local browser acceptance without changing the default `npm start` flow:

- `npm run smoke:browser` runs `scripts/browserSmoke.js`.
- The script uses `playwright-core` with an installed Chrome or Edge executable. Developers can set `BROWSER_EXECUTABLE_PATH` or pass `--browser <path>` when the browser is installed outside standard platform paths.
- By default the smoke starts a temporary Mock-mode server on a free local port. `npm run smoke:browser -- --url http://localhost:3000` targets an already running server.
- The first S26.1 journey covers local page load, scholar opening flow through the real form, `qianqiu.sessionId` localStorage persistence, reload/fresh-page session restoration, API readability for the restored session, and cleanup of the smoke session file.
- Browser smoke remains outside `npm test` so the normal test suite stays no-browser and fast. S26.2 adds DOM and screenshot-level coverage for desktop/mobile layout, the exam modal, result details, and the action input surface.

## S26.2 UI Acceptance Note (2026-05-06)

S26.2 expands `npm run smoke:browser` from opening/restoration smoke into repeatable UI acceptance:

- The browser journey now uses fixed desktop and mobile viewports and checks that the status strip, role panel, narrative area, and action input surface do not overlap or overflow horizontally.
- The journey opens the scholar exam modal through the real panel button, fills and submits a Mock-mode child-exam essay, and verifies the result view contains the player archive, score sections, highlighted ranking row, and inspectable same-field candidate essays.
- The same saved session is then restored and checked on mobile; the historical exam archive is opened there to exercise responsive result-detail rendering.
- The smoke captures PNG screenshots for representative desktop/mobile states and validates them in memory. Passing `--screenshots <dir>` writes those artifacts for manual review; `artifacts/` is ignored by Git.
- This pass exposed and fixed a result-modal regression where `.exam-requirements` overrode the `hidden` attribute with `display: grid`, leaving the old question requirements visible behind the放榜/result view.

## S26.3 Browser Acceptance Documentation Note (2026-05-06)

S26.3 adds `docs/BROWSER_ACCEPTANCE.md` as the durable browser acceptance record:

- The document lists the automated `npm run smoke:browser` coverage, including local boot, scholar opening flow, session restoration, desktop/mobile layout checks, the exam modal, result details, the exam archive, screenshot validation, and cleanup.
- It records the latest S26.2 automated result from commit `434b3ef`, including the screenshot run, 87-test `npm test` pass, and the `.exam-requirements[hidden]` regression fixed during screenshot review.
- It keeps `docs/MANUAL_ACCEPTANCE.md` as the fallback for the complete scholar-to-official browser path, exam integrity variants, role-loop breadth, subjective visual inspection, real-provider browser behavior, and cross-browser checks.
- S26.3 verification also added `test-helpers/fetchSafeServer.js` after a full-suite run exposed an intermittent Node Fetch `bad port` failure when `app.listen(0)` selected a blocked port.

## S27.1 Phase-Two Acceptance Note (2026-05-06)

S27.1 records second-phase acceptance in `docs/PHASE_TWO_ACCEPTANCE.md`:

- The accepted local milestone includes server-owned world tick, relationship memory, magistrate/general/official identity depth, deeper exam competition/archive/travel, no-network AI eval fixtures, real-provider smoke/streaming readiness, and browser smoke/UI acceptance.
- Verified commands for this acceptance pass: `npm run eval:ai`, `npm run smoke:provider`, `npm test`, `npm run smoke:browser -- --screenshots artifacts/browser-smoke/s27-1`, and `git diff --check`.
- Live real-provider calls remain unverified in this environment because no provider keys are configured; the provider smoke skipped successfully and keyed checks remain optional.
- The next phase should open a new roadmap instead of extending S27.1. Candidate directions are long-horizon simulation, relationship inspection UI, deeper official career outcomes, stronger role/world interactions, keyed provider acceptance, broader browser journeys, and storage migration planning.

## S30.1 Third-Phase Roadmap Note (2026-05-06)

S30.1 opens the third-phase active roadmap without changing development rules:

- `docs/PHASE_TWO_ROADMAP_ARCHIVE.md` freezes the completed second-phase roadmap.
- `docs/DEVELOPMENT_STEPS.md` now starts the third-phase active ledger at S30.
- Third-phase priorities start with layout and state-boundary hardening, then proceed to relationship visibility, active NPCs, long-horizon events, official career outcomes, exam calendarization, role/world coupling, keyed provider long-run acceptance, broader browser acceptance, and storage migration planning.
- The mandatory workflow, Git discipline, Mock-default requirement, provider-optional requirement, server-owned state/rules boundary, and complete scholar -> official path protection remain unchanged.

## S31.2 Ordinary Turn State Boundary Note (2026-05-06)

S31.2 hardens ordinary turn provider authority without changing Mock playability:

- Turn schemas and prompts no longer allow ordinary provider patches for `activeExam`, `characters`, `eventHistory`, `player.examRank`, or `player.examHistory`.
- Default `applyStatePatch()` uses a provider-facing whitelist and ignores those server-owned fields even if a non-schema provider returns them.
- Internal server follow-up patches can explicitly pass `allowServerOwnedPatchKeys: true`; the current route uses that for world tick calendar fields while still avoiding a second `turnCount` increment.
- Provider-visible events still enter history through `appendEvents()`, exam requests still use `examTrigger`, promotions and exam history remain owned by exam routes and `src/game/promotions.js`, and relationship state still flows through top-level `relationshipChanges`.

## S31.3 Start Role Boundary Note (2026-05-06)

S31.3 makes the start-role contract explicit:

- `src/game/initialState.js` exports the allowed role enum and rejects unsupported non-empty role values before state creation.
- `/api/game/start` now returns 400 for unknown roles instead of creating sessions with arbitrary `player.role` values.
- Missing or blank role input still defaults to `scholar` for compatibility with older clients.
- The browser start form now exposes `official` alongside `scholar`, `emperor`, `minister`, `general`, and `magistrate`; `scripts/browserSmoke.js` fails if any supported start role is missing from the form.

## S32.1 Relationship Inspection View Note (2026-05-06)

S32.1 defines the player-facing relationship/contact inspection contract without changing the server-owned ledger authority:

- `src/game/relationships.js` now exports `buildRelationshipInspectionView(worldState)`, a presentation-only view derived from the normalized `relationshipLedger`.
- Game and exam route payloads include top-level `relationshipView` beside `worldState` so S32.2 UI can render contacts and factions without reading the raw ledger directly.
- `relationshipView` includes visible contacts and factions, numeric relationship/resentment values, readable relationship and resentment bands, stance, network source, recent intent, and `lastUpdatedTurn`.
- Hidden ledger entries are omitted entirely: no hidden ids, names, exact counts, placeholder rows, faction labels, or hidden-entry notes are exposed through the view.
- The persisted `relationshipLedger` remains server-owned. Providers still cannot patch it directly; they can only suggest bounded top-level `relationshipChanges`.

## S32.2 Relationship UI Note (2026-05-06)

S32.2 turns the inspection contract into a browser surface without changing relationship authority:

- `public/app.js` renders a compact `人脉簿` panel from top-level `relationshipView` inside both scholar and non-scholar role panels.
- The browser panel shows visible characters and factions with relationship, resentment, stance, source, recent intent, and last-updated turn. It uses display localization for known default faction names and relationship text while preserving stable `data-contact-*` selectors for acceptance.
- Player-facing UI code should continue to consume `relationshipView`; the raw `worldState.relationshipLedger` remains available only as a compatibility/developer-inspection fallback.
- `scripts/browserSmoke.js` verifies relationship-panel presence on desktop, restored, fresh-page, mobile, and direct-official-start journeys; checks hidden id/text non-leakage; asserts a Mock scholar turn updates the mentor relationship; and catches relationship-panel horizontal overflow.

## S32.3 Active NPC Request Note (2026-05-06)

S32.3 adds the first server-owned active NPC/faction request loop without giving providers request authority:

- `worldState.activeNpcRequest` stores at most one active request. It is scheduled, normalized, resolved, expired, and cleared by `src/game/activeRequests.js`.
- Game and exam route payloads include top-level `activeNpcRequestView`; turn payloads also include `activeNpcRequestEvents`.
- Active requests target only visible relationship ledger entries. Hidden targets are omitted from the view, and invalid older request state is cleared rather than rendered.
- `/api/game/turn` applies provider state patches and provider relationship suggestions first, then runs active request handling, then world tick. Event history order is provider events, active-request events, and then world-tick events.
- Accept/refuse/expire outcomes use server-authored bounded `applyRelationshipChanges()` deltas, merged into the route `relationshipChanges` response. Provider output still cannot patch `activeNpcRequest` or `relationshipLedger`.
- `public/app.js` renders the compact `来函` panel from `activeNpcRequestView`, with stable `data-request-*` selectors. `scripts/browserSmoke.js` now verifies active request fields, hidden target/text non-leakage, and active-request panel overflow on desktop, restored, fresh-page, and mobile journeys.

## S33 Long-Term Event Scheduler Note (2026-05-06)

S33 adds a server-owned long-term event scheduler while keeping provider authority limited to narrative and ordinary turn suggestions:

- `worldState.longTermEvents` stores `{ schemaVersion, queue, cooldowns, recentResolved }`. It is normalized, scheduled, resolved, cooled down, and summarized by `src/game/longTermEvents.js`.
- The first deterministic event families are seasonal harvest audits, grain-shortage disasters, border alarms, court faction conflict, magistrate local case chains, social repercussions from refused/expired requests, and a disaster relief-audit follow-up.
- Game and exam route payloads include top-level `longTermEventView`; turn payloads also include `longTermEvents: { summary, events, attributeChanges, scheduled, resolved }`.
- `/api/game/turn` now runs active requests first, then world tick, then long-term events against the post-tick calendar. Event history order is provider events, active-request events, world-tick events, and long-term-event events.
- Scheduler state patches still pass through `applyStatePatch(..., { incrementTurnCount: false, allowServerOwnedPatchKeys: true })`, and scheduler social consequences pass through `applyRelationshipChanges()`. Providers cannot patch `longTermEvents` or `activeNpcRequest` in ordinary turns.
- `public/app.js` renders long-term event feedback as `[大势]` narrative lines. S33 intentionally does not add a separate long-term event panel.
- The durable contract is `docs/LONG_TERM_EVENTS_CONTRACT.md`; focused coverage lives in `test/longTermEvents.test.js` and `test/gameTurnLongTermEvents.test.js`.

## S34 Official Career Outcome Note (2026-05-06)

S34 adds a server-owned official career outcome engine while keeping ordinary provider authority limited to meters, narrative, and relationship suggestions:

- `worldState.officialCareer` stores `{ schemaVersion, tenureMonths, reviewCycleMonths, lastReviewTurn, lastReviewYear, currentPosting, careerHistory, pendingOutcome, cooldowns }`. It is normalized and summarized by `src/game/officialCareer.js`.
- Game and exam route payloads include top-level `officialCareerView`; turn payloads also include `officialCareer: { summary, events, attributeChanges, outcome }`.
- `/api/game/turn` runs official career settlement after active requests, world tick, and long-term events. Event history order is provider events, active-request events, world-tick events, long-term-event events, and official-career events.
- Settlement can trigger first real appointment, accelerated promotion review, annual/cycle review, or impeachment-risk review. Result types are `appointment`, `transfer`, `promotion`, `outpost`, `demotion`, `impeachment`, `punishment`, and `retention`.
- Providers may still affect `superiorFavor`, `peerNetwork`, `performanceMerit`, `promotionProspect`, `impeachmentRisk`, and `cleanReputation`, but they cannot patch `officialCareer`, `officeTitle`, `role`, `roleLabel`, `examRank`, `palaceRank`, or `examHistory` in ordinary turns.
- The browser renders a compact `官场履历` panel from `officialCareerView` for official players and appends `[官场结算]` narrative feedback after turn settlement.
- The durable contract is `docs/OFFICIAL_CAREER_CONTRACT.md`; focused coverage lives in `test/officialCareer.test.js`, `test/gameTurnOfficialCareer.test.js`, and browser smoke helper coverage.
