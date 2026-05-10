# 千秋 / Qianqiu

《千秋》是一款浏览器 + Node.js 历史模拟文字游戏。玩家可以扮演书生、皇帝、大臣、将领、地方官或入仕官员，在古代中国历史情境中用自由文本行动推动个人命运、科举功名、官场沉浮和王朝局势。

项目默认使用 Mock AI，本地无需 API Key 即可启动和游玩；配置真实 provider 后，可切换 OpenAI、DeepSeek、Xiaomi MiMo、MiMo + DeepSeek 混合路由或 Anthropic/Claude。

## 这次主要更新

当前项目已经完成可玩纵切、浏览器验收、时间专项、AI provider 扩展、本地动态数据库基础和 S54-S59 SQLite 业务表拆分。近期重点更新集中在“本地数据库专项”和“多 provider 能力”：

- 新增可选 SQLite 存储模式：默认仍是 JSON 存档；设置 `STORAGE_ADAPTER=sqlite` 后，本地使用 `world_sessions`、审计表、地理 `geo_*`、人物 `people_*`、官职任所 `office_*` 派生业务表、安全事件档案 `event_archive_index` 和安全 prompt 检索派生索引。
- 新增地理业务表同步：SQLite 模式会把 `worldState.worldGeography` 同步到 `geo_countries`、`geo_regions`、`geo_cities`、`geo_routes`、`geo_frontier_zones`、`geo_office_jurisdictions`，读档时可按 JSON snapshot 修复缺失或陈旧行。
- 新增地理维护工具：`npm run storage:geography:sqlite -- import|status|repair|export` 支持导入、漂移检查、修复和脱敏 debug dump。
- 新增人物域 SQLite 持久化：SQLite 模式会把规范化后的可见 `worldPeople` bridge rows 同步到 `people_npcs`、`people_households`、`people_assets`、`people_estates`、`people_relationships`；prompt/UI 仍只读 `worldPeopleView`。
- 新增官职任所 SQLite 持久化：SQLite 模式会把规范化后的安全 `officialPostings` projection 同步到 `office_bureaus`、`office_catalog`、`office_city_jurisdictions`、`office_postings`、`office_assessments`、`office_transfers`；读档可按 JSON snapshot 修复缺失、陈旧、错行、同 id/同 revision 内容污染或旧行缺指纹。
- 新增安全事件索引：SQLite 模式会把 `eventArchiveView` 的安全分页 projection 同步到 `event_archive_index`，读档按 `world_sessions.world_state_json` 单向修复；prompt 近事、顶层 `recentEvents`、地方案牍、军务外交预警、经济财政预警和 S65.1 公开历史事件链都只读事件档案安全条目。
- 新增 SQLite prompt 检索索引：SQLite 模式会把地理、人物、官职任所、地方案牍、军务外交态势、经济财政态势、公开历史事件链和事件档案的服务器可见 projection 同步为安全检索行，读档用内容指纹修复同 id/同 revision 污染；JSON 模式继续走原 view helper fallback。
- 新增审计公开 projection 工具：`npm run storage:audit-events -- status|export --adapter json|sqlite` 会从 JSON sidecar 或 SQLite 审计读取 allowlist 后的公开摘要，输出本地调试安全的 public projection；AI proposal 只计数，不输出原始建议内容。
- 新增浏览器 SQLite smoke 参数：`npm run smoke:browser -- --storage-adapter sqlite --sqlite-db <path>` 可验证 Mock 浏览器主线与 SQLite adapter 共用同一存储；`npm run smoke:browser -- --information-parity` 会顺序启动 JSON/SQLite 临时服务器，比对局势簿 DOM、route view 摘要和事件档案分页 metadata。
- 完成 S54-S59 归档与 S60+ 新规划：当前“超大动态世界数据库”的内容充实度约 55-65%，后续路线图转向国家/邻国、城市、NPC、官职生态、地方事务、外交军事、经济市场、事件模板、情报可见性和大规模检索内容；S60.1 已把小/中/大规模档位、seed 分层、prompt budget 和防泄漏 fixture 目标写入内容契约，仍只考虑本地 JSON/SQLite。
- 完成 S61 国家/城市深度内容：`worldGeographyView` 与 prompt 检索现在携带国家财政、军备、国威、继承、外交、情报可靠度，以及城市税粮、市价、士绅、词讼、徭役、水利、灾害、交通、驻军和书院等安全指标；AI 只读这些 projection，不能写地理账本或裁决外交/战争/城市治理。
- 完成 S62.1/S62.2 NPC 人口、家族谱系与生命周期：新增 deterministic 人口谱系生成 helper 和服务器月末生命周期 helper，规模 fixture 可生成官员、胥吏、士绅、商贾、军官、书院师友、同年、亲族、邻国使者，以及父母配偶子女、姻亲、门生故旧、同乡同年和派系网络；普通回合月末可推进可见 NPC 健康、婚丧、迁居、官职履历状态、财富/欠账、资产、田产、家族风险和人情债演化，并复用 `world_people` 审计与 `people_*` 派生行链路。hidden 私档、资产真数和隐藏动机仍不进入当前 raw route state。
- 完成 S63.1 官职生态与任命池：`officialPostingsView` 现在能看到上级堂官、属官/胥吏/幕友接口、空缺、候补、补授、试署、外放、丁忧、起复、弹劾候勘和差遣压力；这些只作为服务器可见 projection、SQLite 派生行和 prompt 检索素材，真实任免仍由 `officialCareer` 服务器结算裁决。
- 完成 S63.2 地方事务与案牍模板：新增 `localAffairsDocketView`，把钱粮、刑名、灾赈、水利、盗匪、徭役、士绅、疫病和任所收束压力从可见城市/任所指标整理为行政身份可见案牍；案牍会进入事件档案 `local_docket` 条目和 prompt 检索索引，但不会直接改城市指标、官场考成、任免或 SQLite 原始表。
- 完成 S64.1 外交军务态势：新增 `militaryDiplomacyView`，把可见国家/边面/城市/路线、军官/使节线索和任所辖区整理为战区、驻军、粮道、外交接触与边患预警；这些进入事件档案 `military_diplomacy` 条目和 `events.militaryReports` prompt 检索行，但不会直接宣战、和议、调兵、任免统帅、结算战役或公开 hidden 情报。
- 完成 S64.2 经济财政态势：新增 `economicFiscalView`，把可见国家/城市/路线、任所案牍、财赋赈务实体和债务资产线索整理为税粮、府库、粮价、盐漕商路、地方库银、赈济、债务腐败与市场预警；这些进入事件档案 `economic_fiscal` 条目和 `events.economicReports` prompt 检索行，但不会直接征税、拨银、开仓、平粜、赈济、裁决盐漕、清偿债务、改市场价格或写入持久化表。
- 完成 S65.1 历史事件链：新增 `historicalEventArchiveView`，把可见案牍、军务、财赋、任所考成、人物关系和科举履历组合为自然灾害/赈务、官场争斗、边事、商税、人物关系、科举和地方差遣公共卷宗；公开链进入路由 view、事件档案 `historical_event_chain` 条目和 `events.eventChains` prompt 检索行，密档链只在服务器显式请求时生成，不进入普通玩家路由、浏览器或 SQLite prompt 索引。
- 新增 Xiaomi MiMo provider：支持 `mimo` 与 `mimo-deepseek`，后者让 MiMo 负责开局、普通回合、流式叙事和出题，让 DeepSeek V4 Pro 负责科举评卷。
- 更新 README 与项目文档：把当前功能、修复、安全边界、启动方式和常用命令整理成更适合 GitHub 首页阅读的结构。

