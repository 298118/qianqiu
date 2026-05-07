# 《千秋》第四阶段开发路线图与进度台账

本文件是 Codex 与 Claude Code 共同维护的当前活动路线图与进度台账。

- 第一阶段路线图已归档到 [docs/PHASE_ONE_ROADMAP_ARCHIVE.md](PHASE_ONE_ROADMAP_ARCHIVE.md)，验收记录见 [docs/PHASE_ONE_ACCEPTANCE.md](PHASE_ONE_ACCEPTANCE.md)。
- 第二阶段路线图已归档到 [docs/PHASE_TWO_ROADMAP_ARCHIVE.md](PHASE_TWO_ROADMAP_ARCHIVE.md)，验收记录见 [docs/PHASE_TWO_ACCEPTANCE.md](PHASE_TWO_ACCEPTANCE.md)。
- 第三阶段路线图已归档到 [docs/PHASE_THREE_ROADMAP_ARCHIVE.md](PHASE_THREE_ROADMAP_ARCHIVE.md)，后续不再追加新步骤。
- 本文件从 S40 起记录第四阶段规划与执行。

第四阶段目标是在第三阶段的可持续模拟骨架之上，集中提升“AI 作为世界引擎”的参与度、可审查性和游戏深度。优先级从玩家最能感知的地方开始：连接真实 AI 的可见校验、优秀且得体的提示词、入仕后的官场深度、长期世界议程，以及“哪些系统适合 AI 调动或控制”的权限审查。

开发规范不变。继续保持 `npm install && npm start` 可运行、Mock 默认可玩、真实 provider 可选、服务器拥有状态边界/科举晋级/作弊处罚/持久化裁决、每个 coherent change 必须更新共享文档并用 Git 提交。

项目内面向协作和玩家的输出尽量使用中文，尤其是文档、交接记录、路线图台账、领域逻辑注释和前端可见文案；只有代码标识符、API/协议名、第三方术语、命令输出或外部工具理解需要时再使用英文。

## 1. 使用规则

每次开发开始时：

1. 读取 `AGENTS.md` 或 `CLAUDE.md`。
2. 读取 `docs/SHARED_CONTEXT.md`。
3. 读取 `docs/QIANQIU_DEVELOPMENT_BRIEF.md`。
4. 读取本文件，选择第一个 `TODO` 或 `IN_PROGRESS` 的小步骤。
5. 执行 `git status --short`，确认是否有别人留下的改动。

每次完成一个小步骤时：

1. 把对应步骤状态改为 `DONE`，填写完成日期、工具、提交哈希或当前文档提交说明。
2. 在“进度记录”追加一条记录，写清完成内容、验证命令、风险/遗留和下一步。
3. 更新 `docs/SHARED_CONTEXT.md`，让另一个工具能直接接手。
4. 如果改动影响产品范围、架构、API、状态字段、提示词、设置或验收标准，同步更新 `docs/QIANQIU_DEVELOPMENT_BRIEF.md`、README 或相关架构文档。
5. 确认新增文档、交接记录、路线图条目、领域逻辑注释和玩家可见文案优先使用中文；确需保留英文时应是代码/API/协议/第三方术语、命令输出或外部工具清晰度所需。
6. 运行相关验证命令。
7. 对包含代码、测试、运行时行为、API/schema、提示词或验证工具变化的改动，在暂存和提交前至少委派一个只读子代理审查最终 diff 与验证结果；主代理必须在审查提示词中提供最终 diff 和验证摘要。纯文档低风险改动可以跳过，但要记录原因。
8. 用 Git 提交本次 coherent change。

子代理使用规则不变：

- 用户已明确授权 Codex 和 Claude Code 在本仓库使用子代理；除非后续用户指令收窄或撤销该授权，否则视为长期项目上下文。
- 推荐委派粒度是独立小步骤或文件职责清晰的子步骤，例如一个子代理评估官场履历契约，另一个子代理评估 AI 权限审查矩阵。
- 主代理仍负责拆分方式、审查所有 diff、补齐跨模块文档、运行最终验证、更新本台账与共享上下文，并做唯一 coherent Git 提交。
- 每个实现型子代理提示词都必须禁止 `git add`、`git commit`、`git push` 和创建 PR，必须要求报告改动文件与 focused verification 命令。
- 提交前审查子代理必须只读，只基于主代理提供的 diff 与验证摘要报告风险、遗漏、测试缺口和建议；不得编辑文件、暂存、提交、推送、创建 PR 或运行 Git 命令。

状态值：

- `TODO`：未开始。
- `IN_PROGRESS`：正在做，接手者应先检查工作树和上下文。
- `DONE`：已完成、已验证、已提交。
- `BLOCKED`：被外部条件阻塞，必须写明原因和解除条件。

## 2. 依赖、插件与开源参考策略

第四阶段允许引入一切真正有价值的依赖、插件或开源参考，但必须可解释、可验证、可替换：

- 依赖或插件必须明显降低复杂度、提升可靠性、改善安全性、提升浏览器体验或提供成熟标准能力。
- 新增依赖必须按 [依赖、插件与开源参考治理](DEPENDENCY_PLUGIN_GOVERNANCE.md) 记录，并同步本文件对应步骤和 README，说明用途、运行入口、测试覆盖、替代方案、许可证、文档落点和回滚策略。
- 优先选择维护活跃、文档清晰、常用、许可证友好的库；参考开源项目时记录借鉴点，不复制不明来源的大段实现。
- 前端继续保持无构建流程，除非本路线图明确批准升级。
- 核心游戏规则、科举晋级、状态边界、作弊惩罚、官职任免和持久化不能完全交给模型或黑箱库。
- 加依赖后必须验证 `npm install`、`npm start` 和对应测试。

## 3. 第四阶段步骤总览

| ID | 状态 | 目标 | 完成日期 | 工具 | 提交 |
| --- | --- | --- | --- | --- | --- |
| S40.1 | DONE | 归档第三阶段规划，开启第四阶段活动台账，并保持开发规范不变 | 2026-05-06 | Codex | 7927c02 |
| S40.2 | DONE | 增加游戏内 AI 连接测试入口、后端诊断路由、DeepSeek 任务模型配置文档和测试 | 2026-05-06 | Codex | 7927c02 |
| S41.1 | DONE | 制定优秀提示词总纲：世界引擎、科举考官、出题官、官场、地方、军事、皇帝/大臣等角色的语气与 JSON 合约 | 2026-05-06 | Codex | 383881a |
| S41.2 | DONE | 为 prompt pack 增加历史语气、越权、现代词、JSON 严格性和隐藏信息不泄露的离线 eval/red-team fixtures | 2026-05-06 | Codex | 2c45949 |
| S42.1 | DONE | 定义深度官场契约：官职谱系、衙门/部院、差遣、座主门生、同年、上官、政敌、考成、廷推、外放、处分 | 2026-05-06 | Codex | fd4b805 |
| S42.2 | DONE | 实现官场行动与履历系统：差事、奏疏、考成、弹劾、调任、升降、丁忧/起复、清望/贪墨风险 | 2026-05-06 | Codex | 9980c6e |
| S42.3 | DONE | 增加官场 UI、档案、浏览器旅程和 Mock/真实 provider 验收，确保入仕后有长期可玩目标 | 2026-05-06 | Codex | 60b2fd7 |
| S43.1 | DONE | 统一世界议程/World Threads：NPC 请托、长期事件、官场结果、地方链条、边事和派系斗争可形成跨月议题 | 2026-05-07 | Codex | 301ff98 |
| S43.2 | DONE | 实现议题的目标、期限、风险、相关人物、玩家可介入点和后续结算，并接入前端检查视图 | 2026-05-07 | Codex | 5c8310a |
| S44.1 | DONE | 完成 AI 调动/控制适配性审查矩阵：列出每个系统由 AI 建议、服务器裁决、玩家可见、隐藏持久化的边界 | 2026-05-07 | Codex | 91da506 |
| S44.2 | DONE | 为 AI 越权、幻觉官职、非法晋级、隐藏信息泄漏、作弊误判、流式失败增加 red-team/eval 测试 | 2026-05-07 | Codex | 43c610c |
| S45.1 | DONE | 扩展多实体世界模型：朝廷衙门、地方士绅、书院同门、军镇边墙、商税盐漕、灾荒赈务 | 2026-05-07 | Codex | 7341990 |
| S45.2 | DONE | 让 AI 叙事、NPC 行为、世界 tick、关系账本和官场结果共同读写这些实体的受限视图 | 2026-05-07 | Codex | 24aef7b |
| S46.1 | DONE | 建立依赖/插件引入模板：用途、许可证、替代方案、测试、回滚策略和文档落点 | 2026-05-07 | Codex | 20e3277 |
| S47.1 | DONE | 扩展真实 provider 验收：浏览器路由级连接测试、带 key 的健康检查、无 key 自动跳过；本轮不做模型费用/速度台账 | 2026-05-07 | Codex | dc7bea8 |
| S47.2 | DONE | 实现 DeepSeek 上下文硬盘缓存友好验证：稳定提示词前缀、动态内容后置、防无意漂移；不新增 provider usage 缓存计数记录且不得牺牲游戏效果 | 2026-05-07 | Codex | 5a8128a |

