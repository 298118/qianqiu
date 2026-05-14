# 《千秋》S72 PixiJS 水墨地图专项归档

归档日期：2026-05-14。

本文件归档 S72.0-S72.8 的 PixiJS 水墨地图专项完成范围，供后续地图玩法、小步骤和回溯验证使用。规划与实现边界源头仍见 [PIXIJS_INK_MAP_ROADMAP.md](PIXIJS_INK_MAP_ROADMAP.md)，运行时契约见 [PIXIJS_INK_MAP_RUNTIME_CONTRACT.md](PIXIJS_INK_MAP_RUNTIME_CONTRACT.md)，素材指南见 [MAP_ASSET_GUIDE.md](MAP_ASSET_GUIDE.md)，素材台账见 [MAP_ASSET_LEDGER.md](MAP_ASSET_LEDGER.md)。稳定开发治理仍以 [DEVELOPMENT_GOVERNANCE.md](DEVELOPMENT_GOVERNANCE.md) 为锚点。

## 1. 归档结论

S72 已把 PixiJS 水墨地图从“可用地图壳”推进为完整的服务器安全地图运行时和浏览器舆图面板。当前地图仍只读安全 `mapContextView` / `mapRuntimeView`，不直接读取 raw 坐标表、hidden enemy truth、raw audit、provider proposal、完整 prompt、本地路径或 key；地图点击、tooltip 和行动草稿都只是前端视图层和玩家确认入口，真实移动、任免、财政、军务、外交和事件后果继续由服务器裁决。

已完成能力：

- S72.0：确认 PixiJS 水墨地图方向，切换当前协作台账为 Codex + Gemini CLI。
- S72.0a：细化 Codex/Gemini 实施规格，补齐素材指南、Gemini 指引和上下文排除规则。
- S72.1：固定 `pixi.js@7.4.3` UMD、本地 vendor 优先、固定 CDN fallback、无 build step 和 `mapRuntimeView` 契约。
- S72.2：实现后端 `mapRuntimeView`、布局种子、route payload 与测试。
- S72.3：生成并登记 `ink-map-v1` 底图、纸纹、路线/事件纹理和图标 manifest。
- S72.4：接入本地 PixiJS vendor、地图 DOM shell、manifest-driven 素材加载、tooltip/label、资源失败 fallback 和行动草稿回填。
- S72.5：完成地点、路线和事件点击选中态、局势簿公开卡片跳转与安全行动草稿联动。
- S72.6：完成路线墨线呼吸、事件涟漪、朱砂双圈选中态、案头舆图 tooltip/fallback 视觉和 reduced-motion / 可见性降级守卫。
- S72.7：完成 browser smoke 验收、安全与性能回归，覆盖 canvas 非空、资源失败静态降级、桌面/窄屏布局和 hidden/raw 防线。
- S72.7a：切换为 Codex-only 协作口径，删除 Gemini 专用上下文入口。
- S72.8：专项归档收口，将完成范围、验证证据、剩余风险和后续方向沉淀为可追溯入口。

## 2. 完成步骤索引

| ID | 摘要 | 主要证据 |
| --- | --- | --- |
| S72.0 | PixiJS 水墨地图规划与协作切换 | `docs/PIXIJS_INK_MAP_ROADMAP.md`、`docs/DEVELOPMENT_STEPS.md` |
| S72.0a | 实施规格细化 | `docs/MAP_ASSET_GUIDE.md`、`docs/DEVELOPMENT_STEPS.md`；历史 `GEMINI.md` / `.geminiignore` 见 Git history |
| S72.1 | 依赖治理与 runtime 契约 | `docs/PIXIJS_INK_MAP_RUNTIME_CONTRACT.md`、`docs/DEVELOPMENT_STEPS.md` |
| S72.2 | 后端地图 runtime view | `src/game/mapRuntimeView.js`、`test/mapRuntimeView.test.js`、`test/mapRuntimeRoute.test.js` |
| S72.3 | 首批地图素材、manifest 与台账 | `public/assets/maps/ink-map-manifest.json`、`docs/MAP_ASSET_LEDGER.md`、`test/mapAssetsManifest.test.js` |
| S72.4 | PixiJS 地图 shell 与图层系统 | `public/mapRenderer.js`、`public/mapPanel.js`、`test/mapFrontendShell.test.js` |
| S72.5 | 地图与游戏系统联动 | `public/mapRenderer.js`、`public/mapPanel.js`、`test/mapFrontendShell.test.js` |
| S72.6 | 水墨动效与视觉 polish | `public/mapRenderer.js`、`public/styles.css`、`test/mapFrontendShell.test.js` |
| S72.7 | 验收、安全与性能回归 | `scripts/browserSmoke.js`、`test/browserSmokeScript.test.js`、`npm run smoke:browser` |
| S72.7a | 协作模式切换为 Codex-only | `AGENTS.md`、`CLAUDE.md`、`docs/SHARED_CONTEXT.md` |
| S72.8 | S72 专项归档 | 本文件、`docs/DEVELOPMENT_STEPS.md`、`docs/SHARED_CONTEXT.md` |

## 3. 稳定边界

- 默认 JSON / Mock 继续完整可玩，SQLite 只表示本机存档增强。
- `mapContextView` 仍是地图事实入口，`mapRuntimeView` 只负责浏览器显示布局、样式 token、路线路径、事件效果和服务器预渲染行动草稿。
- 地图前端只读安全 view，不从 raw coordinate table、raw audit、provider payload、完整 prompt、本地路径或 hidden ledger 推导隐藏信息。
- 地图行动草稿只填入玩家输入框，仍由玩家点击普通回合按钮提交。
- AI 仍只能提交 proposal / request-adjudication，服务器继续拥有地图移动、任免、财政、军务、外交、事件后果和持久化裁决。
- 后续若重新扩展地图玩法，必须先为新步骤建立新的安全 view、提案边界和验收证据，不能回填 hidden raw truth 到玩家 route state。

## 4. 验收与回归入口

```bash
npm run check:docs-governance
node --test test/documentationGovernance.test.js
node --test test/mapRuntimeView.test.js test/mapRuntimeRoute.test.js test/mapAssetsManifest.test.js test/mapFrontendShell.test.js test/browserSmokeScript.test.js
npm run smoke:browser -- --screenshots artifacts/s72-browser-smoke
npm run smoke:dual-mode -- --storage-only
node --test test/dualModeAcceptanceScript.test.js
npm test
```

说明：

- `npm run smoke:browser` 与 `browserSmokeScript.test.js` 共同覆盖桌面、窄屏、恢复读档、新页面恢复、资源失败降级和 `prefers-reduced-motion` 场景。
- `npm run smoke:dual-mode -- --storage-only` 继续是 JSON / SQLite 本地增强的回归守门。
- `npm test` 仍保留 S67 大规模 fixture 的历史性能门槛守门；若后续波动，应先复跑并单独处理阈值，不把它误判为 S72 回归。

## 5. 后续方向

- 若后续地图玩法继续扩展，请从新的小步骤重新开题，继续沿用 `mapContextView` / `mapRuntimeView` 的安全边界。
- 可继续探索更大范围地理覆盖、更丰富的事件压力、更细的路线和行动草稿呈现，但仍必须保持 proposal-only、server-adjudicated 和浏览器只读安全 view 的原则。
