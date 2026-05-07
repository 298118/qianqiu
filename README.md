# 千秋 / Qianqiu

千秋是一款浏览器 + Node.js 历史模拟文字游戏。玩家以书生、皇帝、大臣、将领、地方官、入仕官员等身份进入古代中国历史情境，用自由文本行动推动个人命运、科举功名、官场沉浮和王朝局势。

AI 负责叙事、出题、评卷和角色反馈；服务器负责状态边界、晋级规则、反作弊、长期事件、官场裁决、存档和最终裁定。默认使用 Mock AI，无需 API Key 即可本地游玩。

## 当前进度

项目已经完成第一阶段可玩纵切、第二阶段本地验收、第三阶段 S31-S39.1 的主要硬化与体验扩展，以及第四阶段 S40-S47.2 的 AI 连接、提示词、官场、世界议程、AI 权限、多实体世界、依赖治理和 provider/browser 验收扩展。当前活动路线图已切到 S48 时间专项：把普通自由行动从一回合一月调整为一回合一旬，并为考试等密集场景设计局部时间。

当前重点成果：

- 完整书生主线：书生可以从日常读书、拜师、游学、辩经、谋生进入童试、乡试、会试、殿试，最终成为入仕官员。
- 多身份玩法：支持书生、皇帝、大臣、将领、地方官、入仕官员开局与代表性行动循环。
- 长期模拟骨架：世界 tick、关系账本、主动 NPC 请托、长期事件、官场结果、科举日历、角色世界联动、World Entities 多实体模型和 World Threads 世界议程索引已经接入；S48 将把全局时间从月度回合改造为旬制回合，并保留月末大结算。
- 本地存档簿：JSON session envelope、legacy 迁移、原子写入、revision、轻量 lock、存档列表 API 和浏览器存档簿已经落地。
- 第三阶段审查硬化：S39.1 修复了 CORS、考试触发、SSE、隐藏关系、冷却、初始年份和存储 revision 等安全/一致性问题。
- AI 连接校验：开局页新增“AI 连接”面板，`POST /api/ai/connection-test` 可不落盘检查当前 provider、模型配置、streaming 能力和脱敏错误。

完整路线图见 [docs/DEVELOPMENT_STEPS.md](docs/DEVELOPMENT_STEPS.md)。

## 第三阶段主要成果

- S31 地基修复：修复桌面游戏态过窄布局；普通回合 provider 不能 patch `activeExam`、`eventHistory`、考试名位等服务器独占字段；开局 `role` 显式校验。
- S32 关系与主动 NPC：新增玩家可见的 `relationshipView` 人脉簿；隐藏关系不泄露；服务器调度 `activeNpcRequest` 来函、请托、施压和回应后果。
- S33 长期事件：新增服务器拥有的 `longTermEvents` 队列，把季节、灾荒、边报、廷争、地方案链和跨月后果接入月度推演。
- S34 官场结果：新增 `officialCareer` 引擎，入仕官员会出现实授、转任、升迁、外放、降调、弹劾成案、罚黜或留任。
- S35 科举日历：新增服务器拥有的 `examCalendar`，考试需要通过考期窗口、备考月程、路程、盘费和师长推荐等条件；同场考生以 `rival-*` 持久化。
- S36 角色世界联动：地方官水利、将领战役、皇帝任免、大臣弹劾等身份行动会在月度 tick 前影响粮储、民心、边患、军费、派系和关系。
- S37 真实 provider 长回合验收：新增 keyed provider long-run smoke，检查历史语气、越权边界、状态一致性和可选 streaming 稳定性；无 key 环境成功跳过。
- S38 浏览器与存档验收：浏览器 smoke 覆盖完整四级科举通关、作弊样例、代表身份回合、桌面/移动 UI、存档簿载入和截图检查。
- S39.1 审查硬化：默认 CORS 不再 wildcard；普通回合 `examTrigger` 必须通过服务器考试门禁；SSE 只抽顶层 `narrative`，失败流式文本会回滚；隐藏关系 notes、角色联动 cooldown、初始年份和 JSON revision 都完成加固。

