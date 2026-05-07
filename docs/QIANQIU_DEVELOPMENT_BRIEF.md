# 《千秋》开发文稿与执行规范

## 1. 项目定位

《千秋》是一款 AI 驱动的历史模拟文字游戏。玩家穿越到真实或架空的中国古代历史环境中，扮演皇帝、大臣、将领、地方官、书生、入仕官员等身份，通过自然语言输入圣旨、政令、奏折、策论、文章或日常行动，由大语言模型推演王朝局势与个人命运。

本项目第一阶段必须交付并持续保护一个可运行的浏览器游戏：

- 前端：纯 HTML + CSS + JavaScript，无构建步骤。
- 后端：Node.js + Express，plain JavaScript。
- AI：适配器模式，支持 Mock、OpenAI、DeepSeek、Claude/Anthropic。
- 存储：默认本地 JSON session 文件；可选本地 SQLite session row adapter 与本地审计日志。
- 默认体验：`npm install && npm start` 后访问 `http://localhost:3000` 即可游玩，默认不需要 API Key。

第一阶段最重要的完整体验是 **书生 -> 科举 -> 入仕**，后续任何路线图都不得破坏完整路径：`scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`。

稳定开发治理锚点见 [docs/DEVELOPMENT_GOVERNANCE.md](DEVELOPMENT_GOVERNANCE.md)。重写路线图、交接文档或 brief 时不得删弱其中的必守规范；`npm run check:docs-governance` 和 `npm test` 会检查受保护内容。

## 2. 阶段状态

已完成并归档：

- 第一阶段：可玩纵切，验收记录见 [PHASE_ONE_ACCEPTANCE.md](PHASE_ONE_ACCEPTANCE.md)，路线图见 [PHASE_ONE_ROADMAP_ARCHIVE.md](PHASE_ONE_ROADMAP_ARCHIVE.md)。
- 第二阶段：本地验收，记录见 [PHASE_TWO_ACCEPTANCE.md](PHASE_TWO_ACCEPTANCE.md)，路线图见 [PHASE_TWO_ROADMAP_ARCHIVE.md](PHASE_TWO_ROADMAP_ARCHIVE.md)。
- 第三阶段：S31-S39.1，长期模拟骨架、关系可视化、主动 NPC、长期事件、官场结果、科举日历、身份联动、真实 provider 长跑、浏览器主线、JSON 存档硬化和审查修复，见 [PHASE_THREE_ROADMAP_ARCHIVE.md](PHASE_THREE_ROADMAP_ARCHIVE.md)。
- 第四阶段：S40-S47.2，AI 连接、prompt pack、深度官场、World Threads、AI 权限矩阵、World Entities、依赖/插件治理、provider/browser 验收扩展和 DeepSeek 缓存友好提示词结构，见 [PHASE_FOUR_ROADMAP_ARCHIVE.md](PHASE_FOUR_ROADMAP_ARCHIVE.md)。
- S48 时间专项：普通自由行动从一月一回合改为一旬一回合；月末系统只在下旬进入下月上旬时完整结算；考试已有 scene-local time；浏览器日期统一为“年月旬”，见 [TIME_SPECIALTY_ROADMAP_ARCHIVE.md](TIME_SPECIALTY_ROADMAP_ARCHIVE.md)。
- S49-S53 本地数据库基础：storage adapter、可选 SQLite session row、本地审计、天下地理/人物/官职任所安全 projection、检索式 prompt context 和浏览器局势簿，见 [LOCAL_DATABASE_FOUNDATION_ARCHIVE.md](LOCAL_DATABASE_FOUNDATION_ARCHIVE.md)。

当前活动路线图见 [DEVELOPMENT_STEPS.md](DEVELOPMENT_STEPS.md)，数据库方向见 [DYNAMIC_WORLD_DATABASE_PLAN.md](DYNAMIC_WORLD_DATABASE_PLAN.md)。S54 起的重点是把剩余数据拆成本地 SQLite 业务表：地理、人物、官职任所、安全事件索引、SQLite 检索式 prompt 和 JSON/SQLite 双模式验收。当前不规划远程存档、账号体系、多人同步、云端冲突解决或托管数据库。

开发规范不变：Mock 默认可玩，真实 provider 可选；服务器拥有状态边界、时间推进、科举晋级、作弊处罚、官职任免、长期事件、世界实体、世界议程、数据库写入和持久化裁决；AI 不能直接执行 SQL 或写业务表，只能提交结构化建议。

## 3. 核心体验