## 4. 分阶段详细步骤

### Phase 40: 第四阶段开启与 AI 连接校验

目标：冻结第三阶段规划，把当前活动台账切到第四阶段，并给玩家/开发者一个可见的 AI 连接状态入口。此阶段不调试模型推演质量，只验证 provider 配置、JSON 合约和基本可达性。

- S40.1：新增 `docs/PHASE_THREE_ROADMAP_ARCHIVE.md`；重置 `docs/DEVELOPMENT_STEPS.md` 为第四阶段路线图；同步 README、产品 brief、架构文档和共享上下文。
- S40.2：新增 `POST /api/ai/connection-test`。该接口直接调用指定或当前配置 provider，不写 session，不走 Mock fallback 掩盖真实 provider 问题，返回 provider、模型、耗时、streaming 能力、开局叙事预览和脱敏错误。开局页增加“AI 连接”面板与“校验”按钮。测试覆盖 Mock 成功、真实 provider 缺 key、路由 503、错误脱敏和 DeepSeek 任务模型摘要。

### Phase 41: 提示词与 AI 编排契约

目标：把“AI 像世界引擎”从口号落到可维护的 prompt pack、schema 合约和离线评估。提示词必须文雅、节制、符合时代，不用现代游戏术语直接出戏。

优秀提示词总纲：

- 通用世界引擎应先建立时代、角色视野、最近事件、可见关系、世界议程和服务器边界，再要求模型输出严格 JSON。
- 叙事语气应像史传、奏牍、县志、士林笔记之间的游戏化折中：古意足、可读性强、不过度堆砌典故。
- 玩家输入不可行时，AI 应给出符合身份视野的阻力和替代后果，不直接说“系统不允许”。
- 每次叙事至少要带一个可触摸的历史锚点：人物、衙门、地名、钱粮、军务、学政、灾异或民情。
- AI 可以提出关系变化、事件线索、官场暗流、考试题目和评语，但不能直接决定晋级、任免、作弊处罚、存档和隐藏情报公开。

待拆分的 prompt pack：

- `world_turn`：普通自由行动和世界推演。
- `opening`：开局叙事，强调身份处境和可行动线索。
- `exam_question`：按朝代/年份/考试等级出题，避免重复和现代问题表述。
- `exam_grading`：科举考官评分、防作弊、文风一致性和具体改进意见。
- `official_career`：官场差遣、考成、弹劾、升迁、外放和派系压力。
- `emperor_court`：圣旨、廷议、奏折过滤、内廷/外朝张力。
- `minister_faction`：上疏、党争、门生故吏、言官和权力交换。
- `local_magistrate`：赋役、断案、绅权、灾荒、盗匪和县政。
- `general_frontier`：军饷、士气、侦骑、边墙、战报和夸功风险。

DeepSeek 上下文硬盘缓存规划约束：

- 根据 DeepSeek 官方“上下文硬盘缓存”说明，缓存默认开启，命中依赖后续请求完整复用已经落盘的前缀；因此 prompt pack 应把稳定内容放在最前：系统身份、JSON 合约、服务器边界、固定术语表、少量示例和不随回合变化的时代/角色规则。
- 动态内容应放在稳定前缀之后：当前世界摘要、可见关系、长期议题、玩家输入、考试文本和本回合 schema 附件，避免无意义重排字段或随机化标题破坏前缀。
- 不能为了缓存命中删减必要上下文、隐藏关键局势、降低历史语气、削弱角色视野或让模型少看会影响推演质量的信息。缓存优化只能通过稳定结构、稳定顺序和离线/单测验证实现。
- 根据 2026-05-07 最新范围，S47.2 不读取、不保存、不报告 provider usage 的缓存命中/未命中 token 计数；diagnostics/smoke 不新增命中率字段。若未来重启该方向，必须新开步骤并重新评估日志面与验收口径。
- 需要为 prompt 构建加测试：同一任务的固定前缀在相邻请求中保持字节级稳定；动态片段变化不会改动前缀；schema/少量示例更新必须显式更新快照。

S41.1 落地范围：

- 新增 `src/ai/promptPacks.js` 作为 prompt pack 总纲注册表，记录稳定前缀、语气契约、AI 权限契约和输出契约。
- 既有 provider schema 名称保持不变：`opening`、`turn`、`examQuestion`、`grade` 仍是 OpenAI/DeepSeek/Anthropic 适配器看到的 schema 路由。
- 普通回合按玩家身份选择 `world_turn`、`official_career`、`emperor_court`、`minister_faction`、`local_magistrate` 或 `general_frontier`；科举出题和评卷分别使用 `exam_question` 与 `exam_grading`。
- `test/prompts.test.js` 覆盖 pack 注册表、身份路由、稳定前缀不掺入动态状态、科举出题/评卷权限边界。S41.2 继续扩展离线 eval fixtures 与红队输出；真实 provider 语气验收留到 S47。

### Phase 42: 官场深度优先扩展

目标：让书生入仕后不只是“属性继续上涨”，而是进入一个有职位、差事、人脉、政敌、考成和风险的长期生涯。

S42.1 已落入 `docs/OFFICIAL_CAREER_CONTRACT.md`。该契约保留 S34 结果引擎为当前运行时基础，并为 S42.2/S42.3 固定后续边界：`officeTitle` 是服务器拥有的实授官职，`position` 是软描述，`officialCareer.currentPosting` 是服务器归一化履历位置；官署目录、差遣、考成卷宗、座主/同年/上官/政敌标签、弹劾流程、廷推、调任、外放、丁忧/起复和浏览器官场档案都必须通过服务器归一化与 player-facing view 暴露。AI 可以写叙事、来函、奏疏口吻和受限仪表建议，但不能裁决任免、处分、考成或隐藏信息公开。