## 第四阶段已完成成果

- AI 提示词：把世界引擎、科举考官、出题官、官场、地方、军事、皇帝/大臣等提示词整理为可测试 prompt pack，兼顾古意、可读性、JSON 严格性和服务器边界。
- 官场深度：S42.1 已定义深度官场契约，S42.2 已接入静态官职/衙门目录、差事推进、考成卷宗、弹劾流程和官职伪造过滤，S42.3 已把官署、差事、考成、关系、风险和履历档案渲染进浏览器官场面板并纳入 smoke 验收。
- 世界议程：S43.2 已把服务器拥有的 `worldThreads` 聚合层接入浏览器“世界议程”面板；主动 NPC、长期事件、官场差遣/结果、身份联动、地方压力、边事、派系斗争和高压世界实体会显示目标、期限、风险、牵连对象、介入提示和近归档余波。
- AI 权限审查：S44.1 已新增 [AI 调动与控制审查矩阵](docs/AI_CONTROL_AUDIT_MATRIX.md)，逐项固定哪些系统适合 AI 生成、建议、解释或排序，哪些必须由服务器裁决；S44.2 已补混合越权、官职幻觉、科举评分冲突、隐藏 token、流式失败和错误脱敏的 red-team/eval 基线。
- 多实体世界：S45.2 已在 [多实体世界模型契约](docs/WORLD_ENTITIES_CONTRACT.md) 和 `worldEntities` 账本上接入服务器来源影响；AI 允许的状态变化、世界 tick、主动 NPC/关系、长期事件、身份联动和官场结果会通过 server-owned helper 调整实体压力，并让 World Threads 读取可见实体摘要。
- 依赖与插件：S46.1 已新增 [依赖、插件与开源参考治理](docs/DEPENDENCY_PLUGIN_GOVERNANCE.md)，后续新增依赖、插件或开源参考必须记录用途、许可证、替代方案、测试、文档落点和回滚策略。

第四阶段完整路线图已归档到 [docs/PHASE_FOUR_ROADMAP_ARCHIVE.md](docs/PHASE_FOUR_ROADMAP_ARCHIVE.md)。

## 时间专项规划重点

- 全局旬制：普通自由行动默认每回合推进一旬，按“上旬 -> 中旬 -> 下旬 -> 下月上旬”推进，三回合才进入下一个月。
- 月末结算：世界自然漂移、长期事件月份递减、季节性事件、官场任内月份和考成周期等原月度系统，默认只在下旬进入下月上旬时完整结算；非月末旬只做轻量小结。
- 场景内时间：考试、廷议、堂审、战斗、旅途遭遇和重大差事收束等密集场景应使用局部阶段，不能把每次输入都硬解释为十天。
- 科举优先：考试将优先拆成入场、发题/审题、拟纲、作答、誊清、交卷等局部阶段；开题、拟纲、作答不推进全局旬，交卷后仍保持完整评分、榜单、晋级和考试档案。
- 日期展示：玩家可见日期统一向“年月旬”靠拢，例如“崇祯十七年八月上旬”；存档、状态栏、考试说明和回合反馈都要同步。

## 修复与安全边界

