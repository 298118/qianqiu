# 依赖、插件与开源参考治理

本文档是 S46.1 的依赖/插件引入模板。它不批准任何新依赖；它规定以后新增、升级、替换或移除依赖、插件、外部工具和开源参考时必须留下的判断依据。

## 适用范围

- `package.json` / `package-lock.json` 中的运行依赖和开发依赖。
- 浏览器 smoke、provider smoke、文档/表格/演示等开发工具依赖。
- Codex 工作流中会影响仓库开发方式的插件、脚本、MCP 或外部工具。
- 参考开源项目、示例代码、算法描述或设计素材，但不直接写入 `package.json` 的情况。
- 新增外部服务 SDK、API 客户端或二进制运行时。

不属于本流程的内容：

- 已忽略的本地 `.env` 配置值。
- 不写入仓库、只用于一次性人工排查的本机工具。
- 操作系统自带命令或 Node.js 标准库。

## 当前直接依赖快照

以当前 `package.json` 为准：

| 名称 | 类型 | 版本范围 | 当前用途 | 治理备注 |
| --- | --- | --- | --- | --- |
| `express` | runtime | `latest` | 本地 HTTP 服务与 API 路由 | 核心后端框架，变更会影响 `npm start`。 |
| `cors` | runtime | `latest` | 本地开发 CORS 策略 | 变更需复核默认本机 Origin 边界。 |
| `dotenv` | runtime | `latest` | 读取 `.env` provider 配置 | 真实 provider 仍必须可选，Mock 仍默认可玩。 |
| `ajv` | runtime | `^8.20.0` | AI JSON schema 校验 | 变更需复核 schema 与 red-team/eval。 |
| `openai` | runtime | `^6.36.0` | OpenAI 与 DeepSeek compatible adapter | 变更需复核真实 provider smoke 和错误脱敏。 |
| `@anthropic-ai/sdk` | runtime | `^0.93.0` | Anthropic/Claude adapter | 变更需复核真实 provider smoke 和 streaming。 |
| `react` | runtime | `19.2.6` | S74+ 默认前端组件运行时 | S74.0 批准；只渲染安全 projection，不接触 raw/provider/hidden 数据。 |
| `react-dom` | runtime | `19.2.6` | S74+ React 浏览器挂载 | S74.0 批准；默认入口接管在 S74.1+ 实施。 |
| `react-router` | runtime | `7.15.1` | S74+ 多页 SPA Data Mode 路由 | 只用 `createBrowserRouter` / `RouterProvider`；不采用 Framework Mode，不接管 Express 后端。 |
| `zustand` | runtime | `5.0.13` | S74+ 前端 UI 状态与安全 payload 缓存 | 不保存 canonical state、raw session、raw audit、prompt、provider payload、key 或 hidden ledger。 |
| `lucide-react` | runtime | `1.16.0` | S74+ 图标按钮 | 只按需 import，视觉样式仍由本地水墨/朱印 CSS 控制。 |
| `@fontsource/noto-serif-sc` | runtime | `^5.2.9` | S77.3 React 前端自托管简体中文字体 | OFL-1.1；只导入 400/700/900 简体子集，避免 Linux/CI/无中文系统字体环境出现方框字。 |
| `playwright-core` | dev | `^1.59.1` | 浏览器 smoke 驱动本机 Chrome/Edge | 不打包浏览器；变更需复核 `npm run smoke:browser`。 |
| `typescript` | dev | `6.0.3` | S74+ `client/` 类型检查 | 不把后端 CJS 改为 ESM，不在根级加 `"type": "module"`。 |
| `vite` | dev | `8.0.13` | S74+ React dev/build 工具 | 构建输出必须隔离，不能清空 `public/assets/`、S72 地图运行时或 vendor 资源。 |
| `@vitejs/plugin-react` | dev | `6.0.2` | S74+ Vite React 集成 | 仅用于 client 构建与 React Fast Refresh。 |
| `vitest` | dev | `4.1.6` | S74+ client 单元/交互测试 | 后端测试仍使用 Node.js `node --test`。 |
| `@testing-library/react` | dev | `16.3.2` | S74+ React 组件测试 | 仅 dev 依赖，不新增玩家运行时服务或密钥要求。 |
| `@testing-library/user-event` | dev | `14.6.1` | S74+ 用户交互测试 | 用于键盘、表单、焦点、抽屉和行动输入测试。 |
| `jsdom` | dev | `29.1.1` | S74+ Vitest DOM 环境 | 仅 dev 依赖；要求 Node.js `20.19+`、`22.13+` 或 `24.0+`。 |
| `@types/react` | dev | `19.2.14` | S74+ React 类型声明 | 仅辅助 TypeScript 检查。 |
| `@types/react-dom` | dev | `19.2.3` | S74+ React DOM 类型声明 | 仅辅助 TypeScript 检查。 |
| `@types/node` | dev | `25.8.0` | S74+ Vite/Vitest/Node 配置类型 | 仅辅助 TypeScript 检查。 |

此表只是直接依赖说明，不替代未来新增依赖时的许可证、安全和维护状态检查。

## 版本策略

- `package-lock.json` 是当前安装解析的锁定来源，依赖变更必须保持 lockfile 与 `package.json` 同步。
- 未来新增或升级依赖时，优先使用明确的 semver 范围或固定版本；不要沿用 `latest`。
- 现有 `express`、`cors`、`dotenv` 的 `latest` range 是历史遗留。若未来触及它们，应顺手评估是否改成明确范围，并记录验证结果。
- 只有在工具本身需要持续追随最新版本、且失败可跳过或可回滚时，才可使用 `latest`；必须在记录模板的“版本或范围”和“决策”里写明理由。
- 主版本升级视为行为变更，至少需要 focused tests、相关 smoke 或全量 `npm test` 证明没有破坏 Mock 默认路径。

