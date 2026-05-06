# 千秋 / Qianqiu

千秋是一款浏览器 + Node.js 历史模拟文字游戏。玩家以书生、皇帝、大臣、将领、地方官、入仕官员等身份进入古代中国历史情境，用自由文本行动推动个人命运和王朝局势。

AI 负责叙事、出题、评卷和角色反馈；服务器负责状态边界、晋级规则、反作弊、持久化和最终裁定。默认使用 Mock AI，无需 API Key 即可本地游玩。

## 主要更新

- 完整书生科举主线：书生可以从日常读书、拜师、游学、辩经、谋生一路进入童试、乡试、会试、殿试，最终成为入仕官员。
- 科举深度：同场虚拟考生现在有可回看的文章、风格、考官短评和优劣点；考试入场会产生服务器拥有的赶考盘费、旅途事件和疲劳/心性风险；前端可通过考试档案回看历次题目、本人文章、复核、榜单和同场文卷。
- 世界月度 tick：每次自由行动后，服务器推进一个游戏月份，并自然更新府库、粮储、人口、民心、贪腐、军心、边患和派系走势。
- NPC/派系记忆：新增 `relationshipLedger`，记录人物与派系的关系、怨望、立场、近期意图和可见性。AI 只能提出关系变化建议，最终仍由服务器合并。
- SSE 回合流式响应：`POST /api/game/turn` 支持 `text/event-stream`；真实 provider 支持时会从结构化 JSON token 流中抽取 `narrative` 提前发送，Mock 或不支持流式的 provider 仍使用兼容分块输出。
- 地方官身份循环：新增县库、地方民心、乡绅、盗匪、词讼、赋役、水利等地方状态，支持审案、钱粮、安抚乡绅、捕盗、徭役和兴修水利。
- 将领身份循环：新增统率、部曲、军粮、战名、侦察、战险等军中状态，支持募兵、粮饷、操练、侦察、守边和出战。
- 入仕官员身份循环：新增上官、同年、考成、升迁、弹劾风险、清操等官场状态，支持观政、考成、同年经营、弹劾贪墨、断案抚民和贪墨风险。
- 皇帝、大臣基础循环：支持赈灾、用人、筹饷、整军、廷议、上疏、督办、人脉经营和弹劾攻讦。
- 前端体验：宣纸、墨色、朱砂、青玉风格；移动端单列布局；底部自由输入；科举面板、身份面板、考试弹窗和折叠式放榜详情。

## 修复与质量保障

- 修复/强化状态边界：所有 AI `statePatch` 都经过白名单和数值 clamp，不能直接覆盖完整世界状态。
- 修复派系 patch 风险：`statePatch.factions` 只能更新已存在的数值派系键，不能注入任意派系。
- 修复时间推进权责：真实/Mock provider 不能修改 `year/month`，日历推进由服务器 `worldTick` 独占。
- 修复回合计数：provider patch 与服务器 tick 同回合应用时，`turnCount` 只增加一次。
- 修复旧存档兼容：读取旧 session 时会补齐并规范化关系账本。
- 反作弊：本地检查短文、现代词、疑似照抄经典片段和代笔概率；严重作伪会强制落第、降档并扣减声望与心性。
- 自动化测试：`npm test` 使用 Node.js 内置测试运行器，目前覆盖 84 项，包括状态边界、JSON session、AI schema、AI 输出 eval fixtures、科举门槛、晋级/作弊后果、同场考生档案、赶考准备、月度 tick、关系账本、地方官、将领、入仕官员回合、真实 provider smoke 脚本选择逻辑、provider 流式 SSE 安全边界和浏览器 smoke 脚本参数解析。

## 技术栈

- 前端：原生 HTML、CSS、JavaScript，无构建步骤。
- 后端：Node.js + Express。
- AI 适配器：Mock、OpenAI、DeepSeek、Claude/Anthropic。
- AI JSON 校验：Ajv schema + 本地 JSON 解析/重试/降级。
- 流式响应：Server-Sent Events。
- 存储：本地 JSON session 文件，位于 `data/sessions/`。
- 测试：Node.js `node --test`；浏览器 smoke 使用 `playwright-core` 和本机 Chrome/Edge。
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

Run the no-network AI output fixture gate:
```bash
npm run eval:ai
```