S42.2 已完成首个运行时切片：`src/game/officialCatalog.js` 提供静态官职/衙门目录，`officialCareer.schemaVersion = 2` 兼容旧 v1 存档并新增 `bureauId`、`assignments`、`assessmentDossier`、`impeachmentProcedure`；官场回合会根据玩家输入推进差遣、考成和弹劾流程，`officialCareerView` 暴露官署、差事、考成、关系和风险摘要；普通 provider 仍不能写 `officialCareer` 或 `officeTitle`，也不能通过 `player.position` 伪造明显官职。

S42.3 已把 `officialCareerView` 展开到浏览器官场档案面板：官署职责、差事摘要、差遣卡、考成札记、关系与弹劾风险、履历档案都有稳定 DOM selector 与响应式样式。浏览器 smoke 覆盖直入官员、童试到殿试再入仕、首次官场任命、赈灾差遣、考成/关系/弹劾摘要、隐藏文本不泄漏和桌面/移动布局溢出。

官场深度方向：

- 官职谱系：庶吉士、主事、员外郎、郎中、御史、知县、知州、知府、按察/布政司属官、翰林、六部、都察院等，以朝代差异做轻量修正。
- 衙门职责：户部钱粮、吏部铨选、刑部案牍、礼部科举、兵部军务、工部河工，不同岗位有不同输入提示和可见信息。
- 差事与考成：赈灾、清丈、审案、河工、军需、盐漕、科场监临、文书修撰。服务器记录完成度、风险和后续评价。
- 关系网络：座主、同年、门生、上官、同僚、言官、地方士绅、内廷线索。AI 可生成来函和态度，服务器裁决可见性和数值边界。
- 政治风险：弹劾、廷推、查账、降调、外放、罢黜、丁忧、起复、清流声望与贪墨把柄。
- 前端目标：入仕官员应有“官署/差事/履历/关系/风险”可扫描面板，而不是只读一堆数值。

### Phase 43: 世界议程与跨月事件线

目标：把主动 NPC、长期事件、官场结果、身份联动合并为玩家可追踪的世界议题。议题不是固定任务，而是会随时间变化的历史压力。

S43.1 已新增 `docs/WORLD_THREADS_CONTRACT.md` 与 `src/game/worldThreads.js`。`worldState.worldThreads.schemaVersion = 1` 是服务器拥有的派生议题索引，当前从主动 NPC 请托、长期事件、官场差遣、官场结果、角色世界联动、边镇压力、派系压力和地方案链生成 `worldThreadView`。游戏 start/state/turn 与考试 question/submit 路由均返回该视图，prompt `compactWorldState()` 也读取可见摘要；provider 仍不能 patch `worldThreads`。

S43.2 已开始在 `worldThreadView` 派生目标、期限、风险、相关标签、玩家介入提示和后续结算提示，并接入浏览器 `#world-thread-panel`。该面板只读 `worldThreadView`，不读取原始 ledger；它只提示自由行动方向和近归档余波，不替代主动请托、长期事件、官场差事或身份联动的来源结算。

候选议题：

- 京察/大计将至，玩家上官要求政绩。
- 某地水灾后续演变为赈务、查账、盗匪、弹劾链。
- 边镇战报互相矛盾，军功、饷银、边患和派系相互牵连。
- 科举同年进入官场后求援、结盟或牵连案件。
- 皇帝/大臣/地方官行动改变一个议题的公开走向和隐藏风险。

### Phase 44: AI 调动与控制适配性审查

目标：系统性判断哪些内容适合由 AI 控制，哪些只能让 AI 建议，哪些必须完全服务器拥有。

审查矩阵必须至少包含：

- 系统：开局叙事、普通回合、科举出题、科举评分、虚拟考生、关系变化、主动 NPC、长期事件、官场任免、世界 tick、存档、隐藏信息、作弊处罚、浏览器显示。
- AI 权限：可生成、可建议、可排序、可解释、不可写、不可裁决。
- 服务器裁决：白名单、clamp、schema、反作弊、晋级、官职任免、持久化、红队测试。
- 玩家可见性：哪些是角色视野内信息，哪些只能作为暗流存在，哪些必须明示“传闻/奏报/私信/公文”的来源。
- 失败处理：provider 无 key、JSON 失败、流式中断、越权 patch、历史语气失败、审查误伤。

### Phase 45: 多实体世界模型

目标：让 AI 的影响体现在游戏各方面，但通过结构化实体落地。每个实体有服务器拥有的状态、玩家可见摘要和 AI 可读摘要。

优先实体：

- 朝廷：六部、都察院、翰林院、内廷、军机/中枢等轻量抽象。
- 地方：府州县、士绅、粮仓、河工、诉讼、役法、乡约。
- 军事：边镇、军饷、堡寨、士气、侦报、战功簿。
- 士林：书院、座师、同年、考官、文社、名声。
- 财政：盐漕、田赋、商税、赈银、亏空。

### Phase 46: 依赖/插件治理

目标：允许引入依赖和插件，同时不让项目失去“打开就能跑”的简洁性。

S46.1 已新增 [依赖、插件与开源参考治理](DEPENDENCY_PLUGIN_GOVERNANCE.md)。新增依赖、插件、外部服务 SDK、开发工具或开源参考前，必须写入步骤记录或相关契约文档：

- 为什么需要它。
- 能替代多少手写逻辑。
- 许可证和维护状态。
- 运行/测试命令。
- 没有该依赖时的回退策略。
- 文档落点、Mock/no-key 影响、安全/隐私影响和后续复查点。

### Phase 47: Provider 与浏览器验收扩展

目标：把真实 provider 从“脚本可测”扩展到“玩家开局页可见、路由可测、无 key 也不会破坏本地体验”。

- 路由级连接测试覆盖当前 provider、指定 provider、缺 key、错误脱敏和模型摘要。
- 浏览器 smoke 可选择点击开局页“AI 连接”按钮，Mock 必须通过；真实 provider 检查只在有 key 且显式启用时运行。
- 真实 provider 验收记录应包含模型、是否 streaming、是否 schema-valid、是否写入 session、失败错误是否脱敏；S47.1 保留接口现有 `latencyMs` 作为即时诊断字段，但不新增模型费用或速度台账。
- DeepSeek 上下文硬盘缓存优化进入 S47.2：把 prompt pack 的稳定前缀固定在 `instructions` 最前，动态世界、玩家行动、考试文章和本回合上下文保留在 `input`，并用测试验证字节稳定和动态内容隔离；本步骤不读取 provider usage 的缓存计数字段，不比较命中率。验收标准是降低重复前缀漂移风险，同时不降低 `eval:ai`、长回合历史语气、官场深度和浏览器主线体验。

## 5. 进度记录

按时间倒序追加。每条记录必须让另一个工具看得懂。

模板：

```text
日期：
工具：
步骤：
提交：
完成：
验证：
风险/遗留：
下一步：
```

### 2026-05-07

工具：Codex

步骤：S47.2

提交：5a8128a

完成：
- 根据最新用户范围，把 S47.2 从“记录缓存命中/未命中 token”收窄为“DeepSeek 上下文缓存友好的稳定 prompt 前缀验证”。活跃文档明确本阶段不读取、不保存、不报告 provider usage 的缓存计数字段，也不在 diagnostics/smoke 中新增命中率字段；历史归档中的旧描述只作为过去记录。
- `src/ai/promptPacks.js` 新增 `buildPromptCacheStablePrefix(packName)`，把普通回合类 prompt pack 的通用稳定前缀与服务器状态边界显式导出；`buildPromptInstructions()` 继续把该前缀放在 `instructions` 最前，pack-specific purpose/tone/authority/output 位于其后。
- `test/prompts.test.js` 新增 S47 稳定性用例，验证 turn 类 pack 复用同一稳定前缀、非 turn 类 pack 复用通用前缀、稳定前缀位于 pack-specific 文本之前，并确认玩家名、年份、事件、行动、考试文章和真实性检查等动态 payload 不进入 `instructions` 或稳定前缀。
- 不修改 `src/ai/providers/deepseek.js`、AI diagnostics、provider smoke 或 route-health 输出，因此本步骤没有新增真实 provider usage 采集面。

