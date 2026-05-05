# 千秋

`Qianqiu / 千秋` 是一个浏览器 + Node.js 历史模拟文字游戏。玩家以书生、皇帝、大臣、将领、地方官等身份进入古代中国历史情境，用自由文本行动推动命运与世局；AI 负责叙事、出题、评卷和角色反馈，服务器负责状态边界、晋级规则、反作弊、持久化和最终裁定。

第一阶段的核心体验已经可玩：默认 Mock AI 模式下，无需 API Key，可以从书生开始，经历童试、乡试、会试、殿试并入仕为官；皇帝、大臣、入仕官员也已有基础自由行动循环。

当前项目已经进入第二阶段规划。第一阶段路线图归档见 [docs/PHASE_ONE_ROADMAP_ARCHIVE.md](docs/PHASE_ONE_ROADMAP_ARCHIVE.md)，第二阶段活动台账见 [docs/DEVELOPMENT_STEPS.md](docs/DEVELOPMENT_STEPS.md)。开发规范不变：继续保持 Mock 默认可玩、真实 provider 可选、服务器拥有状态边界和科举规则。

## 快速启动

需要 Node.js 18+。首次运行：

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

默认配置是 `AI_PROVIDER=mock`，本地游玩和验收不需要任何真实模型密钥。

## 可用脚本

```bash
npm start
npm run dev
npm test
```

`npm test` 使用 Node.js 内置 `node --test`，覆盖服务器拥有的状态边界、session JSON 持久化、AI JSON schema、科举门槛、晋级和作伪惩罚、本地反作弊与虚拟考生排名。完整浏览器/API 验收流程见 [docs/MANUAL_ACCEPTANCE.md](docs/MANUAL_ACCEPTANCE.md)，本阶段验收记录见 [docs/PHASE_ONE_ACCEPTANCE.md](docs/PHASE_ONE_ACCEPTANCE.md)。

## 配置

复制 `.env.example` 为 `.env` 后按需覆盖：

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

`AI_PROVIDER` 支持：

- `mock`：默认模式，完整可玩，无需 Key。
- `openai`：使用 `openai` SDK 的 Responses API，读取 `OPENAI_API_KEY`、`OPENAI_MODEL`、可选 `OPENAI_BASE_URL`。
- `deepseek`：使用 `openai` SDK 走 OpenAI-compatible chat completions，读取 `DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL`。
- `claude` 或 `anthropic`：使用 `@anthropic-ai/sdk` Messages API，读取 `ANTHROPIC_API_KEY`、`ANTHROPIC_MODEL`。

真实 provider 的 JSON 会先通过 `src/utils/json.js` 解析，再通过 `src/ai/schemas.js` 的 Ajv schema 校验；失败、超时或 schema 不合格时重试一次，然后按方法降级到 Mock。无论 provider 如何输出，状态 patch、数值 clamp、科举晋级、作伪处罚和 session 保存都由服务器执行。

## 当前功能

- 纯 HTML/CSS/JS 前端，无构建步骤：`public/index.html`、`public/styles.css`、`public/app.js`。
- Express 服务入口：`server.js`，静态托管前端并提供 JSON API。
- 本地 session 存储：`data/sessions/*.json`，由 `src/storage/sessionStore.js` 管理并被 Git 忽略。
- 书生主线：日常读书、拜师、游学、辩经、谋生、赴考；科举路径为 `寒窗 -> 童试 -> 秀才 -> 乡试 -> 举人 -> 会试 -> 贡士 -> 殿试 -> 进士 -> 入仕官员`。
- 考试系统：服务器定义四级考试规则，Mock/真实 provider 只负责出题和评卷建议；交卷后保存文章、五维评分、监试复核、虚拟同场榜单和晋级结果。
- 反作弊：本地检查篇幅过短、现代词、疑似照抄经典片段和代笔概率；严重作伪会强制落第、降档并扣减声望与心性。
- NPC/派系记忆：服务器维护 `relationshipLedger`；Mock 会按书生/皇帝/大臣/官员行动生成可见人物/派系反应，真实 provider 只能通过顶层 `relationshipChanges` 建议可见角色/派系关系变化，最终合并、裁剪和持久化仍由服务器裁决。
- 身份循环：皇帝支持赈灾、用人、筹饷、整军和廷议；大臣支持上疏、经营人脉、督办公务和弹劾；入仕官员支持观政、断案、抚民、同年人脉和贪墨风险。
- UI：宣纸/墨色/朱砂/青玉视觉语言，移动端单列布局，底部自由行动输入，科举面板、身份面板、考试弹窗和可折叠放榜详情。

## API 概览

```text
GET  /api/health
POST /api/game/start
GET  /api/game/state/:sessionId
POST /api/game/turn
POST /api/exam/question
POST /api/exam/submit
```

`POST /api/game/turn` 支持 SSE：客户端发送 `Accept: text/event-stream` 时会收到 `state_preview`、`narrative_chunk`、`final_state` 和 `error` 事件。未请求 SSE 的脚本仍会收到普通 JSON，便于测试和兼容旧调用。成功行动会运行服务器拥有的月度 `worldTick`，响应中包含 `summary`、`events` 和 `attributeChanges`，前端会显示当前年月与简短月度反馈；若 provider 提交了合法的关系建议，响应还会包含服务器实际应用后的 `relationshipChanges`，浏览器叙事区会追加简短 `[人脉]` 反馈。

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
  routes/
  storage/
  utils/
test/
docs/
data/sessions/
```

详细架构、AI 合约、状态字段和科举规则见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 开发协作

后续开发者与智能体请先阅读：

- [AGENTS.md](AGENTS.md)：Codex 项目指令。
- [CLAUDE.md](CLAUDE.md)：Claude Code 项目指令。
- [docs/SHARED_CONTEXT.md](docs/SHARED_CONTEXT.md)：Codex 与 Claude Code 共同维护的当前上下文交接板。
- [docs/QIANQIU_DEVELOPMENT_BRIEF.md](docs/QIANQIU_DEVELOPMENT_BRIEF.md)：产品目标、架构、AI 合约、数据契约和交付标准。
- [docs/DEVELOPMENT_STEPS.md](docs/DEVELOPMENT_STEPS.md)：逐步开发路线图与进度台账。
- [docs/PHASE_ONE_ROADMAP_ARCHIVE.md](docs/PHASE_ONE_ROADMAP_ARCHIVE.md)：第一阶段路线图归档。
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)：当前实现的开发者导览。

每个 coherent change 都应更新共享上下文和路线图，运行相关验证，并用 Git 本地提交。
