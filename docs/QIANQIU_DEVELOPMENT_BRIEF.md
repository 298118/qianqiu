# 《千秋》开发文稿与执行规范

## 1. 项目定位

《千秋》是一款 AI 驱动的历史模拟文字游戏。玩家穿越到真实或架空的中国古代历史环境中，扮演皇帝、大臣、将领、地方官、书生、入仕官员等身份，通过自然语言输入圣旨、政令、奏折、策论、文章或日常行动，由大语言模型推演王朝局势与个人命运。

本项目第一阶段必须交付并持续保护一个可运行的浏览器游戏：

- 前端：S74.1 已创建 `client/` React + TypeScript + Vite 默认前端，生产构建输出 `dist/client/` 接管默认 `/`；React Router Data Mode 管理首页、主卷、舆图、人物、囊箧、史册、科举、皇榜、朝议和设置等多页 SPA 路由。S77.3 起 React 入口自托管 Noto Serif SC 简体中文 400/700/900 字重，避免 Linux/CI 或无中文系统字体环境出现方框字；S77.6 起新增自托管 ZCOOL XiaoWei、Long Cang、Ma Shan Zheng 简体中文 400 子集，玩家可在本地显示偏好选择正文字体，考试、皇榜和金榜题名场景固定使用艺术字并支持低动效降级；S77.4 起 browser smoke 统一扫描 DOM、浏览器存储、运行时 manifest 安全字段和截图产物名，阻断 key、本地路径、raw prompt/provider 与 hidden/raw 词样，S77.6 起还检查浏览器级 reduced-motion 与按钮/链接内部文本溢出。旧原生 `public/index.html` / `app.js` / `styles.css` 暂留作迁移参考，不再是交付入口。
- 后端：Node.js + Express，当前以 CommonJS JavaScript 为主；S86 起采用渐进 TypeScript 迁移，优先覆盖契约、API/view 类型、安全 projection、AI schema/provider facade、storage adapter 和核心 resolver，不做全仓重写。
- AI：适配器模式，支持 Mock、OpenAI、DeepSeek、Claude/Anthropic。
- 存储：默认本地 JSON session 文件；可选本地 SQLite session row adapter、本地审计日志、`schema_migrations` 与维护命令。
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
- S49-S67 本地数据库与大世界内容：storage adapter、可选 SQLite session row、本地审计、地理/人物/官职任所业务表、安全事件档案、prompt 检索、双模式验收、规模内容契约、small/medium/large fixture、国家/城市/NPC/官职/案牍/军务/财赋/事件链/情报、prompt 策略、浏览器分页和 large fixture 规模验收，统一归档见 [LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md](LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md)。旧分卷归档和 S60 契约文件仅保留为跳转页。
- S68-S69 科举、读书、评卷与授官深化：科举制度契约、读书账本、老师点评、科场流程、多考官阅卷、榜单荣誉、同年座师网络、授官轨迹、浏览器科举档案面板和 Provider/Mock 验收，归档见 [IMPERIAL_EXAM_DEEPENING_ARCHIVE.md](IMPERIAL_EXAM_DEEPENING_ARCHIVE.md)。
- S72 PixiJS 水墨地图：PixiJS 地图运行时、首批素材、前端 shell、局势簿联动、水墨动效、浏览器验收、安全回归和协作口径切换，归档见 [PIXIJS_INK_MAP_ARCHIVE.md](PIXIJS_INK_MAP_ARCHIVE.md)。
- S73-S77 前端水墨重构：水墨/手绘/宣纸与奏折质感的整体前端重构已完成并归档，归档见 [FRONTEND_INK_REDESIGN_ARCHIVE.md](FRONTEND_INK_REDESIGN_ARCHIVE.md)，规划源头见 [FRONTEND_INK_REDESIGN_ROADMAP.md](FRONTEND_INK_REDESIGN_ROADMAP.md)，S73.1 视觉资产指南见 [FRONTEND_VISUAL_ASSET_GUIDE.md](FRONTEND_VISUAL_ASSET_GUIDE.md)，S73.2 前端素材台账见 [FRONTEND_ASSET_LEDGER.md](FRONTEND_ASSET_LEDGER.md)。

当前活动路线图见 [DEVELOPMENT_STEPS.md](DEVELOPMENT_STEPS.md)，数据库方向见 [DYNAMIC_WORLD_DATABASE_PLAN.md](DYNAMIC_WORLD_DATABASE_PLAN.md)。S49-S67 已把本地数据库和“超大动态世界数据库”的内容密度、可见性、prompt 检索、浏览器分页和规模验收收束为统一归档；S68-S69 已完成并归档；S70 AI prompt/tool/actor/多模型路由、AI 设置、月报、跳时、记忆、地图接口、provider AI-first smoke 和 JSON/SQLite parity 已完成并归档到 [AI_ORCHESTRATION_ARCHIVE.md](AI_ORCHESTRATION_ARCHIVE.md)。S71 数据库玩法化、维护、安全检索、redacted player API、财政/刑名/军务外交服务器 resolver、压力驱动事件、多 actor 场景、NPC 记忆账本、AI 调动审计面板和验收结果已归档到 [DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md](DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md)，规划源头仍见 [DATABASE_GAMEPLAY_RESOLVER_ROADMAP.md](DATABASE_GAMEPLAY_RESOLVER_ROADMAP.md)，resolver 输入契约仍见 [DATABASE_RESOLVER_INPUT_CONTRACT.md](DATABASE_RESOLVER_INPUT_CONTRACT.md)。S72 PixiJS 水墨地图专项已完成归档，归档见 [PIXIJS_INK_MAP_ARCHIVE.md](PIXIJS_INK_MAP_ARCHIVE.md)；规划源头仍见 [PIXIJS_INK_MAP_ROADMAP.md](PIXIJS_INK_MAP_ROADMAP.md)，运行时契约见 [PIXIJS_INK_MAP_RUNTIME_CONTRACT.md](PIXIJS_INK_MAP_RUNTIME_CONTRACT.md)，素材指南见 [MAP_ASSET_GUIDE.md](MAP_ASSET_GUIDE.md)，素材台账见 [MAP_ASSET_LEDGER.md](MAP_ASSET_LEDGER.md)。S73-S77 前端水墨重构已完成并归档，归档见 [FRONTEND_INK_REDESIGN_ARCHIVE.md](FRONTEND_INK_REDESIGN_ARCHIVE.md)，规划源头仍见 [FRONTEND_INK_REDESIGN_ROADMAP.md](FRONTEND_INK_REDESIGN_ROADMAP.md)：S73 完成视觉资产、manifest、素材 QA 和全量立绘池；S74 完成 React + TypeScript + Vite + React Router Data Mode 默认入口、安全 API client、Zustand 状态层、shell/surface registry、asset registry 和 React 舆图桥；S75 完成首页画卷、开局表单、右上角印匣、存档/读档、显示偏好、底部奏折和只读快捷行动建议；S76 完成主游戏壳、六类身份面板、科举/放榜全屏、独立舆图页、人物谱牒、专题 surface 扩展位和 S76 总验收；S77 完成默认入口确认、浏览器 history/fallback smoke、视觉像素、安全污染防线、性能资源预算、可访问性/字体系统、归档与总验证。S80 已完成服务端全局 AI 设置、全任务矩阵面板、保存状态反馈、provider 可用性提示和旧 session 设置入口兼容。旧 `public/index.html`、`public/app.js`、`public/styles.css` 和 `public/mapPanel.js` 仅保留为迁移参考，产品内不保留 `/legacy.html` 或 `/ink-client/` 双入口。S73-S77 人物与素材显示必须继续通过已审核 `portraitRef`、缩略图、低清占位、精简 runtime manifest 和 fallback 使用，不得显示未审核素材、不得硬编码本地路径、不得一次性拉取全量立绘池。2026-05-14 起，按用户要求停止与 Gemini CLI 共同开发，后续开发全部由 Codex 负责；Codex 负责后端、前端、素材、审核、验证、文档同步和 Git 提交。AI 生图统一由 Codex 使用 `gpt-image-2` 完成；AI 生成素材和第三方优秀素材入库前，都必须由 Codex 使用视觉能力审核游戏基调、历史/水墨适配、缩放可读性和同批一致性。当前不规划远程存档、账号体系、多人同步、云端冲突解决或托管数据库。

S74.0 更新：依赖治理已通过，`package.json` / lockfile 已加入 React、React DOM、React Router、Zustand、Lucide、TypeScript、Vite、`@vitejs/plugin-react`、Vitest、Testing Library、jsdom 和类型声明包，迁移契约见 [FRONTEND_REACT_MIGRATION_CONTRACT.md](FRONTEND_REACT_MIGRATION_CONTRACT.md)。S77.3 更新：为浏览器中文可靠渲染新增 `@fontsource/noto-serif-sc` runtime 字体依赖，只导入简体中文 400/700/900 字重。S77.6 更新：新增 `@fontsource/zcool-xiaowei`、`@fontsource/long-cang`、`@fontsource/ma-shan-zheng` runtime 字体依赖，均只导入简体中文 400 子集，用于本地正文字体选择和场景艺术字；许可证、资源预算和回滚记录见 [DEPENDENCY_PLUGIN_GOVERNANCE.md](DEPENDENCY_PLUGIN_GOVERNANCE.md) 与活动台账。

S74.1 更新：已新增 `client/`、Vite/TypeScript/Vitest 配置、最小 React Router Data Mode 多页壳、Express history fallback、S74.1 focused browser smoke 和 `prestart` 构建入口。`dist/client/` 生产构建接管默认 `/`；`public/assets/`、`public/vendor/`、`public/mapRenderer.js` 和 `public/mapPanel.js` 继续作为已审核素材与 S72 地图资源路径。旧原生前端保留为迁移参考，不再作为默认交付入口。S77.1 起 `prestart` 通过 `scripts/ensureClientBuild.js` 检查缺失/陈旧 React 构建产物，必要时自动构建、已最新时跳过，保证 `npm install && npm start` 默认入口可打开。S74.1 仍未接入真实 start/load/turn/exam/AI settings API client，S74.2 继续补安全 API client。

S74.2 更新：已新增 React 安全 API client、宽松 response 类型、Zustand 会话 store 和页面最小接线。新前端现在只通过 `POST /api/game/start`、`GET /api/game/saves`、`GET /api/game/player-state/:sessionId`、`POST /api/game/turn`、`POST /api/exam/question|progress|submit`、`GET/POST /api/ai/settings/global`、兼容 `GET/POST /api/ai/settings/:sessionId` 和 `POST /api/ai/connection-test` 工作；普通读档明确不使用 `GET /api/game/state/:sessionId`，也不接开发诊断、raw audit、provider payload、完整 prompt、本地路径或 key。非 UUID 预览/烟测案卷不会自动请求后端。

S74.3 更新：已新增 React UI 状态层，`client/src/state/uiState.ts` 管理当前 route page、`sessionId`、安全玩家摘要、drawer/modal/surface、tab、action draft 和 display preferences；`gameSessionState` 在开局、读档、普通回合和交卷成功后同步安全摘要，普通回合成功清空行动草稿。该 store 不保存完整 `worldState`、raw provider payload、hidden ledger、完整 prompt、本地路径或 key；S75.7 起显示偏好通过独立白名单存储层本地持久化，不进入服务器 canonical state。

S74.4 更新：已新增 `AppShell`、`SurfaceHost`、overlay focus helper 和 `surfaceRegistry`，统一管理设置/存档/显示偏好抽屉、安全 modal、人物档案、拟圣旨、阅奏折和舆图筛选专题层；支持 Esc 关闭、焦点回收、页面滚动锁定和路由切换滚动恢复。专题层当前只显示安全占位与行动草稿入口，不读取内部审计原文、模型原文、完整 prompt、本地路径或 key，不导入未审核素材或全量立绘池。

S74.5 更新：已新增 `client/src/assets/assetRegistry.ts`、`client/src/assets/useAssetRegistry.ts` 和 `client/src/components/Portrait.tsx`。S77.5 后 React runtime 通过 `/assets/ui/ink-ui-runtime-manifest.json` 读取精简运行时 manifest，完整 `/assets/ui/ink-ui-manifest.json` 只作为素材生产与 QA 源头；registry 继续按 `runtimeUsableReviewStatuses`、安全 `/assets/ui/` 路径、fallback、缩略图、低清占位和 `allowEagerLoad=false` 建立资产查询层，未审核或 planned 矩阵条目默认不可用。人物页已按 `usage="people_page"` 分页接入全部人物页可用立绘，每页只渲染 8 张当前公开人物；按当前体验取向，可见人物优先使用 manifest 中已审核主图以保证清晰，女性单张高清重制覆盖优先列前。S79.3 起 `Portrait` 在可欣赏立绘右上角提供放大入口，打开 `SurfaceHost` 统一托管的只读高清查看器；查看器只读取已审核 `portraitRef` 对应的 runtime 主图路径，不写 canonical state、URL、localStorage/sessionStorage、行动草稿或 AI prompt。registry、`Portrait` 和查看器不输出完整 prompt、provider 原文、本地 artifacts 路径、key、raw audit 或 hidden 内容。

S74.6 更新：已新增 `client/src/components/InkMapRuntimeBridge.tsx`，React 路由动态加载 `/vendor/pixi.min.js` 和 `/mapRenderer.js`，直接复用 S72 `window.MapRenderer` 的 PixiJS 水墨地图渲染能力；React 自己管理容器、label、tooltip 和行动草稿，不调用旧 `public/mapPanel.js` 的 DOM 单例，不依赖旧 `public/app.js`、旧 `#action-input` 或旧 `#information-panel`。`MapPage` 只从当前安全 session payload 读取 `mapRuntimeView`，并要求 `currentSession.sessionId` 与路由 `sessionId` 一致；地图按钮只写入 React/Zustand 行动草稿，玩家仍需在主卷提交普通回合，服务器继续拥有移动、案件、军务、财政、外交和任免裁决。`mapRuntimeView` 显示坐标仍只服务浏览器布局，不进入 prompt、AI 工具或服务器 resolver。既有 `ink-map-v1` 底图已复看并继续使用，本步不重做地图素材。

S74.7 更新：默认入口验收已把 React 新前端作为当前浏览器基线。`AppShell` 在真实案卷中会把顶部“主卷/舆图/人物/史册”导航绑定到当前安全 `sessionId`，避免落回 `s74-preview`；`scripts/clientSmoke.js` 无 `--url` 时显式固定 `AI_PROVIDER=mock`，并从 `/` 首页表单真实 Mock 开局，验证当前 session 导航、`/game/:sessionId/map|people|archive|exam|ranking|court|settings` 刷新恢复、舆图 canvas、人物懒加载分页、移动端首页和 unsafe `/api/game/state/*` / `/api/dev/*` 请求防线。`npm run smoke:browser` 现在是 React 默认入口 smoke；旧 `scripts/browserSmoke.js` / `smoke:browser:legacy` 仅作迁移参考。产品内不保留 `/legacy.html` 或 `/ink-client/` 双入口；失败回退方式是 Git revert 或恢复上一提交。

S75.1 更新：首页画卷布局已接入默认 `/`。React 首页现在使用 S73.4 已审核的 `home-scroll-landscape-v1`、`home-mist-layer-v1`、`home-register-form-paper-v1`、`home-cinnabar-start-seal-v1`、`home-archive-casefile-v1` 和 `home-static-reduced-motion-v1` 组合为首屏画卷、云雾、中央册页表单和旧案卷提示；标题“千秋”不放入卡片，移动端首屏保留标题、主要表单和下方旧案卷提示。首页继续只调用现有安全 start/saves 接口，不新增 raw state、开发诊断、provider payload、prompt、本地路径或 key 暴露；S75.2/S75.3 再扩展完整开局字段和朱印反馈。

S75.2 更新：开局表单已补齐朝代、年份、六类身份、姓名、书生家境和自定背景。React 首页继续通过安全 `startNewGame` 调用 `POST /api/game/start`，不读取 raw state、开发诊断、provider payload、完整 prompt、本地路径或 key；服务器新增书生公开家境归一化，`familyBackground` 只接受贫寒/普通/世家并且只在 `scholar` 身份保留，非书生忽略该字段。自定背景写入公开 `customSetting`，不是 hidden 私档，不授予功名、官职或绕过科举晋级。S75.3 继续做朱印盖章反馈。

