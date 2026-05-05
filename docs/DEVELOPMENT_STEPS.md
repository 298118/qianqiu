# 《千秋》逐步开发路线图与进度台账

本文件是 Codex 与 Claude Code 共同维护的实现路线图。它解决两个问题：

- 把《千秋》拆成很多小步骤，每次只实现一小块，稳健推进。
- 记录每次完成了哪些步骤、改了什么、如何验证、对应 Git 提交，让 Codex 和 Claude Code 都能同时看到。

## 1. 使用规则

每次开发开始时：

1. 读取 `AGENTS.md` 或 `CLAUDE.md`。
2. 读取 `docs/SHARED_CONTEXT.md`。
3. 读取 `docs/QIANQIU_DEVELOPMENT_BRIEF.md`。
4. 读取本文件，找到第一个 `TODO` 或 `IN_PROGRESS` 的小步骤。
5. 执行 `git status --short`，确认是否有别人留下的改动。

每次完成一个小步骤时：

1. 把对应步骤状态改为 `DONE`，填写完成日期、工具、提交哈希。
2. 在本文件的“进度记录”追加一条说明，写清完成了什么、验证了什么、留下了什么风险。
3. 更新 `docs/SHARED_CONTEXT.md`，让另一个工具看到最新交接信息。
4. 如果改动影响产品范围、架构、API、状态字段、提示词或验收标准，也同步更新 `docs/QIANQIU_DEVELOPMENT_BRIEF.md` 或 README。
5. 运行相关验证命令。
6. 用 Git 提交本次 coherent change。

状态值：

- `TODO`：未开始。
- `IN_PROGRESS`：正在做，下一位接手者应先检查工作树和上下文。
- `DONE`：已完成、已验证、已提交。
- `BLOCKED`：被外部条件阻塞，必须写明原因和解除条件。

## 2. 依赖与开源库策略

允许使用成熟的第三方库和依赖，但必须遵守以下规则：

- 只有当依赖能明显降低复杂度、提升可靠性、改善安全性或带来标准能力时才加入。
- 新增依赖必须记录在本文件的对应步骤和 README 中，说明用途。
- 优先选择维护活跃、文档清楚、常用、许可证友好的库。
- 前端第一阶段保持无构建流程，除非路线图中明确升级。
- 核心游戏规则、科举晋级、状态边界、作弊惩罚不能完全交给模型或黑箱库。
- 加依赖后必须验证 `npm install` 和 `npm start`。

推荐初始依赖：

- `express`：HTTP 服务与静态资源。
- `cors`：本地开发跨域控制。
- `dotenv`：环境变量。
- `nanoid`：session ID。
- `ajv`：AI JSON schema 校验。
- `openai`：OpenAI 与 DeepSeek OpenAI-compatible 接入。
- `@anthropic-ai/sdk`：Claude 接入。

后续可按需引入：

- `vitest` 或 Node.js 内置 test runner：自动化测试。
- `zod`：如果后续希望用更接近业务代码的 schema 声明。
- `marked` 或轻量 markdown renderer：若叙事区需要安全地渲染有限 Markdown。
- `dompurify`：若前端允许富文本渲染，必须配合消毒。

## 3. 步骤总览

