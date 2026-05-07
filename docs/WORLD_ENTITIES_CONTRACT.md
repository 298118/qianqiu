# 多实体世界模型契约

S45.1 新增 `worldState.worldEntities`，用于把朝廷衙门、地方士绅、书院同门、军镇边墙、盐漕税赋和灾荒赈务整理成可审查的结构化实体。它不是新的结算器；第一步只提供服务器拥有的实体账本、玩家可见 view 和 AI 可读摘要。跨系统写入与实体派生议题留给 S45.2。

## 目标

- 让 AI 叙事可以引用具体制度实体，而不是只看全局数值。
- 让玩家和后续 UI 能看到“哪些机构/群体/通道正在吃紧”。
- 保持服务器裁决权：模型只能读取可见摘要，不能写入实体账本、隐藏札记或实体结局。
- 为 S45.2 接入世界 tick、NPC 行为、关系账本、官场结果和 World Threads 留出统一落点。

## 持久状态

`worldState.worldEntities` 是 server-owned ledger：

```javascript
{
  schemaVersion: 1,
  entities: [
    {
      id: "court-ministry-revenue",
      category: "court",
      kind: "court_office",
      name: "户部",
      status: "stable | strained | critical",
      visibility: "public | role_visible | hidden",
      metrics: {
        influence: 0,
        pressure: 0,
        capacity: 0,
        trust: 0,
        deficit: 0
      },
      publicSummary: "玩家可见摘要",
      related: {
        characters: [],
        factions: [],
        offices: [],
        metrics: []
      },
      interventionHints: [],
      lastUpdatedTurn: 0,
      hiddenNotes: []
    }
  ],
  recentNotes: []
}
```

字段约定：

- `category`：`court`、`local`、`academy`、`military`、`fiscal`、`relief`。
- `kind`：`court_office`、`local_gentry`、`academy_circle`、`frontier_garrison`、`fiscal_channel`、`relief_operation`。
- `metrics` 全部夹在 `0..100`，只表示游戏化压力，不是史实定量。
- `hiddenNotes` 只给服务器后续结算使用，不进入 prompt、view 或浏览器。

## 初始实体

S45.1 的基础实体由 `src/game/worldEntities.js` 集中生成和归一化：

- 朝廷：吏部、户部、都察院。
- 地方：地方士绅、河工案牍。
- 士林：县学书院、同年文社。
- 军事：边镇军镇、边墙堡寨。
- 财赋：盐漕通道、田赋商税。
- 赈务：灾荒赈务。

这些实体会按当前 `worldState` 读取府库、粮储、民心、腐败、税率、边患、军心和玩家身份指标来给出初始压力。旧存档缺少实体时，`ensureWorldEntityState()` 会补齐基础实体；旧实体字段会被 normalize、clamp 和裁剪。

## View 与 Prompt

`buildWorldEntityView(worldState)` 返回玩家可见摘要：

- `groups[]`：按大类分组的可见实体。
- `highlights[]`：按压力/亏空/承载不足排序的高关注实体。
- 每个实体只暴露 `metrics`、`publicSummary`、`relatedLabels`、`interventionHints`、`statusLabel`、`riskLabel` 等可见字段。

`summarizeWorldEntitiesForPrompt(worldState)` 返回更短的 AI 可读摘要：

- 只包含可见实体。
- 最多保留 6 个高关注实体。
- 不包含 `hiddenNotes`、隐藏实体、隐藏联系人、provider 配置或原始内部 source refs。

游戏和考试路由返回 `worldEntityView`。Prompt `compactWorldState()` 读取 `worldEntities` 摘要，让 ordinary turn、官场、地方、军事等 prompt pack 能看到制度实体背景。

## AI 与服务器边界

- 普通 provider 不得 patch `worldEntities`；turn schema、remote normalization、`applyStatePatch()` 和 route 红队测试都应挡下。
- AI 可以在叙事中解释“户部钱粮吃紧”“边镇军饷未清”“书院清议转紧”等可见事实。
- AI 不可裁决实体状态、解决实体压力、公开 hidden notes、创建隐藏实体、或把实体直接转成官职任免/长期事件结局。
- 服务器后续若要写入实体，必须通过 `allowServerOwnedPatchKeys` 或实体模块 helper，并同步测试。

## S45.2 预留

后续小步应把以下来源接入实体：

- 世界 tick：每月自然漂移后更新财赋、粮储、边镇、赈务等实体压力。
- NPC/关系：可见士绅、同年、上官、军镇派系可调整相关实体信任或压力。
- 官场结果：赈务、盐漕、军需、河工、考成差事可写入实体 notes 和可见摘要。
- World Threads：高压力实体可派生可追踪议题，但议题仍不能替代来源系统结算。

## 验证要求

- `test/worldEntities.test.js` 覆盖初始账本、旧档归一化、clamp、隐藏过滤和 prompt 摘要。
- `test/gameTurnWorldEntities.test.js` 覆盖 route payload、SSE payload 和 provider 伪造实体不落盘。
- `test/stateRules.test.js`、`test/aiSchemas.test.js`、`test/remoteHelpers.test.js`、`test/aiControlRedTeam.test.js`、`npm run eval:ai` 覆盖普通回合不能写入 server-owned ledger。
