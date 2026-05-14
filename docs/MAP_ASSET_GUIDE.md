# S72 地图素材获取与生成指南

本指南配合 [PIXIJS_INK_MAP_ROADMAP.md](PIXIJS_INK_MAP_ROADMAP.md) 和 [MAP_ASSET_LEDGER.md](MAP_ASSET_LEDGER.md) 使用，目标是让地图素材能被 PixiJS 稳定加载、风格统一、来源可回溯，并且不把历史地图版权或 AI 生图细节混成一团。

## 1. 总原则

- 首版游戏素材优先由 Codex 使用 `gpt-image-2` 生成原创资产；其他 AI 生图工具不得作为 S72 地图正式素材来源。
- `gpt-image-2` 生成结果必须由 Codex 使用视觉能力审核后才能进入 `public/assets/maps/`、manifest 或“可用素材”台账状态。
- 鼓励使用第三方优秀素材作为参考、纹理或直接资产候选；直接资产候选必须先确认许可，再由 Codex 使用视觉能力审核游戏基调和同批一致性。
- 历史地图只作参考、构图、纹理和时代气质来源；除非已确认许可并登记，否则不要把原图作为游戏资产。
- 当前游戏仅个人游玩、不商用，但仍记录来源、作者、许可、URL、访问日期和用途，方便未来公开或替换。
- 项目内引用的所有地图素材必须落入 `public/assets/maps/`，不能只留在聊天记录、浏览器下载目录或 `$CODEX_HOME`。
- 图片中不写中文地名、标签、比例尺、图例或大段说明；玩家可见文字由 HTML/CSS/JS 渲染。
- 地图素材不得包含现代品牌、水印、真实个人信息、密钥、本地路径或隐藏剧情真值。

## 2. 建议目录

```text
public/assets/maps/
  ink-map-manifest.json
  base/
    ink-world-base-v1.webp
    paper-texture-v1.webp
  icons/
    city-prefecture-v1.png
    city-county-v1.png
    exam-hall-v1.png
    relay-station-v1.png
    pass-fort-v1.png
    garrison-v1.png
    trade-port-v1.png
  effects/
    ink-ripple-red-v1.png
    ink-ripple-blue-v1.png
    route-flow-v1.png
  raw/
    README.md
```

`raw/` 只放可提交的低风险中间说明或小型源图。不要提交大体积废稿、下载的历史地图原图、`.psd`、`.kra`、`.xcf` 或未确认来源文件；必要时只在素材台账中记录其参考信息。

## 3. Manifest 草案

```json
{
  "schemaVersion": 1,
  "assetSetId": "ink-map-v1",
  "createdAt": "2026-05-14",
  "style": "ink-wash-hand-drawn",
  "assets": [
    {
      "id": "ink-world-base-v1",
      "path": "/assets/maps/base/ink-world-base-v1.webp",
      "type": "base_map",
      "width": 2400,
      "height": 1600,
      "fallbackColor": "#f3ead7",
      "ledgerId": "map-base-ink-v1"
    }
  ],
  "icons": {
    "city_prefecture": "/assets/maps/icons/city-prefecture-v1.png",
    "exam_hall": "/assets/maps/icons/exam-hall-v1.png",
    "frontier_pressure": "/assets/maps/effects/ink-ripple-red-v1.png"
  }
}
```

Manifest 只记录浏览器需要的安全路径、尺寸和用途，不记录完整 prompt、本地文件路径、参考图下载路径或许可证长文。完整来源进入 `docs/MAP_ASSET_LEDGER.md`。

## 4. AI 生成流程

