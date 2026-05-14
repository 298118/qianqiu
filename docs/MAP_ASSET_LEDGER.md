# 《千秋》地图素材台账

本台账记录 S72 PixiJS 水墨地图专项使用或参考的地图素材、AI 生成资产和后处理记录。素材获取、生成、后处理和验收流程见 [MAP_ASSET_GUIDE.md](MAP_ASSET_GUIDE.md)。当前游戏仅个人游玩、不商用；仍需保留来源和许可信息，方便后续替换、回溯或公开前清理。

## 记录规则

- 项目内实际引用的图片、纹理、图标、sprite sheet 和 manifest 都必须登记。
- 历史地图若只作参考，也记录来源、作者、许可和“reference-only”用途；不要把未确认许可的历史地图原图直接作为游戏资产发布。
- AI 生成资产只能由 Codex 使用 `gpt-image-2` 生成，并记录 prompt 摘要、是否使用参考图、后处理方式、Codex 视觉审核结论和最终文件路径。
- 第三方优秀素材可以作为参考或直接资产候选；直接入库前必须记录许可/来源，并通过 Codex 视觉审核。
- Codex 视觉审核需要覆盖游戏基调、历史/水墨适配、同批素材一致性、缩放可读性、现代元素/水印/误生成文字和 hidden/raw/path/key 污染风险。
- 透明图标若通过 chroma key 去背景，记录源图、最终 alpha 文件和处理脚本。
- 资产替换时新增一行，不覆盖旧记录；废弃资产把状态改为 `deprecated`。

## 素材记录

