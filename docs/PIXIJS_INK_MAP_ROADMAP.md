# S72 PixiJS 水墨地图专项路线图

本文件记录《千秋》下一阶段地图专项规划。用户已明确选择 **PixiJS** 作为长期地图运行时，目标不是简单插图，而是能承接地理、任所、科举赶考、军务外交、商路、事件压力、NPC 关系和 AI proposal 的深度交互地图。

## 1. 决策与目标

- 地图运行时采用 PixiJS，服务于流畅动效、图层合成、大量 marker / route / pressure effect 和后续玩法扩展。
- 视觉目标为水墨手绘风格：宣纸底、淡墨山川、手绘城池、朱砂/青绿少量点染、路线墨线、事件涟漪和低饱和古籍 UI。
- 地图素材优先由 Codex 使用 AI 生图生成原创资产；历史地图只作构图、地貌纹理或时代气质参考。
- 地图中文字、地点名、事件标签不得烘进底图，统一由前端按 `mapEntityRef` 和服务器 view 渲染，避免 AI 图片文字错误和后续改名返工。
- 地图坐标为显示布局坐标，不是 canonical 地理真值，不参与科举资格、行军结果、任免、外交、战和、商路收益或 AI 裁决。
- 默认仍保持 `npm install && npm start` 可运行；新增 PixiJS 或资产加载策略必须先通过依赖治理记录。

## 2. 非目标与边界

- 本阶段不引入远程存档、账号、多人与云同步。
- 不把 raw coordinate table、hidden enemy truth、hidden notes、raw SQLite rows、provider proposal、完整 prompt、本地路径或 key 暴露给浏览器或 prompt。
- 不让 PixiJS 前端直接裁决移动、行军、赶考、赴任、商路、战争、外交、案牍或财政后果。
- 不让 AI 或 Gemini patch 绕过服务器 resolver；AI 仍只能读取安全 `mapContextView` / capped summary，并通过 proposal-only 工具表达地理意图。
- 不把历史地图原图直接做成可发布资产；如因个人游玩需要参考或临时使用，也必须在 [MAP_ASSET_LEDGER.md](MAP_ASSET_LEDGER.md) 记录来源、作者、许可和用途说明。

## 3. 协作分工

| 角色 | 主要职责 | 禁止事项 |
| --- | --- | --- |
| Codex | 后端地图 runtime view、API/schema、服务器裁决边界、AI 工具权限、Mock/no-key fallback、测试、素材生成、素材台账、Gemini patch 审核、最终提交 | 不把未审查的 Gemini patch 直接提交；不把素材来源只留在聊天里 |
| Gemini CLI | 前端 PixiJS 地图渲染、图层系统、动效、交互、响应式布局、浏览器验证截图/说明 | 不运行 `git add`、`git commit`、`git push`，不创建 PR，不改后端裁决逻辑，不回滚他人改动 |
| Codex 子代理 | 只读复审或明确 scoped patch；用于提交前风险检查 | 不提交、不推送、不创建 PR |

Gemini 的交付必须列出改动文件、核心实现、浏览器验证步骤、已知风险和未完成事项。Codex 必须审查 diff、运行验证、同步文档后再提交。

## 4. 建议架构

### 后端与数据契约（Codex）

- 继续以 `mapContextView` 为合法地图信息入口，新增或扩展时保持安全 projection 优先。
- 规划 `mapRuntimeView` 或等价安全 view：聚合 `mapContextView`、玩家当前位置、可见地点、可见路线、事件压力、移动 affordance、当前身份可用地图动作和前端显示布局版本。
- 规划显示布局数据，例如 `mapVisualLayout`：只保存 `mapEntityRef -> normalized x/y/layer/importance`，作为 UI 布局坐标，不作为服务器地理事实。
- 地图点击动作优先转成服务器可解释的自然语言行动草稿或 proposal 请求；真正状态变化仍经 `POST /api/game/turn`、现有地图工具 resolver 或后续 server-owned resolver。
- 新增字段、cap、动画状态上限和布局限制时，放入 `src/config/GameConfig.js` 或 `src/game/*Config.js`，避免 magic numbers。
- 后端测试覆盖 ref 稳定性、隐藏信息过滤、JSON/SQLite parity、地图动作权限和 Mock fallback。

### 前端与 PixiJS（Gemini CLI）