S75.3 更新：朱印开始按钮反馈已完成。React 首页在现有安全 start 表单上增加同步 `submitLockRef` 防线，连续 Enter、双击或同一提交周期重复 submit 只会触发一次 `POST /api/game/start`；按钮提供短促落章反馈、loading 扫光、disabled 和错误重整视觉，并用 `aria-busy` / `aria-live` 给出状态说明。动效同时尊重应用显示偏好和系统 `prefers-reduced-motion: reduce`，低动效下不播放落章动画。此步不改后端 API/schema、provider schema、SQLite schema、存档格式、AI 权限、科举晋级或官职裁决规则。

S75.4 更新：右上角印匣入口已完成。React `AppShell` 顶部工具收束为单一“印匣”按钮；`SurfaceHost` 设置抽屉改为 AI 设置、旧案、显示、安全四个 tab，并保留旧存档/显示偏好抽屉入口的兼容映射。印匣内可调整当前案卷 AI preset、试连 provider、刷新并载入旧案、返回首页、调整运行时显示偏好和查看安全玩家摘要；读档继续通过安全 `loadSession` / `GET /api/game/player-state/:sessionId`，不读取 raw state、开发诊断、内部审计原文、模型原始返回、完整提示词、本地路径或 key。此步不改后端 API/schema、provider schema、SQLite schema、存档格式、AI 权限、科举晋级、官职裁决或显示偏好持久化。

S80 更新：服务端全局 AI 设置已接管设置页和印匣 AI 设置。新增 `GET/POST /api/ai/settings/global` 与运行时文件 `data/settings/ai-global-settings.json`；旧 `GET/POST /api/ai/settings/:sessionId` 只保留兼容，仍校验案卷存在，但读写同一份全局设置并返回 `scope: "global"`、`targetSessionId`、`updatedAt`、`aiSettingsView`、`aiInvocationSummaryView` 和 `aiControlAuditView`。全局设置存在时，开局、普通回合、流式回合、考试出题、考试评卷、快捷建议和专题拟稿统一使用全局 route policy。React `AiSettingsPanel` 渲染 11 类任务矩阵：叙事、人物心智、筹划、制度专题、复核、安全门、记忆提要、月报、跳时、快捷建议和专题拟稿；预设完全来自服务端 `presets`，不再硬编码 `deep`。面板明确显示未保存/保存中/已保存/保存失败、保存时间、provider key 可用性和每类任务生效状态；保存成功后以前端收到的服务端返回值回填表单。全局设置文件只保存校验后的 provider/model/预算/温度/安全控制，不保存 key、base URL、prompt、raw provider payload 或本地路径；缺 key 的真实 provider 不能作为可生效全局路由保存，review-only/no-tool 任务继续由服务器裁剪权限。

S81-S84 更新：NPC、资产与储物系统首轮闭环已完成，规划源头见 [NPC_INVENTORY_SYSTEM_ROADMAP.md](NPC_INVENTORY_SYSTEM_ROADMAP.md)，执行契约见 [NPC_INVENTORY_SYSTEM_CONTRACT.md](NPC_INVENTORY_SYSTEM_CONTRACT.md)。后端新增 `assetLedger`、`inventoryLedger`、`npcRoster`、`npcInteractionLedger`、`tradeLedger`、`delegatedTaskLedger` 和 `openingBackgroundClaims`；`POST /api/game/start` 会先让 `background_claim_parser` 解析玩家自由背景，再由服务器裁决宅产、银两/粮金、书籍声望、债务、禁物、军权、官职和虚假身份宣称，只有服务器接受或折算后的资源、资产、凭证和风险进入账本。新增安全 API：`GET /api/game/inventory/:sessionId`、`POST /api/game/inventory-transfer/:sessionId`、`GET /api/game/npcs/:sessionId`、`GET /api/game/npc/:sessionId/:npcId`、`POST /api/game/npc-interaction/:sessionId`、`POST /api/game/trade/:sessionId`、`POST /api/game/npc-command/:sessionId`。AI 设置矩阵新增 `background_claim_parser`、`npc_dialogue`、`npc_private_planner`、`trade_negotiator`、`delegated_task_planner`、`delegated_task_reporter`、`inventory_effect_explainer` 七类任务；AI 只能解析、扮演、提案和回禀，资产授予、资源扣减、交易成败、物品归属、委派结果、关系落账、科举/官职和持久化仍由服务器拥有；交易 AI `accepted` 只代表议价文本被记录，不直接写银钱或物品，NPC/交易/委派 AI 文本命中 hidden/raw/path/key 形状时会由服务器拒绝并只返回安全原因。SQLite 新增 `asset_resource_accounts`、`asset_long_term_assets`、`inventory_containers`、`inventory_items`、`npc_roster_profiles`、`npc_interaction_events`、`delegated_tasks`、`trade_ledger_records` 安全派生表，并继续从 `world_sessions.world_state_json` 单向修复。React 已新增“囊箧” route、主卷开局裁决摘要、人物 NPC 工作台、对话/交易/委派 tabs 和背包转移界面；浏览器只消费安全 view/API，不读取 raw ledger、hiddenDossier、privateSignalTags、交易底价、完整 prompt、本地路径或 key。

S85.1-S85.6 更新：长期经济 tick、基础市价、NPC 主动性、礼法扩展位、总验收和归档已完成首轮闭环。新增 `marketPriceLedger`、`npcEconomyLedger` 与 `npcActiveRequestLedger` 三个 server-owned 原账，分别由 `marketPriceView`、`npcEconomyView` 和 `npcActiveRequestView` 安全投影到普通回合、SSE、player-state、考试 payload 与 React 主卷/人物页；兼容 `worldState`、redacted player API 和浏览器 UI 均剥离 raw ledger，S85 反馈中的资产/资源/库存变化只返回公开 `economy.*` 分类，不暴露内部 ledger path。普通回合在世界旬/月推进后运行 `npcEconomy`：每旬刷新书籍、粮食、药材、马匹、兵器、文书、礼物、宅产维护和官署经费的基础价格与身份倍率；月末再结算资产维护/收益、库存损耗、委派到期结果、逾期交易承诺、人情债与 NPC 关系记忆。随后 NPC 私人 planner 与 `npcActiveRequests` 可生成求助、索债、献策、请托、行贿、弹劾、引荐、求婚或背叛请求，玩家回应只由服务器归类并裁决为待查、上交、拒绝、暂缓、风险登记或后续处理，不即时写银钱、物品、婚姻、弹劾、背叛或隐藏任务结果。`npcRelationshipActions` 已为论道、切磋、求爱、婚姻提供 schema、权限、NPC eligibility view 和人物页“礼法”tab；客户端伪造胜负、伤势、资源、配偶、关系 delta 或 state patch 会被服务器忽略。委派经费继续由服务器裁决，创建时拒绝超过地方库银的预算，月结旧任务也按服务器确认的有效预算计算成功率和扣款。考试入场/场内场景只推进科场局部时间，不触发全局经济结算。AI 与前端只读取安全市价、月账、来函和礼法门槛摘要；价格、交易、资产、任务、关系、债务、婚姻、弹劾、背叛和持久化仍由服务器裁决。S81-S85 完成范围已归档至 [NPC_INVENTORY_SYSTEM_ARCHIVE.md](NPC_INVENTORY_SYSTEM_ARCHIVE.md)。

S86 规划更新：后端 TypeScript 渐进迁移与 Rust 使用边界已进入活动路线图，规划见 [TYPESCRIPT_BACKEND_MIGRATION_ROADMAP.md](TYPESCRIPT_BACKEND_MIGRATION_ROADMAP.md)。当前决策是先新增后端 TypeScript 检查地基和共享契约，再覆盖安全 view、AI schema/provider facade、storage/session 与少量低副作用 `.ts` 试点；新增或重构后端契约、API/view 类型、安全 projection、AI schema/provider facade、storage adapter 和核心 resolver 时，应优先使用 TypeScript 或纳入 TypeScript 检查。既有 JavaScript 允许渐进迁移，不为语言迁移一次性重写稳定模块；TS 类型不能替代 Ajv、服务器白名单、clamp、hidden/raw 清洗、权限校验或持久化事务。Rust 暂不进入核心玩法、Express routes、AI 编排、resolver 或存档系统，只在有 profiling 证据且可隔离为可选 CLI/WASM/离线工具时评估。

S75.5 更新：案卷式存档/读档已完成。React 新增 `SaveCaseList`，首页旧案卷和印匣“旧案”tab 复用同一套安全 metadata 卡片，显示 sessionId 短码、玩家名、身份/功名/官职、朝代年月旬、回合数、公开摘要和最近更新时间；字段缺失或命中 raw/path/key/prompt/provider 污染词时显示中文 fallback。首页读档进入 `/game/:sessionId` 后由 `GamePage` 自动走 `loadSession` / `GET /api/game/player-state/:sessionId`，印匣读档按钮也继续只调用 `loadSession` 后跳转主卷；不读取 raw state、开发诊断、provider payload、完整 prompt、本地路径或 key。此步不改后端 API/schema、provider schema、SQLite schema、存档格式、AI 权限、科举晋级、官职裁决或显示偏好持久化。

S75.6 更新：返回首页与继续本局已完成。React `AppShell` 的返回首页路径会保留当前安全 session 指针，`returnHome` 只关闭抽屉、弹窗、专题层并清空临时行动草稿，不调用 start/turn/raw state/dev diagnostics，不删除或重写服务器状态；首页在 UI store 的安全玩家投影与当前可运行 `sessionId` 匹配时显示“当前本局”和“继续本局”，摘要只使用安全玩家名、身份/功名/官职和来源，并在命中 raw/path/key/prompt/provider 污染词时回落中文 fallback。`npm run smoke:browser` 现在覆盖真实 Mock 开局 -> 返回首页 -> 继续本局 -> 递送一回合，并继续拦截 unsafe API。此步不改后端 API/schema、provider schema、SQLite schema、存档格式、AI 权限、科举晋级或官职裁决规则。

S75.7 更新：显示偏好本地安全持久化已完成。新增 `client/src/state/displayPreferenceStorage.ts`，S77.6 后只把 `motion`、`textSize`、`contrast`、`autoScroll`、`mapMotion` 和 `bodyFont` 六个字段写入 `qianqiu.displayPreferences.v1`，payload 带 `display-preferences-v1` schema 版本；读取时旧 schema、损坏 JSON、未知字段、非法值和 raw/provider/prompt/path/key 污染文本都会被丢弃或回落默认值。`useUiStateStore` 只接收清洗后的偏好，`AppShell` 继续通过 data attributes 驱动低动效、大字、高对比度和正文字体，舆图页继续以 `mapMotion && motion === "full"` 关闭 S72 地图新增动效。此步不把 session payload、raw state、完整 prompt、provider payload、本地路径或 key 写入 localStorage/sessionStorage，也不改服务器 canonical state。

S75.8 更新：底部奏折输入雏形已完成。React 主卷移除旧内嵌行动表单，新增固定底部 `MemorialComposer`，以奏折/竹简质感承载多行输入、身份 placeholder、右侧“呈上”朱印按钮、Enter 提交和 Shift+Enter 换行；输入框使用组件本地输入态，placeholder 不再作为可提交 value，空白行动禁用，普通回合失败时本地文字保留，成功后继续由 `gameSessionState.submitTurn` 清空 UI 草稿。新增 `quickActionSuggestions` 纯函数与 `QuickActionSource = "local-rule" | "mock-ai" | "provider-ai" | "map-runtime" | "surface"` 扩展位，本步只产出本地规则“可行事”建议；点击建议只写入 `role-surface` 行动草稿，不调用 AI/provider、不提交行动、不裁决结果、不写 canonical state。此步不新增后端 API/schema、provider schema、SQLite schema、存档格式、AI endpoint 或服务器裁决逻辑，也不暴露 raw state、完整 prompt、provider payload、本地路径、key 或 hidden 信息。

S75.9 更新：快捷功能 AI 接入与完善已完成。新增 `quick_action` AI task、Mock/provider 接线、provider schema 和只读 `POST /api/ai/quick-actions/:sessionId`；浏览器只发送当前页、短草稿预览和建议数量，服务器自行读取 session，派生 redacted player summary、route view flags、公开 evidence refs 和 actor 工具能力说明。AI 只能生成 `quickActionSuggestions` 草稿，不提交普通回合、不调用 server resolver、不推进时间、不裁决结果、不写 canonical state，也不持久改 session；服务端会做 schema 校验、身份/工具意图 allowlist、数量/长度 cap、公开 evidence ref 白名单、source 归一化和污染清洗，provider 失败、坏 JSON、越权工具意图、伪造 evidence 或污染文本都降级为本地规则建议。`quick_action` 可单独配置 provider、model、输出长度、timeout 和温度，工具预算被硬锁为 0，`mayUseTools` / `mayRequestAdjudication` 始终为 false。React 主卷会在安全玩家 payload 就绪后请求建议，显示 `mock-ai`、`provider-ai`、`local-rule`、`map-runtime`、`surface` 来源和 loading/stale/failed/applied 状态；点击任何建议仍只写入行动草稿，只有 Enter 或“呈上”才调用 `/api/game/turn`。响应级 `source/status/fallbackReason/generatedAtTurn` 是当前快捷建议的安全审计边界，不记录 prompt 或 provider payload；若后续需要持久 quick action 调动审计，必须另设不破坏 read-only 语义的安全记录方案。

S75.10 更新：S75 浏览器总验收已完成。`scripts/clientSmoke.js` 兼容 `npm run smoke:browser -- --client react`，并继续在无 `--url` 时强制 Mock；真实浏览器路径从默认 `/` 首页开局后，覆盖右上角印匣真实点击、`AI 设置` / `显示` / `安全` / `旧案` tab 遍历、快捷建议工具预算固定为 0、抽屉关闭后焦点回收、印匣内返回首页、继续本局、AI/Mock 快捷建议只写行动草稿、旧案 tab 按当前案卷短码通过 `GET /api/game/player-state/:sessionId` 读档、显示偏好 reload、舆图低动效、人物懒加载分页、主要 session 路由刷新、移动端底部奏折和移动端印匣无横向溢出。全局 request 监听继续拦截 `/api/game/state/*` 与 `/api/dev/*`，DOM/localStorage/移动端抽屉继续检查 hidden/raw/key/path/provider payload 泄漏。S75.10 不新增后端 API、provider schema、SQLite schema、存档格式、AI 权限或服务器裁决；浏览器级 `prefers-reduced-motion` context 与真实专题 `surface` 来源玩家可见验收留给 S77/S76 后续总验收。

S76.1 更新：主游戏壳已完成。React 主卷现在由案卷状态条、按玩家公开身份选择的场景插画带、叙事卷、案头安全投影索引、舆图/人物/史册/科举/皇榜/朝议/印匣功能页签和固定底部 `MemorialComposer` 组成。场景带优先通过 `assetRegistry` 读取 manifest 中 runtime 可用、`usage="game_main"` 的已审核场景资产，资源失败时只回落到既有已审核 `/assets/ui/scenes/` 项目路径；不读取未审核素材或 artifacts。主卷只消费安全 `player-state` / turn payload、UI store 的安全玩家摘要和 route view flags；污染文本会回落为中文 fallback，不把 raw state、开发诊断、provider 原文、完整 prompt、本地路径、key、hidden notes 或 hidden intent 写入 DOM、URL 或本地存储。功能页签只做路由导航，快捷建议仍只写行动草稿；行动、移动、任免、审案、行军、考试和时间推进继续由普通回合与考试服务器接口裁决。本步不新增后端 API、provider schema、SQLite schema、存档格式、AI 权限、科举晋级或官职任免规则。

S76.2 更新：书生面板已完成。React 主卷在 `player.role === "scholar"` 时渲染 `ScholarPanel`，通过 manifest registry 读取已审核 `role_background` 书斋素材，并只组合安全 `studyProfileView`、`examCalendarView`、玩家公开摘要和现有科举/皇榜路由。面板显示读书簿七项、老师点评、师友与保结前置、科期、误期/近科记录、文章练习、荐书和近课；按钮只把“安排日课”“请老师改文”“同窗互评”“整备赴考”“练一篇文”等意图写入底部奏折草稿，不取题、不交卷、不推进时间、不改榜、不晋级、不授官。书生完整路径仍由服务器拥有：赶考、入场、评卷、放榜、晋级、殿试和授官只能通过既有考试与普通回合裁决完成。本步不新增后端 API、provider schema、SQLite schema、存档格式或 AI 权限。

