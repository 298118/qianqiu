# S53 浏览器信息面板规划

S53.2 固定后续浏览器信息面板的数据来源、边界和验收清单。该步骤只做规划，不改 `public/app.js`，不新增 route，不新增 SQLite 业务表，也不改变 AI/provider schema。

后续实现这些面板时，浏览器只能读取 route payload 中的 player-facing view。`S53.1 retrievalContext` 是 provider-only prompt 对象，不是 UI 数据契约；`worldState` 中的 raw ledger 只保留本地开发兼容意义，不得成为新面板的数据来源。

S53.3 已完成前端接线基础：`public/app.js` 缓存 S50-S52 相关 view，并在 `#information-panel` 中建立五类 tab 壳和稳定 selector。S53.4 已完成“天下格局”和“任所地理”两类细内容：前者渲染可见国家、城市、路线、边面和官署辖区卡片，后者渲染当前任所、城市辖区、地方指标与通路卡片。事件档案 tab 仍禁用；下面的 S53.5-S53.6 继续负责人物/官职簿细内容与安全事件 projection。

## 当前现状

路由层已稳定返回以下玩家可见 projection：

- `examCalendarView`
- `examRivalView`
- `relationshipView`
- `activeNpcRequestView`
- `roleWorldCouplingView`
- `worldGeographyView`
- `worldEntityView`
- `worldPeopleView`
- `worldThreadView`
- `longTermEventView`
- `officialCareerView`
- `officialPostingsView`

浏览器已渲染的主要信息面包括：状态栏、身份/书生面板、人脉簿、主动请托、官场档案、世界议程、科期、同场对手、考试弹窗、考试档案、存档簿和 AI 连接面板。S53.4 已把 `worldGeographyView` 与 `officialPostingsView` 的任所地理部分接入 `#information-panel`；尚待独立渲染的是 `worldEntityView`、`worldPeopleView`、`officialPostingsView` 的官职簿部分和 `longTermEventView`。S53 后续面板应补这些 view 的玩家可读入口，同时避免把 `#scholar-panel` 挤成难以扫描的长列表。

## 总边界

- 不读取 raw `worldState.worldGeography`、`worldState.worldPeople`、`worldState.officialPostings`、`worldState.worldEntities`、`worldState.worldThreads`、`worldState.longTermEvents.queue`、`worldState.officialCareer`、`relationshipLedger`、`characters` 或 `activeNpcRequest`。
- 不读取 JSON audit sidecar、SQLite `event_log` / `ai_change_proposals`、provider 原始 proposal、raw prompt、`statePatch`、本地路径或 API key。
- 不把浏览器面板做成结算入口；面板只解释局势和提示可用自由行动，不提供一键任免、一键结案、一键调度或绕过服务器来源系统的操作。
- 不新增远程存档、账号、多人同步、托管数据库或 SQLite 业务表。
- 现有 `officialCareerView` 的官场档案仍是任免、差事、考成和履历的第一玩家入口；S53.4 已用 `officialPostingsView` 支撑任所地理，后续官职簿继续读取同一 view，但不替代官场结算。

## 面板规划

| 面板 | 主数据源 | 辅助数据源 | 首屏职责 | 不得展示 |
| --- | --- | --- | --- | --- |
| 天下格局 | `worldGeographyView` | `worldEntityView.highlights`、`worldThreadView.activeThreads`、`longTermEventView.activeEvents` | 国家、城市、路线、边面、官署辖区的可见格局和压力摘要。 | hidden 国家/路线/边面、`hiddenNotes`、书生不可见 `role_visible` 行、战争/外交裁决。 |
| 任所地理 | `officialPostingsView.cityJurisdictions`、`officialPostingsView.postings`、`worldGeographyView.cities/routes/officeJurisdictions` | `officialCareerView.currentPosting`、`officialCareerView.bureau`、`officialCareerView.assignments` | 当前官职/地方官任所、辖区城市、路线和地方指标。 | hidden 任所、隐藏地理引用、未公开调任、密札考成。 |
| 人物谱牒 | `worldPeopleView.npcs/households/assets/estates/relationships` | `relationshipView`、`activeNpcRequestView`、`examRivalView` | 可见人物、家族、资产、田产和关系网络摘要。 | `hiddenIntent`、`hiddenNotes`、隐藏家族/资产/田产 id、未知人物 id。 |
| 官职簿 | `officialPostingsView.bureaus/offices/postings/assessmentRecords/transferRecords` | `officialCareerView` | 官署、官职、当前任命、考成和迁转的公开簿册。 | 直接任免入口、hidden 官员私档、未公开考成、raw `officialCareer`。 |
| 事件档案 | 未来 `eventArchiveView` | 当前可先参考 `worldThreadView.recentResolved`、`longTermEventView.recentResolved`、`officialCareerView.recentOutcomes`、考试档案 | 按年月旬、来源和可见性整理已经发生或正在观察的事件。 | raw audit、provider proposal、完整 `eventHistory` 直出、隐藏事件、API key、本地路径。 |