## 修复与加固

- 修复并加固 AI 越权边界：AI 只能提交叙事、题目、评分建议、关系建议和受限 `statePatch`；服务器拥有时间推进、晋级、作弊处罚、官职任免、数据库写入和持久化裁决。
- 加固 SSE 流式安全：真实 provider 可先显示顶层叙事片段，但状态只在完整 JSON 通过 schema 后落盘；失败流式文本会回滚。
- 加固错误脱敏：AI 连接诊断、provider smoke、事件档案和浏览器 smoke 会避免暴露 key、长 token、raw prompt、本地路径和 raw provider response。
- 加固存储一致性：JSON adapter 使用 envelope、revision、atomic write 和本地 lock；SQLite adapter 使用 transaction、revision 检查和同 session 队列。
- 加固玩家可见视图：浏览器和 prompt 只读取服务器整理后的 `worldGeographyView`、`worldPeopleView`、`officialPostingsView`、`localAffairsDocketView`、`militaryDiplomacyView`、`economicFiscalView`、`historicalEventArchiveView`、`eventArchiveView` 等安全 projection，不读取 raw audit 或 raw business table。

## 项目特点

- 自由文本玩法：玩家不被固定选项限制，可以用自然语言下旨、读书、赶考、办案、治军、结交、上疏或处理地方事务。
- 完整书生路径：保护 `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`，从寒窗到入仕是当前第一优先级体验。
- 多身份循环：书生、皇帝、大臣、将领、地方官、入仕官员都有代表性开局与行动反馈。
- 旬制时间系统：普通自由行动按“上旬 -> 中旬 -> 下旬 -> 下月上旬”推进；考试等密集场景使用 scene-local time，不强制消耗全局旬。
- 长期世界模拟：关系账本、主动 NPC 请托、长期事件、官场考成、科举日历、角色世界联动、World Entities 和 World Threads 已接入。
- View-first 安全架构：玩家界面和 prompt 使用服务器裁剪后的安全视图，隐藏关系、密札、raw audit、provider proposal 和本地路径不会进入玩家 payload。
- 本地优先：默认 JSON 存档，SQLite 仅作为本机增强；当前不引入远程存档、账号体系、多人同步或托管数据库。