| ID | 状态 | 目标 | 完成日期 | 工具 | 提交 |
| --- | --- | --- | --- | --- | --- |
| S00.1 | DONE | 建立开发文稿、双工具入口、共享上下文与本路线图 | 2026-05-05 | Codex | 8e3cee3 |
| S01.1 | TODO | 创建 `package.json`、`.env.example`、基础 npm scripts |  |  |  |
| S01.2 | TODO | 创建 Express 服务和静态资源托管，打开首页 |  |  |  |
| S01.3 | TODO | 创建前端最小壳：开局按钮、状态区、叙事区 |  |  |  |
| S02.1 | TODO | 实现 session JSON 存储与安全路径处理 |  |  |  |
| S02.2 | TODO | 实现初始世界状态工厂 |  |  |  |
| S02.3 | DONE | 实现状态 patch 白名单、clamp 与历史事件裁剪 | 2026-05-05 | Claude Code | d119393 |
| S03.1 | TODO | 定义 AI provider 接口与 Mock provider 骨架 |  |  |  |
| S03.2 | TODO | 定义通用推演、出题、评卷 JSON schema |  |  |  |
| S03.3 | TODO | 实现 prompt 模板文件并详细注释提示词意图 |  |  |  |
| S03.4 | TODO | 实现 JSON 解析、schema 校验、失败降级 |  |  |  |
| S04.1 | TODO | 实现 `POST /api/game/start` |  |  |  |
| S04.2 | TODO | 实现 `GET /api/game/state/:sessionId` |  |  |  |
| S04.3 | DONE | 实现 `POST /api/game/turn` 非流式基础版本 | 2026-05-05 | Claude Code | d119393 |
| S04.4 | TODO | 将 `/api/game/turn` 升级为 SSE 流式反馈 |  |  |  |
| S05.1 | DONE | 实现开局页：朝代、年份、身份、姓名、家境 | 2026-05-05 | Codex | c6e0537 |
| S05.2 | DONE | 实现主界面状态栏、叙事历史、自由输入 | 2026-05-05 | Claude Code | d119393 |
| S05.3 | DONE | 实现 session 恢复与刷新不丢失当前局 | 2026-05-05 | Claude Code | d119393 |
| S06.1 | DONE | Mock 识别书生日常行动：读书、拜师、游学、谋生 | 2026-05-05 | Codex | 9aa5263 |
| S06.2 | DONE | 书生日常行动影响属性、金钱、人脉、事件历史 | 2026-05-05 | Codex | 9aa5263 |
| S06.3 | DONE | 实现书生专属面板与属性变化展示 | 2026-05-05 | Codex | 9aa5263 |
| S07.1 | DONE | 定义科举阶段、门槛、题型、晋级映射 | 2026-05-05 | Codex | 47dae05 |
| S07.2 | DONE | 实现 `POST /api/exam/question` 和 activeExam 保存 | 2026-05-05 | Codex | 47dae05 |
| S07.3 | DONE | 实现考试弹窗：题目、要求、大文本编辑区 | 2026-05-05 | Codex | 47dae05 |
| S08.1 | DONE | 实现 Mock 考官评分算法 | 2026-05-05 | Codex | 9c8ca76 |
| S08.2 | DONE | 实现本地防作弊检测：现代词、过短、疑似照抄 | 2026-05-05 | Codex | 9c8ca76 |
| S08.3 | DONE | 生成 4-8 名虚拟同场考生与合理分数 | 2026-05-05 | Codex | 9c8ca76 |
| S08.4 | DONE | 实现放榜排名、详细评语、文章保存 | 2026-05-05 | Codex | 9c8ca76 |
| S09.1 | TODO | 童试通过后成为秀才 |  |  |  |
| S09.2 | TODO | 乡试通过后成为举人 |  |  |  |
| S09.3 | TODO | 会试通过后成为贡士 |  |  |  |
| S09.4 | TODO | 殿试定甲第并转为 official |  |  |  |
| S09.5 | TODO | 为严重作弊实现黜落或降档规则 |  |  |  |
| S10.1 | TODO | 实现皇帝身份基础自由输入推演 |  |  |  |
| S10.2 | TODO | 实现大臣身份基础自由输入推演 |  |  |  |
| S10.3 | TODO | 入仕后显示官员视角与基础政务输入 |  |  |  |
| S11.1 | TODO | 接入 OpenAI provider |  |  |  |
| S11.2 | TODO | 接入 DeepSeek OpenAI-compatible provider |  |  |  |
| S11.3 | TODO | 接入 Claude provider |  |  |  |
| S11.4 | TODO | 真实 provider 失败时自动重试或降级 Mock |  |  |  |
| S12.1 | TODO | 前端古风视觉：宣纸、墨色、朱砂强调 |  |  |  |
| S12.2 | TODO | 移动端布局与输入体验优化 |  |  |  |
| S12.3 | TODO | 叙事区、考试区、放榜区交互打磨 |  |  |  |
| S13.1 | TODO | 增加自动化测试：状态规则、session 存储 |  |  |  |
| S13.2 | TODO | 增加自动化测试：科举晋级与作弊惩罚 |  |  |  |
| S13.3 | TODO | 增加端到端手动验收脚本说明 |  |  |  |
| S14.1 | TODO | README 完整化：安装、配置、启动、provider 切换 |  |  |  |
| S14.2 | TODO | 补齐开发者文档：架构、AI 合约、状态字段 |  |  |  |
| S14.3 | TODO | 第一阶段完整验收与稳定化 |  |  |  |

