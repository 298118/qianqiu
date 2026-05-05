# 千秋

AI 驱动的历史模拟文字游戏。玩家以书生、皇帝、大臣、将领、地方官等身份进入古代中国历史情境，用自由文本行动推动命运与世局。

## 当前状态

本仓库已经具备第一版可启动竖切：

- Node.js + Express 服务入口：`server.js`
- 静态前端：`public/index.html`、`public/styles.css`、`public/app.js`
- Mock AI 开局叙事与书生日常行动：`src/ai/providers/mock.js`
- 初始世界状态工厂：`src/game/initialState.js`
- 本地 JSON session 存储：`src/storage/sessionStore.js`
- API：`POST /api/game/start`、`GET /api/game/state/:sessionId`、`POST /api/game/turn`
- 书生面板：显示科举进度、属性、师承、已读书与人脉

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

## 配置

复制 `.env.example` 为 `.env` 后可覆盖本地配置：

```text
PORT=3000
AI_PROVIDER=mock
```

OpenAI、DeepSeek、Claude 的环境变量已经预留，但真实 provider 尚未接入；非 `mock` provider 目前会降级到 Mock。

## 开发文档

后续开发者与智能体请先阅读：

- [AGENTS.md](AGENTS.md)：Codex 项目指令。
- [CLAUDE.md](CLAUDE.md)：Claude Code 项目指令。
- [docs/SHARED_CONTEXT.md](docs/SHARED_CONTEXT.md)：Codex 与 Claude Code 共同维护的当前上下文交接板。
- [docs/QIANQIU_DEVELOPMENT_BRIEF.md](docs/QIANQIU_DEVELOPMENT_BRIEF.md)：完整开发章程、架构计划、AI 合约、科举系统与开发规范。
- [docs/DEVELOPMENT_STEPS.md](docs/DEVELOPMENT_STEPS.md)：逐步开发路线图与进度台账。

所有 coherent change 都应经过本地 Git 提交保存，并更新共享上下文与路线图。