玩家没有固定选项，主要通过自由文本行动推进游戏。AI 作为世界引擎，负责叙事、意图理解、出题、评分、角色反馈和世界变化建议；服务器负责状态存储、数值边界、晋级规则、作弊惩罚、官场任免、长期事件、可见性过滤和持久化。

核心设计原则：

- 开放输入：玩家可以自由打字，不被固定按钮限制。
- 结构化状态：世界必须有可追踪、可保存、可回放的状态对象。
- AI 有创造力，服务器有最终裁判权。
- Mock 模式必须足够完整，让没有 API Key 的开发者也能测试主线。
- 书生科举系统必须像真正的生涯路径，而不是单次问答。

## 4. 技术方案

项目结构保持轻量：

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

AI provider 约定：

- `mock`：默认模式，必须完整可玩。
- `openai`：使用 OpenAI Responses API，支持流式输出和结构化 JSON。
- `deepseek`：使用 OpenAI-compatible adapter，通过 base URL 和 API key 接入；可用 `DEEPSEEK_OPENING_MODEL`、`DEEPSEEK_TURN_MODEL`、`DEEPSEEK_EXAM_QUESTION_MODEL`、`DEEPSEEK_GRADE_MODEL` 按任务覆盖。
- `mimo`：使用 Xiaomi MiMo OpenAI-compatible chat completions，通过 `MIMO_BASE_URL`、`MIMO_API_KEY` 和固定 `MIMO_MODEL=mimo-v2.5-pro` 接入；这是 MiMo-V2.5-Pro 的 1M 长上下文模型口径，Token Plan 订阅 key 为 `tp-...`，必须使用订阅页给出的 token-plan Base URL。
- `mimo-deepseek`：当前最小多模型路由层。开局、普通回合、流式叙事和科举出题尽量走 MiMo，科举评卷走 DeepSeek V4 Pro；完整多 AI 协作/仲裁编排排在 S54-S59 后续规划中。
- `claude` / `anthropic`：使用 Anthropic Messages API，支持 SSE 流式输出。

MiMo Token Plan 官方说明将订阅额度限定在 AI 编程工具相关场景；若后续把本项目公开部署或作为非 Coding 自定义应用后端使用，应改用普通 API key 或先确认授权范围。无论 provider 如何混合，服务器仍拥有 schema 校验、状态边界、考试晋级、官职任免、反作弊和持久化裁决。

CORS 约定：默认只允许无 `Origin` 请求和当前 `PORT` 对应的本机应用 Origin；如需从其他开发前端或工具跨 Origin 调用本地 API，使用逗号分隔的 `CORS_ALLOWED_ORIGINS` 显式放行，不使用通配 `*`。

## 5. 世界状态模型

后端维护结构化 `worldState`。核心字段包括：