1. 由 Codex 使用 `gpt-image-2` 生成底图草案：无文字、无现代装饰、无图例、无边框水印。
2. Codex 使用视觉能力审核候选底图，确认其符合《千秋》水墨历史基调、留白适合 DOM 标签、色彩与现有资产一致，且没有水印、误生成文字、现代符号或隐藏剧情真值。
3. 选择通过视觉审核的底图后，复制到 `public/assets/maps/base/`，用稳定文件名保存。
4. 由 Codex 使用 `gpt-image-2` 生成图标包或单图标，优先透明 PNG；如果工具不支持真透明，使用 chroma-key 背景再本地抠图。
5. Codex 对图标做视觉审核：32px/64px 可读、笔触和墨色一致、视角统一、没有真实文字或现代 pictogram。
6. 生成 route/effect 纹理：墨线、涟漪、朱砂印、淡墨雾，并做同批视觉一致性审核。
7. 使用图片工具检查尺寸、alpha、文件大小和边缘；图标需在深浅底色上都能识别。
8. 更新 `ink-map-manifest.json`。
9. 更新 `docs/MAP_ASSET_LEDGER.md`，记录 prompt、`gpt-image-2`、日期、参考素材、后处理方式、Codex 视觉审核结论和项目路径。
10. 前端接入后做浏览器验证：资源加载、透明边缘、缩放清晰度、移动端性能。

### 4.1 Codex 视觉审核清单

每个 AI 生成或第三方入库候选素材都要记录审核结论：

- 游戏基调：是否符合《千秋》的历史模拟、水墨舆图、案头古籍气质。
- 一致性：色彩、笔触、视角、颗粒、边缘和留白是否能与同批底图/图标/纹理共存。
- 可读性：底图缩放后 marker 区域是否清楚，图标在 32px 和 64px 是否可辨认。
- 安全性：是否含现代品牌、水印、误生成文字、本地路径、key、hidden 真值或 raw table 名。
- 可维护性：是否能被 manifest 稳定引用，是否需要后处理，是否有明确替换策略。

## 5. AI Prompt 模板

### 5.1 无文字水墨大底图

```text
Use case: historical-scene
Asset type: browser game map base layer
Primary request: a hand-painted Chinese ink-wash world map background for a Ming-era historical simulation game
Scene/backdrop: rivers, mountains, plains, coastal route hints, frontier passes, old paper texture
Style/medium: traditional Chinese ink wash, xuan paper, subtle mineral green and cinnabar accents, hand-drawn but readable
Composition/framing: wide landscape map, no labels, no text, no legend, no compass, no decorative UI frame, generous empty areas for HTML labels
Lighting/mood: calm archival desk-map mood, soft paper grain, elegant and restrained
Constraints: no words, no Chinese characters, no English letters, no watermark, no modern borders, no photoreal satellite style
Avoid: modern map symbols, neon colors, fantasy castles, excessive mountains hiding all marker areas
```

### 5.2 地图图标

```text
Use case: stylized-concept
Asset type: transparent browser game map icon
Primary request: a set of small hand-painted ink-wash map icons for a Chinese historical simulation
Subject: prefecture city seal, county town dot, imperial exam hall, relay station flag, mountain pass gate, frontier garrison banner, trade port boat, legal docket, disaster ripple
Style/medium: Chinese ink brush, simple silhouettes, cinnabar and dark ink accents, readable at 32px and 64px
Composition/framing: each icon centered with generous padding, consistent scale and stroke weight
Constraints: no text, no watermark, no background texture if transparent is requested, no modern pictograms
Avoid: photorealism, high saturation, complex tiny details
```

### 5.3 Chroma-key 透明图标

```text
Create the requested ink-wash map icon on a perfectly flat solid #00ff00 chroma-key background for background removal.
The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation.
Keep the icon fully separated from the background with crisp edges and generous padding.
Do not use #00ff00 anywhere in the icon.
No cast shadow, no contact shadow, no reflection, no watermark, and no text.
```

### 5.4 路线与事件效果

```text
Use case: stylized-concept
Asset type: browser game effect texture
Primary request: transparent ink-brush route and ripple textures for a Chinese historical map UI
Subject: flowing ink line, cinnabar warning ripple, blue-green trade route pulse, pale fog wash
Style/medium: traditional ink brush on transparent background, soft feathered edges
Composition/framing: isolated texture elements with padding, seamless enough for repeated use
Constraints: no text, no symbols, no watermark, alpha-friendly edges
Avoid: modern glow, sci-fi particles, hard vector gradients
```

## 6. 第三方与历史参考素材查找建议

### 6.1 推荐来源

- Wikimedia Commons：适合找公有领域或明确 CC 许可的历史地图、古籍插图、纹理参考。
- Library of Congress：适合找地图扫描件和权利说明清楚的历史资料。
- OpenGameArt：适合找开源纹理、图标、纸张或 UI 素材，但要逐项检查 license。
- Internet Archive / 各国国家图书馆：可作参考来源，但下载图像进入项目之前必须确认权利说明。
- 博物馆和大学馆藏：只作视觉参考时也记录 URL；若要直接使用图像，必须确认条款。