S76.3 更新：地方官面板已完成。React 主卷在 `player.role === "magistrate"` 时渲染 `MagistratePanel`，通过 manifest registry 读取已审核 `role_background` 县衙素材，并只组合安全 `localAffairsDocketView`、`officialPostingsView`、`economicFiscalView` 和玩家公开摘要。面板显示案牍总览、公堂词讼、钱粮仓储、水利盗警、士绅乡约、考成/风评/名望和裁决边界；按钮只把“查阅案牍”“升堂核案”“清厘钱粮”“勘修水利”“巡缉盗警”“调停乡约”等意图写入底部奏折草稿，不提交回合、不调用 resolver、不结案、不征税或开仓、不直接修堤缉捕、不改考成或任免。地方官的审案、财赋、水利、盗匪、士绅、考成、时间推进和持久化仍由服务器 resolver 与普通回合裁决完成。本步不新增后端 API、provider schema、SQLite schema、存档格式或 AI 权限。

S76.4 更新：入仕官员/大臣面板已完成。React 主卷在 `player.role === "official"` 或 `player.role === "minister"` 时渲染 `OfficialMinisterPanel`，通过 manifest registry 读取已审核 `role_background` 部院/大臣素材，并只组合安全 `officialCareerView`、`appointmentTrackView`、`officialPostingsView`、`actorMemoryView`、`aiControlAuditView` 和玩家公开摘要。面板显示官职履历、部院公文、同年座师、人脉记忆、派系/朝局风险、考成、弹劾和奏疏入口；按钮只把“整理履历”“查办公文”“拟回堂官”“拜会座师”“探问朝局”“自陈考成”“回应弹劾”“拟具奏疏”等意图写入底部奏折草稿，不提交回合、不调用 resolver、不推进时间、不直接任免、奖惩、处分、弹劾成案或改写考成。官缺、升降、铨选、考成、处分、派系影响、时间推进和持久化仍由服务器 resolver 与普通回合裁决完成。本步不新增后端 API、provider schema、SQLite schema、存档格式或 AI 权限。

S76.5 更新：将领面板已完成。React 主卷在 `player.role === "general"` 时渲染 `GeneralPanel`，通过 manifest registry 读取已审核 `role_background` 边塞军帐素材，并只组合安全 `militaryDiplomacyView`、`officialPostingsView`、`mapRuntimeView`、`eventArchiveView`、`actorMemoryView` 和玩家公开摘要。面板显示军帐总览、粮饷与军心、斥候与情报、边患与舆图、战报与边议和军令边界；按钮只把“召集军议”“点验粮饷”“安抚军心”“遣出斥候”“巡边布防”“草拟战报”等意图写入底部奏折草稿，不提交回合、不调用 resolver、不推进时间、不直接结算战役、调兵遣将、外交和战、统帅任免、粮饷拨付、赏罚或持久化。军令仍走普通自然语言行动或未来服务器 `militaryDiplomacyResolver` 裁决。本步不新增后端 API、provider schema、SQLite schema、存档格式或 AI 权限。

S76.6 更新：皇帝面板已完成。React 主卷在 `player.role === "emperor"` 时渲染 `EmperorPanel`，通过 manifest registry 读取已审核 `role_background` 御案素材，并只组合安全 `officialPostingsView`、`eventArchiveView`、`actorMemoryView`、`aiControlAuditView`、`worldEntityView`、`worldThreadView`、`mapRuntimeView` 和玩家公开摘要。面板显示御案朝仪、奏折队列、朱批拟稿、圣旨草稿、朝议、任免候选、赏罚预留和御案边界；按钮只把“朱批奏折”“批问四务”“拟旨”“召集朝议”“审看任免”“预拟赏罚”等意图写入底部奏折草稿，不提交回合、不调用 resolver、不推进时间、不直接让朱批成案、圣旨生效、任免、赏罚、处分或持久化。皇帝行动仍走普通自然语言回合并由服务器裁决；本步不新增后端 API、provider schema、SQLite schema、存档格式或 AI 权限。

S76.7 更新：科举考试全屏已完成。React `/game/:sessionId/exam` 现在渲染贡院/殿试沉浸考试界面，通过 manifest registry 读取已审核 `exam_page` 场景素材，并组合安全考试状态、试题、局部时间、考试阶段、写作区、字数/草稿状态、场内行动、考场记录、虚拟考生占位和交卷边界。页面只调用既有 `POST /api/exam/question/:sessionId`、`POST /api/exam/progress/:sessionId` 和 `POST /api/exam/submit/:sessionId`；取题、推进考场和交卷不走普通回合、不访问 raw state/dev diagnostics、不新增后端 API、provider schema、SQLite schema、存档格式或 AI 权限。评分、舞弊判定、放榜、晋级、授官、弥封身份映射、考官隐藏意图和模型原始提案继续由服务器拥有并只通过安全 view/考试 API 投影到前端。

S76.8 更新：放榜全屏已完成。React `/game/:sessionId/ranking` 现在渲染贡院外皇榜沉浸界面，通过 manifest registry 读取已审核 `ranking_page` 放榜场景、`imperial_notice` 皇榜纸底和 `red_ink_smudge` 朱砂墨迹素材，并组合服务器返回的 ranking、考试历史 ranking、`examHonorView`、`examinerPanelView` 和 `appointmentTrackView` 安全投影。页面展示三鼎甲、服务器定榜名单、玩家高亮、榜名详情、考官公开评语、评分维度、防作弊检测、授官提示和皇榜安全边界；不新增后端 API、provider schema、SQLite schema、存档格式或 AI 权限，不访问 raw state/dev diagnostics，不在前端排序、补分、补榜、判防弊、判晋级或推断授官。榜次、评分、防弊、晋级、授官、弥封身份映射、未采纳评语和模型原始提案继续由服务器拥有，前端只显示清洗后的玩家可见结果。

S76.9 更新：独立舆图页与地图重构已完成。React `/game/:sessionId/map` 现在直接渲染“山河舆图”独立页面，不再先铺主卷案台；页面继续复用 S72 `InkMapRuntimeBridge` / `public/mapRenderer.js` / PixiJS 运行时，提供大画布、地点/驿路/近事图层筛选、公开近事局势簿摘录、入局势簿/回主卷跳转、tooltip 关闭、资源失败 fallback 和公开近事“据此拟稿”。`InkMapRuntimeBridge` 对 label、tooltip summary 和 action draft 做前端安全文本清洗，重复地点 key 增加 index 后缀，图层筛选只过滤浏览器显示层。本步不新增后端 API、provider schema、SQLite schema、存档格式、地图素材 manifest、AI 权限或服务器 resolver；舆图只读当前 `sessionId` 的 `mapRuntimeView` 安全投影，不访问 raw state、dev diagnostics、provider payload、完整 prompt、本地路径、key 或 hidden 内容。地图显示坐标和 `layoutPath` 只服务浏览器布局、label 与 tooltip，不进入 prompt、AI 工具、服务器 resolver、行动事实、URL 或本地存储；移动、查案、调兵、财政、外交、任免和持久化继续由主卷普通回合提交后服务器裁决。

S76.10 更新：NPC 与玩家立绘接线已完成。React 首页开局表单新增案主立绘选择，候选只来自已审核 manifest runtime 池，按玩家身份阶段筛选 `portrait_pool_player_s73_10`，并保持女性高清重制优先、无重制时使用已审核原图；`POST /api/game/start` 接收 `portraitRef` 后仅保存安全 `portrait-...` id，拒绝本地路径、远程 URL、key/path/raw/provider/prompt/hidden 等污染片段。React `/game/:sessionId/people` 不再展示全量素材目录，而是只读当前案卷的 `worldState.player` 与安全 `worldPeopleView.npcs/relationships`，每页最多 8 个公开人物，玩家优先使用已选立绘，NPC 只从通用 NPC 池按公开身份/性别匹配，女性 NPC 若有高清重制则优先使用，否则使用已审核原图；重要 NPC 专属池不被随机抽取。无效、缺失或未入 registry 的 ref 只显示纸底 fallback。`redactedState` 玩家白名单和 `worldPeopleSchemas` NPC view 只暴露清洗后的 `portraitRef`，前端只把它当 opaque id 交给 registry 命中，不拼路径、不显示未审核素材、不暴露全量素材池数量，也不泄漏 hidden 私档、未公开关系或未公开人物真值。本步不新增 provider schema、SQLite schema、AI 权限、服务器 resolver、科举晋级、官职任免或 canonical 裁决规则。

S78 更新：官署专题玩法化已完成。新增统一 `topicSurfaceView` 安全投影，六类专题 surface（奏折队列、拟圣旨、朝议、堂审、军议、人物公开档案）现在都通过 `GET /api/game/topic-surface/:sessionId/:surfaceId` 读取玩家可见材料、证据 ref、人物公开摘要、可选草稿模板和上一轮公开结果。新增只读 `POST /api/ai/topic-draft/:sessionId`、`topic_draft` AI task、prompt pack、schema、模型路由和 Mock/no-key fallback；AI 只生成标题、草稿正文、引用 evidenceRefs、风险提示和建议下一步，不提交普通回合、不推进时间、不调用 resolver、不写 canonical state。服务端会校验证据白名单、结构化 JSON、污染词、伪造“已裁决/已结案/已任命/已获胜”等成案话术，并在 provider 异常、坏 JSON、越权证据或污染文本时降级本地草稿。React `SurfaceHost` 将六类专题升级为材料/筹议/草稿三栏工作台，玩家可勾选证据、选择批红/拟旨/廷议/问案/军议/拜访等草稿模板，请 AI 拟稿、手动改稿并写入底部奏折；真正后果仍只由 `/api/game/turn` 以及 `cityPolicyResolver`、`judicialCaseResolver`、`militaryDiplomacyResolver`、`sceneRuntime` 等服务器裁决链处理。

S79.1 更新：前端正确性与子路由壳修复已完成。`ExamPage` 现在接受考试接口返回的 `wordCount` 数字或 `{ min, max, target, recommended }` 对象，并以安全中文标签显示字数范围，避免 React 直接渲染对象导致考试页崩溃；`scripts/clientSmoke.js` 会在取题后强制断言仍停留在 `.examFullScreen`、出现考题/文章/字数栏/交卷按钮，错误页不再被漏报。`/game/:sessionId/exam|ranking|court|settings` 已从主卷叙事、身份栏和底部奏折壳中拆出，改走轻量 `sessionRouteShell` 与案卷页签，移动端首屏不再先看到主卷；`/map` 仍保持独立地图壳，`/people` 与 `/archive` 暂保留既有主导航体验。本步不改后端 API、provider schema、SQLite schema、存档格式、AI 权限、服务器 resolver 或 canonical state。

S76.12 更新：S76 总验收已完成。React browser smoke 现在从默认首页 Mock 开局后覆盖书生、地方官、入仕官员、大臣、将领、皇帝六类身份代表草稿行动，逐项打开奏折队列、拟圣旨、朝议、堂审、军议、人物档案六类专题 surface，并继续覆盖考试/放榜、独立舆图、人物谱牒、移动端、unsafe API 防线和截图产物。完整 `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official` 晋级链仍由 `npm run smoke:exam-s69` 验证，不塞入 UI smoke。公开 UI manifest 顶层说明改为普通中文安全描述，不在浏览器可读 manifest 中保留敏感词样；S77.1-S77.6 已完成默认入口确认、浏览器 smoke 扩展、视觉像素检查、安全污染防线、性能资源预算和可访问性/字体系统。S77.5 起 React 运行时读取精简 `ink-ui-runtime-manifest.json`，`npm run smoke:browser` 会先执行构建产物预算；浏览器 smoke 会检查首屏不请求完整素材 manifest、不加载地图运行时、舆图页才懒加载 Pixi/mapRenderer、人物页不越过当前页可见人物。人物立绘体验优先清晰，当前可见人物使用已审核主图；性能边界保护的是“不要一次性拉取全量立绘池”。下一步从前端水墨重构归档和总验证继续。

S77.2 更新：浏览器 smoke 扩展已完成。`scripts/clientSmoke.js` 在既有首页、设置、存档/读档、返回首页/继续本局、普通回合、独立舆图、人物谱牒、史册、科举考试、放榜、六类身份代表草稿行动、专题 surface、应用低动效偏好和移动端覆盖基础上，新增浏览器 `goBack()` / `goForward()` 历史栈验收，并新增拦截 `/vendor/pixi.min.js` 与 `/mapRenderer.js` 的地图运行时资源失败 fallback 验收。资源失败时前端只显示安全中文降级文案，不渲染坏 canvas，不触碰 unsafe API，不扩大后端 API、AI 权限、存档格式、SQLite schema 或 canonical state 写入边界；浏览器级 `prefers-reduced-motion` 深测留给 S77.6 可访问性步骤。

S77.6 更新：可访问性与字体系统已完成。`displayPreferenceStorage` 新增 `bodyFont` 白名单，只接受 `serif-classic`、`song-xiaowei`、`kai-longcang`、`brush-mashan`，旧本地设置缺字段时自动回落默认；该偏好只存在 `qianqiu.displayPreferences.v1` localStorage，不进入服务器存档、canonical state、AI prompt、provider schema 或 SQLite。印匣“显示”tab 新增“正文字体”选择，`AppShell` 输出 `data-body-font`，CSS 变量控制正文、按钮、输入框和常规面板；考试页题头/交卷朱印、皇榜标题、三鼎甲和“金榜题名”高光层固定使用艺术字与 CSS 墨晕、朱砂圈名、淡金题字。特效同时尊重应用低动效和浏览器 `prefers-reduced-motion: reduce`；浏览器 smoke 新增 reduced-motion context 与按钮/链接内部文本溢出扫描，并继续保留 S77.5 首屏资源边界。

S77.7-S77.8 更新：文档归档与总验证已完成。新增 [FRONTEND_INK_REDESIGN_ARCHIVE.md](FRONTEND_INK_REDESIGN_ARCHIVE.md)，把 S73-S77 的素材体系、React/Vite 默认入口、首页/全局 shell、身份/考试/放榜/舆图/人物页面、安全投影、资源预算、可访问性和验收入口收束为专题归档；README、共享上下文和活动台账已同步为“S73-S77 已归档”口径，`FRONTEND_INK_REDESIGN_ROADMAP.md` 保留为规划源头。总验证已通过 `npm test`、client typecheck/test/build、React browser smoke、Mock 科举链、JSON/SQLite storage-only 双模式、docs governance、documentation governance 和 diff check；后续前端玩法从 S79 或新的明确小步骤开题。

S73.10.6 已把分散在各立绘批次中的缩略图与压缩验收收束为独立 QA：`scripts/frontendPortraitCompressionQa.js`、`qa:portrait-compression` 和 `public/assets/ui/portraits/portrait-compression-qa-v1.json` 当前校验 790 张 active 立绘、其中 572 张 S73.10 立绘和 194 张 S79.2 recovered 女性高清立绘的 1024x1536 主图、384x576 缩略图、64x96 低清占位、safeArea、focalPoint、移动裁切、文件预算和禁止 eager load。S73.10 单张覆盖新增 `scripts/frontendSinglePortraitOverrides.js`、`qa:single-portrait-overrides` 和 `public/assets/ui/portraits/portrait-single-override-qa-v1.json`，当前替换 60 张女性/偏女性画像为单张高清重制；S79.2 新增 `scripts/frontendRecoveredFemalePortraitAssets.js`、`qa:recovered-female-portraits` 和 `public/assets/ui/portraits/portrait-recovered-female-pool-qa-v1.json`，把 194 张 recovered 女性 PNG 母版按稳定 ID 派生为公开高清 WebP、缩略图和低清占位。S79.2 后 `ink-ui-runtime-manifest.json` 为 937342 bytes，仍只保存浏览器运行时必要字段；React scaffold 与 browser smoke 的 runtime manifest 预算按高清池索引调整为 1,050,000 bytes。S79.3 已把首页选角与人物谱牒等 `Portrait` 位接入只读高清查看器，主展示和查看器都以审核后的主图为准；缩略图与低清占位仍只服务列表预览、占位、preload hint 和 QA，不能因为素材池已齐就一次性加载全量大图。