## 项目优势

- 无 key 可玩：Mock AI 是默认模式，适合本地开发、演示和回归测试。
- 真实 provider 可选：需要时可接入 OpenAI、DeepSeek、MiMo、MiMo + DeepSeek 或 Anthropic，不让真实 key 成为启动门槛。
- 服务器裁决清晰：模型负责创造力，服务器负责规则、边界、晋级、处罚、任免和持久化。
- 文档与验收完整：路线图、架构、AI 权限矩阵、数据库契约、浏览器验收和 provider 验收都有持续维护。
- 渐进式数据库迁移：JSON snapshot 保持可读可回滚，SQLite 逐步拆表增强查询、审计和长期世界存储。
- 内容保护优先：大规模数据库内容只能经服务器 helper、schema、clamp、可见性过滤和本地事务进入世界；AI 不直接写库，hidden 私档不回填玩家 route state。

## 技术栈

- 前端：原生 HTML、CSS、JavaScript，无构建步骤。
- 后端：Node.js + Express。
- AI provider：Mock、OpenAI、DeepSeek、Xiaomi MiMo、MiMo + DeepSeek、Anthropic/Claude。
- 校验：Ajv schema、本地 JSON 解析、重试和降级。
- 流式响应：Server-Sent Events。
- 存储：默认 JSON session files；可选 SQLite session row、审计表、地理 `geo_*` 业务表、可见人物 `people_*` 业务表、人物事件关联、官职任所 `office_*` 派生业务表、安全 `event_archive_index` 和安全 prompt 检索索引。
- 测试：Node.js `node --test`。
- 浏览器验收：`playwright-core` + 本机 Chrome/Edge。

## 快速启动

需要 Node.js 18+。

```bash
npm install
npm start
```

然后打开：

```text
http://localhost:3000
```

开发时可用自动重启：

```bash
npm run dev
```

## 配置

复制 `.env.example` 为 `.env`，按需填写。最小本地游玩不需要任何 key：

```text
PORT=3000
STORAGE_ADAPTER=json
AI_PROVIDER=mock
```

常用 provider 配置：

```text
AI_PROVIDER=mock

OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini

DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_GRADE_MODEL=deepseek-v4-pro

MIMO_API_KEY=
MIMO_BASE_URL=https://token-plan-sgp.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2.5-pro
MIMO_AUTH_HEADER=api-key

ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-5
```

`AI_PROVIDER` 可选：

- `mock`：默认模式，无需 key，完整可玩。
- `openai`：使用 OpenAI Responses API。
- `deepseek`：使用 OpenAI-compatible chat completions，支持按任务覆盖模型。
- `mimo`：使用 Xiaomi MiMo OpenAI-compatible chat completions，默认模型 ID 为 `mimo-v2.5-pro`。
- `mimo-deepseek`：混合 provider，MiMo 负责叙事/出题，DeepSeek 负责科举评卷。
- `claude` 或 `anthropic`：使用 Anthropic Messages API。

MiMo Token Plan 的 `tp-...` key 必须配套订阅页给出的 token-plan Base URL，不能与普通 `sk-...` key 或按量 Base URL 混用。公开部署或非 Coding 自定义后端使用前，请先确认订阅条款或改用普通 API key。

## 存储模式

默认 JSON：

```text
STORAGE_ADAPTER=json
```