验证：
- `node --check src\ai\promptPacks.js`
- `node --check src\ai\prompts.js`
- `node --check test\prompts.test.js`
- `node --test test\prompts.test.js`，10 项通过
- `npm run eval:ai`，12 项通过
- 活跃文档、代码和测试中检索旧 provider usage 缓存字段名与旧采集目标描述，无匹配；当前只保留“不记录缓存计数”的范围说明
- `node --test test\gameTurnRelationships.test.js`，4 项通过；用于复核全量并行测试里出现的 Windows `EPERM rename` 抖动不是本次 prompt 改动造成
- `$env:AI_PROVIDER='mock'; npm test -- --test-concurrency=1`，267 项通过

风险/遗留：
- `$env:AI_PROVIDER='mock'; npm test` 默认并行模式连续两次命中既有 Windows session atomic rename `EPERM` 抖动，失败点均在 `test\gameTurnRelationships.test.js` 的临时 session 写入；该文件 focused rerun 通过，串行全量通过。本步骤不改 session store。
- 本步骤只验证 prompt 结构，不声称真实 DeepSeek 缓存命中率；若未来要恢复 usage 采集，必须新开路线图步骤并重新评估日志与验收边界。

下一步：
- 第四阶段当前总览已无后续 TODO；下一轮先新增或确认下一个路线图小步骤，并保持不记录缓存命中/未命中 token 的最新范围。

---

工具：Codex

步骤：S47.1

提交：dc7bea8

完成：
- `scripts/browserSmoke.js` 新增显式 `--check-ai-connection` 参数。开启后，浏览器 smoke 会在开局前点击 `#ai-test-button`，断言 `#ai-test-result[data-ok="true"]`、模型/配置摘要、无 API key 或 session 路径泄漏、不写 `qianqiu.sessionId`、不进入游戏行动区；默认临时服务器仍强制 Mock，`--url` 目标只有在明确希望检查其 provider 时才开启。
- 新增 `scripts/providerRouteHealth.js` 与 `npm run smoke:provider:route`。脚本复用 provider smoke 的 key 选择/无 key 跳过策略，启动最小 Express app，经 `/api/ai/connection-test` 逐个检查有 key provider，验证 route-level `ok=true`、provider/config/model、streaming 能力、opening event、叙事预览、密钥片段和 session 路径不泄漏，并确认不新增 `data/sessions/*.json`；失败文案只报泄漏数量并再次脱敏原始错误，不回显被检测到的密钥片段。
- 扩展 `test/aiConnectionRoute.test.js`、`test/aiDiagnostics.test.js`、`test/browserSmokeScript.test.js` 和新增 `test/providerRouteHealthScript.test.js`，覆盖指定 provider 覆盖当前配置、unknown provider、`claude` alias 缺 key、诊断时间/streaming/no-session 字段、浏览器 AI 连接 helper 和 route-health payload 校验。
- 同步 README、架构文档、浏览器验收、真实 provider 验收、产品 brief、共享上下文和本路线图。用户要求忽略“模型费用/速度记录”，因此 S47.1 只保留既有 `latencyMs` 即时诊断，不新增费用或速度台账。
- 只读探索子代理 Newton 梳理了 S47.1 现有连接测试、provider smoke 与 browser smoke 缺口，未编辑文件、未运行 Git 写操作；其 focused 检查 `node --test test\aiDiagnostics.test.js test\aiConnectionRoute.test.js test\providerSmokeScript.test.js test\providerLongRunScript.test.js test\browserSmokeScript.test.js` 50 项通过。

验证：
- `node --check scripts\browserSmoke.js`
- `node --check scripts\providerRouteHealth.js`
- `node --check test\browserSmokeScript.test.js`
- `node --check test\providerRouteHealthScript.test.js`
- `node --check test\aiConnectionRoute.test.js`
- `node --check test\aiDiagnostics.test.js`
- `node --test test\aiDiagnostics.test.js test\aiConnectionRoute.test.js test\providerSmokeScript.test.js test\providerRouteHealthScript.test.js test\browserSmokeScript.test.js`，53 项通过
- `npm run smoke:provider:route`，本机 `.env` 有 DeepSeek key，route-level 检查通过；输出仅含模型名、streaming 能力、事件数和叙事预览，未打印 key
- `$env:AI_PROVIDER='mock'; npm run smoke:browser -- --check-ai-connection`，通过；UI acceptance 包含 `ai-connection` 和既有 14 张截图检查
- 修复复审意见后，`node --test test\providerRouteHealthScript.test.js test\browserSmokeScript.test.js test\aiDiagnostics.test.js test\aiConnectionRoute.test.js`，47 项通过；`$env:AI_PROVIDER='mock'; npm test`，265 项通过；`npm run smoke:provider:route` 重新通过；`git diff --check` 通过
- 提交前只读复审子代理 Chandrasekhar 初审发现一个 P1：route-health 在检测到 secret 泄漏时会把被检测到的片段拼回失败信息，且失败时可能跳过 session 文件对比。已修复为只报告泄漏数量、对 route 错误做二次脱敏，并在 provider 失败后仍执行 session 写入检查。Follow-up 又发现 Unix/相对 `data/sessions` 路径未被遮蔽，已扩展路径脱敏并补测试；最终 follow-up 复审批准提交。

风险/遗留：
- 本步骤只覆盖连接诊断路由，不覆盖 keyed route-level SSE 长流式失败路径；该方向仍可作为后续 provider/browser 验收扩展。
- `--check-ai-connection` 对 `--url` 目标是显式 opt-in；若目标服务器配置真实 provider 且无 key，会按接口设计失败，不影响默认 Mock smoke。
- S47.2 仍需处理 DeepSeek 上下文缓存友好结构验证；根据 2026-05-07 最新用户要求，不再把缓存命中/未命中 token 记录列入 S47.2。

下一步：
- 开始 S47.2：实现 DeepSeek 上下文缓存友好的稳定 prompt 前缀验证，但不得记录缓存命中率，也不得为了缓存牺牲游戏上下文或叙事质量。

---

工具：Codex

步骤：存档维护 - Windows atomic rename 抖动

提交：e13d94e

完成：
- 修复全量并行测试中 `cleanupSessionTempFiles({ olderThanMs: 0 })` 可能误删其他测试进程活跃 atomic temp 文件的问题。
- `cleanupSessionTempFiles()` 现在会识别 `{sessionId}.json.*.tmp`，若同 session 的 `{sessionId}.lock` 仍新鲜则跳过该 temp，避免 Windows 下 `fs.rename(tmpPath, filePath)` 因源临时文件被清理而出现 `ENOENT`，或因并发锁/删除出现 `EPERM`。
- 新增 `test/sessionStore.test.js` 回归用例，覆盖“活跃锁保护 temp；解锁后 cleanup 可删除孤儿 temp”。测试清理 helper 也会删除对应 `.lock`，避免残留影响后续用例。
- 同步架构文档、存储迁移契约、共享上下文和本路线图。只读调查子代理 Darwin 定位竞态来自并行测试清理与活跃 atomic write 的全局 `data/sessions/*.tmp` 共享目录，未编辑文件、未运行 Git 写操作。