## 4. 分阶段详细步骤

### Phase 00: 项目上下文与协作纪律

目标：让 Codex 和 Claude Code 从一开始共享同一套开发上下文。

- S00.1：建立 `AGENTS.md`、`CLAUDE.md`、`docs/SHARED_CONTEXT.md`、`docs/QIANQIU_DEVELOPMENT_BRIEF.md`、本文件。
- 验证：Node.js 能以 UTF-8 读取所有文档；所有入口都引用共享上下文和开发步骤。
- 完成标准：文档已提交，`git status --short` 干净。

### Phase 01: 最小可启动项目

目标：先让项目能安装、启动、打开网页。

- S01.1：创建 `package.json`，加入 `start` 和 `dev` scripts，加入初始依赖。
- S01.2：创建 `server.js`，启动 Express，监听 `PORT || 3000`，托管 `public/`。
- S01.3：创建 `public/index.html`、`public/styles.css`、`public/app.js`，首页显示项目名、开局入口和基本布局。
- 验证：运行 `npm install`、`npm start`，访问 `http://localhost:3000` 能看到页面。

### Phase 02: 状态与存储

目标：建立可保存、可恢复、可约束的世界状态。

- S02.1：实现 `src/storage/sessionStore.js`，提供 create/read/write/list 基础方法，session 文件只允许写入 `data/sessions/`。
- S02.2：实现 `src/game/initialState.js`，按朝代、年份、身份、姓名、家境创建 `worldState`。
- S02.3：实现 `src/game/stateRules.js`，只允许白名单 patch，数值 clamp，事件历史保留 20 条。
- 验证：用 Node.js 脚本创建一个 session、读取、应用 patch、再次读取，确认数据稳定。

### Phase 03: AI 抽象与 JSON 合约

目标：模型可替换，输出可验证。

- S03.1：实现 `src/ai/index.js` 和 `src/ai/providers/mock.js`，统一 provider 方法：`runTurn`、`generateExamQuestion`、`gradeExamEssay`。
- S03.2：实现 `src/ai/schemas.js`，用 Ajv 定义通用推演、出题、评卷 schema。
- S03.3：实现 `src/ai/prompts.js`，写入通用世界引擎、科举考官、出题官 prompt，并在关键处注释。
- S03.4：实现 `src/utils/json.js`，处理模型 JSON 解析、schema 校验、失败重试入口、Mock 降级。
- 验证：Mock provider 返回的三个 JSON 都能通过 schema。

### Phase 04: 游戏 API

目标：前后端能创建游戏、读取状态、推进一回合。

- S04.1：实现 `/api/game/start`，创建 session 并返回初始叙事。
- S04.2：实现 `/api/game/state/:sessionId`，支持刷新后恢复。
- S04.3：实现 `/api/game/turn` 基础版本，接收自由输入，调用 Mock provider，应用 state patch。
- S04.4：实现 SSE 工具 `src/utils/sse.js`，让 `/api/game/turn` 流式输出叙事片段和最终状态。
- 验证：用 curl 或浏览器 fetch 创建 session、行动一次、读取更新后状态。

### Phase 05: 前端基础体验

目标：玩家可以从浏览器完成开局和自由行动。

- S05.1：开局页支持选择朝代、年份、身份、姓名、家境、自定义背景。
- S05.2：主界面显示顶部信息栏、中间叙事历史、底部多行输入框。
- S05.3：保存 sessionId 到 localStorage，刷新页面后恢复当前局。
- 验证：浏览器中创建书生局，输入“研读《孟子》三日”，看到叙事与状态变化。

### Phase 06: 书生日常循环

目标：考试前也好玩，行动能持续成长。