存档位于 `data/sessions/`，带 schema envelope、metadata、revision、atomic write 和 save-list API。

可选 SQLite：

```text
STORAGE_ADAPTER=sqlite
SQLITE_DATABASE_PATH=data/qianqiu.sqlite
```

SQLite 模式需要当前 Node.js 运行时提供 `node:sqlite`。它会保留完整 `world_sessions.world_state_json`，同步地理 `geo_*` 业务表、可见人物 `people_*` bridge rows、官职任所 `office_*` projection rows、安全事件档案 `event_archive_index` 和安全 prompt 检索索引，并把服务器人物事件关联到本地 `people_*.last_event_id`。`office_*`、`event_archive_index` 和 prompt 检索索引派生行带本地内容指纹；`prompt_retrieval_index` 也包含 `localAffairsDocketView` 的地方案牍 compact rows、`militaryDiplomacyView` 的军务外交 compact rows、`economicFiscalView` 的经济财政 compact rows 和 `historicalEventArchiveView` 的公开事件链 compact rows，用于发现同 id/同 revision 的 raw table 污染或旧行缺指纹。raw SQLite table 不进入浏览器、prompt 或 save-list payload；读取修复也只从 `world_state_json` 单向重建，不把 raw row、事件 id 或密档链回填为 route state。

导入、地理维护与审计公开 projection：

```bash
npm run storage:import:sqlite -- --dry-run
npm run storage:geography:sqlite -- status
npm run storage:geography:sqlite -- repair --dry-run
npm run storage:geography:sqlite -- export
npm run storage:audit-events -- status --adapter json
npm run storage:audit-events -- export --adapter sqlite --db data/qianqiu.sqlite
npm run smoke:dual-mode -- --storage-only
```

`storage:import:sqlite` 会通过 SQLite adapter 同步 `geo_*`、`people_*`、`office_*`、`event_archive_index` 和 `prompt_retrieval_index` 等派生表；`smoke:dual-mode -- --storage-only` 是 S59.1 的快速整体验收，串联 JSON -> SQLite dry-run/正式导入、地理修复/导出、审计公开 projection、派生表计数和 hidden-token 防线。

回滚优先关闭 `STORAGE_ADAPTER=sqlite` 回到 JSON adapter，或保留/恢复原 JSON 存档。

## 常用命令

```bash
npm test
npm run check:docs-governance
npm run eval:ai
npm run smoke:browser
npm run smoke:browser -- --information-parity
npm run smoke:dual-mode -- --storage-only
npm run smoke:provider
npm run smoke:provider:route
npm run smoke:provider:long
npm run storage:audit-events -- status
```

说明：

- `npm test` 使用 Node.js 内置测试，覆盖状态边界、AI schema、科举、关系、长期事件、官场、角色联动、存储、SSE 和脚本逻辑。
- `npm run check:docs-governance` 检查开发治理规范、活动路线图和必读文档中的受保护规则。
- `npm run eval:ai` 是离线 AI 输出质量门槛，覆盖 provider-shaped JSON、越权风险、历史语气、评分边界和作弊处罚。
- `npm run smoke:browser` 启动临时 Mock 服务器，覆盖完整书生到入仕路径、作弊样例、代表身份回合、存档簿、年月旬显示和桌面/移动布局；`--information-parity` 专项比对 JSON/SQLite 双模式下“局势簿”五类面板和事件档案分页。
- `npm run smoke:dual-mode` 串联 JSON/SQLite 完整 Mock browser smoke、局势簿 parity 和 S59.1 存储维护验收；无浏览器或只想核验导入/修复/导出时可加 `--storage-only`。
- `npm run smoke:provider*` 只在配置真实 provider key 时进行网络调用；无 key 环境会成功跳过。
- `npm run storage:audit-events -- status|export` 是本地审计公开 projection 工具，默认只输出脱敏统计和 public 事件摘要，不输出 raw audit、provider proposal、prompt、key、本地路径或 hidden notes。

## API 概览

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

