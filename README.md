# 千秋 / Qianqiu

千秋是一款浏览器 + Node.js 历史模拟文字游戏。玩家以书生、皇帝、大臣、将领、地方官、入仕官员等身份进入古代中国历史情境，用自由文本行动推动个人命运、科举功名、官场沉浮和王朝局势。

AI 负责叙事、出题、评卷和角色反馈；服务器负责状态边界、晋级规则、反作弊、长期事件、官场裁决、存档和最终裁定。默认使用 Mock AI，无需 API Key 即可本地游玩。

## 当前进度

项目已经完成第一阶段可玩纵切、第二阶段本地验收，并推进完第三阶段 S31-S39.1 的主要硬化与体验扩展。

当前重点成果：

- 完整书生主线：书生可以从日常读书、拜师、游学、辩经、谋生进入童试、乡试、会试、殿试，最终成为入仕官员。
- 多身份玩法：支持书生、皇帝、大臣、将领、地方官、入仕官员开局与代表性行动循环。
- 长期模拟骨架：世界月度 tick、关系账本、主动 NPC 请托、长期事件、官场结果、科举日历、角色世界联动已经接入。
- 本地存档簿：JSON session envelope、legacy 迁移、原子写入、revision、轻量 lock、存档列表 API 和浏览器存档簿已经落地。
- 第三阶段审查硬化：S39.1 修复了 CORS、考试触发、SSE、隐藏关系、冷却、初始年份和存储 revision 等安全/一致性问题。

完整路线图见 [docs/DEVELOPMENT_STEPS.md](docs/DEVELOPMENT_STEPS.md)。

## 第三阶段主要更新

- S31 地基修复：修复桌面游戏态过窄布局；普通回合 provider 不能 patch `activeExam`、`eventHistory`、考试名位等服务器独占字段；开局 `role` 显式校验。
- S32 关系与主动 NPC：新增玩家可见的 `relationshipView` 人脉簿；隐藏关系不泄露；服务器调度 `activeNpcRequest` 来函、请托、施压和回应后果。
- S33 长期事件：新增服务器拥有的 `longTermEvents` 队列，把季节、灾荒、边报、廷争、地方案链和跨月后果接入月度推演。
- S34 官场结果：新增 `officialCareer` 引擎，入仕官员会出现实授、转任、升迁、外放、降调、弹劾成案、罚黜或留任。
- S35 科举日历：新增服务器拥有的 `examCalendar`，考试需要通过考期窗口、备考月程、路程、盘费和师长推荐等条件；同场考生以 `rival-*` 持久化。
- S36 角色世界联动：地方官水利、将领战役、皇帝任免、大臣弹劾等身份行动会在月度 tick 前影响粮储、民心、边患、军费、派系和关系。
- S37 真实 provider 长回合验收：新增 keyed provider long-run smoke，检查历史语气、越权边界、状态一致性和可选 streaming 稳定性；无 key 环境成功跳过。
- S38 浏览器与存档验收：浏览器 smoke 覆盖完整四级科举通关、作弊样例、代表身份回合、桌面/移动 UI、存档簿载入和截图检查。
- S39.1 审查硬化：默认 CORS 不再 wildcard；普通回合 `examTrigger` 必须通过服务器考试门禁；SSE 只抽顶层 `narrative`，失败流式文本会回滚；隐藏关系 notes、角色联动 cooldown、初始年份和 JSON revision 都完成加固。

## 修复与安全边界

- 状态边界：所有 AI `statePatch` 都经过 Ajv schema、白名单和数值 clamp，不能直接覆盖完整世界状态。
- 科举权责：考试资格、考期窗口、取题、晋级、殿试入仕和严重作弊惩罚都由服务器裁定。
- 自由赶考：普通回合的 `examTrigger` 只是一项请求。服务器会检查 `canEnterExam()` 与考期窗口，并保护未交卷考试不被覆盖。
- 流式安全：真实 provider SSE 会先显示顶层 `narrative`，但状态只在完整 JSON 通过校验后落盘；若 stream 后续失败，浏览器移除未提交的临时文本。
- 隐藏信息：玩家可见视图和 prompt summary 会过滤隐藏联系人、隐藏派系和隐藏关系笔记。
- CORS：默认只允许无 `Origin` 请求和当前 `PORT` 对应的本机应用 Origin；额外调试 Origin 必须通过 `CORS_ALLOWED_ORIGINS` 显式配置。
- 存储一致性：JSON session 使用 envelope、atomic temp rename、revision 检查、同 session 队列和本地 `.lock` 文件；SQLite/数据库迁移仍是后续方向。
- 反作弊：本地检查短文、现代词、疑似照抄经典片段和代笔概率；严重作伪会强制落第、降档并扣减声望与心性。

## 技术栈