- 状态边界：所有 AI `statePatch` 都经过 Ajv schema、白名单和数值 clamp，不能直接覆盖完整世界状态。
- 科举权责：考试资格、考期窗口、取题、晋级、殿试入仕和严重作弊惩罚都由服务器裁定。
- 自由赶考：普通回合的 `examTrigger` 只是一项请求。服务器会检查 `canEnterExam()` 与考期窗口，并保护未交卷考试不被覆盖。
- 流式安全：真实 provider SSE 会先显示顶层 `narrative`，但状态只在完整 JSON 通过校验后落盘；若 stream 后续失败，浏览器移除未提交的临时文本。
- 错误脱敏：AI 连接诊断和 SSE provider 错误会遮蔽已配置密钥及长片段，避免把本地 key 带到玩家可见错误里。
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
DEEPSEEK_OPENING_MODEL=deepseek-v4-pro
DEEPSEEK_TURN_MODEL=deepseek-v4-flash
DEEPSEEK_EXAM_QUESTION_MODEL=deepseek-v4-flash
DEEPSEEK_GRADE_MODEL=deepseek-v4-pro
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-5
```

`AI_PROVIDER` 可选：

- `mock`：默认模式，无需 key，完整可玩。
- `openai`：使用 OpenAI SDK Responses API。
- `deepseek`：使用 OpenAI-compatible chat completions。默认 `DEEPSEEK_MODEL` 是兜底模型；可用 `DEEPSEEK_OPENING_MODEL`、`DEEPSEEK_TURN_MODEL`、`DEEPSEEK_EXAM_QUESTION_MODEL`、`DEEPSEEK_GRADE_MODEL` 按任务覆盖。推荐策略是开局和科举评卷走 `deepseek-v4-pro`，普通回合/流式叙事和出题走 `deepseek-v4-flash`。
- `claude` 或 `anthropic`：使用 Anthropic Messages API。

`CORS_ALLOWED_ORIGINS` 是逗号分隔的额外允许 Origin，例如 `http://localhost:5173`。默认不要配置 `*`。

## 常用命令

```bash
npm test
npm run eval:ai
npm run smoke:browser
npm run smoke:provider
npm run smoke:provider:route
npm run smoke:provider:long
```

说明：

- `npm test` 使用 Node.js 内置测试，覆盖状态边界、AI schema、科举、关系、长期事件、官场结果、角色联动、存储、SSE 和脚本逻辑。
- `npm run eval:ai` 是离线 AI 输出质量门槛，覆盖 provider-shaped JSON、越权风险、历史语气、评分边界和本地作弊处罚。
- `npm run smoke:browser` 默认启动临时 Mock 服务器，覆盖完整书生到入仕路径、作弊样例、代表身份回合、官场差事面板、失败 SSE 回滚、存档簿和桌面/移动布局；`npm run smoke:browser -- --check-ai-connection` 还会点击开局页“AI 连接”按钮并断言 Mock 诊断不写 session。
- `npm run smoke:provider`、`npm run smoke:provider:route` 与 `npm run smoke:provider:long` 只在配置真实 provider key 时进行网络调用；无 key 时会成功跳过。`smoke:provider:route` 会启动最小 Express 路由并 POST `/api/ai/connection-test`，用于验收玩家开局页同一条 provider 健康检查路径。

## API 概览

```text
GET  /api/health
POST /api/game/start
GET  /api/game/saves
GET  /api/game/state/:sessionId
POST /api/game/turn
POST /api/ai/connection-test
POST /api/exam/question
POST /api/exam/submit
```

核心约定：