| Asset ID | 状态 | 项目路径 | 类型 | 来源/工具 | 模型或工具版本 | 生成日期 | 作者或生成者 | 参考素材 Ref ID | 后处理脚本/方式 | Codex 视觉审核 | 许可/使用说明 | 是否商用确认 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| map-base-ink-v1 | approved | `public/assets/maps/base/ink-world-base-v1.webp` | 水墨底图 | Codex AI 生图 | Codex `image_gen` / `gpt-image-2` managed path | 2026-05-14 | Codex | 无 | 由生成 PNG resize 至 2400x1600，WebP quality 86 | 通过：文人案头舆图气质明显，山川/海岸/留白适合 DOM 标签；无文字、水印、现代 UI 或 hidden/raw 内容 | 原创 AI 生成；prompt 摘要：late-Ming desk map、xuan paper、pale ink mountains/rivers、no labels/text/compass/watermark | 未做公开商用确认；当前仅个人游玩/开发使用 | manifest `ink-world-base-v1` |
| paper-texture-v1 | approved | `public/assets/maps/base/paper-texture-v1.webp` | 宣纸纹理 | Codex AI 生图 | Codex `image_gen` / `gpt-image-2` managed path | 2026-05-14 | Codex | 无 | resize 至 1024x1024，WebP quality 82 | 通过：低对比纸纤维与淡墨污渍，适合叠加；无文字、水印、现代图形 | 原创 AI 生成；prompt 摘要：aged xuan paper texture、warm fibers、subtle stains、no symbols/text | 未做公开商用确认；当前仅个人游玩/开发使用 | manifest `paper-texture-v1` |
| route-brush-v1 | approved | `public/assets/maps/effects/route-brush-v1.png` | 路线笔触 | Codex AI 生图 | Codex `image_gen` / `gpt-image-2` managed path | 2026-05-14 | Codex | 无 | `#00ff00` chroma-key 本地移除并压缩为 1024x683 透明 PNG | 通过：墨线干湿变化好，适合陆路/水路/海道复用；无箭头、文字、水印或现代 glow | 原创 AI 生成；prompt 摘要：Chinese ink route strokes、flat green background、no arrows/text/symbols | 未做公开商用确认；当前仅个人游玩/开发使用 | manifest route tokens 复用 |
| ink-ripple-red-v1 | approved | `public/assets/maps/effects/ink-ripple-red-v1.png` | 朱砂事件涟漪 | Codex AI 生图 | Codex `image_gen` / `gpt-image-2` managed path | 2026-05-14 | Codex | 无 | `#00ff00` chroma-key 本地移除，裁切置入 512x512 透明 PNG | 通过：朱砂中心、纸上晕染边缘清楚，适合边警/灾务压力；无文字、水印、现代粒子 | 原创 AI 生成；prompt 摘要：cinnabar ink ripple、xuan paper bloom、flat green background、no symbols/text | 未做公开商用确认；当前仅个人游玩/开发使用 | manifest `frontier_pressure` 与 red effect |
| ink-ripple-blue-v1 | approved | `public/assets/maps/effects/ink-ripple-blue-v1.png` | 石青事件涟漪 | Codex AI 生图 | Codex `image_gen` / `gpt-image-2` managed path | 2026-05-14 | Codex | 无 | `#ff00ff` chroma-key 本地移除，裁切置入 512x512 透明 PNG | 通过：青绿色克制，适合科期/商路/水路提示；无文字、水印、现代 glow | 原创 AI 生成；prompt 摘要：blue-green ink ripple、mineral pigment bloom、flat magenta background、no symbols/text | 未做公开商用确认；当前仅个人游玩/开发使用 | manifest blue effect |
| map-icons-ink-v1 | processed-only | 不入库；仅用于切出下列单图标 | 图标源图 | Codex AI 生图 | Codex `image_gen` / `gpt-image-2` managed path | 2026-05-14 | Codex | 无 | `#00ff00` chroma-key 本地移除，3x3 切图后删除源 sheet，避免前端加载冗余大图 | 通过：同批笔触、墨色和朱砂一致，图标具象但适合 32px/64px；无文字、水印、现代 app icon | 原创 AI 生成；prompt 摘要：3x3 late-Ming ink map marks、city/exam/pass/garrison/port/docket/edict、flat green background、no characters/text | 未做公开商用确认；当前仅个人游玩/开发使用 | 单图标见下列记录；manifest 不引用源 sheet |
| city-prefecture-v1 | approved | `public/assets/maps/icons/city-prefecture-v1.png` | 府城图标 | `map-icons-ink-v1` 切图 | 本地 alpha 清理 | 2026-05-14 | Codex | map-icons-ink-v1 | 3x3 切图、连通域清理、置入 256x256 透明 PNG | 通过：城墙与旗帜可辨，适合 `city_prefecture` | 继承 `map-icons-ink-v1` 原创 AI 生成说明 | 未做公开商用确认；当前仅个人游玩/开发使用 | manifest `city_prefecture` |
| city-county-v1 | approved | `public/assets/maps/icons/city-county-v1.png` | 县城/小城图标 | `map-icons-ink-v1` 切图 | 本地 alpha 清理 | 2026-05-14 | Codex | map-icons-ink-v1 | 3x3 切图、移除相邻单元碎片、置入 256x256 透明 PNG | 通过：小聚落形态清楚；首版可作为县城/小节点 fallback | 继承 `map-icons-ink-v1` 原创 AI 生成说明 | 未做公开商用确认；当前仅个人游玩/开发使用 | manifest `city_county` |
| exam-hall-v1 | approved | `public/assets/maps/icons/exam-hall-v1.png` | 贡院/科场图标 | `map-icons-ink-v1` 切图 | 本地 alpha 清理 | 2026-05-14 | Codex | map-icons-ink-v1 | 3x3 切图、置入 256x256 透明 PNG | 通过：殿宇轮廓稳定，适合 `exam_hall` | 继承 `map-icons-ink-v1` 原创 AI 生成说明 | 未做公开商用确认；当前仅个人游玩/开发使用 | manifest `exam_hall` |
| garrison-v1 | approved | `public/assets/maps/icons/garrison-v1.png` | 军镇/战报图标 | `map-icons-ink-v1` 切图 | 本地 alpha 清理 | 2026-05-14 | Codex | map-icons-ink-v1 | 3x3 切图、移除底部碎片、置入 256x256 透明 PNG | 通过：红旗形态醒目但不刺眼，适合 `garrison` 和军务提示 | 继承 `map-icons-ink-v1` 原创 AI 生成说明 | 未做公开商用确认；当前仅个人游玩/开发使用 | manifest `garrison` |
| pass-fort-v1 | approved | `public/assets/maps/icons/pass-fort-v1.png` | 关隘图标 | `map-icons-ink-v1` 切图 | 本地 alpha 清理 | 2026-05-14 | Codex | map-icons-ink-v1 | 3x3 切图、置入 256x256 透明 PNG | 通过：山门关隘可读，适合 `pass_fort` | 继承 `map-icons-ink-v1` 原创 AI 生成说明 | 未做公开商用确认；当前仅个人游玩/开发使用 | manifest `pass_fort` |
| relay-station-v1 | approved | `public/assets/maps/icons/relay-station-v1.png` | 驿站图标 | `map-icons-ink-v1` 切图 | 本地 alpha 清理 | 2026-05-14 | Codex | map-icons-ink-v1 | 3x3 切图、置入 256x256 透明 PNG | 通过：望楼/驿旗轮廓清楚，适合 `relay_station` | 继承 `map-icons-ink-v1` 原创 AI 生成说明 | 未做公开商用确认；当前仅个人游玩/开发使用 | manifest `relay_station` |
| trade-port-v1 | approved | `public/assets/maps/icons/trade-port-v1.png` | 商埠/海道图标 | `map-icons-ink-v1` 切图 | 本地 alpha 清理 | 2026-05-14 | Codex | map-icons-ink-v1 | 3x3 切图、置入 256x256 透明 PNG | 通过：舟船与青绿色水迹可读，适合 `trade_port` | 继承 `map-icons-ink-v1` 原创 AI 生成说明 | 未做公开商用确认；当前仅个人游玩/开发使用 | manifest `trade_port` |
| legal-docket-v1 | approved | `public/assets/maps/icons/legal-docket-v1.png` | 案牍图标 | `map-icons-ink-v1` 切图 | 本地 alpha 清理 | 2026-05-14 | Codex | map-icons-ink-v1 | 3x3 切图、移除边缘碎片、置入 256x256 透明 PNG | 通过：卷宗/文书束清楚，适合 `legal_docket` | 继承 `map-icons-ink-v1` 原创 AI 生成说明 | 未做公开商用确认；当前仅个人游玩/开发使用 | manifest `legal_docket` |
| edict-v1 | approved | `public/assets/maps/icons/edict-v1.png` | 诏令/官印图标 | `map-icons-ink-v1` 切图 | 本地 alpha 清理 | 2026-05-14 | Codex | map-icons-ink-v1 | 3x3 切图、置入 256x256 透明 PNG | 通过：朱印形态与地图基调一致，适合 `edict` | 继承 `map-icons-ink-v1` 原创 AI 生成说明 | 未做公开商用确认；当前仅个人游玩/开发使用 | manifest `edict` |

## 参考素材记录

| Ref ID | 状态 | URL 或来源 | 类型 | 作者/机构 | 许可或权利说明 | 用途 | Codex 视觉审核 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ref-historical-map-001 | deferred | 未使用 | 历史地图参考 | 不适用 | 不适用 | reference-only | 本轮未引入第三方或历史地图参考；全部首批资产为 Codex AI 生成并本地后处理 | 后续若查找历史地图或第三方纹理，再新增具体来源记录 |
