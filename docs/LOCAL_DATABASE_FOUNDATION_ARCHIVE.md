# 《千秋》S49-S53 本地数据库基础归档

归档日期：2026-05-07。

本文件压缩 S49-S53 已完成的本地动态数据库基础工作，供后续追溯。稳定开发治理仍以 [DEVELOPMENT_GOVERNANCE.md](DEVELOPMENT_GOVERNANCE.md) 为锚点；当前活动路线图见 [DEVELOPMENT_STEPS.md](DEVELOPMENT_STEPS.md)。

## 归档结论

S49-S53 已经完成“先边界、后拆表”的数据库基础层：

- 路由面对 `sessionStore` facade，默认 JSON adapter 保持可玩；`STORAGE_ADAPTER=sqlite` 可选启用本地 SQLite session row，一行一 session，仍保存 JSON `world_state`。
- 本地审计已具备 `event_log` 与 `ai_change_proposals`：JSON 模式写 `data/audit/*.jsonl`，SQLite 模式写本地表，只记录脱敏摘要、服务器接受/拒绝原因和应用事件 id。
- 天下地理、人物关系、官职任所已经先形成 server-owned ledger / visible bridge 和 route view：`worldGeographyView`、`worldPeopleView`、`officialPostingsView`。
- `promptContextAssembler` 已把 prompt 动态上下文集中到服务器可见 projection 与 `retrievalContext`，不读取 raw ledger、raw audit 或 SQLite 审计表。
- 浏览器“局势簿”已落地天下格局、任所地理、人物谱牒、官职簿和事件档案五类面板；事件档案读取 `eventArchiveView`，不读取 raw audit、provider proposal、prompt、本地路径或 key。

S49-S53 没有把国家、城市、NPC、家族、资产、官职任所等拆成 SQLite 业务表。后续 S54+ 的重点是基于这些安全 view 和审计底座，逐步拆业务表并保持 JSON/SQLite route-view parity。

## 完成步骤索引

| ID | 摘要 | 主要提交 |
| --- | --- | --- |
| S49.1 | 动态世界数据库总体规划；确认本地 SQLite 可行、AI 不直写数据库、先 adapter 后拆表 | `e3808df`、`990f7d3`；路线图切换 `c2e31f3`、`9726ccb` |
| S49.2 | Storage adapter facade 与 JSON adapter contract tests | `2e15e13` |
| S49.3 | 可选本地 SQLite session row adapter、`node:sqlite`、JSON -> SQLite 导入脚本 | `22217e0` |
| S49.4 | 本地事件日志与 AI proposal 审计 | `092de20` |
| S50.1 | 天下地理静态 seed 契约与 `worldGeographySeeds` | `45f9b65` |
| S50.2 | 每局 `worldGeography` ledger、`worldGeographyView` 与 prompt summary | `b0ced01` |
| S51.1 | NPC、家族、资产、田产、关系 schema 契约 | `418077b` |
| S51.2 | `worldPeople` 可见桥接、`worldPeopleView` 与 prompt summary | `8ed984a` |
| S52.1 | 官职、官署、任所、城市辖区、考成和迁转 schema 契约 | `4ce6d0e` |
| S52.2 | `officialPostings` 可见桥接、任所城市联动与 prompt summary | `4599869` |
| S53.1 | `promptContextAssembler` 与检索式 `retrievalContext` | `1268c04` |
| S53.2 | 浏览器信息面板规划 | `b89882a` |
| S53.3 | 浏览器局势簿 tab 壳与 view 缓存基础 | `89e73c2` |
| S53.4 | 天下格局与任所地理面板 | `657c08e` |
| S53.5 | 人物谱牒与官职簿面板 | `e642ae3` |
| S53.6 | `eventArchiveView` 安全事件档案与浏览器面板 | `bac7d2f` |

## 稳定边界

- JSON 仍是默认存储；`npm install && npm start` 与 Mock 模式不依赖 SQLite。
- SQLite 只表示本机存档增强；远程存档、账号体系、多人同步、云端冲突解决和托管数据库不属于当前范围。
- AI 不能执行 SQL、不能直接写 `countries`、`cities`、`npcs`、`office_postings`、`event_log` 等表，也不能绕过服务器事务。
- AI 只能提交 schema-valid proposal；服务器负责 schema、白名单、数值 clamp、可见性过滤、科举晋级、官职任免、长期事件、世界实体、世界议程和持久化裁决。
- 浏览器和 prompt 只读服务器整理后的 player-facing view / capped summary；不得读取 raw audit、raw provider proposal、raw prompt、数据库路径、密钥、hidden notes、hidden intent 或未公开关系/任所。
- 事件档案属于安全 projection，不等于 raw audit 浏览器。

## 当前剩余缺口

- 尚无地理业务表：国家、区域、城市、路线、边面、官署辖区仍主要存在于 JSON `worldState.worldGeography` 与安全 view。
- 尚无人物业务表：NPC、家族、资产、田产、关系仍以 `characters`、`relationshipLedger` 和 `worldPeople` 可见桥接为主。
- 尚无官职任所业务表：官署、官职、任命、考成、迁转仍以 `officialCatalog`、`officialCareer` 和 `officialPostings` projection 为主。
- `eventArchiveView` 不读取 raw audit；后续如需分页、筛选和长期检索，需要另建安全事件索引。
- `retrievalContext` 目前基于 route/prompt helper 的可见 projection；SQLite 索引驱动检索仍需 S58 实现。

## 后续入口

后续不应重做 S49-S53 的基础边界。接手者应从 [DEVELOPMENT_STEPS.md](DEVELOPMENT_STEPS.md) 的第一个 `TODO` 开始，当前推荐是 S54.1：地理 SQLite 业务表契约。