- `POST /api/game/start` 校验 `role`，允许 `scholar`、`emperor`、`minister`、`general`、`magistrate`、`official`。
- `GET /api/game/saves` 返回脱敏 metadata，不返回完整 `worldState`、关系账本、隐藏关系或 provider 配置。
- `POST /api/game/turn` 支持普通 JSON 与 SSE。SSE 事件包括 `state_preview`、`narrative_chunk`、`final_state`、`error`。
- `POST /api/ai/connection-test` 直接校验指定或当前 AI provider，不创建 session、不写存档、不用 Mock fallback 掩盖真实 provider 问题，返回模型摘要、即时 `latencyMs`、streaming 能力、开局叙事预览或脱敏错误；S47.1 不新增模型费用或速度台账。
- 游戏与考试路由会返回 `examCalendarView`、`examRivalView`、`relationshipView`、`activeNpcRequestView`、`roleWorldCouplingView`、`worldEntityView`、`worldThreadView`、`longTermEventView`、`officialCareerView` 等视图；其中 `officialCareerView` 用于浏览器官场面板，`worldThreadView` 用于浏览器“世界议程”面板和 AI prompt 摘要，`worldEntityView` 用于暴露 S45 多实体世界模型的玩家可见摘要。

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
- [docs/DEVELOPMENT_STEPS.md](docs/DEVELOPMENT_STEPS.md)：当前时间专项路线图与进度台账。
- [docs/DEPENDENCY_PLUGIN_GOVERNANCE.md](docs/DEPENDENCY_PLUGIN_GOVERNANCE.md)：依赖、插件和开源参考的引入模板、验证门槛与回滚要求。
- [docs/BROWSER_ACCEPTANCE.md](docs/BROWSER_ACCEPTANCE.md)：浏览器自动验收覆盖和最近结果。
- [docs/REAL_PROVIDER_ACCEPTANCE.md](docs/REAL_PROVIDER_ACCEPTANCE.md)：真实 provider keyed 长回合验收方案。
- [docs/AI_CONTROL_AUDIT_MATRIX.md](docs/AI_CONTROL_AUDIT_MATRIX.md)：AI 可生成、可建议、不可写、不可裁决的系统级权限矩阵。
- [docs/SESSION_STORAGE_MIGRATION_PLAN.md](docs/SESSION_STORAGE_MIGRATION_PLAN.md)：JSON 存档硬化和数据库迁移路径。
- [docs/LONG_TERM_EVENTS_CONTRACT.md](docs/LONG_TERM_EVENTS_CONTRACT.md)：长期事件调度器契约。
- [docs/OFFICIAL_CAREER_CONTRACT.md](docs/OFFICIAL_CAREER_CONTRACT.md)：官场结果引擎与 S42 深度官场契约。
- [docs/EXAM_CALENDAR_CONTRACT.md](docs/EXAM_CALENDAR_CONTRACT.md)：科举日历与持久同场契约。
- [docs/ROLE_WORLD_COUPLING_CONTRACT.md](docs/ROLE_WORLD_COUPLING_CONTRACT.md)：身份行动与世界联动契约。
- [docs/WORLD_ENTITIES_CONTRACT.md](docs/WORLD_ENTITIES_CONTRACT.md)：多实体世界模型契约。
- [docs/WORLD_THREADS_CONTRACT.md](docs/WORLD_THREADS_CONTRACT.md)：World Threads / 世界议程聚合契约。
- [docs/PRE_PHASE_CODEBASE_REVIEW_2026-05-06.md](docs/PRE_PHASE_CODEBASE_REVIEW_2026-05-06.md)：第三阶段后续硬化前的代码审查记录。
- [docs/PHASE_THREE_ROADMAP_ARCHIVE.md](docs/PHASE_THREE_ROADMAP_ARCHIVE.md)：第三阶段路线图归档。
- [docs/PHASE_FOUR_ROADMAP_ARCHIVE.md](docs/PHASE_FOUR_ROADMAP_ARCHIVE.md)：第四阶段路线图归档。

## 已知限制

- 真实 provider 网络调用需要配置 API key；无 key 环境只验证 Mock、连接测试缺 key 分支和 no-key skip。
- 浏览器 smoke 覆盖完整主线和代表身份回合，但不等同于所有身份的长线游玩验收。
- 长期事件、官场结果、科举日历、角色世界联动、World Entities 和 World Threads 仍是确定性规则集；S42.3 已让入仕后可在浏览器中查看官署、差事、考成、关系和风险，S43.2/S45.2 已把这些信号与高压实体汇入浏览器世界议程总览。S45 仍未新增浏览器实体面板，世界议程只提示介入方向，不提供一键结算。
- 当前存储仍是本地 JSON。虽然已有 envelope、revision、atomic write 和 lock，SQLite 或数据库适配器仍是下一阶段更稳的持久化方向。