S68-S69 科举、读书、评卷与授官深化规划见 [IMPERIAL_EXAM_DEEPENING_ROADMAP.md](IMPERIAL_EXAM_DEEPENING_ROADMAP.md)，S68.1 制度契约见 [IMPERIAL_EXAM_SYSTEM_CONTRACT.md](IMPERIAL_EXAM_SYSTEM_CONTRACT.md)，完成归档见 [IMPERIAL_EXAM_DEEPENING_ARCHIVE.md](IMPERIAL_EXAM_DEEPENING_ARCHIVE.md)。该专项要求外层 `child_exam -> provincial_exam -> metropolitan_exam -> palace_exam` API 保持兼容，内部把童试拆为县试/府试/院试，把乡试/会试扩为三场、多日、多卷、号舍、弥封、誊录、对读、磨勘、复核、房官/同考官/主考官阅卷、canonical 榜单荣誉和授官轨迹，并把 AI 老师、同年、考官、吏部、皇帝和授官 proposal 全部限制在服务器裁决之下。弥封身份映射、考官 hidden intent、保结 hidden notes 和 raw provider proposal 不得回填普通 route `worldState` 或浏览器/prompt view。

开发规范不变：Mock 默认可玩，真实 provider 可选；服务器拥有状态边界、时间推进、科举晋级、作弊处罚、官职任免、长期事件、世界实体、世界议程、数据库写入和持久化裁决。AI 可以通过身份受限的领域工具提交 structured proposal / tool call，让老师、考官、县令、大臣、将领或皇帝真实参与世界；但 AI 不能直接执行 SQL，不能直接写 canonical 状态、业务表或审计表，工具调用也不能被当作已经发生的世界事实。

S73.10.1 已完成全量立绘矩阵定稿：新增 [FRONTEND_PORTRAIT_MATRIX.md](FRONTEND_PORTRAIT_MATRIX.md)、`public/assets/ui/portraits/portrait-pool-matrix-v1.json`、`scripts/frontendPortraitMatrix.js` 和 `qa:portrait-matrix`，把后续生产池锁定为 336 张 planned 立绘，覆盖玩家身份阶段、通用 NPC、重要 NPC、状态姿态和场景锚点。矩阵只保存安全 `portraitRef`、目标路径、prompt 母版、fallback、懒加载和审核字段，矩阵本身不作为 runtime manifest。S73.10.2 已生成并审核 72 张玩家身份阶段立绘，新增 `scripts/frontendPlayerPortraitAssets.js`、`qa:player-portraits`、`public/assets/ui/portraits/portrait-player-pool-qa-v1.json`、主图、缩略图和低清占位，并保留 60 张已审核女性玩家风格补充与 60 张已审核男性玩家风格补充，使玩家可选池男女各 96 张；S73.10.3 已生成并审核 188 张通用 NPC 立绘，新增 `scripts/frontendGenericNpcPortraitAssets.js`、`qa:generic-npc-portraits`、`public/assets/ui/portraits/portrait-generic-npc-pool-qa-v1.json`，并把一开始的 120 张矩阵通用 NPC、20 张旧版 bonus 和 48 张宫装/唐装女性风格扩展全部登记为已审核通用池；S73.10.4 已生成并审核 72 张重要 NPC 专属立绘，新增 `scripts/frontendSignatureNpcPortraitAssets.js`、`qa:signature-npc-portraits`、`public/assets/ui/portraits/portrait-signature-npc-pool-qa-v1.json`，并用 `signature_npc_pool` 单独隔离皇帝、太后、摄政、首辅、御史、总督、名将、权臣、清流领袖、宿敌、知己、宫廷谋主和边地使者等核心模板；S73.10.5 已生成并审核 72 张状态/姿态与场景锚点立绘，新增 `scripts/frontendStateScenePortraitAssets.js`、`qa:state-scene-portraits`、`public/assets/ui/portraits/portrait-state-scene-pool-qa-v1.json`，并用 `state_variant_pool`、`scene_anchor_pool` 单独登记；S73.10.7 已生成并审核 48 张年轻成年女性补充立绘，新增 `scripts/frontendYoungFemalePortraitAssets.js`、`qa:young-female-portraits`、`public/assets/ui/portraits/portrait-young-female-pool-qa-v1.json`，并用 `young_female_style_pool` 单独登记；S73.10 单张覆盖新增 `scripts/frontendSinglePortraitOverrides.js`、`qa:single-portrait-overrides` 和 `public/assets/ui/portraits/portrait-single-override-qa-v1.json`，当前替换 60 张女性/偏女性画像为单张高清重制；S79.2 新增 `scripts/frontendRecoveredFemalePortraitAssets.js`、`qa:recovered-female-portraits` 和 `public/assets/ui/portraits/portrait-recovered-female-pool-qa-v1.json`，并用 `recovered_female_highres_pool` / `portrait_pool_recovered_female_s79_2` 单独登记 194 张 recovered 女性高清母版派生产物；S73.10.6 已新增 `scripts/frontendPortraitCompressionQa.js`、`qa:portrait-compression` 和 `public/assets/ui/portraits/portrait-compression-qa-v1.json`，当前统一校验 790 张 active 立绘的主图、缩略图、低清占位、safeArea、focalPoint、移动裁切、文件预算和禁止 eager load；S74-S79 可以通过 manifest 中已审核的玩家池、通用 NPC 池、重要 NPC 专属池、状态姿态池、场景锚点池、年轻女性补充池和 S79.2 recovered 女性高清池 `portraitRef` 按需懒加载使用。

## 3. 核心体验

玩家没有固定选项，主要通过自由文本行动推进游戏。AI 作为世界引擎，负责叙事、意图理解、出题、评分、角色反馈和世界变化建议；服务器负责状态存储、数值边界、晋级规则、作弊惩罚、官场任免、长期事件、可见性过滤和持久化。

AI 是《千秋》的核心世界引擎，不是可替换装饰。后续新增玩法、数据域、角色、官署、城市、事件、经济、战争、外交、浏览器面板或 prompt 检索时，都必须设计 AI 的读取范围、角色智能、工具权限、proposal 边界、服务器裁决、审计记录和 Mock/no-key 降级。模型越深入游戏世界，服务器法度越要清楚。

核心设计原则：

- 开放输入：玩家可以自由打字，不被固定按钮限制。
- 结构化状态：世界必须有可追踪、可保存、可回放的状态对象。
- AI 有创造力，服务器有最终裁判权。
- AI 必须与身份、职位、地理、关系、情报和历史后果绑定；书生、县令、大臣、将领、皇帝和系统世界引擎的 AI 能力、可读信息和可调用工具必须不同。
- Mock 模式必须足够完整，让没有 API Key 的开发者也能测试主线。
- 书生科举系统必须像真正的生涯路径，而不是单次问答。后续深化必须覆盖读书画像、老师点评、县试/府试/院试、乡试/会试三场多卷、多考官评卷、名次荣誉和馆选/观政/铨选/外放，而不是只用单篇分数直接授官。
- 游戏规则、属性上下限、时间间隔、概率、数量门槛、UI 限制、fixture 规模和 prompt budget 等可调参数应进入具名配置模块，避免在逻辑中散落魔法数字；优先使用 `src/config/GameConfig.js` 这类总配置，或按领域放入 `src/game/*Config.js`，并在命名或注释中说明单位、范围和默认值意图。

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
- `mimo`：使用 Xiaomi MiMo OpenAI-compatible chat completions，通过 `MIMO_BASE_URL`、`MIMO_API_KEY` 和固定 `MIMO_MODEL=mimo-v2.5-pro` 接入；这是 MiMo-V2.5-Pro 的 1M 长上下文模型口径，Token Plan 订阅 key 为 `tp-...`，必须使用订阅页给出的 token-plan Base URL。S70 把 MiMo-V2.5-Pro 作为主力大面积 provider 候选，但必须先用 provider smoke 固定工具调用真实行为，不能默认 OpenAI-compatible 就等同 OpenAI 工具协议全量兼容。
- `mimo-deepseek`：当前兼容最小多模型路由层，并已由 S70.8 的 task-aware route policy 接管 provider facade。开局、普通回合、流式叙事和科举出题仍优先 MiMo，科举评卷、critic/safety 在 DeepSeek key 可用时走 DeepSeek V4 Pro；`AI_PROVIDER=mock` 即使本机存在真实 provider key 也保持全任务 Mock；多模型共识不能绕过 schema、工具权限或服务器裁决。
- `claude` / `anthropic`：使用 Anthropic Messages API，支持 SSE 流式输出。

S68-S69 的科举深化是 S70 工具协议的前置样板：老师、保人、房官、同考官、主考官、吏部和皇帝都可以成为 AI actor，但只能读取各自可见摘要并提交题目、点评、批语、事件、复核疑点或授官 proposal。S68.1 已固定科举工具语义必须是 proposal-only：房官不能定榜，皇帝不能直接写官职，吏部不能绕过官缺和籍贯回避，老师不能凭空创造真实关系或名位。S70 提前规划见 [AI_ORCHESTRATION_ROADMAP.md](AI_ORCHESTRATION_ROADMAP.md)。该规划采用“模型请求工具、服务器执行工具”的方向：MiMo-V2.5-Pro、OpenAI、Anthropic、DeepSeek 等 provider 的 function calling、structured output、MCP connector 或未来内部 MCP 只用于生成 tool call / proposal / request-adjudication；真正执行工具、裁决后果、写入状态、写入数据库和审计仍由服务器 resolver 完成。S70.1 已新增 [AI_PROMPT_ENGINEERING_CONTRACT.md](AI_PROMPT_ENGINEERING_CONTRACT.md)、[AI_TOOL_PROTOCOL_CONTRACT.md](AI_TOOL_PROTOCOL_CONTRACT.md)、`src/ai/toolSchemas.js` 和 `npm run smoke:provider:tools`，先固定 prompt 分层、MCP-friendly tool envelope、strict input schema、proposal/result/request-adjudication schema、`server.*` 内部化、Mock/no-key fallback 和 MiMo 工具调用形状 smoke。S70.2 已新增 `src/game/aiActorProfileConfig.js` 和 `src/game/aiActorProfiles.js`，固定 T0-T6 authority tier、actor type、tool group、visibility preset、budget preset、玩家/NPC/官署/系统 actor profile 构造、安全 view/prompt summary 和 actor tool allowlist；profile 只复用服务器可见 projection，不读取 raw SQLite、raw audit、provider proposal、hidden 私档、本地路径或 key。S70.3 已新增内部 `game_ai_tools` registry 与 runner：`src/ai/gameAiTools.js`、`src/ai/gameAiToolRunner.js` 和 `src/game/aiToolResolvers.js` 提供工具注册、actor 可见列表、provider tool call 归一、strict arguments 校验、read/proposal/request-adjudication runner、pending resolver bridge、基础 cooldown、tool result 回填和 hidden-safe 审计摘要；S70.3 尚不接入普通 turn，不写 session/SQLite，不创建真实领域后果。S70.4 已新增 `src/game/npcMindConfig.js` 和 `src/game/npcMind.js`，提供高显著 NPC 排序、NPC mind prompt context、安全 heuristic proposal、Mock/no-key deterministic fallback、服务器应用可见关系变化/公开事件材料/`player_visible` 记忆候选和 hidden-safe 审计摘要；本步不保存深层 private memory ledger，不写 SQLite，不调用真实 provider，真正 actor memory ledger 与 private impression 留给 S70.12。S70.5 已新增 `src/game/institutionSceneConfig.js` 和 `src/game/institutionScenes.js`，提供朝议与科场评议的 scene-local 多 actor helper，参与者只读取官署任所、案牍、财赋、军务、科场流程、多考官阅卷、科名荣誉、同年座师和授官轨迹公开摘要，默认 Mock/no-key heuristic 只产待裁决 proposal；`resolveInstitutionSceneOutcome()` 只返回 `pending_server_resolution`，不推进全局时间、不写 session/SQLite、不执行工具。S70.6 已新增 `src/ai/eventToolDefinitions.js`、`src/game/aiEventProposalConfig.js` 和 `src/game/aiEventProposal.js`，把 `event.propose_incident` / `event.request_incident_adjudication` 做成默认 registry 事件工具；模型只能引用 actor 可见压力摘要提交候选，服务器锚定 actor、校验权限/来源/冷却、清空 private refs，并返回 pending/rejected，不写世界状态、session、SQLite、事件档案或成案审计。S70.7 已新增 `src/ai/domainToolDefinitions.js` 和 `src/game/domainToolResolvers.js`，把刑名、地方政策、军令、外交、科举定榜复核、授官复核、赏赐升迁和处分复核八个领域工具接入默认 registry；模型只能引用 actor 可见的地方案牍、财赋市场、军务外交、公开情报、地理、官署任所、科场、授官轨迹、可见人物和事件档案 evidence refs，服务器校验权限/辖区/证据领域/冷却/脱敏后只返回 pending 或 rejected，不写世界状态、session、SQLite、事件档案、官职、榜单、判决、军令、战和、赏罚或审计表成案结果。S70.8 已新增 `src/ai/modelRoutePolicy.js`、`src/ai/aiEvaluationRunner.js` 和 task-aware `src/ai/index.js` facade，固定 narrator、actor_mind、planner、domain_specialist、critic、safety_gate、memory_summarizer、monthly_briefing 和 time_skip_planner 的 provider/model/budget/tool policy；route 的 model、timeout、temperature 和 token budget 会进入支持的 adapter 请求。critic/safety 只能输出风险和建议，默认 review-only guard 不能调用普通 gameplay provider methods、不能用工具、request adjudication、写状态或调用 `server.*`。`npm run eval:ai` 现在先运行 S70.8 本地 eval runner，再运行既有 `test/aiEvalFixtures.test.js`，覆盖 schema、语气、hidden/raw canary、canonical ranking overreach、review-only 和既有离线 AI fixture。S70.9 已新增 `src/game/aiSettingsConfig.js` 与 `src/game/aiSettings.js`，提供 session 级 AI 设置、玩家可见 `aiSettingsView`、bounded `aiInvocationSummaryView` 和浏览器 `#ai-control-panel`；玩家可按九类任务配置 provider/model、输出长度、工具预算、输出倍率、并发和安全严格度，但设置接口会拒绝 hidden/raw/server/path/key、直写状态/数据库、server resolver、raw audit 和观测日志伪造，critic/safety 的工具预算仍由服务器裁剪为 0。后期如果工具数量和按身份裁剪需求膨胀，再在 `game_ai_tools` 外层包装内部 MCP server。通用外部工具如 web search、代码执行、浏览器控制或第三方 MCP 不进入普通玩家回合；若后续确需引入 SDK、MCP server、外部 connector 或 tracing 工具，必须先走依赖治理和 AI 权限矩阵。

S70.10 已新增 `src/game/playerMonthlyBriefingConfig.js` 与 `src/game/playerMonthlyBriefing.js`，在玩家为入仕官员、地方官、大臣、将领或皇帝且下旬进入下月上旬时生成一次职位化 `playerMonthlyBriefingView`；月报只读取官场、任所、案牍、财赋、军务、可见人物和事件档案等服务器公开 projection，写入脱敏月报账本、`monthly_briefing` 事件档案条目和 bounded `monthly_briefing` AI 调动摘要，不直接改官职、财政、案牍、军务、NPC、SQLite 或审计表。

S70.11 已新增 `src/game/timeSkipConfig.js` 与 `src/game/timeSkip.js`，把“学习一月”“养病半月”“照旧处理一月”等自然语言解析为服务器可裁决的 `timeSkipPlan`；`POST /api/game/turn` 在普通/流式 narrator 调用前识别跳时，记录 `time_skip_planner` 调动摘要，再逐旬复用既有 `finalizeTurn()` 结算链。跳时只写本来每旬会产生的读书、角色事务、世界 tick、长期事件、官职月报、事件和审计后果；不会让模型直接改状态、跳过考试场景、读取 hidden/raw/SQLite 私表或绕过科期/急件中断。

