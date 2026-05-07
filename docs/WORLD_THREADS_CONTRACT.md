# World Threads / 世界议程契约

S43.1 新增 `worldState.worldThreads`，用于把分散在主动 NPC 请托、长期事件、官场差遣、官场结果、身份-世界联动、世界实体压力、地方压力、边事和派系斗争里的信号整理成可追踪的跨月议题。

World Threads 不是新的裁决引擎，也不替代 `longTermEvents`、`officialCareer`、`roleWorldCoupling` 或 `activeNpcRequest`。它是服务器拥有的归一化索引和玩家可见视图，让 AI prompt 与后续前端面板能读到同一份“当前有哪些历史压力值得盯住”的摘要。

## 持久状态

```js
worldState.worldThreads = {
  schemaVersion: 1,
  threads: [
    {
      schemaVersion: 1,
      id: "WT-lte-LTE-0008-border_alarm",
      status: "active",
      kind: "border",
      sourceType: "long_term_event",
      sourceId: "LTE-0008-border_alarm",
      sourceLabel: "长期大势",
      title: "边报连至",
      summary: "边镇催饷，兵部与军镇持续施压。",
      severity: 2,
      createdTurn: 8,
      lastUpdatedTurn: 8,
      dueTurn: null,
      startedYear: 1644,
      startedMonth: 8,
      remainingMonths: 2,
      visibility: "public",
      related: {
        characters: [],
        factions: ["militaryLords"],
        offices: [],
        entities: ["military-frontier-garrison"],
        metrics: ["borderThreat", "armyMorale", "treasury"]
      }
    }
  ],
  recentResolved: []
}
```

字段约定：

- `status`：`active` 表示需要当前处置或持续观察，`watch` 表示已形成余波/结果仍可被叙事引用，`resolved` 只用于归档视图。
- `kind`：当前覆盖 `npc_request`、`seasonal`、`disaster`、`border`、`faction_conflict`、`local_case`、`consequence`、`official_assignment`、`official_outcome`、`role_impact`、`world_entity_pressure`。
- `sourceType`：说明来源系统，当前覆盖 `active_npc_request`、`long_term_event`、`official_assignment`、`official_outcome`、`role_world_coupling`、`world_entity`、`frontier_report`、`faction_pressure`、`local_case_pressure`。
- `severity`：`1..3`，用于排序和前端轻重提示；不是结算分数。
- `related`：只保存玩家可见可解释的关联人物、派系、衙门、世界实体和指标路径，不保存隐藏札记。
- `visibility`：`public` 或 `relationship_visible` 可进入玩家视图与 prompt 摘要；`hidden` 仅用于兼容旧数据归一化，不进入 `worldThreadView`。

## 服务器规则

- `src/game/worldThreads.js` 拥有归一化、同步、玩家视图和 prompt 摘要。
- `ensureWorldThreadState(worldState)` 会从当前服务器状态重新推导议题，不接受 provider 直接写入。
- 普通 turn 的 provider schema、prompt pack 和 `applyStatePatch()` 都禁止 `statePatch.worldThreads`。
- 同一来源使用稳定 id 去重，例如 `WT-lte-{longTermEvent.id}`、`WT-official-assignment-{assignment.id}`。
- 已存在但来源消失的 active/watch thread 会进入 `recentResolved`，作为“暂归档”留给后续叙事引用。
- World Threads 只整理来源和可见摘要，不直接改变数值、不结算实体、不结算差事、不安排长期事件、不创建 NPC 请托、不裁决官职。

## 路由与 Prompt 合约

`POST /api/game/start`、`GET /api/game/state/:sessionId`、`POST /api/game/turn`、`POST /api/exam/question` 和 `POST /api/exam/submit` 返回：

```js
{
  worldThreadView: {
    schemaVersion: 1,
    generatedAtTurn: 8,
    activeThreads: [],
    recentResolved: []
  }
}
```

`worldThreadView.activeThreads[]` 暴露：

- 来源与排序字段：`id/status/kind/sourceType/sourceId/sourceLabel/title/summary/severity/createdTurn/lastUpdatedTurn/dueTurn/turnsRemaining/startedYear/startedMonth/remainingMonths/related`。
- S43.2/S45.2 派生展示字段：`goal`、`deadlineLabel`、`riskLabel`、`riskTone`、`relatedLabels`、`relatedEntitySummaries`、`interventionHints`、`followUpHint`。

这些字段全部由服务器按 `kind/sourceType/severity/dueTurn/remainingMonths/related`、公开世界状态和可见 `worldEntityView` 派生，不进入 provider patch 白名单，也不代表新的裁决权。`relatedEntitySummaries` 只读取可见实体摘要，隐藏实体、`hiddenNotes` 和 `recentNotes` 不进入议题 view/prompt。`interventionHints` 只提示玩家可用自由文本介入方向；`followUpHint` 只说明来源系统如何继续结算。

`src/ai/prompts.js` 的 `compactWorldState()` 会把 `summarizeWorldThreadsForPrompt(worldState)` 放入 `worldThreads`，供 prompt pack 读取当前议题。该摘要不包含隐藏 thread、隐藏关系、官场 `hiddenNotes` 或 provider 配置。

## 浏览器检查视图

S43.2 在浏览器角色面板内新增 `#world-thread-panel`。该面板只读取 `worldThreadView`，不读取 `worldState.worldThreads` 原始 ledger，避免 legacy hidden row 或隐藏札记绕过服务器 view 过滤。

稳定选择器：

- `#world-thread-panel[data-generated-turn][data-active-count][data-watch-count]`
- `.world-thread-card[data-thread-id][data-source-type][data-thread-kind][data-status][data-severity][data-risk]`
- `.world-thread-goal`
- `.world-thread-deadline`
- `.world-thread-risk`
- `.world-thread-related`
- `.world-thread-hint`
- `.world-thread-followup`
- `.world-thread-resolved-item`

浏览器面板与 prompt 摘要共享同一可见字段；隐藏关系、隐藏 thread、官场 `hiddenNotes`、provider 配置和 `.env` 不得进入面板。

## S43 范围与后续

S43.1 建立服务器拥有的议题聚合层和 API/prompt 可见摘要。S43.2 已实现浏览器“世界议程”检查视图，并扩展目标、期限、玩家介入点和后续结算提示。后续仍可继续完善多来源合并、阶段化目标和更具体的归档 outcome，但必须保持来源系统拥有实际结算权。
