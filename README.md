# 千秋 / Qianqiu

千秋是一款浏览器 + Node.js 历史模拟文字游戏。玩家以书生、皇帝、大臣、将领、地方官、入仕官员等身份进入古代中国历史情境，用自由文本行动推动个人命运和王朝局势。

AI 负责叙事、出题、评卷和角色反馈；服务器负责状态边界、晋级规则、反作弊、持久化和最终裁定。默认使用 Mock AI，无需 API Key 即可本地游玩。

> 本 README 以第二阶段本地验收为基线，并补记已经落地的第三阶段 S31-S38 增量；完整路线图仍以 `docs/DEVELOPMENT_STEPS.md` 为准。

## 主要更新

- 完整书生科举主线：书生可以从日常读书、拜师、游学、辩经、谋生一路进入童试、乡试、会试、殿试，最终成为入仕官员。
- 科举深度：同场虚拟考生有可回看的文章、风格、考官短评和优劣点；考试入场会产生服务器拥有的赶考盘费、旅途事件和疲劳/心性风险；前端可通过考试档案回看历次题目、本人文章、复核、榜单和同场文卷。
- S35 科举日历与同场记忆：`examCalendar` 由服务器拥有，取题前检查考期窗口、备考月程、路程、盘费和师长推荐；错过考期只记录不扣钱，同场考生以 `rival-*` id 跨考试存在，殿试后可转为入仕同年联系人。
- S36 角色与世界联动：`roleWorldCoupling` 由服务器拥有，把地方官水利、将领战役、皇帝任免和大臣弹劾等身份行动转成粮储、民心、边患、军费、派系与关系后果，并在月度 tick 前生效。
- 世界月度 tick：每次自由行动后，服务器推进一个游戏月份，并自然更新府库、粮储、人口、民心、贪腐、军心、边患和派系走势。
- 长期事件年表：第三阶段 S33 新增服务器拥有的 `longTermEvents` 队列，把季节、灾荒、边报、廷争、地方案链和跨月后果接入月度推演与叙事反馈。
- 官场结果引擎：第三阶段 S34 新增服务器拥有的 `officialCareer` 结算。入仕官员的上官、同年、考成、升迁、弹劾和清操仪表会触发实授、转任、升迁、外放、降调、弹劾成案、罚黜或留任；普通 provider 不能直接授官或罢官。
- NPC/派系记忆：新增 `relationshipLedger`，记录人物与派系的关系、怨望、立场、近期意图和可见性。AI 只能提出关系变化建议，最终仍由服务器合并。
- 主动来函/请托：第三阶段 S32.3 新增服务器调度的 `activeNpcRequest` 最小循环，NPC 或派系可基于可见人脉主动请托、施压、背书或索取回报，玩家回应会转化为服务器裁定的关系变化。
- SSE 回合流式响应：`POST /api/game/turn` 支持 `text/event-stream`；真实 provider 支持时会从结构化 JSON token 流中抽取 `narrative` 提前发送，Mock 或不支持流式的 provider 仍使用兼容分块输出。
- 地方官身份循环：新增县库、地方民心、乡绅、盗匪、词讼、赋役、水利等地方状态，支持审案、钱粮、安抚乡绅、捕盗、徭役和兴修水利。
- 将领身份循环：新增统率、部曲、军粮、战名、侦察、战险等军中状态，支持募兵、粮饷、操练、侦察、守边和出战。
- 入仕官员身份循环：新增上官、同年、考成、升迁、弹劾风险、清操等官场状态，支持观政、考成、同年经营、弹劾贪墨、断案抚民和贪墨风险。
- 皇帝、大臣基础循环：支持赈灾、用人、筹饷、整军、廷议、上疏、督办、人脉经营和弹劾攻讦。
- 前端体验：宣纸、墨色、朱砂、青玉风格；移动端单列布局；底部自由输入；科举面板、身份面板、考试弹窗和折叠式放榜详情。

## 修复与质量保障