第三方优秀素材可以进入候选池，但不因“看起来很好”自动入库。直接使用前必须同时满足：

- 许可或权利声明允许当前用途，并在台账中记录。
- 文件来源、作者/机构、URL、访问日期和署名要求可回溯。
- Codex 已完成视觉审核，确认风格、时代气质、色彩、细节密度和同批素材一致性达标。
- 没有现代 UI 感、品牌、水印、误导性文字、真实个人信息、本地路径或 hidden/raw 内容。

### 6.2 搜索关键词

```text
Ming dynasty map public domain
Chinese historical map 17th century public domain
明代 舆图 公有领域
古地图 明朝 江南 舆图
Chinese ink map texture paper public domain
Wikimedia Commons Ming map
Library of Congress Chinese map
OpenGameArt parchment paper texture CC0
OpenGameArt ink brush icon CC0
```

### 6.3 记录字段

每个参考素材至少记录：

- `Ref ID`
- URL
- 标题
- 作者/机构
- 年代
- license / rights statement
- access date
- 用途：`reference-only`、`texture-source`、`direct-asset-candidate`
- 是否进入项目目录
- 备注：例如“只参考河道构图，不复制原图”
- Codex 视觉审核结论：`pending`、`approved`、`rejected`，并说明原因

## 7. 使用与许可建议

- 即使当前只个人游玩，也按“未来可能公开”的标准记录来源。
- CC0 / Public Domain / 明确可再利用素材优先。
- CC-BY 素材若直接使用，必须保留作者与署名方式；首版尽量避免直接混入需要复杂署名的素材。
- CC-BY-SA、GPL、OGA-BY 等素材可能带来传播义务，直接使用前必须记录影响。
- “仅供个人使用”“不可商用”“all rights reserved”素材只可作为参考，不进入项目资产。
- 历史地图扫描件不等于自动公有领域；看馆藏页面权利声明，而不是只看年代。

## 8. 文件规格

- 大底图：WebP 优先，建议长边 2048-3072，首版控制在 1.5MB 以内。
- 图标：PNG/WebP，建议源尺寸 256x256，运行时缩放到 24-64px。
- 透明：必须检查 alpha 通道；边缘不能有明显绿边/洋红边。
- 色彩：统一偏暖宣纸底，墨色不纯黑，朱砂只用于风险/警示。
- 命名：`kebab-case-vN.ext`，例如 `exam-hall-v1.png`。
- 替换：不要覆盖旧文件，新增 `v2`，更新 manifest 和台账。

## 9. 质量验收

- 视觉：缩放后仍可读，图标之间一眼可区分，整体不偏现代 UI 或奇幻游戏地图，并已记录 Codex 视觉审核结论。
- 技术：文件路径稳定，manifest 可解析，浏览器 Network 无 404。
- 安全：图片和 manifest 不含本地路径、key、hidden 真值、raw table 名。
- 性能：首屏地图资源可接受；图标与纹理不造成明显卡顿。
- 可维护：每个资产能在台账中找到来源、生成 prompt 或参考记录。

## 10. 地图素材边界

2026-05-14 起，后续开发全部由 Codex 负责。任何地图前端或素材改动都只能使用已提交到 `public/assets/maps/` 的素材和 manifest；如需新增素材，仍由 Codex 按本指南生成、审核和登记。后续维护不得：

- 自行下载并提交未经登记的历史地图。
- 自行使用 AI 生图工具生成 S72 地图素材；AI 生图统一由 Codex 使用 `gpt-image-2` 完成。
- 把网络图片 URL 直接写进前端运行时代码。
- 把 `$CODEX_HOME`、下载目录或本地绝对路径写进 manifest。
- 修改 `docs/MAP_ASSET_LEDGER.md` 声称某素材已授权，除非已经完成来源确认和 Codex 视觉审核。
- 生成或提交大体积二进制废稿。

如果后续发现缺素材，应先在路线图或交接记录中列出“需要 Codex 提供的素材清单”，再由 Codex 生成、登记并提交。