S70.12 已新增 `src/game/actorMemoryConfig.js`、`src/game/actorMemoryLedger.js`、`src/game/sessionSummary.js` 与 `src/game/clientWorldState.js`，把 provider `memoryProposals`、可见关系变化、主动 NPC 请求、官职月报和科举同年座师网络整理为服务器拥有的 `actorMemoryLedger`，并在普通回合、SSE 和考试路由返回 `actorMemoryView` / `sessionSummaryView`。月末会生成玩家经历 `sessionSummary`，记录 bounded `memory_summarizer` 调动摘要，并把可见记忆与月度摘要纳入事件档案和 prompt capped retrieval。当前版本只接受 `public` / `player_visible` / `relationship_visible` 记忆，拒绝 private/hidden/actor-private 及其空格/连字符别名直到 redacted API 完成；provider 不能 patch `actorMemoryLedger` 或 `sessionSummary`，只能提交 schema 校验后的 `memoryProposals`，且 provider 记忆来源类型由服务器强制归为 `ai_memory_proposal`。被拒绝的记忆提案只暴露 hidden-safe 计数和原因码，真实 provider remote helper 对非法/hidden/private 记忆提案也会输出脱敏拒绝 telemetry；`actorMemoryView`、recent updates 和事件档案只展示仍在 actor label map 中可见的 actor 记忆；route response 内的兼容 `worldState` 会剥离 raw `actorMemoryLedger` / `sessionSummary`，玩家侧只使用安全 view 与本回合 feedback。

S71.10 在 S70.12 记忆账本上补 NPC 记忆专门化，不新增普通玩家可读 raw 私档。`actorMemoryConfig` 新增目标、家族风险、畏惧、野心等记忆类型和背景 NPC 记忆 cap；`actorMemoryLedger` 可把 S70.4 NPC mind 的安全 `memoryCandidates` 转为服务器 proposal，也能从 `worldPeopleView` 与可见关系行批量生成背景 NPC 目标、人情债、恩怨、可见家族风险、畏惧和野心记忆。普通回合只开启背景 NPC heuristic，仍通过既有服务器校验、去重、衰减和可见性边界写入 `actorMemoryView`；private/hidden/actor-private 记忆、污染文本、不可见 actor、raw `actorMemoryLedger`、SQLite raw table、本地路径和 key 不进入普通 player-state、prompt、安全搜索或 S71.9 scene actor context。

S70.13 已新增 `src/game/mapContextConfig.js`、`src/game/mapContext.js`、`src/ai/mapToolDefinitions.js` 与 `src/game/mapToolResolvers.js`，把现有地理、官署任所、地方案牍、军务外交、经济财政、科举赶考和事件压力 projection 汇成 `mapContextView`、稳定 `mapEntityRef` 与 `mapEventHooks`。游戏、考试和 SSE payload 返回 `mapContextView`，prompt context 只读取 capped `mapContext` 摘要；默认工具 registry 新增 `map.propose_route_or_geopolitical_move`，覆盖赶考、赴任、巡查、行军、押解、使节出行和商路活动。该工具只提交待裁决 proposal，服务器 resolver 校验 actor 权限、移动类型、可见 origin/destination/route/evidence refs、route ref 类型和 hidden/raw/坐标/路径/key/SQL 污染后返回 pending 或 rejected；不写 `worldState`、session、SQLite、事件档案、战争/外交/财政/任免或移动后果。S72 在此安全接口之上建设 PixiJS 水墨地图 UI；S72.2 已新增 `src/game/mapRuntimeConfig.js`、`src/game/mapVisualLayoutSeed.js` 和 `src/game/mapRuntimeView.js`，把安全地图 refs 合成为显示 layout、layer/style token、route path、event effect 与服务器预渲染行动草稿。显示坐标只用于前端布局，不代表 canonical 地理真值，不授予 AI 或浏览器新的裁决权。

S70 之后的正式游玩体验按 AI-first 建设：真实 AI 是产品核心，MiMo-V2.5-Pro 是大面积使用候选，Mock/no-key 只保留为本地开发、CI、断网降级和 deterministic 回归样板，不再作为玩法深度上限。AI 输出可以按玩家设置变长，真实 provider 验收应覆盖长叙事、多 actor、工具调用、月报、跳时、记忆提炼和 critic/safety；但服务器仍必须保留场景级并发、工具次数、超时、重试和失败降级上限。S70.9 已落地浏览器 “AI 设置” 面板，让玩家按叙事、NPC、科举、政务、战争、记忆、critic/safety 等任务配置 provider/model、输出长度、并发、工具预算和安全严格度；设置只能影响路由和质量，不得启用 hidden/raw/直写库能力。S70.10 已落地浏览器“官职月报”面板，玩家在行政/官职身份每月末看到服务器清洗后的本职差事、案牍、钱粮、军务、上官同僚、下月待办和风险摘要；面板只读 route `playerMonthlyBriefingView` 与本回合反馈，不读取 raw 月报账本。

S70.8 的路由策略不会因为本机存在真实 provider key 而覆盖显式 Mock 模式；只有用户选择真实 provider、`mimo-deepseek` 或任务级 provider 环境变量时，相关 task 才会走真实模型。

S70 新增 AI-first 体验工具应覆盖玩家官职月报、自然语言跳时、大模型记忆和地图接口预留。玩家当官后，每三旬进入下月上旬时触发 `playerMonthlyBriefing`，只为玩家按职位生成月报，汇总政务、案牍、财政、军务、上级态度、同僚风向、NPC 主动请求和下月风险。玩家说“学习一月”或类似自然语言时，AI/Mock 只解析 `timeSkipPlan`，服务器再拆成三个旬 tick，逐旬结算读书、政务、NPC、长期事件和危机中断；如果科期开场、考试场景、重大长期事件或署中急件出现，跳时停在当旬并返回下一步提示。大模型记忆已分为可见 actor memory ledger、fact/impression memory、月度 session summary 和安全 prompt 检索；AI 只能提交 memory proposal，服务器写入来源、可见性、置信度和衰减，private/hidden 记忆等 redacted API 后再做。地图接口已预留 `mapContextView`、`mapEntityRef`、`mapVisibility`、移动/行军/赴任/赶考/外交 proposal 和 `mapEventHooks`，AI 只读可见地图 projection，不读取 raw coordinate table 或 hidden enemy truth，服务器只接收待裁决移动/地缘 proposal。