- 状态边界：所有 AI `statePatch` 都经过白名单和数值 clamp，不能直接覆盖完整世界状态。
- 派系安全：`statePatch.factions` 只能更新已存在的数值派系键，不能注入任意派系。
- 时间推进权责：真实/Mock provider 不能修改 `year/month`，日历推进由服务器 `worldTick` 独占。
- 科期权责：provider 不能 patch `examCalendar`；考期窗口、错过记录、持久同场和同年联系人都由服务器裁定。
- 长期事件、角色联动与官场权责：provider 不能 patch `activeNpcRequest`、`longTermEvents`、`roleWorldCoupling` 或 `officialCareer`；长期事件调度、身份行动的世界后果、官场授官/升降/弹劾/罢黜、冷却、跨月结算和关系后果都由服务器裁定。
- 回合计数：provider patch 与服务器 tick 同回合应用时，`turnCount` 只增加一次。
- 开局身份边界：`/api/game/start` 显式校验 `role`，只允许 `scholar`、`emperor`、`minister`、`general`、`magistrate`、`official`。
- 旧存档兼容：读取旧 session 时会补齐并规范化关系账本。
- 科举反作弊：本地检查短文、现代词、疑似照抄经典片段和代笔概率；严重作伪会强制落第、降档并扣减声望与心性。
- AI 输出质量门槛：`npm run eval:ai` 覆盖 provider-shaped JSON、越权风险、历史语气、评分边界和本地作弊处罚。
- 自动化测试：`npm test` 使用 Node.js 内置测试运行器，目前覆盖状态边界、开局 role 校验、JSON session、AI schema、科举门槛、晋级/作弊后果、同场考生档案、赶考准备、月度 tick、长期事件调度、角色世界联动、关系账本、关系 UI、主动 NPC 请托循环、官场结果结算、地方官、将领、入仕官员回合、真实 provider smoke/long-run 脚本选择逻辑、provider 流式 SSE 安全边界、浏览器 smoke 脚本参数解析和 DOM/截图级 UI 验收。

## 技术栈

- 前端：原生 HTML、CSS、JavaScript，无构建步骤。
- 后端：Node.js + Express。
- AI 适配器：Mock、OpenAI、DeepSeek、Claude/Anthropic。
- AI JSON 校验：Ajv schema + 本地 JSON 解析/重试/降级。
- 流式响应：Server-Sent Events。
- 存储：本地 JSON session 文件，位于 `data/sessions/`；S38.2 已实行 JSON schema envelope、legacy 迁移、原子写入、同 session 串行化、revision 和存档列表 API，数据库迁移仍按计划后续推进。
- 测试：Node.js `node --test`。
- 浏览器验收：`playwright-core` + 本机 Chrome/Edge。
- 配置：`dotenv` + `.env`。

## 快速启动

需要 Node.js 18+。

```bash
npm install
npm start
```

打开：

```text
http://localhost:3000
```

开发时可使用自动重启：

```bash
npm run dev
```

运行测试：

```bash
npm test
```

运行离线 AI 输出评估：

```bash
npm run eval:ai
```

运行本地浏览器 smoke：

```bash
npm run smoke:browser
npm run smoke:browser -- --url http://localhost:3000
npm run smoke:browser -- --screenshots artifacts/browser-smoke
```

`smoke:browser` 使用本机 Chrome 或 Edge。默认会启动临时 Mock 服务器，创建书生 session，验证 `localStorage` 存档恢复、桌面/移动布局、行动输入区、人脉簿关系面板、来函请托面板、官场履历面板、考试弹窗、四级科举通关至入仕、照抄经典作弊黜落样例、放榜详情、考试档案、直接官员开局回合，以及地方官/将领/皇帝/大臣的 S36 角色世界联动代表回合，并清理临时 session 文件。S38.1 之后，`--url` 模式用于同一仓库工作目录中已启动的本地服务器，因为完整科举旅程会直接准备 `data/sessions/` 下的 Mock session。

有真实模型 key 的环境可运行可选 provider smoke：

```bash
npm run smoke:provider
npm run smoke:provider -- --provider openai
npm run smoke:provider -- --stream --provider openai
npm run smoke:provider:long
npm run smoke:provider:long -- --stream --provider anthropic
```