```javascript
{
  sessionId: "string",
  year: 1644,
  month: 1,
  tenDayPeriod: 1, // 1=上旬，2=中旬，3=下旬
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
  factions: {},
  characters: [],
  relationshipLedger: {},
  longTermEvents: [],
  worldEntities: {},
  worldThreads: {},
  worldGeography: {},
  worldPeople: {},
  officialPostings: {},
  eventHistory: [],
  activeExam: null,
  player: {
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
- 入仕官员：`officeTitle`、`bureauId`、`currentPostingId`、`superiorFavor`、`peerNetwork`、`performanceMerit`、`promotionProspect`、`impeachmentRisk`、`cleanReputation`。
- 将领：`command`、`troops`、`supply`、`battleReputation`、`scouting`、`campaignRisk`。
- 地方官：`countyName`、`localTreasury`、`localOrder`、`gentryRelations`、`banditPressure`、`pendingLawsuits`、`corveeBurden`、`waterworks`。

状态更新规则：

- AI 只能返回受限 `statePatch`，不能直接覆盖完整状态。
- 服务器通过白名单、schema 和 clamp 合并 patch。
- `turnCount`、年月旬、考试晋级、作弊惩罚、最终身份转换、官职任免和持久化 revision 必须由服务器执行。
- `eventHistory` 只保留最近摘要；长期追溯通过安全事件 projection，而不是把 raw audit 暴露给 UI。

## 6. 后端 API

当前公开 API：

```text
GET  /api/health
POST /api/game/start
GET  /api/game/saves
GET  /api/game/state/:sessionId
POST /api/game/turn
POST /api/ai/connection-test
POST /api/exam/question
POST /api/exam/progress
POST /api/exam/submit
```

核心约定：

- `POST /api/game/start` 校验 `role`，允许 `scholar`、`emperor`、`minister`、`general`、`magistrate`、`official`；未知身份返回 400，不创建 session。
- `GET /api/game/saves` 只返回脱敏 metadata，包括 `sessionId`、schema/revision、创建/更新时间、玩家名、身份、朝代年月旬、回合数、科名、官职和摘要；不返回完整 `worldState`、隐藏关系、provider 配置、本地文件路径或数据库路径。
- `GET /api/game/state/:sessionId` 读取完整本地状态和服务器整理后的 route views。后续如保存 hidden 私档，必须先拆玩家 API 或增加 raw state redaction。
- `POST /api/game/turn` 支持普通 JSON 与 SSE。SSE 可先发送顶层 `narrative_chunk`，但状态只在完整 JSON 通过 schema 后落盘；真实 provider 流式失败时不保存状态，并移除未提交临时叙事。
- `POST /api/ai/connection-test` 不创建 session、不写存档、不用 Mock fallback 掩盖真实 provider 问题，返回脱敏健康检查。

游戏与考试路由可返回这些 view：

- `examCalendarView`、`examRivalView`
- `relationshipView`、`activeNpcRequestView`
- `roleWorldCouplingView`
- `worldEntityView`、`worldThreadView`
- `worldGeographyView`
- `worldPeopleView`
- `officialCareerView`
- `officialPostingsView`
- `longTermEventView`
- `eventArchiveView`

浏览器和 prompt 必须优先读取这些服务器 view / capped summary，而不是 raw ledger、raw audit、provider-only `retrievalContext` 或 SQLite 原始表。

## 7. 存储与本地数据库

`src/storage/sessionStore.js` 是 route-facing facade。默认 adapter 是 `src/storage/jsonSessionAdapter.js`，存储 JSON envelope 到 `data/sessions/*.json`，包含 `storageSchemaVersion: 1`、redacted metadata、nested `worldState`、atomic temp writes、revision checks 和 per-session local lock。

可选 SQLite adapter：

- 通过 `STORAGE_ADAPTER=sqlite` 显式启用，默认仍是 JSON。
- 使用本地 `world_sessions` row 保存 metadata、revision、timestamps 和 JSON `world_state_json`。
- `SQLITE_DATABASE_PATH` 只影响本地数据库路径，不进入 prompt、浏览器或 save-list payload。
- `npm run storage:import:sqlite` 可把 JSON 存档导入 SQLite，默认不删除 JSON 原档。

本地审计：

- JSON 模式写 `data/audit/{sessionId}.event-log.jsonl` 与 `data/audit/{sessionId}.ai-proposals.jsonl`，是诊断性尽力追加。
- SQLite 模式写 `event_log` 与 `ai_change_proposals`，可在本地 transaction 中和 session row 一起提交。
- 审计记录只保存脱敏摘要、proposal 字段、服务器接受/拒绝原因和应用事件 id，不保存密钥、完整 prompt、本地路径、hidden notes 或未经脱敏 provider 错误。

S54+ 数据库拆表必须继续保持 JSON 默认可玩，并保留 `worldState` snapshot 可读、可导入、可导出。SQLite 只增强本机索引、审计、长期存储、检索式 prompt context 和安全查阅 projection，不把核心裁决交给 AI、SQL 或黑箱库。

## 8. 当前领域账本与安全 View

已落地的 server-owned / view-first 数据域：

- `worldEntities` / `worldEntityView`：朝廷衙门、地方士绅、书院、军镇、盐漕、赈务等制度实体压力。
- `worldThreads` / `worldThreadView`：主动 NPC、长期事件、官场差事、身份联动和高压实体整理成世界议程。
- `worldGeography` / `worldGeographyView`：国家、邻国、区域、城市、路线、边境压力面和官署辖区；只做可见 projection 与轻量压力快照，不替代财政、战争、外交或城市治理裁决。
- `worldPeople` / `worldPeopleView`：从当前可见 `characters`、`relationshipLedger` 和 active request 近期札记桥接人物、家族、资产、田产和关系摘要；不保存 hidden 私档。
- `officialPostings` / `officialPostingsView`：从 `officialCatalog`、`officialCareer`、地方官 role state 和可见地理 view 派生官署、官职、任所、考成和迁转摘要；不改变 `officialCareerView`。
- `eventArchiveView`：从公开近事、世界议程、长期事件、官场履历和考试档案整理事件档案；不读取 raw audit、provider proposal、prompt、本地路径或 key。

S53 浏览器“局势簿”只读这些 route view。后续 S54-S59 拆表时，UI 和 prompt contract 应保持 view-first，不暴露原始业务表。

## 9. 时间与场景契约

S48 后，普通自由行动使用旬制：

- 日期使用 `year/month/tenDayPeriod`，玩家可见为“明1644年正月上旬”这类格式。
- 普通回合按“上旬 -> 中旬 -> 下旬 -> 下月上旬”推进。
- 世界自然漂移、长期事件月数递减、季节性事件、官场任内月份和考成周期默认只在下旬进入下月上旬时完整结算。
- 考试已有 `activeExam.sceneTime`；`/api/exam/question`、`/api/exam/progress`、`/api/exam/submit` 推进考试局部阶段，不自动消耗全局旬。

后续廷议、堂审、战斗、赶考途中遭遇、重大差事收束和外交会盟也应使用 scene-local time，而不是把每次输入都硬解释为十天。

## 10. AI 权限与控制审查

[AI_CONTROL_AUDIT_MATRIX.md](AI_CONTROL_AUDIT_MATRIX.md) 是当前 AI/server 权限矩阵入口。新增 AI 可读摘要、可建议字段、server-owned ledger、浏览器面板或 provider 验收时，必须同步检查该矩阵。

权限原则：

- AI 可生成叙事、公文口吻、题目、评语、传闻、受限 meter 建议和关系建议。
- AI 可建议普通状态 delta，但服务器必须 schema 校验、白名单合并、clamp 并记录接受/拒绝。
- AI 不可写：年月旬、考试晋级、榜单、官职任免、长期事件结局、世界实体/议程账本、数据库业务表、审计表、隐藏信息和持久化 revision。
- AI 不可读：密钥、`.env`、本地路径、raw prompt、raw audit、hidden notes、hidden intent、未公开关系/任所/密札。

所有新增表都应在契约中标明 AI 权限或至少给出安全边界。

## 11. Prompt 与 DeepSeek 缓存边界

`src/ai/promptPacks.js` 维护固定前缀、服务器边界、语气契约、AI 权限契约和输出契约。`src/ai/prompts.js` 按任务附带 `promptPack` 元数据并选择身份指令。`src/ai/promptContextAssembler.js` 负责动态上下文与 `retrievalContext`。

DeepSeek 上下文硬盘缓存优化必须纳入 prompt pack 设计，但不得影响游戏效果：

- 稳定前缀优先：系统身份、服务器边界、JSON 合约、固定术语和不随回合变化的规则放在请求最前。
- 动态内容后置：当前世界摘要、玩家输入、考试文章和本回合具体 schema 附件放在稳定前缀之后。
- 不为缓存删上下文：不能牺牲必要局势信息、角色视野、官场深度、历史语气、反作弊判断或叙事质量。
- 不做缓存计数记录：当前阶段不读取或保存 provider usage 的缓存命中/未命中 token 计数，也不在 diagnostics/smoke 中新增命中率字段。
- 可测试：同一 prompt pack 的固定前缀应有快照或等价测试。

## 12. 开发过程注意事项

每次开发都必须做：

1. 先读 `AGENTS.md` 或 `CLAUDE.md`，再读本文件。
2. 读取 `docs/SHARED_CONTEXT.md`，确认 Codex 与 Claude Code 共享的最新上下文。
3. 读取 `docs/DEVELOPMENT_STEPS.md`，确认当前应执行的小步骤和历史进度。
4. 执行 `git status --short`，确认当前工作树。
5. 判断是否有别人未提交或未说明的改动，不要覆盖。
6. 将本次任务涉及的设计变更写回文档或 README。
7. 每次 coherent change 结束前更新 `docs/SHARED_CONTEXT.md`，写清当前状态、关键决策、验证结果和下一步建议。
8. 每次开始、完成、阻塞或调整开发步骤时更新 `docs/DEVELOPMENT_STEPS.md`，写明步骤 ID、完成内容、验证结果和提交哈希。
9. 保持 Mock 模式可运行。
10. 项目内面向协作和玩家的输出尽量使用中文；代码标识符、API、第三方术语、命令输出或外部工具清晰度需要时再使用英文。
11. 完成后至少运行与本次改动相关的验证命令。
12. 再次执行 `git status --short`。
13. 对包含代码、测试、运行时行为、API/schema、提示词或验证工具变化的 coherent change，在暂存和提交前至少委派一个只读子代理审查最终 diff 与验证结果。纯文档低风险改动可以跳过，但要在共享上下文或最终回复说明。
14. 用 Git 提交本次 coherent change。
15. 在最终回复中说明改了什么、验证了什么、提交哈希是什么。

大步开发可以使用子代理并行推进，但主代理负责收束。用户已明确授权 Codex 和 Claude Code 在本仓库使用子代理；除非后续用户指令收窄或撤销该授权，否则视为长期项目上下文。实施子代理不得运行 `git add`、`git commit`、`git push` 或创建 PR；提交前审查子代理必须只读，只报告风险、遗漏、测试缺口和建议。

不要做：

- 不要把关键决策只留在聊天记录里。
- 不要只更新 `AGENTS.md` 或只更新 `CLAUDE.md`，跨工具上下文必须进入 `docs/SHARED_CONTEXT.md`。
- 不要完成路线图步骤却不更新 `docs/DEVELOPMENT_STEPS.md`。
- 不要让真实 API Key 成为本地启动必要条件。
- 不要让 AI 原始输出直接改写完整世界状态或数据库业务表。
- 不要绕过服务器的科举晋级、作弊规则、官职任免和持久化裁决。
- 不要把 `data/sessions/*.json`、`.env`、`node_modules/`、SQLite 本地数据库文件提交进仓库。
- 不要在一个提交里混入无关重构。

## 13. Git 规范

推荐提交信息：

```text
docs: update database roadmap
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

基础验收必须持续满足：

- `npm install && npm start` 能启动。
- `http://localhost:3000` 能打开。
- 无 API Key 时，Mock 模式能完整游玩书生主线。
- 书生可以通过四级科举并入仕。
- 皇帝、大臣、将领、地方官、入仕官员身份有代表性自由输入反馈。
- 考试文章、评分、虚拟考生、榜单和晋级结果会被保存。
- AI JSON 有 schema 校验和失败降级。
- README 说明安装、配置、启动和 provider/storage 切换。
- 数据库专项不得破坏 JSON 默认路径，也不得引入远程/账号/多人范围。

## 15. 当前数据库专项摘要

S49-S53 基础层结论：

1. JSON 默认仍可玩；SQLite 通过 `STORAGE_ADAPTER=sqlite` 显式启用，当前主要是一行一 session 与审计表。
2. `event_log` / `ai_change_proposals` 是本地脱敏审计，不进入玩家 API，也不让 AI 直接写表。
3. `worldGeographyView`、`worldPeopleView`、`officialPostingsView`、`eventArchiveView` 是当前 UI/prompt 合法入口。
4. 浏览器“局势簿”只读 route player-facing view，不读 raw ledger、raw audit、provider-only `retrievalContext`、prompt、本地路径或 key。
5. S54.1 已固定地理 SQLite 业务表契约；国家/城市地理行尚未在运行时写入 SQLite，NPC/家族/资产/关系、官职任所和安全事件索引也尚未拆成 SQLite 业务表，仍按 S54-S59 小步推进。

S54-S59 剩余方向：

- S54：地理 SQLite 表契约已完成；后续实现 SQLite 持久化、导入/修复/导出和 view parity。
- S55：人物、家族、资产、田产、关系 SQLite 表与 NPC 生命周期事件。
- S56：官署、官职、任所、考成、迁转 SQLite 表与跨域引用完整性。
- S57：安全事件索引和审计到公开事件 projection。
- S58：SQLite 索引驱动的 prompt context 与浏览器 JSON/SQLite parity。
- S59：双模式集成硬化与再归档。

本地数据库专项必须满足同一边界：默认 JSON/Mock 路径不得被破坏；SQLite local-only；AI 不执行 SQL、不直接写业务表；浏览器和 prompt 只读服务器 projection；服务器继续拥有 schema、白名单、clamp、隐藏过滤、科举晋级、官职任免、长期事件、世界实体、世界议程和持久化事务。

## 16. 历史实现笔记归档

日常启动只需阅读必读四件套和当前活动台账。需要追溯旧阶段细节时再打开：

- [QIANQIU_DEVELOPMENT_HISTORY_ARCHIVE.md](QIANQIU_DEVELOPMENT_HISTORY_ARCHIVE.md)：S11-S38.3 逐步实现笔记。
- [FOURTH_PHASE_PROGRESS_ARCHIVE.md](FOURTH_PHASE_PROGRESS_ARCHIVE.md)：第四阶段早期详细进度。
- [PHASE_FOUR_ROADMAP_ARCHIVE.md](PHASE_FOUR_ROADMAP_ARCHIVE.md)：第四阶段路线图归档。
- [TIME_SPECIALTY_ROADMAP_ARCHIVE.md](TIME_SPECIALTY_ROADMAP_ARCHIVE.md)：S48 时间专项归档。
- [LOCAL_DATABASE_FOUNDATION_ARCHIVE.md](LOCAL_DATABASE_FOUNDATION_ARCHIVE.md)：S49-S53 本地数据库基础归档。