- `POST /api/game/start` 校验身份，只允许 `scholar`、`emperor`、`minister`、`general`、`magistrate`、`official`。
- `GET /api/game/saves` 只返回脱敏 metadata，不返回完整 `worldState`、隐藏关系、provider 配置或本地路径。
- `POST /api/game/turn` 支持普通 JSON 与 SSE。SSE 事件包括 `state_preview`、`narrative_chunk`、`final_state`、`error`。
- `POST /api/ai/connection-test` 不创建 session、不写存档、不用 Mock fallback 掩盖真实 provider 问题。
- 游戏与考试路由会返回服务器整理后的可见视图，例如 `relationshipView`、`worldGeographyView`、`worldPeopleView`、`officialPostingsView`、`localAffairsDocketView`、`militaryDiplomacyView`、`economicFiscalView`、`historicalEventArchiveView`、`eventArchiveView`。

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

- [docs/SHARED_CONTEXT.md](docs/SHARED_CONTEXT.md)：Codex 与 Claude Code 共享交接板。
- [docs/QIANQIU_DEVELOPMENT_BRIEF.md](docs/QIANQIU_DEVELOPMENT_BRIEF.md)：产品目标、架构、数据契约和交付标准。
- [docs/DEVELOPMENT_STEPS.md](docs/DEVELOPMENT_STEPS.md)：当前本地数据库专项路线图与进度台账。
- [docs/DEVELOPMENT_GOVERNANCE.md](docs/DEVELOPMENT_GOVERNANCE.md)：稳定开发治理锚点。
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)：当前架构、API、状态模型和验证要求。
- [docs/AI_CONTROL_AUDIT_MATRIX.md](docs/AI_CONTROL_AUDIT_MATRIX.md)：AI/server 权限矩阵。
- [docs/DYNAMIC_WORLD_DATABASE_PLAN.md](docs/DYNAMIC_WORLD_DATABASE_PLAN.md)：本地动态数据库规划。
- [docs/HUGE_DYNAMIC_WORLD_CONTENT_CONTRACT.md](docs/HUGE_DYNAMIC_WORLD_CONTENT_CONTRACT.md)：S60 超大动态世界数据库内容规模、seed 分层、可见性和 fixture 验收契约。
- [docs/LOCAL_DATABASE_FOUNDATION_ARCHIVE.md](docs/LOCAL_DATABASE_FOUNDATION_ARCHIVE.md)：S49-S53 本地数据库基础归档。
- [docs/LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md](docs/LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md)：S54-S59 本地 SQLite 业务表、索引、维护工具和双模式验收归档。
- [docs/WORLD_GEOGRAPHY_SEED_CONTRACT.md](docs/WORLD_GEOGRAPHY_SEED_CONTRACT.md)：天下地理与 SQLite 地理业务表契约。
- [docs/NPC_HOUSEHOLD_ASSET_RELATIONSHIP_CONTRACT.md](docs/NPC_HOUSEHOLD_ASSET_RELATIONSHIP_CONTRACT.md)：人物、家族、资产、田产、关系 schema/桥接与 S55 SQLite 人物域表契约/实现边界。
- [docs/OFFICIAL_POSTING_DATABASE_CONTRACT.md](docs/OFFICIAL_POSTING_DATABASE_CONTRACT.md)：官署、官职、任所、考成、迁转 schema/桥接与 S56 SQLite 官职任所表契约。

## 已知限制

- 真实 provider 网络调用需要配置 API key；无 key 环境只验证 Mock、缺 key 分支和 no-key skip。
- 浏览器 smoke 覆盖完整主线和代表身份回合，但不等同于所有身份的长线游玩验收。
- SQLite 目前已经包含 session row、审计表、地理 `geo_*` 业务表、可见人物 `people_*` bridge rows、人物事件到 `people_*.last_event_id` 的本地关联、带内容漂移探针的官职任所 `office_*` 派生业务表、安全事件档案 `event_archive_index`、安全 prompt 检索索引，以及只输出 allowlist public 摘要的本地审计公开 projection 工具；它们都不是浏览器、prompt 或服务器裁决的 raw 来源。
- “超大动态世界数据库”的内容密度仍在继续建设中：S60+ 会按 S60 内容契约补国家/邻国、城市、NPC、官职生态、事件模板、情报可见性和大规模检索，而不是引入远程或多人功能。S61 已把国家/城市深度指标接入安全 view、prompt retrieval 和 SQLite 派生 metadata；S62.1/S62.2 已补 NPC 人口、家族谱系和月末生命周期/资产流动 helper；S63.1/S63.2 已补官职生态、任命池和地方案牍 projection；S64.1/S64.2 已补外交军务态势和经济财政态势 projection；S65.1 已补公开历史事件链，后续继续做情报可见性和分页。
- 当前不包含远程存档、账号体系、多人同步或云端数据库。