`smoke:provider` 会直接调用真实 provider 适配器的 start、turn、question、submit/grade 四类方法，不走 Mock fallback，也不写入 `data/sessions/`。没有 key 时会跳过并以成功状态退出。
`smoke:provider:long` 是 S37 keyed 长回合验收脚本，会跑多回合书生场景、检查历史语气、普通回合越权、状态一致性和可选 `streamTurn()` 稳定性；没有 key 时同样跳过成功。

## 配置

复制 `.env.example` 为 `.env`，按需填写：

```text
PORT=3000
AI_PROVIDER=mock
AI_PROVIDER_TIMEOUT_MS=30000
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
OPENAI_BASE_URL=
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-5
```

`AI_PROVIDER` 可选：

- `mock`：默认模式，无需 key，完整可玩。
- `openai`：使用 `openai` SDK Responses API。
- `deepseek`：使用 OpenAI-compatible chat completions。
- `claude` 或 `anthropic`：使用 `@anthropic-ai/sdk` Messages API。

真实 provider 普通 JSON 调用失败、超时或 JSON/schema 不合格时，会重试一次并按方法降级到 Mock。SSE token streaming 路径会先抽取可见叙事，但状态仍只在完整 JSON 通过 schema 后落盘；如果已经向浏览器发送过真实 provider 叙事后校验失败，路由会返回 `error` 事件并保持 session 不变。

## API 概览

```text
GET  /api/health
POST /api/game/start
GET  /api/game/saves
GET  /api/game/state/:sessionId
POST /api/game/turn
POST /api/exam/question
POST /api/exam/submit
```

`POST /api/game/start` 会校验 `role`，目前允许 `scholar`、`emperor`、`minister`、`general`、`magistrate`、`official`；浏览器开局下拉也暴露这六种身份。缺省或空 role 会按 `scholar` 开局，未知 role 返回 400。

`GET /api/game/saves` 返回本地存档列表的脱敏 metadata，包括 `sessionId`、角色、朝代年月、回合数、科名、官职、更新时间和 storage revision，不返回完整 `worldState`、关系账本、隐藏关系或 provider 配置。

当前第三阶段开发载荷会从游戏与考试路由返回顶层 `examCalendarView`、`examRivalView`、`relationshipView`、`activeNpcRequestView`、`roleWorldCouplingView`、`longTermEventView` 和 `officialCareerView`。`examCalendarView` 展示下一场科期、备考/路程、盘费、师长推荐和错过记录；`examRivalView` 展示持久同场竞争者与同年线索。`relationshipView` 是从服务器自有 `relationshipLedger` 派生出的玩家联系人/派系检查视图，会过滤隐藏关系的 id、名称、数量、占位行和隐藏对象笔记；浏览器已在书生/身份面板中渲染 `人脉簿`，展示可见联系人/派系的关系、怨望、立场、来源、近期意图和最近变化。`activeNpcRequestView` 是服务器调度的当前来函/请托视图，只能指向可见关系目标；普通回合还会返回 `activeNpcRequestEvents`，用于把主动请托的安排、回应或逾期反馈加入叙事流。`roleWorldCouplingView` 是服务器角色世界联动的近期影响摘要；普通回合还会返回 `roleWorldCoupling`，浏览器以 `[联动]` 叙事反馈展示身份行动对粮储、民心、边患、军费、派系和关系的复合后果。`longTermEventView` 是服务器长期事件队列的玩家可见摘要；普通回合还会返回 `longTermEvents`，浏览器以 `[大势]` 叙事反馈展示调度、结算和跨月后果。`officialCareerView` 是服务器官场履历摘要；普通回合还会返回 `officialCareer`，浏览器以 `[官场结算]` 展示实授、升降、弹劾、罚黜或留任。

`POST /api/game/turn` 支持 SSE。客户端发送 `Accept: text/event-stream` 或 `?stream=1` 时，会收到：

- `state_preview`
- `narrative_chunk`
- `final_state`
- `error`

未请求 SSE 的脚本仍会收到普通 JSON，便于测试和兼容旧调用。

## 项目结构

```text
server.js
public/
  index.html
  styles.css
  app.js
src/
  ai/
    index.js
    prompts.js
    schemas.js
    providers/
  config/
  game/
    candidates.js
    examTravel.js
    examCalendar.js
    essayChecks.js
    exams.js
    initialState.js
    activeRequests.js
    longTermEvents.js
    officialCareer.js
    roleWorldCoupling.js
    promotions.js
    relationships.js
    stateRules.js
    worldTick.js
  routes/
  storage/
  utils/
test/
docs/
data/sessions/
```