- S06.1：Mock provider 识别读书、拜师、游学、辩论、谋生、赶考等意图。
- S06.2：这些行动更新 `academia`、`literaryTalent`、`adaptability`、`mentality`、`reputation`、`gold`、`connections`、`studiedBooks`。
- S06.3：前端书生面板显示科举进度、属性、师承、已读书、人脉。
- 验证：连续多次日常行动后，属性合理变化，事件历史保留最近 20 条。

### Phase 07: 考试入口与出题

目标：玩家能进入真实写文章的考试界面。

- S07.1：实现 `src/game/exams.js`，定义四级考试、题型、字数建议、通过线、晋级结果。
- S07.2：实现 `/api/exam/question`，生成题目并保存 `activeExam`。
- S07.3：前端考试弹窗展示题目、要求、大文本输入区和提交按钮。
- 验证：书生点击或输入参加考试后能看到对应层级题目。

### Phase 08: 评卷、作弊检测与放榜

目标：玩家文章会被认真评分，并与虚拟考生同榜竞争。

- S08.1：Mock 考官按文章长度、古文词汇、结构、玩家属性、考试难度给五维评分。
- S08.2：本地防作弊检测现代词、明显时代错误、过短文本、疑似照抄经典片段。
- S08.3：实现 `src/game/candidates.js`，生成 4-8 名虚拟考生、背景和分数。
- S08.4：实现 `/api/exam/submit` 和前端放榜界面，展示总分、排名、评语和虚拟考生。
- 验证：提交正常文章、过短文章、含现代词文章，分数和惩罚符合预期。

### Phase 09: 完整科举晋级

目标：完成书生到入仕的第一主线。

- S09.1：童试通过后 `examRank = "秀才"`。
- S09.2：乡试通过后 `examRank = "举人"`。
- S09.3：会试通过后 `examRank = "贡士"`。
- S09.4：殿试定一甲、二甲、三甲，`player.role = "official"`，分派初始官职。
- S09.5：严重作弊时强制落第、降档或记录污点。
- 验证：从新书生开始，按四级考试一路走到 official，`examHistory` 保存每篇文章。

### Phase 10: 其他身份基础玩法

目标：皇帝、大臣、入仕官员都能基本游玩。

- S10.1：皇帝身份支持圣旨、用人、赈灾、征税、军事等基础自由输入。
- S10.2：大臣身份支持上疏、结党、执行政务、谏言等基础自由输入。
- S10.3：入仕后的官员视角显示官职、影响力、派系关系和可行动提示。
- 验证：三种身份各行动三次，状态和叙事都有合理变化。

### Phase 11: 真实 AI Provider

目标：保持 Mock 可玩，同时支持真实模型增强叙事。

- S11.1：实现 OpenAI provider，优先使用 Responses API。
- S11.2：实现 DeepSeek provider，走 OpenAI-compatible base URL。
- S11.3：实现 Claude provider，使用 Anthropic SDK Messages API。
- S11.4：provider 失败、JSON 无效或超时时，重试一次并可降级 Mock。
- 验证：无 API Key 时 Mock 正常；配置某个 provider 后能完成 start、turn、exam 三类调用。

### Phase 12: UI 与体验打磨

目标：让游戏像一个可长期玩的古风文本模拟器。

- S12.1：完善宣纸、墨色、朱砂红、宋/楷风字体 fallback、按钮和面板层级。
- S12.2：优化移动端输入框、考试编辑区、放榜弹窗。
- S12.3：叙事历史支持回合分隔、属性变化高亮、考试结果展开查看。
- 验证：桌面和移动宽度下无明显遮挡、溢出或不可操作区域。

### Phase 13: 测试与质量门槛

目标：每次改动都更稳。

- S13.1：为 session 存储、状态规则、AI schema 增加自动化测试。
- S13.2：为科举晋级、作弊惩罚、虚拟排名增加自动化测试。
- S13.3：写入手动验收脚本，覆盖书生完整主线和皇帝/大臣基础玩法。
- 验证：`npm test` 和手动验收清单都通过。

### Phase 14: 文档与第一阶段验收

目标：别人可以按文档启动、配置、扩展。