验证：
- `node --check src\storage\sessionStore.js`
- `node --check test\sessionStore.test.js`
- `node --test test\sessionStore.test.js`，17 项通过
- `node --test test\examTravel.test.js`，5 项通过
- `$env:AI_PROVIDER='mock'; npm test`，253 项通过
- `git diff --check`
- 提交前只读复审子代理 Ramanujan 未发现 blocker；确认修复方向对准并行 cleanup 误删 active temp 的根因。残余风险是未来若写入流程不再保持“先 lock、后 temp”，或单次本地 JSON 写入超过 30 秒 stale 阈值，cleanup 仍可能误判；当前实现顺序与测试规模下风险可接受。

风险/遗留：
- 该修复保护本地 JSON adapter 的 temp cleanup；网络文件系统、多主机写入仍不在当前 JSON 存储目标内，未来若需要更强并发语义应继续迁移 SQLite。
- 若未来新增其他全局清理脚本，也必须尊重 session `.lock` 或使用测试专用存储目录。

下一步：
- 完成提交前只读复审并提交；随后继续 S47.1 provider/browser acceptance 扩展。

---

工具：Codex

步骤：S46.1

提交：20e3277

完成：
- 新增 `docs/DEPENDENCY_PLUGIN_GOVERNANCE.md`，作为依赖、插件、外部服务 SDK、开发工具和开源参考的统一引入模板。
- 模板固定了适用范围、当前直接依赖快照、版本策略、引入原则、引入前检查、记录字段、文档落点、验证门槛、回滚要求、开源参考 attribution 和后续复查规则。
- 同步 README、架构文档、产品 brief、本路线图和共享上下文，明确后续新增依赖不能只改 `package.json`，必须记录用途、许可证、维护状态、替代方案、Mock/no-key 影响、测试和回滚。
- 本次不新增或升级任何运行时依赖，保持前端无构建步骤与 Mock 默认可玩。
- 只读探索子代理 Kepler 梳理了现有依赖面和文档规则，未编辑文件、未运行 Git 写操作。

验证：
- `git diff --check`

风险/遗留：
- S46.1 是治理模板，不自动做 license report、audit baseline 或依赖升级；现有 `express`、`cors`、`dotenv` 的 `latest` range 已记为历史遗留，未来触及时应评估是否改成明确范围。
- 本次为低风险纯文档改动，跳过提交前只读复审子代理；已在共享上下文记录跳过原因。

下一步：
- 开始 S47.1，扩展真实 provider 验收：浏览器路由级连接测试、带 key 健康检查、无 key 跳过和模型费用/速度记录。

---

工具：Codex

步骤：S45.2

提交：24aef7b

完成：
- 新增 `deriveWorldEntityInfluences()` 与 `applyWorldEntityInfluences()`，把已经通过服务器边界的来源结果转成 bounded 实体指标影响；来源包括 AI 合法 `statePatch` 的 before/after 差异、世界 tick、可见关系变化、主动 NPC、长期事件、身份联动和官场结果。
- `POST /api/game/turn` 在官场结算后、World Threads 同步前运行实体 influence pass；JSON 与 SSE turn payload 额外返回本回合 `worldEntityImpacts`。普通 provider 仍不能 patch `worldEntities`，也不能伪造 impacts。
- `worldThreads` 支持 `world_entity` 来源与 `world_entity_pressure` kind；高压可见实体可派生少量议题，既有议题也可通过 `related.entities` 暴露 `relatedEntitySummaries`。这些摘要只来自可见 `worldEntityView`，不读取隐藏实体、`hiddenNotes` 或 `recentNotes`。
- 扩展 `test/worldEntities.test.js`、`test/gameTurnWorldEntities.test.js` 和 `test/worldThreads.test.js`，覆盖 server-owned influence 写入、多来源派生、provider 伪造仍被拒绝、SSE `worldEntityImpacts`、实体议题与隐藏实体不泄漏。
- 同步 README、架构文档、产品 brief、AI 权限矩阵、World Entities 契约、World Threads 契约、共享上下文和本路线图；只读探索子代理 Sartre 梳理了 S45.2 接入点和风险，未编辑文件、未运行 Git 写操作。

验证：
- `node --check src\game\worldEntities.js`
- `node --check src\game\worldThreads.js`
- `node --check src\routes\game.js`
- `node --check test\worldEntities.test.js`
- `node --check test\gameTurnWorldEntities.test.js`
- `node --check test\worldThreads.test.js`
- `node --test test\worldEntities.test.js test\worldThreads.test.js`，12 项通过
- `node --test test\gameTurnWorldEntities.test.js`，4 项通过
- `node --test test\worldThreads.test.js test\gameTurnWorldEntities.test.js`，11 项通过
- `node --test test\gameTurnWorldThreads.test.js test\prompts.test.js`，12 项通过
- `node --test test\stateRules.test.js test\aiSchemas.test.js test\remoteHelpers.test.js test\providerLongRunScript.test.js`，24 项通过
- `node --test test\gameTurnOfficialCareer.test.js test\gameTurnRoleWorldCoupling.test.js test\gameTurnLongTermEvents.test.js test\gameTurnWorldThreads.test.js`，15 项通过
- `npm run eval:ai`，12 项通过
- `$env:AI_PROVIDER='mock'; npm test`，252 项通过
- `git diff --check`
- 提交前只读复审子代理 Volta 初审发现 `sourceType: "world_entity"` 的 legacy 可见 thread 若指向隐藏实体，可能经 `sourceId` 或 `recentResolved` 泄漏；已在 `normalizeThread()`、`normalizeResolvedThread()`、`related.entities` view 过滤和回归测试中修复，follow-up 复审确认无阻塞并批准提交。

风险/遗留：
- 实体 influence 仍是服务器确定性派生，不是新的独立结算器；实际后果仍回到世界 tick、关系、长期事件、官场、身份联动等来源系统。
- 高压实体会派生少量 World Threads，后续若世界议程噪音增加，需要继续补实体议题降噪/合并规则。
- `role_visible` 仍暂按非 hidden 可见处理；若 S45 后续要做身份视野过滤，需要专门补角色条件、测试和浏览器 smoke。
- 本次仍不新增浏览器实体面板；后续若新增，只能读取 `worldEntityView`，并补隐藏 token 与移动/桌面布局验收。

下一步：
- 完成提交前只读复审并提交；随后开始 S46.1 依赖/插件引入模板，或继续做 S45 后续实体视野/UI 降噪小切片。

---

工具：Codex

步骤：S45.1

提交：7341990

完成：
- 新增 `docs/WORLD_ENTITIES_CONTRACT.md` 和 `src/game/worldEntities.js`，定义 server-owned `worldState.worldEntities.schemaVersion = 1` 多实体账本、基础实体目录、归一化/clamp/cap、可见 view 和 prompt 摘要。
- 初始实体覆盖吏部、户部、都察院、地方士绅、河工案牍、县学书院、同年文社、边镇军镇、边墙堡寨、盐漕通道、田赋商税和灾荒赈务；实体按 `court/local/academy/military/fiscal/relief` 分组，并给出压力、承载、信任、亏空等游戏化指标。
- 游戏和考试路由返回 `worldEntityView`；`compactWorldState()` 读取 capped `worldEntities` prompt 摘要；prompt pack、schema/eval、remote helper、provider long-run 和 route red-team 都明确普通 provider 不得 patch `worldEntities`。
- 同步 README、架构文档、产品 brief、AI 权限矩阵、共享上下文和本路线图；只读探索子代理 Socrates 梳理了 S45.1 接入点和风险，未编辑文件、未运行 Git 写操作。

