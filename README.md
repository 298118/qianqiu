# 千秋

AI 驱动的历史模拟文字游戏。玩家以书生、皇帝、大臣、将领、地方官等身份进入古代中国历史情境，用自由文本行动推动命运与世局。

## 当前状态

本仓库已经具备第一版可启动竖切：

- Node.js + Express 服务入口：`server.js`
- 静态前端：`public/index.html`、`public/styles.css`、`public/app.js`
- Mock AI 开局叙事与书生日常行动：`src/ai/providers/mock.js`
- 初始世界状态工厂：`src/game/initialState.js`
- 本地 JSON session 存储：`src/storage/sessionStore.js`
- API：`POST /api/game/start`、`GET /api/game/state/:sessionId`、`POST /api/game/turn`、`POST /api/exam/question`、`POST /api/exam/submit`
- 书生面板：显示科举进度、属性、师承、已读书与人脉
- 身份面板：皇帝、大臣、入仕官员可查看权力/影响/操守、府库粮储、朝局派系与行动提示
- UI 打磨：宣纸/墨色/朱砂/青玉视觉层级、移动端底部行动输入、叙事回合分隔、考场篇幅提示与可折叠放榜详情
- 科举出题：服务器定义四级考试规则，Mock provider 可生成题目并保存 `activeExam`
- 科举交卷：Mock 考官可五维评分；服务器本地检查过短、现代词、疑似照抄与代笔嫌疑，生成虚拟考生榜单并保存文章记录
- 科举晋级：服务器在交卷后应用童试/乡试/会试/殿试晋级，殿试通过会转为 `official` 并分派初授官职；严重作伪会黜落降档
- 皇帝/大臣/入仕官员基础循环：Mock provider 已支持赈灾、用人、筹饷、整军、上疏、党争、督办公务、观政、断案与抚民等自由行动分支

默认 AI provider 是 `mock`，无需 API Key 即可本地开局。

## 启动

```bash
npm install
npm start
```

然后访问：

```text
http://localhost:3000
```

开发时可使用：

```bash
npm run dev
```

## Testing

Automated quality checks use Node.js' built-in test runner, so no extra test dependency is required:

```bash
npm test
```

Current coverage focuses on server-owned state boundaries, session JSON persistence, AI JSON schemas, exam gates, promotion rules, local anti-cheat penalties, and virtual candidate ranking. For a full browser/API walkthrough, use [docs/MANUAL_ACCEPTANCE.md](docs/MANUAL_ACCEPTANCE.md).

## 配置

复制 `.env.example` 为 `.env` 后可覆盖本地配置：

```text
PORT=3000
AI_PROVIDER=mock
```

AI provider can now be `mock`, `openai`, `deepseek`, `claude`, or `anthropic`. `mock` remains the default and needs no key. Real providers validate model JSON through Ajv before the server applies state, and each real provider retries once before falling back to Mock.

Common provider settings:

```text
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

Provider dependencies: `openai` powers both OpenAI Responses API and DeepSeek OpenAI-compatible chat completions, `@anthropic-ai/sdk` powers Claude Messages API, and `ajv` performs local schema validation for all model JSON.

## 开发文档

后续开发者与智能体请先阅读：

- [AGENTS.md](AGENTS.md)：Codex 项目指令。
- [CLAUDE.md](CLAUDE.md)：Claude Code 项目指令。
- [docs/SHARED_CONTEXT.md](docs/SHARED_CONTEXT.md)：Codex 与 Claude Code 共同维护的当前上下文交接板。
- [docs/QIANQIU_DEVELOPMENT_BRIEF.md](docs/QIANQIU_DEVELOPMENT_BRIEF.md)：完整开发章程、架构计划、AI 合约、科举系统与开发规范。
- [docs/DEVELOPMENT_STEPS.md](docs/DEVELOPMENT_STEPS.md)：逐步开发路线图与进度台账。

所有 coherent change 都应经过本地 Git 提交保存，并更新共享上下文与路线图。
