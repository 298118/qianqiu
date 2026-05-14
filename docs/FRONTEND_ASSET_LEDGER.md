# S73 前端视觉素材台账

本台账配合 [FRONTEND_VISUAL_ASSET_GUIDE.md](FRONTEND_VISUAL_ASSET_GUIDE.md) 和 `public/assets/ui/ink-ui-manifest.json` 使用，记录 S73-S77 前端水墨重构中的 UI 材质、首页、场景、身份背景、动效、fallback、缩略图和玩家/NPC 立绘素材。S73.2 只建立台账字段和 manifest 草案，不生成实际图片。

## 记录规则

- 所有进入 `public/assets/ui/`、manifest 或运行时可用集合的素材都必须在本台账登记。
- S73-S77 正式 AI 生成素材统一由 Codex 使用 `gpt-image-2` 生成，并记录 prompt 摘要、负面约束摘要、后处理方式和 Codex 视觉审核结论。
- 第三方素材必须先区分 `reference-only`、`texture-source` 或 `direct-asset-candidate`。直接资产候选必须完成许可确认和 Codex 视觉审核后才能入库。
- Manifest 只保存浏览器需要的安全字段；完整来源、许可、生成说明和人工审核结论写入本台账。
- 未审核、审核中、拒绝或被替换的素材不得进入运行时默认可用集合。
- S73.10 的 300-400 张全量玩家/NPC 立绘池必须同时满足基础素材字段和立绘扩展字段，逐条登记源图路径、尺寸、格式、性能预算、`portraitRef`、缩略图、低清占位、fallback、状态变体、审核状态和懒加载分组；S74-S77 只能通过已审核 `portraitRef` 使用。
- 台账不得记录真实 key、本地绝对路径、完整 prompt、provider 原始响应、raw audit、raw SQLite table、hidden notes、hidden intent、未公开关系或密档真值。

## Manifest 草案记录

| Manifest ID | 状态 | 路径 | 作用 | 安全边界 | 备注 |
| --- | --- | --- | --- | --- | --- |
| ink-ui-v1 | schema_draft | `public/assets/ui/ink-ui-manifest.json` | S73-S77 前端 UI 素材 manifest 草案，定义资产组计划、fallback token、审核状态、usage、立绘字段和懒加载策略 | 只保存安全路径、尺寸、用途、fallback、审核状态和台账 id；立绘资产必须同时满足基础素材字段与立绘扩展字段；不保存完整 prompt、provider 原始响应、本地路径、key、raw audit 或 hidden 真值 | S73.2 不生成图片，`assets` 暂为空；S73.3-S73.10 按本契约逐步填充 |

## 素材记录

| Asset ID | 状态 | manifest id/ref | 项目路径 | 缩略图路径 | fallbackRef | 类型 | usage | role/scene | 尺寸/格式/透明 | 来源类型 | 工具/模型 | 生成日期 | 生成者 | 参考素材 Ref ID | prompt 摘要 | 负面约束摘要 | 后处理方式 | Codex 视觉审核 | 安全审核 | 许可/使用说明 | 是否商用确认 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ui-fallback-paper-panel-v1 | approved | `fallback-paper-panel-v1` | CSS token，无图片文件 | 不适用 | 不适用 | fallback | `global_fallback` | generic | CSS token | project_defined | 不适用 | 2026-05-14 | Codex | 无 | 不适用 | 不适用 | 不适用 | 通过：纸色、淡墨边和深墨文字 token 可作为缺图 fallback | 通过：无图片、无路径、无 hidden/raw/key 风险 | 项目内定义 | 当前仅个人游玩/开发使用 | manifest fallbackCatalog |
| ui-fallback-role-silhouette-v1 | approved | `fallback-role-silhouette-v1` | CSS token，无图片文件 | 不适用 | `fallback-paper-panel-v1` | fallback | `people_page`, `game_main` | role silhouette | CSS token | project_defined | 不适用 | 2026-05-14 | Codex | 无 | 不适用 | 不适用 | 不适用 | 通过：可作为未加载或未审核立绘的身份剪影底 | 通过：不暴露人物 hidden 私档或未公开关系 | 项目内定义 | 当前仅个人游玩/开发使用 | S73.10 立绘池默认 fallback |
| ui-fallback-ink-motion-static-v1 | approved | `fallback-ink-motion-static-v1` | CSS token，无图片文件 | 不适用 | `fallback-paper-panel-v1` | fallback | `home`, `exam_page`, `ranking_page` | reduced-motion | CSS token | project_defined | 不适用 | 2026-05-14 | Codex | 无 | 不适用 | 不适用 | 不适用 | 通过：低动效静态纸色和淡墨 token | 通过：无图片、无脚本、无状态变更 | 项目内定义 | 当前仅个人游玩/开发使用 | reduced-motion 静态替代 |

## 立绘矩阵

S73.2 只固定字段；S73.7 写入 24-40 张基准立绘，S73.10 写入 300-400 张全量玩家/NPC 立绘池。

| portraitRef | 状态 | 人物范围 | 专属人物安全 ref | 身份/职业 | genderPresentation | ageBand | roleStage | statusVariant | emotionVariant | 源图路径 | 缩略图路径 | 低清占位路径 | fallbackRef | 小尺寸可读性 | 成年端庄审核 | 现代/水印/乱码审核 | manifest ledgerId | 懒加载分组 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| portrait-schema-placeholder | schema_only | schema_only | 不适用 | 不适用 | 不适用 | adult | 不适用 | normal | neutral | 不适用 | 不适用 | 不适用 | `fallback-role-silhouette-v1` | 不适用 | 不适用 | 不适用 | 不适用 | 不适用 | 占位说明行，不进入 manifest assets |

## 参考素材记录

| Ref ID | 状态 | URL 或来源 | 类型 | 作者/机构 | 许可或权利说明 | 用途 | Codex 视觉审核 | 是否进入项目资产 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ref-frontend-visual-001 | deferred | 未使用 | 前端视觉参考 | 不适用 | 不适用 | reference-only | 本轮 S73.2 未引入第三方参考或直接素材 | 否 | 后续若查找宣纸、奏折、古籍、服饰或场景参考，再新增具体来源记录 |

## 审核状态说明

| 状态 | 是否可运行时默认使用 | 说明 |
| --- | --- | --- |
| planned | 否 | 计划中，尚未生成或尚未找到素材 |
| draft | 否 | 草案或未处理候选 |
| review_pending | 否 | 等待 Codex 视觉/安全审核 |
| approved | 是 | 可进入 manifest 可用集合 |
| approved_with_limits | 是，但受限 | 只能用于台账记录的 route、尺寸、角色或背景 |
| rejected | 否 | 不得进入 manifest 可用集合 |
| replaced | 否 | 已被新版替换，保留历史记录 |

## S73.2 后续入库检查

- 每个非 fallback 资产必须有 `fallbackRef`，且 fallback 指向已批准记录。
- 每个图片资产必须有项目相对路径、缩略图路径、尺寸、格式、透明度和性能预算。
- 每个立绘资产必须先满足图片资产基础字段，再补齐 `portraitRef`、`thumbnailPath`、`lowResPlaceholderPath`、`fallbackRef`、`genderPresentation`、`ageBand`、`statusVariant`、`safeArea`、`focalPoint` 和懒加载分组。
- `approved` 与 `approved_with_limits` 资产必须有视觉审核、安全审核和台账记录。
- `draft`、`review_pending`、`rejected`、`replaced` 不得作为运行时默认可用素材或 fallback。
- S73.10 全量立绘池不得标记为首页 eager load；只能按 route、公开人物列表和可见 `portraitRef` 懒加载。