## 引入原则

新增依赖或插件必须同时满足：

- 明显降低复杂度、提升可靠性、安全性、浏览器验收能力或成熟标准能力。
- 不破坏 `npm install && npm start`，不要求真实 provider key，不让 Mock 模式失去完整可玩性。
- 不把核心游戏规则、科举晋级、状态边界、作弊惩罚、官职任免、隐藏信息过滤或持久化裁决交给黑箱。
- 前端继续保持原生 HTML/CSS/JS、无构建步骤，除非路线图另行明确批准。
- 许可证、维护状态、供应链风险和替代方案可解释。
- 有清楚的测试入口、回滚策略和文档落点。

## 引入前检查

新增或升级前，先回答这些问题；答案要写入路线图进度记录、相关契约文档或 PR/提交说明：

1. 具体问题是什么？没有它时现有手写方案哪里不够好？
2. 它会替代多少代码、测试、工具脚本或人工流程？
3. 是否可以用 Node.js 标准库、现有依赖或更小的本地 helper 解决？
4. 许可证是否清楚，是否允许当前 `UNLICENSED` 私有仓库使用和后续可能发布？
5. 维护状态是否健康：近期发布、文档、issue 活跃度、生态使用量是否足够？
6. 是否引入网络调用、二进制、原生编译、postinstall、浏览器下载、账户/密钥或遥测？
7. 对 `npm install`、`npm start`、Windows 本地开发和无 key Mock 模式有什么影响？
8. 失败时是否能降级或跳过，尤其是 browser/provider smoke 和真实服务检查？
9. 需要新增哪些测试、smoke、文档和 `.env.example` 字段？
10. 如果撤回它，需要删除哪些文件、配置、脚本和文档？

## 记录模板

复制此模板到 `docs/DEVELOPMENT_STEPS.md` 的对应步骤记录，或放入更具体的契约文档。一次引入多个包时，每个核心包都要有独立条目；只作为间接依赖出现的包可在“风险”里汇总。

```text
依赖/插件记录：
- 名称：
- 类型：runtime dependency / dev dependency / plugin / external service / open-source reference
- 版本或范围：
- 是否使用 `latest` 及理由：
- 引入步骤：
- 负责人/工具：
- 用途：
- 替代的手写逻辑或人工流程：
- 影响范围：server / browser / tests / AI provider / storage / docs / tooling
- 许可证：
- 维护状态：
- 安全与隐私：是否有网络、密钥、遥测、postinstall、二进制或原生编译
- 备选方案：
- Mock/no-key 影响：
- 安装与运行影响：
- 验证命令：
- 回滚策略：
- 文档落点：
- 决策：
- 后续复查：
```

## 文档落点

依赖或插件变更至少更新：

- `docs/DEVELOPMENT_STEPS.md`：记录步骤、原因、验证、风险、回滚和提交哈希。
- `docs/SHARED_CONTEXT.md`：压缩成未来 Codex 需要知道的状态、验证和下一步。
- `README.md`：当安装、启动、常用命令、技术栈或玩家/开发者体验改变时更新。
- `docs/QIANQIU_DEVELOPMENT_BRIEF.md`：当依赖改变产品/架构约束、AI/provider 策略或验收标准时更新。
- `docs/ARCHITECTURE.md`：当运行时形态、路由、状态、脚本或工具链改变时更新。
- 相关契约文档：当依赖影响存储、AI 权限、浏览器验收、provider smoke、World Threads、World Entities 等边界时更新。
- `.env.example`：当新增环境变量、密钥、base URL、开关或超时配置时更新。

只更新 `package.json` 而不更新这些说明，视为未完成。

## 验证门槛

纯文档治理变更：

- `git diff --check`

新增、升级或移除依赖：

- `npm install` 或 `npm ci`，并确认 `package-lock.json` 与 `package.json` 同步。
- `npm start` 或等价本地启动检查，确认仍可访问 `http://localhost:3000`。
- `npm test`；如果改动范围很小，可先跑 focused tests，但提交前需说明为何没有跑全量。
- 触及 AI/provider：`npm run eval:ai`，必要时 `npm run smoke:provider` / `npm run smoke:provider:long`。
- 触及浏览器体验或 smoke：`$env:AI_PROVIDER='mock'; npm run smoke:browser`。
- 触及安全/供应链时，记录已执行或跳过 `npm audit --omit=dev` 的原因；审计失败不得静默忽略。
- `git diff --check`

## 回滚要求

回滚策略必须能让项目回到可运行状态：

- 删除或还原 `package.json` 与 `package-lock.json` 里的依赖。
- 删除新增 import、adapter、脚本、配置、环境变量和文档入口。
- 保留或恢复 Mock 默认路径，让 `npm install && npm start` 不需要外部 key 或服务。
- 对迁移性变更，说明旧存档、旧 `.env`、旧浏览器数据如何兼容或清理。
- 对插件/外部工具，说明没有插件时是否有手动替代流程。

## 开源参考规则

参考开源项目时，只记录思路、协议或小段必要接口形状；不要复制不明来源的大段实现。若确实需要移植代码：

- 记录来源 URL、许可证、版本/commit、复制范围和本地改写点。
- 在相关文件或文档中保留清楚 attribution。
- 确认许可证与本仓库用途兼容。
- 添加能证明本地改写行为的测试。

## 后续复查

每次进入涉及工具链、provider、浏览器验收、存储适配器或前端构建方式的路线图步骤时，先查看本文档。若后续新增依赖治理自动化，例如 license report、audit baseline 或 dependency update script，也应先用本文档模板记录引入理由。