验证：
- `node --check src\game\worldEntities.js`
- `node --check src\routes\game.js`
- `node --check src\routes\exam.js`
- `node --check test\worldEntities.test.js`
- `node --check test\gameTurnWorldEntities.test.js`
- `node --check test\aiControlRedTeam.test.js`
- `node --check testdata\aiEvalFixtures.js`
- `node --check scripts\providerLongRun.js`
- `node --test test\worldEntities.test.js test\stateRules.test.js test\prompts.test.js`，16 项通过
- `node --test test\gameTurnWorldEntities.test.js test\gameTurnWorldThreads.test.js`，7 项通过
- `node --test test\aiSchemas.test.js test\remoteHelpers.test.js test\providerLongRunScript.test.js`，19 项通过
- `node --test test\aiControlRedTeam.test.js test\gameTurnWorldEntities.test.js test\worldEntities.test.js`，10 项通过
- `node --test test\gameTurnOfficialCareer.test.js test\gameTurnRoleWorldCoupling.test.js test\gameTurnLongTermEvents.test.js test\gameTurnWorldThreads.test.js`，15 项通过
- `node --test test\stateRules.test.js test\aiSchemas.test.js test\remoteHelpers.test.js test\providerLongRunScript.test.js`，24 项通过
- `npm run eval:ai`，12 项通过
- `node --test test\examTravel.test.js`，5 项通过；用于确认第一次全量测试中的 Windows 临时文件 rename 抖动没有复现
- `$env:AI_PROVIDER='mock'; npm test`，247 项通过；全量运行期间曾两次遇到 Windows 本地 atomic rename 抖动（一次 `test\examTravel.test.js` 的 `ENOENT rename`，一次 `test\gameTurnLongTermEvents.test.js` 的 `EPERM rename` 导致 route 500），对应 focused rerun 和最终全量复跑均通过
- `git diff --check`
- 提交前只读复审子代理 Ampere 审查最终 diff 与验证摘要，未发现阻塞问题；确认 `worldEntities` 为 server-owned、隐藏实体/`hiddenNotes`/`recentNotes` 不进 view/prompt、start/state/turn/SSE/exam question/exam submit 接入完整。残余风险是 `role_visible` 暂等同于非 hidden 可见，S45.2 若做身份视野过滤需补角色条件与测试。

风险/遗留：
- S45.1 只建立实体账本、API view 和 prompt 摘要，不新增浏览器实体面板，也不让实体直接改写 World Threads 或来源系统结算。
- 完整 `worldState` API 仍按本地开发威胁模型返回内部状态；玩家可见与 prompt 边界依赖 `worldEntityView` 和 `summarizeWorldEntitiesForPrompt()`。
- S45.2 需要把世界 tick、NPC/关系、官场结果和 World Threads 接入实体读写，并补隐藏实体归档、实体派生议题和浏览器 smoke。

下一步：
- 开始 S45.2，让 AI 叙事、NPC 行为、世界 tick、关系账本和官场结果共同读写多实体世界模型的受限视图。

---

工具：Codex

步骤：S44.2

提交：43c610c

完成：
- 新增 `test/aiControlRedTeam.test.js`，用恶意 provider 做 route-level 红队：普通回合混合越权 patch、隐藏关系目标、非法考试触发、provider-owned 科举候选/榜单、AI 与本地反作弊冲突、严重作弊不得晋级、流式失败不落盘。
- 扩展 `testdata/aiEvalFixtures.js` 与 `test/aiEvalFixtures.test.js`，增加 S44 混合越权离线 fixture，确认 opening/turn schema 拒绝跨系统状态写入。
- 扩展官职幻觉 guard：`src/game/stateRules.js` 现在对 provider `player.position` 的空格、繁体、署理/护理/兼管和常见英文官名做归一化识别，测试覆盖 `內閣大學士`、`Grand Secretary`、`minister of revenue` 等变体。
- 加固错误脱敏：`src/ai/diagnostics.js` 会遮蔽已配置密钥的长片段，`src/routes/game.js` 的 SSE `error` 事件也复用 `redactSecrets()`，避免 provider 错误文本把 key 或片段发给浏览器。
- 同步 README、架构文档、产品 brief、AI 权限矩阵、共享上下文和本路线图；只读探索子代理 Leibniz 梳理了 S44.2 覆盖与高风险缺口，未编辑文件、未运行 Git 写操作。
- 提交前只读审查子代理 Ohm 复核 runtime/test/doc diff，未发现阻塞问题；其额外运行 `node --test test\aiControlRedTeam.test.js test\stateRules.test.js test\aiDiagnostics.test.js test\aiEvalFixtures.test.js`，26 项通过。

验证：
- `node --check src\game\stateRules.js`
- `node --check src\ai\diagnostics.js`
- `node --check src\routes\game.js`
- `node --check test\aiControlRedTeam.test.js`
- `node --check testdata\aiEvalFixtures.js`
- `node --test test\aiControlRedTeam.test.js`，4 项通过
- `node --test test\stateRules.test.js test\aiDiagnostics.test.js test\aiConnectionRoute.test.js`，12 项通过
- `node --test test\aiEvalFixtures.test.js test\remoteHelpers.test.js`，15 项通过
- `node --test test\streamingTurnRoute.test.js test\gameTurnExamTrigger.test.js`，8 项通过
- `node --test test\gameTurnOfficialCareer.test.js test\gameTurnRelationships.test.js test\gameTurnWorldThreads.test.js`，13 项通过
- `npm run eval:ai`，12 项通过
- `$env:AI_PROVIDER='mock'; npm test`，240 项通过
- `git diff --check`

风险/遗留：
- S44.2 route 测试确认流式失败后不落盘且 SSE error 脱敏；但如果 provider 在失败前已经流出顶层叙事，网络层文本已经到达客户端，浏览器必须继续丢弃 pending 文本。
- `POST /api/exam/question` 仍依赖 provider schema 校验题面结构；若未来允许自定义 provider 绕过 adapter，应再加 route-level `passScore/wordCount/requirements` sanity clamp。
- 完整 `worldState` API 仍按本地开发威胁模型返回内部状态；玩家可见 UI/prompt view 才承担隐藏信息过滤。

下一步：
- 开始 S45.1，多实体世界模型：朝廷衙门、地方士绅、书院同门、军镇边墙、商税盐漕和灾荒赈务。

---

工具：Codex

步骤：S44.1

提交：91da506

完成：
- 新增 `docs/AI_CONTROL_AUDIT_MATRIX.md`，定义 AI 权限术语（可生成、可建议、可排序、可评分、可解释、不可写、不可裁决）和当前本地开发威胁模型。
- 逐系统列出 AI 权限、服务器裁决与持久化、玩家可见性、当前代码/测试证据和 S44.2 red-team 缺口，覆盖 AI 连接诊断、开局、普通回合、SSE、世界 tick、考试触发、科举出题/评分/虚拟考生、关系、主动 NPC、长期事件、官场、身份联动、World Threads、存档、隐藏信息和浏览器显示。
- 明确 S44.2 优先测试清单：越权 patch 组合包、幻觉官职扩展、非法晋级/考试门禁、隐藏 token 统一扫描、作弊误判边界和流式失败回滚。
- 同步 README、架构文档、产品 brief 和本路线图，把 S44 矩阵设为后续新增 AI 可读摘要、可建议字段、服务器拥有 ledger、浏览器面板和 red-team/eval 覆盖的入口。
- 只读探索子代理 Banach 梳理了现有 AI/服务器边界、代码证据和 S44.2 缺口，未编辑文件、未运行 Git 写操作。
- 提交前只读复审子代理 Gibbs 审查最终 diff 与验证摘要；复审无阻塞，提出浏览器 raw `worldState` 兼容 fallback 需在矩阵中说明，已补入威胁模型和 S44.2 隐藏泄漏清单。

