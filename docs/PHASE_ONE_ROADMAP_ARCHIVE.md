# 第一阶段路线图归档

归档日期：2026-05-05

本文件归档《千秋》第一阶段规划。第一阶段的活动路线图已经从 `docs/DEVELOPMENT_STEPS.md` 移出；该文件现在只维护第二阶段以后仍在执行的步骤。完整历史仍可通过 Git 查看，第一阶段正式验收记录见 [docs/PHASE_ONE_ACCEPTANCE.md](PHASE_ONE_ACCEPTANCE.md)。

## 归档范围

第一阶段目标是交付默认 Mock 模式下可运行、可验收、可继续开发的浏览器 + Node.js 历史模拟文字游戏。该目标已经完成并验收：

- `npm install && npm start` 可启动本地 Express 服务。
- 浏览器打开 `http://localhost:3000` 可进入游戏。
- 默认 `AI_PROVIDER=mock`，无 API Key 也能完成书生主线。
- 书生路径已经跑通：寒窗 -> 童试 -> 秀才 -> 乡试 -> 举人 -> 会试 -> 贡士 -> 殿试 -> 进士 -> 入仕官员。
- 皇帝、大臣、入仕官员有基础自由行动循环。
- 科举文章会保存到 `player.examHistory`，并带评分、监试复核、虚拟考生和榜单。
- OpenAI、DeepSeek、Claude provider 适配器已接入，失败时重试并降级 Mock。
- 状态 patch、数值 clamp、科举晋级、作弊惩罚和持久化仍由服务器拥有。
- `npm test` 使用 Node.js 内置 test runner 覆盖核心服务器规则。

## 完成的阶段

| 阶段 | 内容 | 代表提交 |
| --- | --- | --- |
| Phase 00 | 项目上下文、双工具入口、共享交接板、初始路线图 | `8e3cee3` |
| Phase 01 | 最小可启动项目、Express、静态前端、健康检查 | `c6e0537` |
| Phase 02 | session JSON 存储、初始状态、状态 patch 边界 | `c6e0537`, `d119393` |
| Phase 03 | AI provider 抽象、Mock 骨架、JSON 合约基础 | `c6e0537`, `0d779a2` |
| Phase 04 | 游戏 API、自由行动、SSE 反馈 | `d119393`, `0fd8729` |
| Phase 05 | 开局页、主界面、状态恢复 | `c6e0537`, `d119393` |
| Phase 06 | 书生日常行动和书生面板 | `9aa5263` |
| Phase 07 | 科举阶段、出题接口、考试写作界面 | `47dae05` |
| Phase 08 | 评卷、防作弊、虚拟考生、放榜 | `9c8ca76` |
| Phase 09 | 四级科举晋级、入仕、严重作伪惩罚 | `bed515a` |
| Phase 10 | 皇帝、大臣、入仕官员基础玩法 | `592b7a1` |
| Phase 11 | OpenAI、DeepSeek、Claude provider 接入 | `0d779a2` |
| Phase 12 | 古风 UI、移动端、考试/放榜交互打磨 | `7b4f349` |
| Phase 13 | 自动化测试和手动验收脚本 | `4a70f5a` |
| Phase 14 | README、架构文档、第一阶段验收记录 | `b67aadb` |

## 验收摘要

第一阶段验收记录在 [docs/PHASE_ONE_ACCEPTANCE.md](PHASE_ONE_ACCEPTANCE.md)。验收通过项包括：

- `npm install` 成功，0 vulnerabilities。
- `npm test` 通过。
- 静态资源、健康检查和核心 API 可用。
- Mock 模式完整 scholar -> official 路径通过。
- 短文、现代词、照抄经典片段等反作弊路径可触发惩罚。
- 皇帝、大臣、入仕官员基础循环可返回叙事和安全状态变更。

后续追加的 SSE 工作已完成并记录在共享上下文：`POST /api/game/turn` 可在 `Accept: text/event-stream` 或 `?stream=1` 下返回 `state_preview`、`narrative_chunk`、`final_state` 和 `error`。

## 已知限制

这些限制不是第一阶段失败项，而是第二阶段的优先候选：

- 世界尚不会在玩家行动之外系统性推进，财政、粮储、民心、边患、腐败之间还缺少长期联动。
- NPC、派系、人物恩怨和长期记忆仍较浅。
- 将领和地方官仍缺少专属深度循环。
- 虚拟考生有榜单，但还没有可查看的文章和个体风格。
- 真实 provider 没有在本地用 API Key 做端到端验收。
- 浏览器截图、localStorage 和移动布局没有自动化验收。
- 当前 SSE 是把完成后的 provider 叙事分块输出，尚不是真正 provider token streaming。

## 不归档的规范

第一阶段规划归档不改变开发规范。以下要求继续有效：

- 每次开发先读 `AGENTS.md` 或 `CLAUDE.md`、`docs/SHARED_CONTEXT.md`、`docs/QIANQIU_DEVELOPMENT_BRIEF.md`、`docs/DEVELOPMENT_STEPS.md`。
- 每次 meaningful change 更新共享上下文和步骤台账。
- 影响产品、架构、API、状态、提示词、验收标准的改动必须写入持久文档。
- 默认 Mock 模式必须可运行。
- 真实 provider 必须保持可选。
- 服务器继续拥有状态边界、科举晋级、作弊惩罚和持久化。
- 每个 coherent change 运行相关验证并用 Git 本地提交。