## 重要文档

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)：当前架构、API、状态模型和验证要求。
- [docs/SHARED_CONTEXT.md](docs/SHARED_CONTEXT.md)：Codex 与 Claude Code 共享交接板。
- [docs/QIANQIU_DEVELOPMENT_BRIEF.md](docs/QIANQIU_DEVELOPMENT_BRIEF.md)：产品目标、数据契约和交付标准。
- [docs/DEVELOPMENT_STEPS.md](docs/DEVELOPMENT_STEPS.md)：当前活动路线图与进度台账。
- [docs/MANUAL_ACCEPTANCE.md](docs/MANUAL_ACCEPTANCE.md)：人工端到端验收脚本。
- [docs/BROWSER_ACCEPTANCE.md](docs/BROWSER_ACCEPTANCE.md)：浏览器自动验收覆盖、最近结果和人工 fallback。
- [docs/REAL_PROVIDER_ACCEPTANCE.md](docs/REAL_PROVIDER_ACCEPTANCE.md)：真实 provider keyed 长回合验收方案、矩阵和脚本说明。
- [docs/SESSION_STORAGE_MIGRATION_PLAN.md](docs/SESSION_STORAGE_MIGRATION_PLAN.md)：S38.2 JSON 存档 schema envelope、原子写入、并发保护、存档列表、清理和数据库迁移路径。
- [docs/LONG_TERM_EVENTS_CONTRACT.md](docs/LONG_TERM_EVENTS_CONTRACT.md)：长期事件调度器的状态、路由顺序和边界契约。
- [docs/OFFICIAL_CAREER_CONTRACT.md](docs/OFFICIAL_CAREER_CONTRACT.md)：官场结果引擎的状态、结算规则、路由顺序和浏览器契约。
- [docs/EXAM_CALENDAR_CONTRACT.md](docs/EXAM_CALENDAR_CONTRACT.md)：科举日历、错过考期、赶考准备和持久同场竞争者契约。
- [docs/ROLE_WORLD_COUPLING_CONTRACT.md](docs/ROLE_WORLD_COUPLING_CONTRACT.md)：角色行动如何在月度 tick 前转成世界状态、关系和叙事反馈。
- [docs/PHASE_ONE_ACCEPTANCE.md](docs/PHASE_ONE_ACCEPTANCE.md)：第一阶段验收记录。
- [docs/PHASE_TWO_ACCEPTANCE.md](docs/PHASE_TWO_ACCEPTANCE.md)：第二阶段验收记录、已知限制和后续候选。
- [docs/PHASE_TWO_ROADMAP_ARCHIVE.md](docs/PHASE_TWO_ROADMAP_ARCHIVE.md)：第二阶段路线图归档。

## 当前状态

项目已完成第一阶段可玩纵切，并完成第二阶段“可持续模拟”本地验收。第二阶段已经包含世界 tick、关系账本、地方官深度、将领深度、入仕官员深度、科举深度、真实 provider smoke、真实 provider turn token streaming、离线 AI 输出 eval fixtures、本地浏览器 smoke、DOM/截图级 UI 验收、浏览器验收记录和第二阶段验收记录。第三阶段已推进到 S38.2，关系 UI、服务器调度的主动 NPC 请托最小循环、服务器拥有的长期事件调度器、官场结果引擎、科举日历、持久同场竞争者、角色世界联动、keyed provider 长回合验收脚本、完整浏览器旅程验收和 JSON 存档硬化已经落地。

已知限制：

- 真实 provider 网络调用在无 key 环境不会执行，只能通过可选 smoke 在有 key 时验证。
- 浏览器 smoke 覆盖完整四级科举通关、作弊样例和代表性身份一回合；仍不等同于全部身份长线游玩。
- 长期事件、官场结果、科举日历和角色/世界深耦合目前是确定性的最小规则集；JSON 存储已经硬化，SQLite/托管数据库迁移和浏览器存档列表 UI 仍待后续实现。