## 事件档案额外要求

事件档案风险最高，不应在没有服务器 projection 的情况下直接实现。建议先新增 `eventArchiveView`，由服务器从以下可见来源整理：

- capped sanitized `eventHistory` 文本。
- `worldThreadView.activeThreads` 和 `worldThreadView.recentResolved`。
- `longTermEventView.activeEvents` 和 `longTermEventView.recentResolved`。
- `officialCareerView.recentOutcomes`。
- `player.examHistory` 中已对玩家公开的考试档案摘要。

`eventArchiveView` 必须带 `schemaVersion`、`generatedAtTurn`、`dateLabel`、`items[]`，并给每条 item 标注 `id`、`sourceType`、`title`、`summary`、`year/month/tenDayPeriod/turn`、`visibility`、`status`。服务器负责 cap、排序、hidden token 过滤和本地路径/密钥脱敏。若未来要把本地 audit 用于事件档案，也必须先转成 sanitized projection，并补分页或检索权限，而不是让浏览器读 JSONL 或 SQLite audit table。

## UI 设计方向

- 面板应作为游戏态信息工具，不做营销页、浮夸 hero 或独立 landing。
- 优先使用 tab/segmented controls 在“天下、任所、人物、官职、事件”之间切换，避免五个大面板同时铺满 `#scholar-panel`。
- 每个面板必须有稳定 selector 和 `data-*` 验收属性；卡片用于重复条目，不能把整页 section 包成层层卡片。
- 桌面端应保证叙事区和行动区仍是主体验；信息面板用于查阅和决策辅助。
- 移动端优先折叠为可切换的单列面板，所有长地名、官名、人物名都必须换行或裁剪，不能横向溢出。

建议 selector：

- `#world-geography-panel`
- `#posting-geography-panel`
- `#world-people-panel`
- `#official-postings-panel`
- `#event-archive-panel`
- `.world-geography-card[data-kind][data-entity-id]`
- `.posting-geography-card[data-kind][data-entity-id]`
- `.world-people-card[data-kind][data-entity-id]`
- `.official-posting-card[data-kind][data-entity-id]`
- `.event-archive-item[data-event-id][data-source-type][data-status]`

## 后续步骤拆分

- S53.3：前端接线基础。`renderWorldState()` 缓存 `worldGeographyView`、`worldEntityView`、`worldPeopleView`、`officialPostingsView` 和 `longTermEventView`；新增轻量 tab/面板容器，但不实现复杂内容。补 browser smoke metrics 的空面板/溢出骨架检查。
- S53.4：实现“天下格局”和“任所地理”。只读 `worldGeographyView`、`officialPostingsView` 和必要的可见地理查表；已补地理 hidden token、role-visible、桌面/移动溢出和 official start 验收。
- S53.5：实现“人物谱牒”和“官职簿”。只读 `worldPeopleView`、`officialPostingsView`、`relationshipView` 和 `activeNpcRequestView`。补 hidden 人物/资产/任所/考成泄漏探针。
- S53.6：实现事件档案前先新增 `eventArchiveView`。只读 sanitized projection；若没有该 view，事件档案 UI 不应落地。补 raw audit/proposal 泄漏、分页/cap、年月旬排序和考试/官场/长期事件合并验收。

## 验收清单

后续代码实现至少需要：

- route 测试确认 start/state/turn/SSE/exam question/progress/submit 都带面板所需 view。
- browser smoke 新增面板 helper：`assertWorldGeographyPanel`、`assertPostingGeographyPanel`、`assertWorldPeoplePanel`、`assertOfficialPostingsPanel`、`assertEventArchivePanel`。
- `readGameLayoutMetrics()` 增加新面板桌面/移动横向溢出检查。
- `test/browserSmokeScript.test.js` 覆盖缺字段、hidden token 泄漏、横向溢出和空状态。
- hidden-token corpus 覆盖地理、人物、家产、任所、官署、世界实体、世界议程、长期事件、事件档案和 provider/audit/path 文本。
- 完整 Mock browser smoke 覆盖开局、普通回合后、reload restore、fresh page、mobile、direct official start 和书生通关入仕后。

S53.2 本身的验证为：

```powershell
npm run check:docs-governance
git diff --check
```