Run the local browser smoke acceptance:
```bash
npm run smoke:browser
npm run smoke:browser -- --url http://localhost:3000
npm run smoke:browser -- --screenshots artifacts/browser-smoke
```

`smoke:browser` uses `playwright-core` with an installed Chrome or Edge browser. By default it starts a temporary Mock-mode server on a free local port, loads the page, creates a scholar session, verifies `qianqiu.sessionId` in `localStorage`, runs desktop/mobile UI acceptance for the game layout, action input, exam modal, result sections, and exam archive, reloads and opens a fresh page to confirm session restoration, and removes the smoke session file. Use `BROWSER_EXECUTABLE_PATH` or `--browser <path>` if Chrome/Edge is installed somewhere non-standard; use `--url` when you want to test an already running server. Pass `--screenshots <dir>` to save the screenshots that the smoke already captures and validates.

有真实模型 key 的环境可运行可选 smoke：

```bash
npm run smoke:provider
npm run smoke:provider -- --provider openai
npm run smoke:provider -- --stream --provider openai
```

`smoke:provider` 会直接调用真实 provider 适配器的 start、turn、question、submit/grade 四类方法，不走 Mock fallback，也不写入 `data/sessions/`。默认 `AI_PROVIDER=mock` 时，它只运行当前环境中已经配置 key 的 provider；没有 key 时会跳过并以成功状态退出。加 `--stream` 时还会验证该 provider 的 turn token streaming 路径。

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

- `mock`：默认模式，无需 Key，完整可玩。
- `openai`：使用 `openai` SDK Responses API。
- `deepseek`：使用 OpenAI-compatible chat completions。
- `claude` 或 `anthropic`：使用 `@anthropic-ai/sdk` Messages API。

真实 provider 普通 JSON 调用失败、超时或 JSON/schema 不合格时，会重试一次并按方法降级到 Mock。SSE token streaming 路径会先抽取可见叙事，但状态仍只在完整 JSON 通过 schema 后落盘；如果已经向浏览器发送过真实 provider 叙事后校验失败，路由会返回 `error` 事件并保持 session 不变，避免把不可信状态写入存档。无论 provider 如何输出，状态合并、数值边界、科举晋级、作弊处罚和保存都由服务器执行。

## API 概览

```text
GET  /api/health
POST /api/game/start
GET  /api/game/state/:sessionId
POST /api/game/turn
POST /api/exam/question
POST /api/exam/submit
```

`POST /api/game/turn` 支持 SSE。客户端发送 `Accept: text/event-stream` 或 `?stream=1` 时，会收到：

- `state_preview`
- `narrative_chunk`
- `final_state`
- `error`

真实 provider 支持 turn streaming 时，`narrative_chunk` 来自服务端对模型结构化 JSON token 流中 `narrative` 字段的安全抽取；Mock 或不支持流式的 provider 会在完整结果返回后按现有兼容逻辑分块。未请求 SSE 的脚本仍会收到普通 JSON，便于测试和兼容旧调用。

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
    essayChecks.js
    exams.js
    initialState.js
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
- [docs/DEVELOPMENT_STEPS.md](docs/DEVELOPMENT_STEPS.md)：第二阶段路线图与进度台账。
- [docs/SHARED_CONTEXT.md](docs/SHARED_CONTEXT.md)：Codex 与 Claude Code 共享交接板。
- [docs/QIANQIU_DEVELOPMENT_BRIEF.md](docs/QIANQIU_DEVELOPMENT_BRIEF.md)：产品目标、数据契约和交付标准。
- [docs/MANUAL_ACCEPTANCE.md](docs/MANUAL_ACCEPTANCE.md)：人工端到端验收脚本。
- [docs/PHASE_ONE_ACCEPTANCE.md](docs/PHASE_ONE_ACCEPTANCE.md)：第一阶段验收记录。

## 当前状态

项目已完成第一阶段可玩纵切，并进入第二阶段“可持续模拟”开发。当前已实现世界 tick、关系账本、地方官深度、将领深度、入仕官员深度、科举深度、真实 provider smoke、真实 provider turn token streaming、离线 AI 输出 eval fixtures 和本地浏览器 smoke 验收。下一步计划是扩展 DOM/截图级 UI 验收。