- S14.1：README 完整说明安装、启动、`.env`、provider 切换、Mock 模式。
- S14.2：补齐架构文档、AI 合约、状态字段、科举规则。
- S14.3：完成第一阶段验收，记录已知限制和下一阶段计划。
- 验证：新开发者只看 README 和文档即可启动项目并理解下一步。

## 5. 进度记录

按时间倒序追加。每条记录必须让另一个工具看得懂。

模板：

```text
日期：
工具：
步骤：
提交：
完成：
验证：
风险/遗留：
下一步：
```

### 2026-05-05

工具：Codex

步骤：S00.1

提交：8e3cee3

完成：新增本逐步开发路线图，明确允许使用成熟第三方库，规定 Codex 和 Claude Code 每次完成小步骤都要更新本文件和共享上下文。

验证：用 Node.js 检查 `AGENTS.md`、`CLAUDE.md`、README、开发文稿、共享上下文和本文件的入口链接。

风险/遗留：游戏实现尚未开始。

下一步：从 S01.1 开始创建 `package.json`、`.env.example` 和基础 npm scripts。

---

Codex progress note, 2026-05-05:

Status updates:

- S01.1 DONE: Added `package.json`, `package-lock.json`, `.env.example`, `start`, and `dev` scripts.
- S01.2 DONE: Added `server.js`, Express setup, CORS, dotenv loading, static `public/` hosting, and `GET /api/health`.
- S01.3 DONE: Added `public/index.html`, `public/styles.css`, and `public/app.js` with a usable opening form, status strip, and narrative area.
- S02.1 DONE: Added `src/storage/sessionStore.js` with JSON read/write under `data/sessions/` and session id validation.
- S02.2 DONE: Added `src/game/initialState.js` with the first structured `worldState`.
- S03.1 DONE: Added `src/ai/index.js` and `src/ai/providers/mock.js`; non-Mock providers currently fall back to Mock.
- S04.1 DONE: Added `POST /api/game/start`, including Mock opening narrative and session persistence.
- S04.2 DONE: Added `GET /api/game/state/:sessionId` for reading saved sessions.

Commit: c6e0537

Verification: Ran `npm install` successfully with 0 vulnerabilities. Started the app through `npm start`, confirmed `http://localhost:3000/` returned 200, `GET /api/health` returned ok, `POST /api/game/start` created a session, and `GET /api/game/state/:sessionId` read it back.

Risk/leftover: The turn loop, state patch whitelist/clamping, AI JSON schemas, exam endpoints, and complete scholar exam path are still TODO.

Next step: Implement S02.3 and S04.3 together so free-text actions can change state only through server-side rules.

---

### 2026-05-05

工具：Claude Code

步骤：S02.3, S04.3, S05.2, S05.3

提交：d119393

完成：
- S02.3：新增 `src/game/stateRules.js`，实现状态 patch 白名单（只允许预定义字段修改）、数值 clamp（如 health 0-100, gold 0-100000 等）、eventHistory 保留最近 20 条。
- S04.3：新增 `POST /api/game/turn` 端点，接收 sessionId 和自由文本 input，通过 Mock provider 推演，经 stateRules 安全应用后写回 session。
- S05.2：前端新增底部自由输入区（textarea + 行动按钮），叙事区改为追加历史模式，属性变化高亮显示（绿色增长/红色下降），科举提示内联显示。
- S05.3：页面加载时自动从 localStorage 恢复 sessionId，读取并展示已有事件历史。

验证：
- `npm install` 无漏洞。
- `npm start` 启动成功。
- `POST /api/game/start` 创建 session。
- `POST /api/game/turn` 研读《论语》→ 学识增加，turnCount 递增。
- `POST /api/game/turn` 请求考试 → activeExam 设为 child_exam。
- `GET /api/game/state/:sessionId` 恢复完整状态。
- 错误处理：空 input 返回 400，缺 sessionId 返回 400。

风险/遗留：SSE 流式（S04.4）、考试出题与评卷（S07-S08）尚未实现。Mock provider 的其他身份行动识别仍可进一步丰富。

下一步：S07.1（科举阶段定义），然后实现 S07.2-S07.3 的出题接口和考试写作界面。

---

Codex progress note, 2026-05-05:

Steps: S06.1, S06.2, S06.3