- 前端：原生 HTML、CSS、JavaScript，无构建步骤。
- 后端：Node.js + Express。
- AI 适配器：Mock、OpenAI、DeepSeek、Claude/Anthropic。
- AI JSON 校验：Ajv schema + 本地 JSON 解析、重试和降级。
- 流式响应：Server-Sent Events。
- 存储：本地 JSON session files under `data/sessions/`，带 schema envelope、metadata、revision、atomic write、lock 和 save-list API。
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

开发时可用自动重启：

```bash
npm run dev
```

## 配置

复制 `.env.example` 为 `.env`，按需填写：

```text
PORT=3000
CORS_ALLOWED_ORIGINS=
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
- `openai`：使用 OpenAI SDK Responses API。
- `deepseek`：使用 OpenAI-compatible chat completions。
- `claude` 或 `anthropic`：使用 Anthropic Messages API。

`CORS_ALLOWED_ORIGINS` 是逗号分隔的额外允许 Origin，例如 `http://localhost:5173`。默认不要配置 `*`。

## 常用命令

```bash
npm test
npm run eval:ai
npm run smoke:browser
npm run smoke:provider
npm run smoke:provider:long
```

说明：

- `npm test` 使用 Node.js 内置测试，覆盖状态边界、AI schema、科举、关系、长期事件、官场结果、角色联动、存储、SSE 和脚本逻辑。
- `npm run eval:ai` 是离线 AI 输出质量门槛，覆盖 provider-shaped JSON、越权风险、历史语气、评分边界和本地作弊处罚。
- `npm run smoke:browser` 默认启动临时 Mock 服务器，覆盖完整书生到入仕路径、作弊样例、代表身份回合、失败 SSE 回滚、存档簿和桌面/移动布局。
- `npm run smoke:provider` 与 `npm run smoke:provider:long` 只在配置真实 provider key 时进行网络调用；无 key 时会成功跳过。

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

核心约定：

- `POST /api/game/start` 校验 `role`，允许 `scholar`、`emperor`、`minister`、`general`、`magistrate`、`official`。
- `GET /api/game/saves` 返回脱敏 metadata，不返回完整 `worldState`、关系账本、隐藏关系或 provider 配置。
- `POST /api/game/turn` 支持普通 JSON 与 SSE。SSE 事件包括 `state_preview`、`narrative_chunk`、`final_state`、`error`。
- 游戏与考试路由会返回 `examCalendarView`、`examRivalView`、`relationshipView`、`activeNpcRequestView`、`roleWorldCouplingView`、`longTermEventView`、`officialCareerView` 等第三阶段视图。

## 项目结构

```text
server.js
public/
  index.html
  styles.css
  app.js
src/
  ai/
  config/
  game/
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
- [docs/DEVELOPMENT_STEPS.md](docs/DEVELOPMENT_STEPS.md)：第三阶段路线图与进度台账。
- [docs/BROWSER_ACCEPTANCE.md](docs/BROWSER_ACCEPTANCE.md)：浏览器自动验收覆盖和最近结果。
- [docs/REAL_PROVIDER_ACCEPTANCE.md](docs/REAL_PROVIDER_ACCEPTANCE.md)：真实 provider keyed 长回合验收方案。
- [docs/SESSION_STORAGE_MIGRATION_PLAN.md](docs/SESSION_STORAGE_MIGRATION_PLAN.md)：JSON 存档硬化和数据库迁移路径。
- [docs/LONG_TERM_EVENTS_CONTRACT.md](docs/LONG_TERM_EVENTS_CONTRACT.md)：长期事件调度器契约。
- [docs/OFFICIAL_CAREER_CONTRACT.md](docs/OFFICIAL_CAREER_CONTRACT.md)：官场结果引擎契约。
- [docs/EXAM_CALENDAR_CONTRACT.md](docs/EXAM_CALENDAR_CONTRACT.md)：科举日历与持久同场契约。
- [docs/ROLE_WORLD_COUPLING_CONTRACT.md](docs/ROLE_WORLD_COUPLING_CONTRACT.md)：身份行动与世界联动契约。
- [docs/PRE_PHASE_CODEBASE_REVIEW_2026-05-06.md](docs/PRE_PHASE_CODEBASE_REVIEW_2026-05-06.md)：第三阶段后续硬化前的代码审查记录。

## 已知限制

- 真实 provider 网络调用需要配置 API key；无 key 环境只验证 Mock 和 no-key skip。
- 浏览器 smoke 覆盖完整主线和代表身份回合，但不等同于所有身份的长线游玩验收。
- 长期事件、官场结果、科举日历和角色世界联动仍是确定性最小规则集，后续可继续扩展。
- 当前存储仍是本地 JSON。虽然已有 envelope、revision、atomic write 和 lock，SQLite 或数据库适配器仍是下一阶段更稳的持久化方向。