验证：
- `git diff --check`
- 本次为纯文档矩阵与协作记录更新，未运行代码测试。

风险/遗留：
- 当前威胁模型仍是本地开发与本机浏览器；API state route 仍返回完整 `worldState` 给同客户端。若未来支持远程或不可信客户端，需要新增脱敏状态 API。
- 普通真实 provider 调用仍可能 fallback 到 Mock 保持可玩；真实 provider 连通性以 `POST /api/ai/connection-test`、`smoke:provider` 和 `smoke:provider:long` 为准。
- S44.1 只完成审查矩阵，不新增 red-team/eval 测试；测试落地留给 S44.2。

下一步：
- 开始 S44.2，按矩阵优先补越权 patch、幻觉官职、非法晋级、隐藏泄漏、作弊误判和流式失败的红队/离线 eval/route 测试。

---

工具：Codex

步骤：S43.2

提交：5c8310a

完成：
- `worldThreadView.activeThreads[]` 新增 `goal`、`deadlineLabel`、`riskLabel`、`riskTone`、`relatedLabels`、`interventionHints` 和 `followUpHint`；prompt `worldThreads` 摘要同步读取这些可见字段。
- 浏览器角色面板新增 `#world-thread-panel`，只读取服务器给出的 `worldThreadView`，显示议题目标、期限、风险、牵连对象、介入提示和近归档余波；没有做一键结算，不替代主动请托、长期事件、官场差事或身份联动的来源规则。
- 扩展 browser smoke helper 与单测：检查 `.world-thread-card` 稳定 selector、字段完整性、hidden text token 不泄漏，以及桌面/移动横向溢出。
- 同步 README、架构文档、产品 brief、World Threads 契约、共享上下文和本路线图；只读探索子代理 Carson 梳理了 S43.2 前端和 smoke 切入点，未编辑文件、未运行 Git 写操作。
- 提交前只读复审子代理 Hooke 审查最终 diff 与验证摘要；初审提出 `.world-thread-card[data-risk]` selector 未被 smoke 强制，已补 selector、空 `data-risk` 检查和单测，follow-up 审查通过。

验证：
- `node --check src\game\worldThreads.js`
- `node --check public\app.js`
- `node --check scripts\browserSmoke.js`
- `node --test test\worldThreads.test.js test\browserSmokeScript.test.js`，33 项通过
- `node --test test\gameTurnWorldThreads.test.js test\prompts.test.js`，11 项通过
- `node --test test\stateRules.test.js test\aiSchemas.test.js test\remoteHelpers.test.js test\providerLongRunScript.test.js`，24 项通过
- `npm run eval:ai`，11 项通过
- `$env:AI_PROVIDER='mock'; npm run smoke:browser`，通过；UI acceptance 包含 `world-thread`，14 张截图检查
- `$env:AI_PROVIDER='mock'; npm test`，234 项通过；一次中途复跑曾遇到 Windows `EPERM rename` 临时文件锁，`test\gameTurnTick.test.js` 单跑通过，随后全量复跑通过

风险/遗留：
- 世界议程仍是派生索引和检查视图；归档 outcome 仍以“暂归档”为主，后续若要更细的阶段目标、多来源合并和具体结局，需要各来源模块提供更明确状态。
- 前端只提示自由文本介入方向，不做一键解决按钮；玩家行动仍由服务器裁决。
- 世界议程面板现在依赖 route view；若未来新增离线/旧 payload 兼容路径，仍需避免读取原始 `worldState.worldThreads` ledger。

下一步：
- 复审通过并提交 S43.2 后，开始 S44.1，做 AI 调动/控制适配性审查矩阵。

---

工具：Codex

步骤：S43.1

提交：301ff98

完成：
- 新增 `docs/WORLD_THREADS_CONTRACT.md` 与 `src/game/worldThreads.js`，定义服务器拥有的 `worldState.worldThreads.schemaVersion = 1`、`worldThreadView` 和 prompt 摘要。
- World Threads 当前从主动 NPC 请托、长期事件、官场差遣、官场结果、角色世界联动、边镇压力、派系压力和地方案链派生议题；只做归一化、去重、排序、可见性过滤和近期归档，不替代原结算器。
- 游戏 start/state/turn、SSE preview/final、考试 question/submit 均返回 `worldThreadView`；`compactWorldState()` 以 `worldThreads` 字段向 prompt pack 提供可见议题摘要。
- 加固 AI 边界：prompt pack、AI schema/eval fixtures、provider long-run 检查、remote helper 和 state patch 白名单都把 `worldThreads` 视作服务器拥有字段，普通 provider 不能直接写入。
- 同步 README、架构文档、产品 brief、共享上下文和本路线图；只读探索子代理 Wegener 梳理了 S43.1 集成点和风险，未编辑文件、未运行 Git 写操作。
- 提交前只读子代理 Arendt 审查最终 diff 与验证摘要；初审发现旧档 hidden `recentResolved` 议题可能泄漏到可见视图/prompt，已修复并补回归测试，follow-up 审查通过。

验证：
- `node --check src\game\worldThreads.js`
- `node --check src\routes\game.js`
- `node --check src\routes\exam.js`
- `node --check src\ai\prompts.js`
- `node --test test\worldThreads.test.js`，5 项通过
- `node --test test\gameTurnWorldThreads.test.js`
- `node --test test\stateRules.test.js test\aiSchemas.test.js test\remoteHelpers.test.js test\prompts.test.js test\providerLongRunScript.test.js`
- `npm run eval:ai`
- `node --test test\gameTurnLongTermEvents.test.js test\gameTurnOfficialCareer.test.js test\gameTurnRoleWorldCoupling.test.js`
- `$env:AI_PROVIDER='mock'; npm test`，232 项通过
- `git diff --check`

风险/遗留：
- S43.1 没有新增前端世界议程面板，也不新增任务目标、玩家介入点或议题结算；这些留给 S43.2。
- World Threads 是派生索引，长期事件、官场、请托和身份联动仍是各自的裁决来源；后续若要合并同一件事的多来源，需要继续完善 sourceRefs/干预线索。已补旧档隐藏 thread 不进入 `recentResolved` 的回归测试。
- 当前浏览器 smoke 尚未检查 `worldThreadView`，因为还没有 UI 面板；S43.2 做面板时应补桌面/移动溢出和隐藏信息不泄漏验收。

下一步：
- 开始 S43.2，基于 `worldThreadView` 做世界议程前端检查视图，并为议题补目标、期限、风险、相关人物、玩家可介入点和后续结算。

---

### 2026-05-06

工具：Codex

步骤：S42.3

提交：60b2fd7

完成：
- 扩展 `public/app.js` 的 `#official-career-panel`，用服务器生成的 `officialCareerView` 渲染官署、差事、考成、关系与风险、履历档案，不直接读取隐藏札记或 provider 原文。
- 新增稳定浏览器 selector：`data-current-posting`、`data-impeachment-stage`、`data-bureau-id`、`data-assignment-*`、`data-pending-recommendation` 和既有 `data-outcome-*`，供 smoke 断言和后续 UI 迭代复用。
- 扩展 `public/styles.css` 的官场档案样式，桌面和移动端都保持面板可扫描、文本可换行、卡片不互相挤压。
- 扩展 `scripts/browserSmoke.js` 与 `test/browserSmokeScript.test.js`，覆盖官署/差事/考成/关系/风险 DOM、Mock 赈灾差遣、允许状态集合、隐藏官场文本 token 不泄漏、直入官员和书生入仕后的官场面板。
- 同步 README、架构文档、产品 brief、官场契约和浏览器验收记录；子代理 Peirce 先行实现了部分 browser-smoke helper/test，未运行 Git 写操作，主代理随后整合、补齐并验证。