S70 规划已经扩展为 Codex 开发任务书并完成归档：`docs/AI_ORCHESTRATION_ROADMAP.md` 第 13-16 节列出执行规则、依赖与资料准备、S70.1-S70.14 的前置条件、建议模块/函数、工具/route 接口、测试文件和验收清单；实际完成范围以 [AI_ORCHESTRATION_ARCHIVE.md](AI_ORCHESTRATION_ARCHIVE.md) 为交接入口。S70 默认优先不新增 npm 依赖，先使用现有 Node/Express/AJV/provider adapters/node:test/browser smoke；若后续需要 MCP SDK、队列、schema 类型库、搜索或可观测依赖，必须先走依赖治理并证明收益。S70.1 已落地契约、schema 与 provider tool smoke；S70.2 已落地 actor profile 与权限 allowlist；S70.3 已落地内部 registry/runner、read resolver、pending bridge 和审计摘要；S70.4 已落地 NPC mind 基础、显著度排序、启发式 proposal、可见记忆候选和 hidden-safe redaction，但尚不接入普通 turn 自动调度或持久私密记忆；S70.5 已落地朝议/科场制度场景 helper、公开 context 压缩清洗、scene-local proposal 收束和伪造参与者防护，但尚不接入真实 provider 或领域 resolver；S70.6 已落地压力事件工具协议、可见压力来源收集、Mock 候选和 hidden-safe 红队，但尚不做 S71.8 的数据库压力成案生成器；S70.7 已落地刑名、地方政策、军务、外交、科举、任免、赏罚与处分工具定义和 thin resolver bridge，但尚不做真实领域结算；S70.8 已落地多模型 task route policy、task-aware provider facade 和本地 AI eval runner；S70.9 已落地 session 级 AI 设置、浏览器设置面板、route 成本摘要和 hidden-safe 调动摘要；S70.10 已落地玩家官职月报、月末触发、事件档案接入、浏览器面板和 hidden-safe redaction；S70.11 已落地自然语言跳时、逐旬 batch tick、科期/急件中断、SSE `timeSkip` payload 和浏览器 `[跳时]` 反馈；S70.12 已落地 actor memory ledger、session summary、memory proposal schema、route/prompt/event archive 安全 projection 和 private memory 拒绝边界；S70.13 已落地地图 AI 接口预留、稳定 map refs、地图可见性过滤、移动/行军/赴任/赶考/外交 proposal schema 和 pending-only resolver；S70.14 已落地 `npm run smoke:provider:ai-first`、S70 AI-first JSON/SQLite route-view parity 和 S70 归档。`smoke:provider:tools` 当前真实执行 forced tool call 与 tool-result roundtrip，multi-tool / streaming tool delta / schema failure 的深度实探留给后续扩展，不授予 AI 新写权。

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
GET  /api/game/player-state/:sessionId
GET  /api/game/state/:sessionId
GET  /api/game/search/:sessionId
POST /api/game/turn
POST /api/ai/connection-test
GET  /api/ai/settings/global
POST /api/ai/settings/global
GET  /api/ai/settings/:sessionId
POST /api/ai/settings/:sessionId
POST /api/ai/quick-actions/:sessionId
GET  /api/game/topic-surface/:sessionId/:surfaceId
POST /api/ai/topic-draft/:sessionId
POST /api/exam/question
POST /api/exam/progress
POST /api/exam/submit
```

核心约定：

- `POST /api/game/start` 校验 `role`，允许 `scholar`、`emperor`、`minister`、`general`、`magistrate`、`official`；未知身份返回 400，不创建 session。
- `GET /api/game/saves` 只返回脱敏 metadata，包括 `sessionId`、schema/revision、创建/更新时间、玩家名、身份、朝代年月旬、回合数、科名、官职和摘要；不返回完整 `worldState`、隐藏关系、provider 配置、本地文件路径或数据库路径。
- `GET /api/game/player-state/:sessionId` 是普通玩家读档与局势簿分页优先入口，返回 `server_player_visible_state_projection`、allowlist `worldState`、metadata、redaction 边界和再次清洗的 route views；可用与 state route 相同的 `information*` 与 `eventArchive*` 查询参数。hidden canary、raw ledger、raw audit、provider payload、完整 prompt、本地路径、key、SQLite 物理表行不会进入该 route。
- `GET /api/game/state/:sessionId` 读取开发兼容状态快照和服务器整理后的 route views；可用 `informationTab`、`informationQuery`、`informationFilter`、`informationSort`、`informationPage`、`informationPageSize` 读取局势簿服务器分页。S70.12 起响应 `worldState` 会剥离 raw `actorMemoryLedger` / `sessionSummary`；S71.4 后普通浏览器读档改用 player-state，后续真正 hidden 私档不能依赖该兼容 route 暴露。
- `POST /api/game/turn` 支持普通 JSON 与 SSE。SSE 可先发送顶层 `narrative_chunk`，但状态只在完整 JSON 通过 schema 后落盘；真实 provider 流式失败时不保存状态，并移除未提交临时叙事。
- `POST /api/ai/connection-test` 不创建 session、不写存档、不用 Mock fallback 掩盖真实 provider 问题，返回脱敏健康检查。
- `GET/POST /api/ai/settings/global` 读取或更新服务端全局 AI 设置；响应固定 `scope: "global"`，并返回 `updatedAt`、`aiSettingsView`、`aiInvocationSummaryView` 和 `aiControlAuditView`。全局设置存在时，所有当前和未来案卷的 AI 路由都优先使用同一份 route policy。
- `GET/POST /api/ai/settings/:sessionId` 是兼容入口，仍校验案卷存在，但读写同一份服务端全局设置，并在响应中返回 `targetSessionId`。设置接口只接受 provider/model、输出长度、工具预算、温度和安全控制等质量/路由字段，拒绝 hidden/raw/server/path/key、直写状态/数据库和观测日志伪造。
- `GET /api/dev/session-diagnostics/:sessionId` 是本机开发诊断 route，不属于普通玩家 API：默认关闭，`NODE_ENV=production` 强制关闭，只有 `ENABLE_DEV_DIAGNOSTICS=true`、远端地址为 loopback，且 Origin 为空或本机 loopback Origin 通过时才返回 storage/features/counts/resolver/AI 摘要统计。
- S68.4 起，考试和游戏路由在有当前或刚归档考试时返回 `examProcedureView`。该 view 由服务器从 `activeExam.procedure`、`sceneTime`、入场准备和交卷复核派生，展示童试三关、乡试/会试三场、保结、搜检、号舍、发题、草稿、誊清、交卷、弥封、誊录、对读、磨勘、放榜和归档摘要；交卷后安全快照写入 `player.examHistory[].examProcedure`。S68.5 起，交卷后还返回 `examinerPanelView`，公开展示夹带疑云、号舍病困、誊录误差、多考官建议、服务器定分输入和 provider 建议拒绝摘要。S69.1 起，交卷后还返回 `examHonorView`，公开展示服务器从 canonical ranking 写定的解元、会元、状元、榜眼、探花、传胪、二甲/三甲次序和三元成就。S69.2 起，交卷后服务器还会从定榜顺序、公开荣誉和脱敏阅卷摘要派生 `examNetwork` 安全快照，把可见同年、房官、主考/座师和读卷官关系写入 `relationshipView` / `worldPeopleView` / `eventArchiveView`。S69.3 起，殿试交卷后服务器还会返回 `appointmentTrackView`，用 canonical 甲第、榜次、荣誉、同年座师摘要、官缺 projection 和籍贯回避裁决初授，写入 `officialCareerView`、事件档案与安全 `examHistory[].appointmentTrack` 快照。S69.4 起，浏览器侧栏的“科举档案”只组合这些 route view 与 `examHistory[]` 安全快照，展示读书簿、科场档案、榜单、同年考官和授官轨迹。S69.5 起，真实 provider 出题与评卷结果在进入 `activeExam`、评分 payload、`examinerPanelView` 和考试历史前经过考试 provider 文本清洗，遮蔽 hidden token、raw provider/proposal、prompt/index/table 名、本地路径和 key 形状文本；`smoke:exam-s69` 用 Mock deterministic 路径验收四级科举到初授。外层四级 API 不变，流程阶段不推进全局旬。

游戏与考试路由可返回这些 view：

- `examCalendarView`、`examRivalView`
- `examProcedureView`
- `examinerPanelView`
- `examHonorView`
- `appointmentTrackView`
- `examNetwork`（通过 `relationshipView`、`worldPeopleView`、`eventArchiveView` 和考试历史快照暴露）
- `studyProfileView`
- `relationshipView`、`activeNpcRequestView`
- `roleWorldCouplingView`
- `worldEntityView`、`worldThreadView`
- `worldGeographyView`
- `worldPeopleView`
- `officialCareerView`
- `officialPostingsView`
- `localAffairsDocketView`
- `militaryDiplomacyView`
- `economicFiscalView`
- `historicalEventArchiveView`
- `intelligenceRumorView`
- `longTermEventView`
- `eventArchiveView`
- `informationPanelPageView`
- `actorMemoryView`
- `sessionSummaryView`
- `mapContextView`
- `mapRuntimeView`

浏览器和 prompt 必须优先读取这些服务器 view / capped summary，而不是 raw ledger、raw audit、provider-only `retrievalContext` 或 SQLite 原始表；其中 `mapRuntimeView` 只供浏览器地图 runtime 使用，不进入 prompt context、AI 工具或服务器 resolver 的事实依据。

## 7. 存储与本地数据库

`src/storage/sessionStore.js` 是 route-facing facade。默认 adapter 是 `src/storage/jsonSessionAdapter.js`，存储 JSON envelope 到 `data/sessions/*.json`，包含 `storageSchemaVersion: 1`、redacted metadata、nested `worldState`、atomic temp writes、revision checks 和 per-session local lock。

可选 SQLite adapter：

- 通过 `STORAGE_ADAPTER=sqlite` 显式启用，默认仍是 JSON。
- 使用本地 `world_sessions` row 保存 metadata、revision、timestamps 和 JSON `world_state_json`。
- S54.2 起，SQLite 模式会用 `src/storage/sqliteGeographyTables.js` 同步规范化后的 `worldState.worldGeography` 到 `geo_countries`、`geo_regions`、`geo_cities`、`geo_routes`、`geo_frontier_zones`、`geo_office_jurisdictions`，并在读取时从 `world_state_json` 修复缺失或陈旧业务行。
- `SQLITE_DATABASE_PATH` 只影响本地数据库路径，不进入 prompt、浏览器或 save-list payload。
- `npm run storage:import:sqlite` 可把 JSON 存档导入 SQLite，默认不删除 JSON 原档；写入时通过 SQLite adapter 同步 `geo_*`、`people_*`、`office_*`、`event_archive_index`、`prompt_retrieval_index` 和 `safe_search_index` 等本地派生表，`--dry-run` 不打开或修改 SQLite。
- S54.3 起，`npm run storage:geography:sqlite -- status|repair|export` 可检查地理业务表漂移、按 `world_sessions.world_state_json` 修复 `geo_*` 行，并导出脱敏 debug dump；`import` / `repair` 的 `--dry-run` 不修改 SQLite，`export` 不输出 hidden notes、数据库路径、prompt、key 或 raw provider response。
- S55.2 起，SQLite 模式会用 `src/storage/sqlitePeopleTables.js` 同步规范化后的可见 `worldState.worldPeople` bridge rows 到 `people_npcs`、`people_households`、`people_assets`、`people_estates`、`people_relationships`，并在读取时从 `world_state_json` 修复缺失、陈旧或错行的派生表。S55.3 起，服务器已应用的人物关系、active request 结果和后续可见人物/家产 delta 会生成 `world_people` 审计事件，SQLite `people_*` 行可保存本地 `last_event_id` 关联。它不改变 `worldPeopleView`，也不把 hidden NPC 私档、raw `people_*` 行或事件 id 回填进 route raw `worldState.worldPeople`。
- S56.2 起，SQLite 模式会用 `src/storage/sqliteOfficialPostingTables.js` 同步规范化后的安全 `worldState.officialPostings` projection 到 `office_bureaus`、`office_catalog`、`office_city_jurisdictions`、`office_postings`、`office_assessments`、`office_transfers`；S56.3 起，每条 `office_*` 派生行带 `metadata_json.contentHash` 本地漂移探针，读取时从 `world_state_json` 修复缺失、陈旧、错行、同 id/同 revision 内容污染或旧行缺指纹的派生表。它不新增 route 字段，也不让 raw `office_*` 反向改写 `player.officeTitle`、`officialCareer` 或 prompt/browser view。
- S57.1 起，SQLite 模式会用 `src/storage/sqliteEventArchiveTables.js` 同步 `buildEventArchiveView` / `buildEventArchiveIndexItems` 生成的安全公开事件条目到 `event_archive_index`。该表只保存 `eventArchiveView` 已脱敏、可分页的公开 projection 字段，带 `metadata_json.contentHash` 漂移探针，读档时从 `world_sessions.world_state_json -> eventArchiveView` 单向修复，不读取 raw `event_log` / `ai_change_proposals`，也不把 raw index row 反向回填 route state、prompt 或浏览器。S65.1 的 `historical_event_chain` 条目只来自服务器公开历史事件链，不保存密档 projection；S65.2 的 `intelligence_rumor` 条目只来自 `intelligenceRumorView.publicRumors`，不保存隐藏情报真值。
- S57.2 起，`npm run storage:audit-events -- status|export --adapter json|sqlite` 可从 JSON sidecar 或 SQLite 审计读取本地记录，生成只含 allowlist public 摘要的安全 projection；AI proposal 只计数，不输出原始建议内容，也不会写回 `eventArchiveView` 或 `event_archive_index`。
- S58.1 起，SQLite 模式会用 `src/storage/sqlitePromptRetrievalTables.js` 把 `worldGeographyView`、`worldPeopleView`、`officialPostingsView`、`localAffairsDocketView`、`militaryDiplomacyView`、`economicFiscalView`、S65.1 `historicalEventArchiveView` 公共事件链、S65.2 `intelligenceRumorView` 情报传闻和 `eventArchiveView` 的服务器可见条目同步到 `prompt_retrieval_index`，每行带 `metadata_json.contentHash`；读档从 `world_sessions.world_state_json -> server views -> prompt index` 单向修复，`promptContextAssembler` 只在 SQLite 读档挂载了非枚举安全来源时读取该索引，否则继续使用现有 JSON/view helper fallback。
- S71.3 起，`GET /api/game/search/:sessionId` 返回 `safeWorldSearchView`，只包含 `domain/sourceView/sourceId/title/snippet/confidence/visibility/relatedRefs/routeViewRef` 等玩家可见字段。JSON 模式由 `src/game/safeWorldSearch.js` 从服务器 route views 即时生成；SQLite 模式同步 `safe_search_index`，FTS5 可用时维护 `safe_search_fts`，不可用时使用 LIKE fallback。搜索查询、页码、页大小和 snippet 都有 cap；内部表名、审计原文、provider 输出、提示全文、本地路径、密钥或隐藏私档不会进入搜索结果或 AI 可读片段。
- S81-S84 起，SQLite 模式会用 `src/storage/sqliteAssetTables.js`、`src/storage/sqliteInventoryTables.js` 和 `src/storage/sqliteNpcInteractionTables.js` 同步安全资产、资源、背包、NPC 名册、交互、委派和交易 projection 到 `asset_resource_accounts`、`asset_long_term_assets`、`inventory_containers`、`inventory_items`、`npc_roster_profiles`、`npc_interaction_events`、`delegated_tasks`、`trade_ledger_records`。这些派生表只保存服务器安全摘要和 `metadata_json.contentHash` 漂移探针；读档从 `world_sessions.world_state_json` 单向修复，不把 hiddenDossier、privateSignalTags、交易底价、raw provider proposal、完整 prompt、本地路径或 key 回填 route、prompt 或浏览器。
- S74 起 `npm run smoke:browser` 是 React 默认入口 smoke，接受 `--client react`、`--url`、`--browser`、`--screenshots` 和 `--headed` 等 client 参数；JSON/SQLite 双模式、局势簿 parity 和 no-browser 存储验收统一由 `npm run smoke:dual-mode` 与 `npm run smoke:dual-mode -- --storage-only` 承担。`--storage-only` 会跑 JSON -> SQLite dry-run/正式导入、地理修复/导出、审计公开 projection、派生表计数、prompt 策略、局势簿分页、事件档案分页、SQLite 读档修复、内存/耗时门槛和 hidden-token 检查。S67 性能报告中 `rawFixtureGenerationMs` 只表示原始 fixture 数据生成，`fixtureBuildMs` 表示外层构建总耗时且用于报告；完整测试并发下的资源波动不得替代数量、分页、prompt budget、读修复 parity 和防泄漏硬门。

本地审计：

- JSON 模式写 `data/audit/{sessionId}.event-log.jsonl` 与 `data/audit/{sessionId}.ai-proposals.jsonl`，是诊断性尽力追加。
- SQLite 模式写 `event_log` 与 `ai_change_proposals`，可在本地 transaction 中和 session row 一起提交。
- 审计记录只保存脱敏摘要、proposal 字段、服务器接受/拒绝原因和应用事件 id，不保存密钥、完整 prompt、本地路径、hidden notes 或未经脱敏 provider 错误。
- `src/game/auditPublicProjection.js` 与 `scripts/auditEventArchiveTool.js` 只把 `visibility: "public"` 的审计摘要重新经过事件档案 sanitizer 和字段 allowlist；raw prompt、provider proposal 原文、路径、key、hidden notes、hidden intent 和数据库内部信息必须被丢弃或遮蔽。

S54-S59 已完成的数据库拆表必须继续保持 JSON 默认可玩，并保留 `worldState` snapshot 可读、可导入、可导出。SQLite 只增强本机索引、审计、长期存储、检索式 prompt context 和安全查阅 projection，不把核心裁决交给 AI、SQL 或黑箱库。即使 SQLite 已保存 `geo_*` raw rows，浏览器和 prompt 仍必须读取 `worldGeographyView` / capped summary，不得绕过服务器 view 过滤；S60-S67 内容充实归档后的所有新增内容域也继续沿用这个边界。

## 8. 当前领域账本与安全 View

已落地的 server-owned / view-first 数据域：

- `worldEntities` / `worldEntityView`：朝廷衙门、地方士绅、书院、军镇、盐漕、赈务等制度实体压力。
- `worldThreads` / `worldThreadView`：主动 NPC、长期事件、官场差事、身份联动和高压实体整理成世界议程。
- `worldGeography` / `worldGeographyView`：国家、邻国、区域、城市、路线、边境压力面和官署辖区；S61 起还包含国家财政/军备/国威/继承/外交/情报可靠度与城市人口/税粮/市价/士绅/诉讼/徭役/水利/灾害/交通/驻军/书院等安全深度指标。这些字段只做可见 projection、prompt 检索和局势解释，不替代财政、战争、外交或城市治理裁决。
- `worldPeople` / `worldPeopleView`：从当前可见 `characters`、`relationshipLedger` 和 active request 近期札记桥接人物、家族、资产、田产和关系摘要；不保存 hidden 私档。S55.2 已让 SQLite 模式把这份可见 bridge projection 同步进本地 `people_*` 表，S55.3 让服务器人物事件通过审计和本地 `last_event_id` 关联追溯这些可见行；S62.1 的人口谱系生成器为 fixture/安全 projection 补 NPC 社会身份、公开族谱、婚姻、门生故旧、同乡同年和派系网络；S62.2 的服务器生命周期 helper 在月末推进可见健康、婚丧、迁居、官职履历状态、财富/欠账、资产、田产、家族风险和人情债演化，并继续通过 `world_people` 审计和 `people_*` 派生行追踪。真正 hidden 私档、资产真数或未公开动机仍不回填当前 raw route state。prompt/UI 仍只读服务器 view，不读 raw table 或 raw audit。
- `assetLedger` / `resourceLedger` / `inventoryLedger` / `npcRoster` / `npcInteractionLedger` / `tradeLedger` / `delegatedTaskLedger` / `openingBackgroundClaims` / `marketPriceLedger` / `npcEconomyLedger` / `npcActiveRequestLedger`：S81-S85 新增的服务器拥有账本，分别维护长期资产、可计量资源、容器物品、可交互 NPC、NPC 交互、交易记录、委派任务、开局背景裁决、基础市场价格、NPC 经济月结和 NPC 主动来函。provider 不能 patch 这些账本；浏览器、prompt 和 SQLite 只读安全 view 或安全派生表；兼容 route `worldState` 会剥离 raw ledger，player-state 返回 `assetLedgerView`、`resourceLedgerView`、`inventoryView`、`npcRosterView`、`npcInteractionView`、`tradeLedgerView`、`delegatedTaskView`、`openingBackgroundClaimsView`、`marketPriceView`、`npcEconomyView` 和 `npcActiveRequestView`。S85 的 `npcEconomy` 只在普通回合/跳时共享的世界 tick 后运行：旬更市价，月末结算资产、库存、委派、逾期交易、人情债和 NPC 关系记忆；考试场景不触发全局经济。S85 的 `npcActiveRequests` 只生成和裁决 NPC 主动请求安全状态，不直接写资源、婚姻、弹劾、背叛或 hidden 事实；`npcRelationshipActions` 只提供论道、切磋、求爱和婚姻的服务器 eligibility/outcome 扩展位，后续专门 resolver 才能写更重后果。
- `officialPostings` / `officialPostingsView`：从 `officialCatalog`、`officialCareer`、地方官 role state 和可见地理 view 派生官署、官职、任所、考成和迁转摘要；S61.2 起，当前任所考成会把城市税基、粮储、市价、士绅、词讼、徭役、水利、灾害、交通、驻军和书院压力整理成可见“任所奏报”；不改变 `officialCareerView` 或官场结算。
- `localAffairsDockets` / `localAffairsDocketView`：从可见 `worldGeographyView` 城市深度指标和 `officialPostingsView.cityJurisdictions/postings` 派生地方案牍模板，覆盖钱粮、刑名、灾赈、水利、盗匪、徭役、士绅、疫病和任所收束。该 view 只对行政身份开放，书生默认为空；`assessmentHint` 只是后续服务器考成候选线索，不会直接改 `officialCareer`、城市指标或 SQLite 表。
- `militaryDiplomacy` / `militaryDiplomacyView`：从可见 `worldGeographyView` 国家/边面/城市/路线、`worldPeopleView` 军官/邻国使者线索和 `officialPostingsView` 任所/辖区派生外交军务态势，覆盖边防战区、驻军、粮道、战备、邻国使节往来和边患预警。该 view 按角色 cap、地理/任所相关性和情报可信度过滤；书生默认为空；它只提供叙事和后续 resolver 线索，不直接宣战、和议、调兵、任免统帅、结算战役或公开 hidden 情报。
- `economicFiscal` / `economicFiscalView`：从可见 `worldGeographyView` 城市/国家/路线、`officialPostingsView` 任所/辖区、`localAffairsDocketView` 案牍、`worldEntityView` 财赋/赈务实体和 `worldPeopleView` 可见债务资产派生经济财政态势，覆盖户部钱粮总账、城市粮储市价、盐漕商路、地方库银赈济、债务亏空/腐败风险和财赋市场预警。该 view 按角色 cap 和任所/商路相关性过滤；书生默认为空；它只提供叙事、预警和后续 resolver 线索，不直接裁决征税、拨银、开仓、平粜、赈济、盐漕、矿冶、债务清偿、追赃、市场价格、考成或持久化。
- `historicalEventArchive` / `historicalEventArchiveView`：从可见案牍、军务、财赋、任所考成、人物关系和科举履历组合 S65.1 历史事件链，覆盖自然灾害/赈务、官场争斗、边事、商税、人物关系、科举和地方差遣。普通 route 只返回公开链；密档链必须由服务器显式 `includeSealed`，且不进入普通玩家路由、浏览器、prompt retrieval 或 SQLite prompt 索引。
- `intelligenceRumor` / `intelligenceRumorView`：从服务器可见地理、案牍、军务、财赋、人物关系和公开历史事件链派生 S65.2 情报传闻，按身份显示为坊间传闻、地方风声、衙门案牍、官署奏报、同僚私信、军中侦报、粮道风声、部院奏报、御史风闻或御前摘报，并附可信度、来源归因、相关 refs 和服务器裁决边界。它只提供角色可见线索，不直接公开隐藏情报真值、写状态、写审计、写 `prompt_retrieval_index`、成案或结算后果。
- `studyProfile` / `studyProfileView`：S68.2 新增读书账本与学业计划，S68.3 扩展老师点评、书院师友、同窗互评、小题训练、荐书和保结前置。服务器从玩家属性、读书行动、师友互动和 `player.examHistory` 的评分/反作弊复核派生经义根柢、制艺章法、策论时务、史事典故、律例判断、誊写卷面、科场耐力等可见画像，并生成最近日课、文卷强弱、老师建议、AI 老师文本点评、书目、小题和下旬计划。普通拜师、讲会、同窗互评或求保结会由服务器创建/更新可见 `characters -> relationshipLedger -> relationshipView/worldPeopleView` 师友关系，并刷新 `academyNetwork.sponsorship` 保结稳度；考试入场准备只携带脱敏保结 snapshot，不把保结当作准考事实。AI 老师、出题和评卷 prompt 只能读取 capped `studyProfile` 摘要并给点评/建议；普通 provider `statePatch` 不能写 `studyProfile`、`player.teacher` 或 `player.position`，师承身份、名位文本与关系事实只由服务器读书互动或官职 resolver 建立，`teacherFeedbackProposal` 也只能提交文本点评 proposal，不能借读书建议直接授名位、改榜、改官职、创造真实关系或写持久化事实。
- `activeExam.procedure` / `examProcedureView`：S68.4 新增科场制度流程 projection。服务器在入场取题、场内推进和交卷归档时同步安全流程摘要，覆盖童试县试/府试/院试摘要，乡试/会试三场多卷，保结、搜检、号舍、发题、草稿、誊清、交卷、弥封、誊录、对读、磨勘、放榜和归档；浏览器科举面板、考试弹窗和考试档案都只读 `examProcedureView` / `examHistory[].examProcedure`。prompt 只能读取 capped `examProcedure` 摘要，普通 provider `statePatch` 不能写 `examProcedure`、`activeExam`、卷件生命周期、榜单、名次或官职。当前实现不保存弥封身份映射、保结密注、考官私意、模型原始建议或内部审计；若未来需要 hidden 卷件真值，必须先设计玩家 API redaction 与角色视野分层。
- `examinerPanelView`：S68.5 新增科场事件与多考官阅卷 projection。服务器在本地反作弊后、生成榜单和晋级前运行 `resolveExamReview()`，用具名配置限幅处理夹带疑云、号舍病困、誊录误差、房官/同考官/主考官/磨勘 critic 建议和 provider `examiner_reviews`。provider 考官建议只能作为脱敏 proposal 留痕，不直接加分、扣分、定榜、授功名或处罚；服务器采纳的 reviewer delta 与事件 delta 先形成最终 score，再进入既有 virtual candidates、canonical ranking 和 promotion resolver。浏览器考试结果、考试档案和书生面板只读 `examinerPanelView` 或 `examProcedureView.examinerPanelView`；prompt 只读取 capped `examinerPanel` 摘要，不暴露弥封映射、考官 hidden intent、保结 hidden notes、raw proposal、raw audit、本地路径或 key。
- `examHonorLedger` / `examHonorView`：S69.1 新增榜单名次荣誉 projection。服务器在 `buildRanking()` 生成 canonical 同场顺序后，由 `examHonors` resolver 为榜单行加上解元、会元、状元、榜眼、探花、传胪、二甲/三甲次序等公开标签；殿试 promotion 读取 canonical 榜次确定一甲/二甲/三甲，考试历史保存安全 `examHonor` 快照，累计荣誉写入 `worldState.examHonorLedger` 并可触发三元及第。prompt 只读取 capped `examHonors` 摘要，浏览器只读 route `examHonorView` 或历史快照；provider `ranking`、`virtual_candidates`、`examiner_reviews`、皇帝/吏部叙事或普通 `statePatch` 都不能授予荣誉、改甲第、定官职或写隐藏榜单。
- `examNetwork`：S69.2 新增同年、座师与考官网络安全快照。服务器在 canonical ranking、荣誉和 cohort 记录完成后，由 `examNetworks` resolver 创建同年、房官、主考/座师、殿试读卷官等可见联系人，写入 `characters -> relationshipLedger -> relationshipView/worldPeopleView`，并把安全 `examHistory[].examNetwork` 快照纳入事件档案 `exam_network` 条目和 capped prompt `examNetwork` 摘要。provider `examiner_reviews`、普通 `relationshipChanges`、raw proposal、弥封映射、考官 hidden intent、保结密注或 hidden 榜单不能创建 durable 同年/座师/考官事实。
- `appointmentTrack` / `appointmentTrackView`：S69.3 新增殿试后授官轨迹 projection。服务器在 canonical ranking、`examHonors`、`examNetworks` 和 `officialPostingsView` 完成后，由 `appointmentTracks` resolver 裁决初授：一甲第一名为翰林院修撰，一甲二三名为翰林院编修，二甲优先馆选庶吉士并保留观政/部属候选，三甲读取任命池与籍贯回避后外放、部属候补或候缺观政。选中结果写入 `player.role` / `player.officeTitle` / `officialCareer.currentPosting` 与“初授”履历，考试历史保存安全 `appointmentTrack` 快照，事件档案生成 `appointment_result`，prompt 只读取 capped 摘要。provider、吏部或皇帝 proposal 不能绕过官缺、回避、甲第、服务器任免或直接写 `officeTitle`。
- 浏览器“科举档案”面板：S69.4 新增 `#imperial-exam-archive-panel`，在书生和入仕侧栏整合读书画像、科场流程、多考官阅卷、榜单荣誉、同年/座师/考官与授官轨迹。该面板只读 `studyProfileView`、`examProcedureView`、`examinerPanelView`、`examHonorView`、`relationshipView` / `worldPeopleView`、`appointmentTrackView` 和 `examHistory[]` 安全快照；source smoke 与 browser smoke 共同禁止它从 raw `worldState` 子账本、raw audit、SQLite raw/index table、prompt、retrievalContext 或 provider proposal 渲染。
- S69.5 Provider/Mock 验收守卫：`src/game/examProviderSanitizer.js` 在考试出题和评卷 route 落盘前清洗 provider 文本，`scripts/mockImperialExamAcceptance.js` 通过 `npm run smoke:exam-s69` 验收 Mock 四级科举 deterministic path，`scripts/providerSmoke.js` 要求真实 provider 覆盖 `teacherFeedbackProposal`、出题、评卷和 S69 server-owned patch 越权检查。该守卫不授予 provider 新写权，只把已有 proposal/评分入口纳入验收和脱敏。
- `eventArchiveView`：从公开近事、世界议程、长期事件、官场履历、考试档案、可见任所考成、地方案牍、军务外交预警、财赋市场预警、S65.1 公开历史事件链和 S65.2 情报传闻整理事件档案；S57.1 起带分页 metadata，并在 SQLite 模式同步到安全 `event_archive_index`；S61.2 的 `official_assessment` 条目只来自 `officialPostingsView.assessmentRecords`，S63.2 的 `local_docket` 条目只来自 `localAffairsDocketView`，S64.1 的 `military_diplomacy` 条目只来自 `militaryDiplomacyView.frontierIncidents`，S64.2 的 `economic_fiscal` 条目只来自 `economicFiscalView.marketIncidents`，S65.1 的 `historical_event_chain` 条目只来自公开 `historicalEventArchiveView.publicChains`，S65.2 的 `intelligence_rumor` 条目只来自 `intelligenceRumorView.publicRumors`。它不读取 raw audit、provider proposal、prompt、本地路径、key、历史事件密档或隐藏情报真值。S57.2 的审计公开 projection 是本地开发/调试工具输出，不是 route view、prompt 或浏览器信息面板的数据源。

S53/S66 浏览器“局势簿”只读这些 route view；S66.2 的 `informationPanelPageView` 也是从 route view 和安全事件档案条目派生的分页 projection，不读取 raw SQLite table。S54-S59 已完成的 SQLite 拆表和 S60-S67 内容充实阶段继续保持 view-first；后续 UI 和 prompt contract 仍不得暴露原始业务表、raw audit、provider proposal、hidden notes、hidden intent 或本地路径。

## 9. 时间与场景契约

S48 后，普通自由行动使用旬制：

- 日期使用 `year/month/tenDayPeriod`，玩家可见为“明1644年正月上旬”这类格式。
- 普通回合按“上旬 -> 中旬 -> 下旬 -> 下月上旬”推进。
- 世界自然漂移、长期事件月数递减、季节性事件、官场任内月份和考成周期默认只在下旬进入下月上旬时完整结算。
- 考试已有 `activeExam.sceneTime`；`/api/exam/question`、`/api/exam/progress`、`/api/exam/submit` 推进考试局部阶段，不自动消耗全局旬。

后续廷议、堂审、战斗、赶考途中遭遇、重大差事收束和外交会盟也应使用 scene-local time，而不是把每次输入都硬解释为十天。

## 10. AI 权限与控制审查

[AI_CONTROL_AUDIT_MATRIX.md](AI_CONTROL_AUDIT_MATRIX.md) 是当前 AI/server 权限矩阵入口。新增 AI 可读摘要、可建议字段、server-owned ledger、浏览器面板或 provider 验收时，必须同步检查该矩阵。

### AI 地位与工具分层

S70 起，AI 不再只按 provider 分工，还要按游戏内 actor 分工。书生、士绅、商贾、吏员、地方官、御史、大臣、将领、皇帝、邻国君主和系统世界引擎都可以有不同 `aiActorProfile`、记忆、目标、可见信息和工具组。高位 actor 工具更强，但后果也更重：皇帝可以发诏、任免、诛罚、宣战或和议；服务器必须根据礼法、证据、财政、军心、士论、派系、执行链和历史记忆裁决成败与反噬。

推荐权限层：

- T0 背景民人：只提供传闻、记忆、局部事件材料。
- T1 书生/亲友：读书、拜访、投文、请托、结交，只影响自身和局部关系。
- T2 士绅/商贾/吏员：赞助、告发、拖延、串联、市场或地方舆情 proposal。
- T3 地方官/低阶军官：审案、赈济、征粮、水利、拘捕、局部兵备，受辖区和证据限制。
- T4 部院/御史/总督/将领：弹劾、调粮、任命建议、军令、跨区域差遣，受制度路径和资源限制。
- T5 皇帝/摄政/外邦君主：强政策工具，但必须有合法性、财政、士论、军心、宗室和执行链成本。
- T6 系统世界引擎：自然、市场、边患、事件链和长期压力演化，不代表任何角色。

权限原则：

- AI 可生成叙事、公文口吻、题目、评语、传闻、受限 meter 建议和关系建议。
- AI 可请求读取服务器整理后的可见上下文、actor 记忆、案牍、奏报、律例、市场、情报和检索摘要；读取范围由身份、职位、辖区、关系、地理和情报可信度决定。
- AI 可请求身份受限的领域工具调用或提交结构化 proposal；模型本身不执行 SQL，不直接写 canonical 状态、业务表或审计表，不把 tool call 当成已发生事实。
- AI 可建议普通状态 delta，但服务器必须 schema 校验、白名单合并、clamp 并记录接受/拒绝。
- AI 不可写：年月旬、考试晋级、榜单、官职任免、长期事件结局、世界实体/议程账本、canonical 状态、数据库业务表、审计表、隐藏信息和持久化 revision；这些只能由服务器 resolver 与 adapter transaction 写入。
- AI 不可读：密钥、`.env`、本地路径、raw prompt、raw audit、hidden notes、hidden intent、未公开关系/任所/密札。

所有新增表都应在契约中标明 AI 权限或至少给出安全边界。

## 11. Prompt 与 DeepSeek 缓存边界

`src/ai/promptPacks.js` 维护固定前缀、服务器边界、语气契约、AI 权限契约和输出契约。`src/ai/prompts.js` 按任务附带 `promptPack` 元数据并选择身份指令。`src/ai/promptContextAssembler.js` 负责动态上下文与 `retrievalContext`；S58.1 起，SQLite 读档会以非枚举方式提供安全 prompt 检索来源，assembler 可从 `prompt_retrieval_index` 的可见 projection 行组装检索摘要，JSON/default 路径仍直接调用服务器 view helper。S66.1 起，`retrievalContext.strategy` 会记录检索 profile、排序信号、行/字符预算、候选/选中/丢弃域统计、角色视野边界和分页边界；显式内部检索源会先过滤 hidden canary、raw table/index、审计表名、本地路径和 key 形状文本。

S70 提示词工程必须作为独立契约推进，而不是零散调 prompt。S70.1 已新增 [AI_PROMPT_ENGINEERING_CONTRACT.md](AI_PROMPT_ENGINEERING_CONTRACT.md)，定义 prompt pack 分层：`systemContract`、`actorCard`、`sceneContract`、`visibleContextCapsule`、`toolPolicy`、`outputContract`、`selfCheck`。每层都要有 `promptId`、`promptVersion`、适用 `sceneType` / `actorType`、输入预算、输出 schema、Mock/no-key fallback、provider smoke 和红队 fixture。提示词可以强化历史语气、角色差异、工具选择和结构化输出，但不能成为隐藏裁决权；它只能引导叙事、proposal、tool call 或 request-adjudication，最终仍由服务器 resolver 裁决。

S70 的 prompt 优化重点：

- 身份差异：书生、老师、县令、大臣、将领、皇帝、考官、商贾、胥吏、邻国使者要有不同 actorCard、利益偏差、语言风格和可用工具。
- 场景差异：普通回合、科场、堂审、朝议、战役、会盟、赈济、财政、市场、密札和事件链要有不同 sceneContract 与输出 schema。
- 上下文压缩：长上下文模型也不得读取 raw table；动态摘要必须由服务器按身份、职位、地理、关系、情报可信度和场景目标排序裁剪。
- Prompt 安全：玩家输入、NPC 原话、奏折、案卷和密札都作为 data 处理，不得覆盖 system/developer contract；红队覆盖忽略系统约束、直接升官/宣战/杀人、输出 SQL、泄漏 hidden、暴露完整 prompt、伪造工具结果和低可信传闻当事实。
- Provider 评测：MiMo-V2.5-Pro、DeepSeek、OpenAI、Anthropic 和 Mock 要用同一组 prompt fixtures 比较 schema 合规、身份边界、工具选择、拒绝越权、历史语气、token 成本和失败降级。

DeepSeek 上下文硬盘缓存优化必须纳入 prompt pack 设计，但不得影响游戏效果：

- 稳定前缀优先：系统身份、服务器边界、JSON 合约、固定术语和不随回合变化的规则放在请求最前。
- 动态内容后置：当前世界摘要、玩家输入、考试文章和本回合具体 schema 附件放在稳定前缀之后。
- 不为缓存删上下文：不能牺牲必要局势信息、角色视野、官场深度、历史语气、反作弊判断或叙事质量。
- 不做缓存计数记录：当前阶段不读取或保存 provider usage 的缓存命中/未命中 token 计数，也不在 diagnostics/smoke 中新增命中率字段。
- 可测试：同一 prompt pack 的固定前缀应有快照或等价测试。

## 12. 开发过程注意事项

每次开发都必须做：

1. 先读 `AGENTS.md` 或 `CLAUDE.md`，再读本文件。
2. 读取 `docs/SHARED_CONTEXT.md`，确认 Codex 最新上下文。
3. 读取 `docs/DEVELOPMENT_STEPS.md`，确认当前应执行的小步骤和历史进度。
4. 执行 `git status --short`，确认当前工作树。
5. 判断是否有别人未提交或未说明的改动，不要覆盖。
6. 将本次任务涉及的设计变更写回文档或 README。
7. 每次 coherent change 结束前更新 `docs/SHARED_CONTEXT.md`，写清当前状态、关键决策、验证结果和下一步建议。
8. 每次开始、完成、阻塞或调整开发步骤时更新 `docs/DEVELOPMENT_STEPS.md`，写明步骤 ID、完成内容、验证结果和提交哈希。
9. 保持 Mock 模式可运行。
10. 项目内面向协作和玩家的输出尽量使用中文；代码标识符、API、第三方术语、命令输出或外部工具清晰度需要时再使用英文。
11. 新增或调整游戏数值、阈值、时间间隔、概率、fixture 数量、UI 上限或 prompt budget 时，优先写入 `src/config/GameConfig.js` 或领域配置模块，避免魔法数字散落在业务逻辑、测试和前端脚本中。
12. 后续开发和维护不以“最小实现点”或“最小改动点”为目标；在安全边界、默认可运行、内容保护和可审查粒度不受损的前提下，优先交付完整、丰富、功能强大的游戏实现，并把必要的系统、交互、AI、数据、验证和文档一次设计到位。
13. 复杂功能必须坚持前后端分离和大步骤拆分：后端/API/数据契约、AI 权限与服务器裁决、前端体验、验证与文档应分阶段施工；前端不得代替服务器裁决资源、身份、交易、NPC 行动、经济结果或隐藏信息。
14. 后端契约、API/view 类型、安全 projection、AI schema/provider facade、storage adapter 和核心 resolver 新增或重构时，优先使用 TypeScript 或纳入 TypeScript 检查；既有 JavaScript 渐进迁移，不为语言迁移一次性重写稳定模块，TS 类型不能替代 Ajv 与服务器 runtime 校验。
15. 完成后至少运行与本次改动相关的验证命令。
16. 再次执行 `git status --short`。
17. 对包含代码、测试、运行时行为、API/schema、提示词或验证工具变化的 coherent change，在暂存和提交前至少委派一个只读子代理审查最终 diff 与验证结果。纯文档低风险改动可以跳过，但要在共享上下文或最终回复说明。
18. 用 Git 提交本次 coherent change。
19. 在最终回复中说明改了什么、验证了什么、提交哈希是什么。

大步开发可以使用 Codex 子代理并行推进，但主代理负责收束。用户已明确授权 Codex 在本仓库使用子代理；除非后续用户指令收窄或撤销该授权，否则视为长期项目上下文。2026-05-14 起，Gemini CLI 不再作为前端协作方参与本仓库后续开发；实施、复审、验证、文档同步、暂存和最终提交均由 Codex 负责。实施子代理不得运行 `git add`、`git commit`、`git push` 或创建 PR；提交前审查子代理必须只读，只报告风险、遗漏、测试缺口和建议。

不要做：

- 不要把关键决策只留在聊天记录里。
- 不要只更新 `AGENTS.md` 或只更新 `CLAUDE.md`，跨工具上下文必须进入 `docs/SHARED_CONTEXT.md`。
- 不要完成路线图步骤却不更新 `docs/DEVELOPMENT_STEPS.md`。
- 不要让真实 API Key 成为本地启动必要条件。
- 不要新增玩法、数据域、角色、官署、事件、面板或 prompt 检索却没有说明 AI 在其中的角色、可见信息、工具权限、proposal 边界、服务器裁决、审计和 Mock/no-key 降级。
- 不要让 AI 原始输出直接改写完整世界状态或数据库业务表。
- 不要绕过服务器的科举晋级、作弊规则、官职任免和持久化裁决。
- 不要把 `data/sessions/*.json`、`.env`、`node_modules/`、SQLite 本地数据库文件提交进仓库。
- 不要在一个提交里混入无关重构。
- 不要把同一类游戏数值、阈值、概率、时间间隔、fixture 规模或 prompt 预算硬编码散落在多个文件；确需局部常量时也要使用具名常量并说明原因。
- 不要用“最小实现点”“最小改动点”或临时占位代替完整玩法；可以拆成多个可审查 coherent changes，但每个阶段都应朝完整、丰富、功能强大的游戏实现推进。
- 不要把大功能的后端规则、AI 权限、数据库迁移、前端页面和验收脚本混成一个不可审查的改动；前端不得用本地推断替代服务器资源、交易、委派、身份或隐藏信息裁决。
- 不要为了 TypeScript 迁移一次性重写大量稳定 JavaScript 模块，也不要用 TS 类型替代 Ajv/schema 校验、服务器裁决、hidden/raw 清洗或持久化事务。

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

已完成的本地数据库底座：

1. JSON 默认仍可玩；SQLite 通过 `STORAGE_ADAPTER=sqlite` 显式启用，当前包含 `schema_migrations`、一行一 session、审计表、地理 `geo_*`、人物 `people_*`、官职任所 `office_*`、安全 `event_archive_index`、安全 `prompt_retrieval_index` 和安全 `safe_search_index` 派生表。
2. S49-S67 已统一归档到 [LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md](LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md)：S49-S53 本地数据库基础、S54-S59 SQLite 业务表/索引/维护/双模式验收、S60-S67 内容契约/规模 fixture/国家/城市/NPC/官职/案牍/军务/财赋/事件链/情报/prompt/局势簿分页/large fixture scale acceptance 都以该文件为追溯入口。
3. 旧的 `LOCAL_DATABASE_FOUNDATION_ARCHIVE.md`、`LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md`、`HUGE_DYNAMIC_WORLD_CONTENT_ARCHIVE.md` 和 `HUGE_DYNAMIC_WORLD_CONTENT_CONTRACT.md` 仅保留为跳转页，避免历史链接失效。
4. `event_log` / `ai_change_proposals` 是本地脱敏审计，不进入玩家 API，也不让 AI 直接写表；AI 领域工具最多提交 proposal，由服务器记录接受/拒绝原因。
5. `examProcedureView`、`examinerPanelView`、`examHonorView`、`examNetwork` 安全快照、`appointmentTrackView`、`studyProfileView`、`worldGeographyView`、`worldPeopleView`、`officialPostingsView`、`localAffairsDocketView`、`militaryDiplomacyView`、`economicFiscalView`、`historicalEventArchiveView`、`intelligenceRumorView`、`playerMonthlyBriefingView`、`actorMemoryView`、`sessionSummaryView`、`mapContextView`、`mapRuntimeView`、`eventArchiveView`、`informationPanelPageView` 和 capped `retrievalContext` 是当前 UI/prompt 合法入口；`mapRuntimeView` 例外为浏览器 runtime 显示投影，不进入 prompt 或服务器裁决。
6. 浏览器“局势簿”和“科举档案”只读 route player-facing view、`informationPanelPageView` 与考试历史安全快照，不读 raw ledger、raw audit、provider-only payload、prompt、本地路径或 key。

当前活动方向：

- S68-S69：科举、读书、评卷与授官深化已完成并归档到 [IMPERIAL_EXAM_DEEPENING_ARCHIVE.md](IMPERIAL_EXAM_DEEPENING_ARCHIVE.md)。
- S70：AI 提示词、工具协议、actor 权限、多 AI 编排、AI 设置、官职月报、跳时、记忆、地图接口、provider AI-first smoke、JSON/SQLite parity 和归档已完成，见 [AI_ORCHESTRATION_ARCHIVE.md](AI_ORCHESTRATION_ARCHIVE.md)。
- S71：数据库玩法化、维护、安全检索和 redacted API 已完成并归档到 [DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md](DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md)；后续新步骤继续复用安全 projection、本地维护工具、snippet 搜索、玩家/诊断分层、proposal-only 工具边界和服务器 resolver 裁决。
- S72：PixiJS 水墨地图已完成并归档到 [PIXIJS_INK_MAP_ARCHIVE.md](PIXIJS_INK_MAP_ARCHIVE.md)；后续前端只能复用 `mapRuntimeView` 安全投影和 S72 素材/manifest 边界，不得把显示坐标变成 prompt 或服务器裁决事实。
- S73-S77：前端水墨重构已完成并归档，归档见 [FRONTEND_INK_REDESIGN_ARCHIVE.md](FRONTEND_INK_REDESIGN_ARCHIVE.md)，任务书源头见 [FRONTEND_INK_REDESIGN_ROADMAP.md](FRONTEND_INK_REDESIGN_ROADMAP.md)。S73 完成视觉资产、manifest、素材 QA 和全量立绘池，S74 完成 React/Vite/React Router 默认入口迁移，S75 完成首页与全局 shell，S76 完成身份/考试/放榜/独立舆图页/人物谱牒和专题 surface，S77 完成默认入口、浏览器、视觉、安全、性能、可访问性、归档和总验证。后续前端玩法应从新的小步骤继续，继续沿用 `portraitRef`、runtime manifest、资源预算、安全 projection 和服务器裁决边界。

- S74.0：依赖治理与迁移契约已完成，见 [FRONTEND_REACT_MIGRATION_CONTRACT.md](FRONTEND_REACT_MIGRATION_CONTRACT.md)。本步只安装 React/Vite 工具链并更新 package/lock 与文档，不创建 `client/`、不改 Express fallback、不替换当时的 `public/` 前端。
- S74.1：Vite/TypeScript 默认前端已完成，新增 `client/`、Vite/TS/Vitest 配置、最小 React Router Data Mode 多页壳、Express history fallback、S74.1 focused browser smoke 和 `prestart` 构建入口；`dist/client/` 接管默认 `/`。
- S74.2：安全 API client 已完成，新增 `qianqiuApi`、安全 response 类型、会话 store、UUID 会话守卫和首页/主卷/科举/印匣最小接线；普通读档只走 `player-state`。
- S74.3：前端 UI 状态层已完成，新增安全 UI store、route page bridge、显示偏好抽屉、安全摘要 modal 和全局 action draft；只保存安全玩家摘要和 UI 状态，不保存完整 `worldState` 或模型/审计原文。
- S74.4：多页 shell 与 surface registry 已完成，新增 `AppShell`、`SurfaceHost`、overlay focus helper 和局部专题 registry；设置/存档/显示偏好抽屉、安全 modal、人物/圣旨/奏折/舆图专题层支持 Esc 关闭、焦点回收和滚动恢复，专题层只显示安全占位与草稿入口。
- S74.5 / S79.3：资产加载层已完成，新增 manifest 驱动 `assetRegistry`、`useAssetRegistry` 和 `Portrait` 组件；人物页按 8 张一组分页接入全部人物页可用立绘，女性高清重制优先，未重制项使用 manifest 原图，未审核素材和 planned 矩阵不进入 runtime。S79.3 后 `Portrait` 自带可选放大入口，查看器只读 runtime 主图并复用 `SurfaceHost` 的 Esc、遮罩关闭、焦点回收和滚动锁定。
- S74.6：S72 地图运行时桥已完成，新增 React `InkMapRuntimeBridge`，动态加载本地 Pixi vendor 与 `public/mapRenderer.js`，只读包装安全 `mapRuntimeView`；不依赖旧 `public/app.js`、旧 `mapPanel.js` DOM 单例、旧 `#action-input` 或旧局势簿 DOM。

- S73.10.1：全量玩家/NPC 立绘生产矩阵已定稿，机器可读矩阵为 `public/assets/ui/portraits/portrait-pool-matrix-v1.json`，中文说明为 [FRONTEND_PORTRAIT_MATRIX.md](FRONTEND_PORTRAIT_MATRIX.md)。矩阵锁定 336 张 planned 立绘，但不代表素材可用；S74-S77 runtime 仍只能读取 `ink-ui-manifest.json` 中已审核、已入库、`runtimeUsable=true` 的立绘。
- S73.10.2：玩家身份阶段立绘池已入库，`public/assets/ui/portraits/s73-10/` 下有 72 张玩家身份阶段主图，另有 60 张玩家女性风格补充立绘和 60 张玩家男性风格补充立绘作为选角可用池；`public/assets/ui/thumbs/` 和 `public/assets/ui/portraits/placeholders/` 分别提供缩略图与低清占位，QA sidecar 为 `public/assets/ui/portraits/portrait-player-pool-qa-v1.json`、`public/assets/ui/portraits/portrait-player-female-reset-qa-v1.json` 与 `public/assets/ui/portraits/portrait-player-male-extra-qa-v1.json`，校验入口为 `npm run qa:player-portraits`、`npm run qa:player-female-portraits` 和 `npm run qa:player-male-portraits`。
- S73.10.3：通用 NPC 立绘池已入库，`public/assets/ui/portraits/s73-10/` 下有 188 张通用 NPC 主图，包括一开始的 120 张矩阵主体、20 张旧版 bonus 和 48 张宫装/唐装女性风格扩展；对应缩略图与低清占位已生成，QA sidecar 为 `public/assets/ui/portraits/portrait-generic-npc-pool-qa-v1.json`，校验入口为 `npm run qa:generic-npc-portraits`。
- S73.10.4：重要 NPC 专属立绘池已入库，`public/assets/ui/portraits/s73-10/` 下有 72 张 `signature_npc_pool` 主图；对应缩略图与低清占位已生成，QA sidecar 为 `public/assets/ui/portraits/portrait-signature-npc-pool-qa-v1.json`，校验入口为 `npm run qa:signature-npc-portraits`。重要 NPC 不混入通用头像池，未公开人物只按安全 `portraitRef` 暴露。
- S73.10.5：状态/姿态与场景锚点池已入库，`public/assets/ui/portraits/s73-10/` 下有 48 张 `state_variant_pool` 主图和 24 张 `scene_anchor_pool` 主图；对应缩略图与低清占位已生成，QA sidecar 为 `public/assets/ui/portraits/portrait-state-scene-pool-qa-v1.json`，校验入口为 `npm run qa:state-scene-portraits`。女性角色按用户要求不做中性化处理，以发髻、簪钗、衣料层次、腰封细腰、肩颈线和端庄姿态体现成年女性特征，同时保持完整衣着、无挑逗、无幼态。
- S73.10.7：年轻成年女性补充池已入库，`public/assets/ui/portraits/s73-10/` 下有 48 张 `young_female_style_pool` 主图，覆盖宫署/女官、书院/才女、商事/市井和边关/军务；对应缩略图与低清占位已生成，QA sidecar 为 `public/assets/ui/portraits/portrait-young-female-pool-qa-v1.json`，校验入口为 `npm run qa:young-female-portraits`。Codex 视觉审核确认无中老年女性、无发福老态、无中性化，女性特征以发髻簪钗、面容、肩颈线、层叠衣料、腰封细腰和端庄姿态体现。
- S79.2：Recovered 女性高清母版池已入库，`public/assets/ui/portraits/s79-2/` 下有 194 张 `recovered_female_highres_pool` 主图，来自 `likely-portrait-masters` 的 194 张唯一 PNG 母版；对应缩略图与低清占位已生成，QA sidecar 为 `public/assets/ui/portraits/portrait-recovered-female-pool-qa-v1.json`，校验入口为 `npm run qa:recovered-female-portraits`。Codex 已用 contact sheet 视觉复看，确认整体为成年女性古风竖版立绘，服饰完整、画风与 S73.10 女性池兼容，无明显水印、现代 UI、大面积可读文字、露骨、挑逗或幼态问题；公开 manifest/runtime manifest 只登记 `/assets/ui/` 派生产物和 `localHighResSource=kept_outside_public_manifest` 标记，不暴露 artifacts 路径。
- S73.10 单张覆盖：`public/assets/ui/portraits/portrait-single-override-qa-v1.json` 当前记录 60 张女性/偏女性单张高清重制覆盖，校验入口为 `npm run qa:single-portrait-overrides`。后续女性立绘重制优先参考压缩 WebP 构图，不上传源图或大图；已重制图减少重复视觉审核，疑似小面积文字风险不阻塞入库。
- S73.10.6：缩略图与压缩总括 QA 已入库并随 S79.2 刷新，QA sidecar 为 `public/assets/ui/portraits/portrait-compression-qa-v1.json`，校验入口为 `npm run qa:portrait-compression`。该报告覆盖 790 张 active 立绘，其中 572 张为 S73.10 全量池/补充池立绘、194 张为 S79.2 recovered 女性高清池，固定 1024x1536 主图、384x576 缩略图、64x96 低清占位、safeArea、focalPoint、移动裁切、文件预算和 `allowEagerLoad=false`。

本地数据库专项必须满足同一边界：默认 JSON/Mock 路径不得被破坏；SQLite local-only；AI 可以通过领域工具提交 proposal，但不执行 SQL、不直接写 canonical 状态、业务表或审计表；浏览器和 prompt 只读服务器 projection；hidden 私档不回填当前 raw route `worldState`；服务器继续拥有 schema、白名单、clamp、隐藏过滤、科举晋级、官职任免、长期事件、世界实体、世界议程、数据库写入和持久化事务。

## 16. 历史实现笔记归档

日常启动只需阅读必读四件套和当前活动台账。需要追溯旧阶段细节时再打开：

- [QIANQIU_DEVELOPMENT_HISTORY_ARCHIVE.md](QIANQIU_DEVELOPMENT_HISTORY_ARCHIVE.md)：S11-S38.3 逐步实现笔记。
- [FOURTH_PHASE_PROGRESS_ARCHIVE.md](FOURTH_PHASE_PROGRESS_ARCHIVE.md)：第四阶段早期详细进度。
- [PHASE_FOUR_ROADMAP_ARCHIVE.md](PHASE_FOUR_ROADMAP_ARCHIVE.md)：第四阶段路线图归档。
- [TIME_SPECIALTY_ROADMAP_ARCHIVE.md](TIME_SPECIALTY_ROADMAP_ARCHIVE.md)：S48 时间专项归档。
- [LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md](LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md)：S49-S67 本地数据库基础、SQLite 业务表、双模式验收、超大动态世界内容与 S60 内容契约统一归档。
- [IMPERIAL_EXAM_DEEPENING_ARCHIVE.md](IMPERIAL_EXAM_DEEPENING_ARCHIVE.md)：S68-S69 科举、读书、评卷、榜单、同年座师、授官与 Provider/Mock 验收归档。
- [AI_ORCHESTRATION_ARCHIVE.md](AI_ORCHESTRATION_ARCHIVE.md)：S70 AI prompt/tool/actor/多模型路由、AI 设置、官职月报、跳时、记忆、地图接口、provider AI-first smoke、JSON/SQLite parity 与归档。
- [DATABASE_RESOLVER_INPUT_CONTRACT.md](DATABASE_RESOLVER_INPUT_CONTRACT.md)：S71 数据库 resolver 输入契约，固定 `resolverInputContext` 字段、允许来源、禁止源、evidence ref、AI 权限和 JSON/SQLite parity 测试矩阵；S71.1 已按该契约提供 `resolverInputConfig` / `resolverInputContext` 初版。
- [DATABASE_GAMEPLAY_RESOLVER_ROADMAP.md](DATABASE_GAMEPLAY_RESOLVER_ROADMAP.md)：S71 数据库玩法化、维护、安全检索、redacted API、玩法 resolver、actor 场景、NPC 记忆和 AI 调动审计面板任务书。
- [DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md](DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md)：S71.0-S71.12 完成范围、稳定边界、API/命令入口、验收记录和后续风险。
