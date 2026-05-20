# 《千秋》开发治理规范

本文件是 Codex 使用的开发规范锚点。`AGENTS.md`、`CLAUDE.md`、`docs/SHARED_CONTEXT.md`、`docs/QIANQIU_DEVELOPMENT_BRIEF.md` 和 `docs/DEVELOPMENT_STEPS.md` 可以保留摘要，但不得删弱本文件的必守规则。

`scripts/checkGovernanceDocs.js` 和 `test/documentationGovernance.test.js` 会检查本文件和活动路线图中的保护段落。修改下方保护段时，必须同步更新检查脚本、共享上下文和路线图进度记录。

<!-- GOVERNANCE_CANONICAL_START -->

## 必守规范

- 每次开发开始前读取 `AGENTS.md` 或 `CLAUDE.md`、`docs/SHARED_CONTEXT.md`、`docs/QIANQIU_DEVELOPMENT_BRIEF.md` 和 `docs/DEVELOPMENT_STEPS.md`，并先执行 `git status --short`。
- 每个 coherent change 必须更新 `docs/SHARED_CONTEXT.md`；开始、完成、阻塞或调整路线图步骤时必须更新 `docs/DEVELOPMENT_STEPS.md`，写明步骤 ID、完成内容、验证结果和提交哈希。
- 关键决策不能只留在聊天记录里；会影响后续 Codex 接手的内容必须写入仓库文档。
- 使用 Git 保存每个 coherent change。提交前确认工作树、验证结果和最终回复描述一致，不提交 `.env`、`data/sessions/*.json`、`node_modules/` 或密钥。
- 保持 `npm install && npm start` 可运行，默认访问 `http://localhost:3000`；Mock AI 必须默认完整可玩，真实 provider 只作为可选配置。
- 不破坏完整书生路径：`scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`。
- 后续开发和维护不以“最小实现点”或“最小改动点”为目标；在安全边界、默认可运行、内容保护和可审查粒度不受损的前提下，优先交付完整、丰富、功能强大的游戏实现，并把必要的系统、交互、AI、数据、验证和文档一次设计到位。
- 复杂功能必须坚持前后端分离和大步骤拆分：后端/API/数据契约、AI 权限与服务器裁决、前端体验、验证与文档应按可审查阶段分步交付；前端不得代替服务器裁决资源、身份、交易、NPC 行动、经济结果或隐藏信息。
- AI 是《千秋》的核心世界引擎，不是可替换装饰；新增玩法、数据域、角色、官署、事件、面板或 prompt 检索时，必须设计 AI 的读取范围、角色智能、工具权限、proposal 边界、服务器裁决、审计记录和 Mock/no-key 降级。
- AI 可以生成叙事、题目、评分建议、关系建议、可解释内容、受限 `statePatch`，或通过身份受限的领域工具提交 structured proposal / tool call；AI 不得执行 SQL，不得直接写 canonical 状态、业务表或审计表。服务器拥有状态边界、时间推进、科举晋级、作弊处罚、官场任免、长期事件、世界实体、世界议程、隐藏信息过滤、数据库写入和持久化裁决。
- 游戏规则、数值阈值、时间间隔、概率、UI 限制、fixture 规模和 prompt budget 等可调参数不得散落为魔法数字；新增或调整时优先集中到具名配置模块，例如 `src/config/GameConfig.js` 或更贴近领域的 `src/game/*Config.js`，并写清单位、范围和默认值意图。
- 项目内面向协作和玩家的输出优先使用中文，尤其是文档、交接记录、路线图台账、领域逻辑注释和玩家可见文案；只有代码标识符、API、第三方术语、命令输出或外部工具清晰度需要时再使用英文。

## 子代理纪律

- 用户已明确授权 Codex 在本仓库使用子代理；除非后续用户指令收窄或撤销，否则视为长期项目上下文。
- 对路线图阶段或步骤簇，应在可拆分为独立小步骤时主动使用子代理；优先按 `Sxx.y` 这类可审查粒度拆分，而不是把“大步”交给一个超大任务。
- 子代理实施任务必须有清晰职责边界和文件/模块归属；多个实施子代理并行时，写入范围应尽量互不重叠。
- 每个实施子代理提示词必须明确：不得运行 `git add`、`git commit`、`git push` 或创建 PR；不得回滚他人改动；最终报告列出改动文件和验证命令。
- 子代理只产出受限 patch 与聚焦验证报告；主代理负责审查 diff、补齐跨模块契约、最终验证、共享文档同步和唯一的 coherent Git 提交。
- 包含代码、测试、运行时行为、API/schema、提示词或验证工具变化的提交，暂存和提交前必须委派至少一个只读子代理审查最终 diff 与验证证据。主代理需向复审子代理提供 diff 与验证摘要；复审子代理只报告风险、遗漏、测试缺口和建议，不得编辑文件，也不得运行 Git 命令。
- 低风险纯文档改动可跳过子代理复审，但必须在 `docs/SHARED_CONTEXT.md` 或最终回复说明。
- 如果子代理意外创建提交，主代理必须把它视为未复审工作：检查 diff 和测试，在交接记录中说明事故，并避免继续让该子代理提交。

## 依赖、插件与开源参考

- 新增或升级 `package.json` 依赖、开发工具、外部服务 SDK、Codex 插件工作流或开源参考时，必须按 [依赖、插件与开源参考治理](DEPENDENCY_PLUGIN_GOVERNANCE.md) 记录和验证。
- 记录必须说明用途、运行入口、测试覆盖、替代方案、许可证、维护状态、安全/隐私影响、Mock/no-key 影响、文档落点和回滚策略。
- 前端以 React + TypeScript + Vite 的 `client/` 源码和 `dist/client/` 构建产物为默认交付入口；后续框架或构建链调整必须先进入活动路线图和依赖治理记录。
- 核心游戏规则、时间推进、科举晋级、状态边界、作弊惩罚、官职任免和持久化不能完全交给模型或黑箱库。

## 检查命令

- `npm run check:docs-governance`：检查本治理锚点、活动路线图和必读文档中的保护内容。
- `npm test`：会通过 `test/documentationGovernance.test.js` 自动运行同一治理检查。

<!-- GOVERNANCE_CANONICAL_END -->