验证：
- `node --check public\app.js`
- `node --check scripts\browserSmoke.js`
- `node --test test\browserSmokeScript.test.js`，26 项通过
- `$env:AI_PROVIDER='mock'; npm run smoke:browser`，通过；覆盖 14 张截图检查、完整四级科举入仕、官场档案、赈灾差遣、隐藏 token 不泄漏和移动端布局
- `$env:AI_PROVIDER='mock'; npm test`，222 项通过；首次全量复跑曾遇到 Windows `EPERM rename` 临时文件锁，失败文件 `test\examTravel.test.js` 单跑通过，全量复跑通过
- `git diff --check`
- 提交前只读子代理审查最终 diff 与验证摘要；初审提出差事 kind/status 未绑定同一记录、考成/关系/弹劾区块可能被占位误报、契约样例字段名不一致，已补绑定校验、`data-view-ready` 断言和文档字段修正。

风险/遗留：
- S42.3 只呈现 S42.2 已有的官场 view，不新增跨月世界议题、差事后续链或真实 provider 长跑验收。
- 官场差事仍是确定性最小规则集；赈灾、清丈、案牍等长期牵连应在 S43 World Threads 中沉淀为跨月议题。
- 浏览器 smoke 使用 Mock provider 验收；真实 provider 的路由级连接、成本/耗时和无 key 跳过策略仍按 S47 处理。

下一步：
- 开始 S43.1，统一 World Threads，让官场差事、NPC 请托、地方灾荒、边事和派系斗争能形成跨月可追踪议题。

---

工具：Codex

步骤：S42.2

提交：9980c6e

完成：
- 新增 `src/game/officialCatalog.js` 和 `test/officialCatalog.test.js`，集中维护翰林院、六部、都察院、布政司、按察司、府州县等官署和常见官职目录，提供官职推断、玩家摘要、升迁/平调/外放候选 helper。
- 将 `worldState.officialCareer.schemaVersion` 升至 `2`，在初始状态和归一化中兼容旧 v1 存档，并新增 `bureauId`、`assignments`、`assessmentDossier`、`impeachmentProcedure`。
- `runOfficialCareerStep()` 现在接收玩家输入并分类官场行动：赈务、清丈、案牍、河工、军需、盐漕、科场、奏疏、考成、弹劾、调任、外放、丁忧和起复都能推进服务器拥有的差事/考成/弹劾流程；官职任免仍由 S34/S42 结算规则裁决。
- 扩展 `officialCareerView` 与 prompt 摘要，公开官署、差事、考成、关系和弹劾风险摘要，不泄漏 `hiddenNotes`。
- 加固 provider 边界：普通 provider 仍不能写 `officialCareer`、`officeTitle` 等服务器字段；official 玩家场景下，明显官职或目录可识别官名的 `player.position` patch 会被忽略。
- 同步 README、架构文档、产品 brief、官场契约和共享上下文。

验证：
- `node --check src\game\officialCareer.js`
- `node --check src\game\officialCatalog.js`
- `node --check src\game\stateRules.js`
- `node --test test\officialCatalog.test.js test\officialCareer.test.js test\officialRole.test.js test\gameTurnOfficialCareer.test.js test\stateRules.test.js`，28 项通过
- `$env:AI_PROVIDER='mock'; npm test`，219 项通过
- `git diff --check`
- 提交前只读子代理审查最终 diff 与验证摘要；初审提出 `player.position` 官职过滤可被空格和未列官名绕过，已补过滤与测试，follow-up 审查通过。

风险/遗留：
- S42.2 只扩展 API/runtime view；浏览器仍显示紧凑官场面板，官署/差事/履历/关系/风险的完整 UI、DOM selector 和截图验收留给 S42.3。
- 官职目录是轻量游戏目录，不是严格品级资料库；后续若增加朝代差异或更细品级，应继续由服务器目录集中维护。
- 差事与考成目前是确定性最小规则集，尚未接入 S43 World Threads 的跨月议题后果。

下一步：
- 开始 S42.3，基于 `officialCareerView` 增加官场 UI、档案、浏览器旅程和 Mock/真实 provider 验收。

---

工具：Codex

步骤：S42.1

提交：fd4b805

完成：
- 在 `docs/OFFICIAL_CAREER_CONTRACT.md` 增加 S42.1 深度官场契约，保留 S34 结果引擎为当前运行时基础。
- 明确 `player.officeTitle` 是服务器拥有的实授官职，`player.position` 是软描述，`worldState.officialCareer.currentPosting` 是服务器归一化履历位置。
- 定义后续 S42.2/S42.3 的官职目录、衙门/部院、差遣、考成卷宗、座主/同年/上官/政敌标签、弹劾流程、廷推、调任、外放、丁忧/起复、浏览器官场档案和 AI 权限边界。
- 同步 README、架构文档和产品 brief，让后续工具不必从聊天记录恢复 S42.1 决策。
- 委派只读子代理检查现有官场代码、测试、前端展示和 scholar -> official 主线约束；子代理未编辑文件、未运行 Git 写操作。

验证：
- `node --test test\officialCareer.test.js test\officialRole.test.js test\gameTurnOfficialCareer.test.js test\examRules.test.js test\gameStartRole.test.js`
- `git diff --check`

风险/遗留：
- 本次是契约与协作文档更新，不改变运行时代码、API、存档 schema 或浏览器 UI。
- `player.position` 当前仍在 provider patch 白名单中；S42.2 实现时需要按契约过滤明显官职伪造，避免 UI 或 prompt 把软描述当成服务器任免。
- S42.2 仍需实现静态官职/衙门目录、差遣状态、考成卷宗、弹劾流程归一化和对应测试。

下一步：
- 开始 S42.2，实现官场行动与履历系统。建议先做官职/衙门目录与 v1 存档兼容归一化，再接差遣和考成规则。

---

工具：Codex

步骤：context compaction

提交：current documentation commit

完成：
- 将 `docs/QIANQIU_DEVELOPMENT_BRIEF.md` 的 S11-S38.3 历史实现笔记迁入 `docs/QIANQIU_DEVELOPMENT_HISTORY_ARCHIVE.md`，让必读 brief 聚焦当前产品契约和开发规范。
- 将本文件中第四阶段早期详细进度记录迁入 `docs/FOURTH_PHASE_PROGRESS_ARCHIVE.md`，当前台账保留路线图、使用规则和最新压缩记录。
- 明确归档策略：日常启动只读必读四件套；追溯旧阶段细节、旧验证命令或历史决策时再打开归档文件。
- 必读四件套总行数从约 1543 行降到约 1068 行；`docs/QIANQIU_DEVELOPMENT_BRIEF.md` 从 998 行降到 642 行，本文件从 367 行降到 246 行。

验证：
- `git diff --check`

风险/遗留：
- 本次只搬迁和压缩文档，不改变运行时代码、API、测试、提示词或玩家存档。
- 旧阶段详细记录仍可在新增归档文件中追溯；后续完成新步骤时应继续在本台账写短记录，必要细节再归档。

下一步：
- 继续按当前路线图推进 S42.1 深度官场契约，或先做 S44.1 AI 调动/控制审查矩阵。

---

## 6. 详细进度归档

S40.1、S40.2、S41.1、S41.2、DeepSeek 缓存规划和中文输出规范的详细进度记录已迁入 `docs/FOURTH_PHASE_PROGRESS_ARCHIVE.md`。当前步骤表仍保留完成状态与提交哈希；需要旧验证命令和遗留风险时再读取归档。