Commit: 9aa5263

Completed:

- Expanded `src/ai/providers/mock.js` so scholar daily actions separately recognize study, teacher visits, travel/social, debate, money/work, exam request, and rest.
- Daily actions now update numeric attributes plus `teacher`, `studiedBooks`, `connections`, `gold`, and event history through the existing server-side patch whitelist.
- Added a scholar panel in the plain frontend showing exam progress, next exam, active exam, attribute meters, teacher, studied books, and connections.

Verification:

- `node --check src/ai/providers/mock.js`
- `node --check public/app.js`
- `node --check src/routes/game.js`
- Local server returned 200 for `/`, `/app.js`, and `/styles.css`.
- Six-turn API smoke test passed for study, teacher visit, travel, debate, money/work, and exam request; confirmed studied book recording, teacher recording, multiple connections, `child_exam` trigger, saved `activeExam`, event history cap, and `turnCount`.

Risk/leftover: The exam question endpoint and real exam writing flow are still TODO; S07.1 is the next best step.

---

Codex progress note, 2026-05-05:

Steps: S07.1, S07.2, S07.3

Commit: 47dae05

Completed:

- Added `src/game/exams.js` as the server-owned exam rules module, defining the four exam levels, requirements, thresholds, word-count ranges, pass scores, and promotion mappings.
- Added `POST /api/exam/question`, wired under `/api/exam`, to generate a Mock question, save a full `activeExam`, append an exam-entry event, and reuse an unanswered exam instead of regenerating.
- Added a frontend exam writing modal with exam metadata, question text, requirements, essay textarea, and visible submit button placeholder; scholar panel entry and free-text exam triggers both open the question flow.

Verification:

- `node --check server.js`
- `node --check src/game/exams.js`
- `node --check src/routes/exam.js`
- `node --check src/ai/providers/mock.js`
- `node --check public/app.js`
- Temporary local server returned 200 for `/`, `/app.js`, and `/styles.css`.
- Temporary-port API smoke tests confirmed direct `POST /api/exam/question`, free-text exam trigger into question generation, `activeExam.examQuestion` persistence, and unanswered exam reuse by stable `examId`.

Risk/leftover: `/api/exam/submit`, Mock grading, anti-cheat checks, virtual candidate ranking, promotion application, and a working final submit action remain for S08-S09.

Next step: Implement S08.1-S08.4 so essays can be graded, checked for cheating, ranked against virtual candidates, and saved.

---

Codex progress note, 2026-05-05:

Steps: S08.1, S08.2, S08.3, S08.4

Commit: 9c8ca76

Completed:

- Added Mock `gradeExamEssay` with five score dimensions driven by essay length, classical vocabulary, structure markers, player attributes, readiness, and exam difficulty.
- Added server-owned `src/game/essayChecks.js` for short essay, modern/anachronistic term, copied classic passage, and ghostwriting checks; penalties are applied after provider grading.
- Added `src/game/candidates.js` to generate 4-8 virtual same-field candidates and rank them with the player.
- Added `POST /api/exam/submit`, saving essays/results into `player.examHistory`, clearing `activeExam`, and returning `score`, `authenticityCheck`, `virtualCandidates`, `ranking`, `promotionResult`, and `worldState`.
- Updated the frontend exam modal so the submit button calls `/api/exam/submit` and displays score, detailed comments, monitoring flags, and the ranking list.

Verification:

- `node --check src/game/essayChecks.js`
- `node --check src/game/candidates.js`
- `node --check src/ai/providers/mock.js`
- `node --check src/routes/exam.js`
- `node --check public/app.js`
- Temporary server on port 3137 confirmed health, `POST /api/exam/question`, normal `POST /api/exam/submit`, 4-8 ranking entries, `examHistory` persistence, `activeExam` clearing, and too-short plus modern-term penalty flags.

Risk/leftover: S08 records pass/fail in `promotionResult` but does not yet mutate `player.examRank` or `player.role`; S09 must apply promotion and severe-cheating consequences server-side.

Next step: Implement S09.1-S09.5 so passed exams update ranks through 秀才 -> 举人 -> 贡士 -> 进士/official, with severe cheating causing 黜落 or downgrade.
