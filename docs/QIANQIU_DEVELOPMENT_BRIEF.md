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
- 入仕官员：`officeTitle`、`position`、`faction`、`influence`、`integrity`。
- 将领：`command`、`troops`、`supply`、`battleReputation`。
- 地方官：`countyName`、`localTreasury`、`localOrder`、`gentryRelations`。

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
- `worldState`

第一版实现中，接口会复用尚未交卷的 `activeExam`，避免同一场考试反复刷题；若 `activeExam` 只是由自由行动触发的简略入场记录，则该接口负责补齐题目、要求、字数、通过线和保存后的状态。

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

当前实现中，`/api/exam/submit` 使用普通 JSON 返回；服务器会先做本地反作弊检查，再调用 provider 评分，并在服务端应用作弊扣分。文章、评分、复核结果、虚拟考生、榜单与 `promotionResult` 会保存到 `player.examHistory`，同时清空 `activeExam`。随后 `src/game/promotions.js` 执行服务器自有晋级规则：童试/乡试/会试通过后分别写入 `player.examRank = "秀才" / "举人" / "贡士"`；殿试通过后写入 `player.examRank = "进士"`、`player.role = "official"`、`player.roleLabel = "入仕官员"`，并记录 `palaceRank` 与 `officeTitle`。严重作伪会强制黜落，按当前名位降一档并扣减声望与心性。

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
- 身份面板：皇帝、大臣、入仕官员展示关键权力/操守/影响指标、府库粮储、朝局派系与可行动提示。
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
- 入仕官员基础行动：观政学习、断案平讼、劝农抚民、拜会同年、贪墨风险。

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

## S11 Provider Integration Note (2026-05-05)

The first real-provider slice is implemented without changing the default local experience:

- `AI_PROVIDER=mock` remains the default and needs no API key.
- `AI_PROVIDER=openai` uses the OpenAI SDK Responses API with `OPENAI_API_KEY`, optional `OPENAI_BASE_URL`, and `OPENAI_MODEL`.
- `AI_PROVIDER=deepseek` uses the OpenAI SDK against `DEEPSEEK_BASE_URL` for OpenAI-compatible chat completions with `DEEPSEEK_API_KEY` and `DEEPSEEK_MODEL`.
- `AI_PROVIDER=claude` and `AI_PROVIDER=anthropic` use `@anthropic-ai/sdk` Messages API with `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`.
- `AI_PROVIDER_TIMEOUT_MS` controls real provider request timeout and defaults to 30000.
- All real provider methods build prompts through `src/ai/prompts.js`, parse JSON through `src/utils/json.js`, validate through Ajv schemas in `src/ai/schemas.js`, retry once on call/parse/schema failure, and then fall back to Mock.
- The server still owns patch whitelisting, numeric clamps, exam gates, promotion rules, anti-cheat penalties, candidate ranking, and persistence.