- 在不破坏现有纯 HTML/CSS/JS 体验的前提下接入 PixiJS；加载方式由 S72.1 依赖治理决定。
- 建议拆出 `public/mapRenderer.js` 或等价模块，封装 PixiJS app、asset loading、layer manager、viewport transform、hit testing、tooltip bridge 和 teardown。
- 图层建议：宣纸底图、山川水系、行政/城市 marker、路线墨线、事件压力、军务/商路/科举 overlay、选中高亮、悬浮 tooltip、行动按钮。
- 动效要求：缩放/拖拽平滑、marker 呼吸不扰眼、路线墨迹流动、事件涟漪、低端设备降级、`prefers-reduced-motion` 支持。
- UI 必须与现有侧栏/局势簿联动：点击地图 ref 可跳转或筛选现有信息面板；地图 action 不直接写状态。
- 浏览器验证必须覆盖桌面与窄屏，确认 canvas 非空、无文本重叠、tooltip 不挡主操作、地图资源加载失败时有优雅降级。

## 5. 素材方案（Codex）

- 使用 AI 生图先生成无文字水墨大底图，再生成独立图标/纹理：府城、县城、贡院、驿站、关隘、军镇、商埠、灾情、边患、诏令、案牍、队伍、船队。
- 所有项目引用资产保存到 `public/assets/maps/` 下，不能只留在 `$CODEX_HOME` 或聊天记录。
- 建议建立 manifest，例如 `public/assets/maps/ink-map-manifest.json`，记录 asset id、文件路径、用途、尺寸、生成 prompt、来源和版本。
- 历史地图参考可来自 Wikimedia Commons、Library of Congress、OpenGameArt 等。即使当前仅个人游玩、不商用，也要在 [MAP_ASSET_LEDGER.md](MAP_ASSET_LEDGER.md) 记录来源和许可，方便以后回溯或替换。
- AI 生成的图片仍记录 prompt、生成工具、日期、是否含外部参考、后处理方式和最终落点。

## 6. S72 小步骤

| ID | 状态 | Owner | 目标 | 交付与验证 |
| --- | --- | --- | --- | --- |
| S72.0 | DONE | Codex | 确认 PixiJS 水墨地图方向，切换当前协作台账为 Codex + Gemini CLI | 本路线图、素材台账模板、`DEVELOPMENT_STEPS` 和 `SHARED_CONTEXT` 同步；不改运行时代码 |
| S72.1 | TODO | Codex，Gemini 提供前端约束 | PixiJS 依赖治理与 runtime 契约 | 更新依赖治理记录；决定 CDN/vendor/npm；若选 CDN 必须固定版本并提供本地 fallback，避免运行时强依赖外网；固定 `mapRuntimeView` 字段草案；验证 docs governance |
| S72.2 | TODO | Codex | 后端地图 runtime view 与布局契约 | 新增/扩展安全 view、配置、测试；确保 raw/hidden/坐标污染不外泄 |
| S72.3 | TODO | Codex | 水墨底图、图标、纹理与素材 manifest | 生成项目内资产；更新素材台账；基础图片尺寸/透明度/加载检查 |
| S72.4 | TODO | Gemini CLI，Codex 审核提交 | PixiJS 地图 shell 与图层系统 | 前端 patch；桌面/移动浏览器截图或说明；Codex 审查后提交 |
| S72.5 | TODO | Codex + Gemini CLI | 地图与游戏系统联动 | 点击 ref 联动局势簿/行动草稿；服务器权限校验；地图 action 不直写状态 |
| S72.6 | TODO | Gemini CLI，Codex 提供素材 | 水墨动效与视觉 polish | 路线流动、事件涟漪、marker 状态、降级模式；浏览器动效验证 |
| S72.7 | TODO | Codex | 验收、性能与安全回归 | `npm test` 或相关 node tests、browser smoke、canvas 非空/帧率/资源失败降级、JSON/SQLite parity |
| S72.8 | TODO | Codex | 专项归档 | 将完成范围、风险和后续地图玩法迁入归档，压缩活动台账 |

## 7. 首轮验收标准

- 地图面板在 `npm start` 后本地浏览器可打开，默认 Mock 模式可用。
- PixiJS canvas 加载稳定，桌面和窄屏下无空白、无严重遮挡、无文本溢出。
- 地图至少显示核心城邑、路线、当前玩家相关地点和 1-2 类事件压力。
- 地图点击只读取安全 view 并触发前端选择、信息面板联动或行动草稿；不直接修改状态。
- 后端测试证明地图 view 不暴露 raw coordinate table、hidden enemy truth、hidden notes、provider proposal、完整 prompt、本地路径或 key。
- 素材已落入项目目录并登记来源；AI 生成资产有 prompt 和使用说明。

## 8. 下一步建议

先执行 S72.1：Codex 固定 PixiJS 依赖治理、`mapRuntimeView` 草案和 Gemini patch 边界；Gemini 在该契约下再开始 S72.4 前端 shell。这样前端可以大胆做精美动效，后端仍守住《千秋》的服务器裁决和 AI 权限边界。
