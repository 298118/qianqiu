# SCALE OS 集成指南 — 千秋 / Qianqiu

本文档是 SCALE OS 功能集成的详尽安装指南。Codex 按本文档逐步执行即可完成配置。

> **SCALE OS 官网**: https://scale-os.hongmaple.top/
> **Gitee 仓库**: https://gitee.com/hongmaple/scale-engine
> **参考版本**: v10.1 (2026-05)

---

## 目录

1. [前置条件](#1-前置条件)
2. [功能总览与优先级](#2-功能总览与优先级)
3. [P0: Hooks 自动化工作流](#3-p0-hooks-自动化工作流)
4. [P1-A: 代码审查模式技能](#4-p1-a-代码审查模式技能)
5. [P1-B: AI Provider 调试技能](#5-p1-b-ai-provider-调试技能)
6. [P2-A: 游戏状态验证技能](#6-p2-a-游戏状态验证技能)
7. [P2-B: 文档同步检查技能](#7-p2-b-文档同步检查技能)
8. [TDD 适配专题](#8-tdd-适配专题)
9. [验证清单](#9-验证清单)
10. [回滚策略](#10-回滚策略)

---

## 1. 前置条件

### 1.1 环境要求

```bash
# 确认 Node.js 版本 (需要 v22+ 以支持 node:test 和 --watch)
node --version

# 确认 Codex CLI 已安装
codex --version
# 如未安装:
npm install -g @openai/codex
```

### 1.2 确认项目状态

```bash
cd /mnt/e/LSMNQ
git status --short
npm test  # 确认 80 个测试全部通过
npm run check:docs-governance  # 确认文档治理检查通过
```

### 1.3 克隆 SCALE OS 引擎（仅用于参考技能文件）

```bash
# 克隆到临时目录，只提取需要的文件
git clone --depth 1 https://gitee.com/hongmaple/scale-engine.git /tmp/scale-engine
```

> **注意**: 不要把整个 scale-engine 放进项目。只提取需要的技能定义和配置模板。

---

## 2. 功能总览与优先级

| 优先级 | 功能 | 投入 | 收益 | 状态 |
|--------|------|------|------|------|
| 🥇 P0 | Hooks 自动化工作流 | 低 | 高 | 待配置 |
| 🥈 P1-A | 代码审查模式技能 | 中 | 高 | 待配置 |
| 🥈 P1-B | AI Provider 调试技能 | 中 | 高 | 待配置 |
| 🥉 P2-A | 游戏状态验证技能 | 中 | 中 | 待配置 |
| 🥉 P2-B | 文档同步检查技能 | 低 | 中 | 待配置 |
| ⏸️ 暂缓 | MCP 服务器 | 高 | 低(现在) | 等 S70 |
| ⏸️ 暂缓 | TDD 完整集成 | 高 | 中 | 需适配 |

---

## 3. P0: Hooks 自动化工作流

### 3.1 为什么最优先

千秋项目已有完善的脚本但需要手动运行：
- `npm run check:docs-governance` — 文档治理检查
- `npm test` — 80 个测试
- `npm run smoke:browser` — 浏览器冒烟
- `npm run smoke:provider` — Provider 冒烟

Hooks 的价值在于把这些串联成**自动化流水线**，并添加项目特有的提醒。

### 3.2 创建 Hooks 配置文件

**文件**: `.scale-hooks.yaml`（项目根目录）

```yaml
# SCALE OS Hooks 配置 — 千秋项目
# 文档: https://scale-os.hongmaple.top/
# 本文件定义 Codex CLI 的自动化工作流钩子

# ============================================================
# Pre-commit Hooks — 每次 git commit 前自动执行
# ============================================================
pre_commit:
  # 1. 文档治理检查 (必须通过才能提交)
  - name: "文档治理检查"
    description: "检查 DEVELOPMENT_GOVERNANCE.md 保护段落完整性"
    command: "npm run check:docs-governance"
    fail_action: "block"  # 失败则阻止提交
    timeout: 30

  # 2. 测试套件 (必须通过才能提交)
  - name: "测试套件"
    description: "运行全部 80 个测试文件"
    command: "npm test"
    fail_action: "block"
    timeout: 120

  # 3. .env 安全检查
  - name: "敏感文件检查"
    description: "确保 .env 和 session 数据不会被提交"
    command: |
      if git diff --cached --name-only | grep -qE '^\.env$|^data/sessions/|^data/audit/|^data/.*\.sqlite'; then
        echo "❌ 检测到敏感文件被暂存:"
        git diff --cached --name-only | grep -qE '^\.env$|^data/sessions/|^data/audit/|^data/.*\.sqlite'
        exit 1
      fi
      echo "✅ 无敏感文件泄露"
    fail_action: "block"

# ============================================================
# Post-edit Hooks — 编辑特定文件后触发提醒
# ============================================================
post_edit:
  # 编辑 src/game/*.js 后提醒检查状态边界
  - name: "状态边界提醒"
    trigger_pattern: "src/game/*.js"
    remind: |
      ⚠️ 你刚修改了游戏逻辑文件。请检查:
      1. 新增/修改的数值是否已加入 src/game/stateRules.js 的 NUMERIC_RANGES
      2. 新增的 statePatch 字段是否已在 src/ai/schemas.js 注册
      3. 是否需要更新 test/ 下对应的测试文件
      4. SHARED_CONTEXT.md 的 Current Snapshot 是否需要更新

  # 编辑 src/ai/*.js 后提醒检查 provider 兼容性
  - name: "Provider 兼容性提醒"
    trigger_pattern: "src/ai/**/*.js"
    remind: |
      ⚠️ 你刚修改了 AI 模块。请检查:
      1. 修改是否影响所有 6 个 provider (mock/openai/deepseek/mimo/mimo-deepseek/anthropic)
      2. JSON schema 变更是否向后兼容
      3. Mock provider 是否仍然正常工作 (npm run smoke:dual-mode)
      4. 是否需要更新 test/aiSchemas.test.js 或 test/aiEvalFixtures.test.js

  # 编辑 docs/*.md 后提醒更新交接板
  - name: "文档同步提醒"
    trigger_pattern: "docs/*.md"
    remind: |
      ⚠️ 你刚修改了项目文档。请确认:
      1. SHARED_CONTEXT.md 的 Current Snapshot 是否已同步
      2. DEVELOPMENT_STEPS.md 是否记录了本次变更
      3. 如涉及保护段落，运行 npm run check:docs-governance 验证

# ============================================================
# Pre-task Hooks — Codex 开始任务前的检查清单
# ============================================================
pre_task:
  - name: "开发会话初始化"
    description: "每次开发会话开始时的必读清单"
    checklist:
      - "读取 AGENTS.md"
      - "读取 docs/SHARED_CONTEXT.md"
      - "读取 docs/QIANQIU_DEVELOPMENT_BRIEF.md"
      - "读取 docs/DEVELOPMENT_STEPS.md"
      - "执行 git status --short 确认工作树状态"
      - "执行 npm test 确认基线健康"

# ============================================================
# Commit Message 规范
# ============================================================
commit_convention:
  prefix_map:
    "feat": "新功能"
    "fix": "修复"
    "docs": "文档"
    "test": "测试"
    "refactor": "重构"
    "perf": "性能"
    "chore": "杂项"
  format: "{type}({scope}): {description}"
  examples:
    - "feat(exam): 新增院试三级细分"
    - "fix(ai): 修复 DeepSeek 评分 JSON 解析失败"
    - "docs(shared-context): 更新 S68.1 科举进度"
    - "test(economic): 补充财政模块边界测试"
```

### 3.3 Codex CLI 集成 Hooks

**文件**: `.codex/config.toml`（项目根目录）

```toml
# Codex CLI 配置 — 千秋项目
# SCALE OS 集成配置

# 模型选择
model = "o4-mini"

# 审批模式: suggest (建议) / auto-edit (自动编辑) / full-auto (全自动)
approval_mode = "suggest"

# 技能目录
skills_dir = ".skills"

# Hooks 配置文件路径
hooks_config = ".scale-hooks.yaml"

# 项目上下文文件
context_files = [
  "AGENTS.md",
  "docs/SHARED_CONTEXT.md",
  "docs/QIANQIU_DEVELOPMENT_BRIEF.md",
  "docs/DEVELOPMENT_STEPS.md"
]

# 提交信息模板
[commit]
template = "{type}({scope}): {description}"
```

### 3.4 创建技能目录

```bash
mkdir -p /mnt/e/LSMNQ/.skills
```

---

## 4. P1-A: 代码审查模式技能

### 4.1 为什么需要

千秋项目已有 subagent review 流程（AGENTS.md 中定义），但审查标准是分散在各处的。这个技能将审查清单**标准化为一个可复用的技能文件**，确保每次审查覆盖所有关键维度。

### 4.2 技能定义

**文件**: `.skills/code-review.md`

```markdown
# 代码审查技能 — 千秋项目

## 触发条件

当以下情况发生时使用本技能：
- 完成一个 roadmap step 的实现
- 子代理提交了 patch 等待审查
- 准备进行 coherent commit

## 审查清单

### A. 游戏逻辑正确性

- [ ] **状态边界**: 新增/修改的数值字段是否在 `src/game/stateRules.js` 的 `NUMERIC_RANGES` 中注册
- [ ] **statePatch 白名单**: AI 可修改的字段是否在 `src/ai/schemas.js` 的 `statePatchSchema` 中声明
- [ ] **服务器裁决**: 涉及晋级、考试资格、作弊处罚、官职任免的逻辑是否由服务器拥有，而非 AI
- [ ] **书生路径完整性**: `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official` 是否仍然可用
- [ ] **Mock 可玩性**: `AI_PROVIDER=mock` 模式下功能是否正常

### B. AI 集成安全性

- [ ] **JSON 验证**: AI 返回的 JSON 是否通过 `validatePayload()` 验证
- [ ] **Provider 兼容**: 修改是否影响所有 6 个 provider (mock/openai/deepseek/mimo/mimo-deepseek/anthropic)
- [ ] **Mock 降级**: 真实 provider 失败时是否正确降级到 mock
- [ ] **Hidden 信息保护**: NPC 私档、未公开关系、密档事件链是否泄露到 worldState
- [ ] **Prompt 预算**: prompt 内容是否超出 retrieval context 的行数/字符限制

### C. 代码质量

- [ ] **无魔法数字**: 可调参数是否在 `GameConfig.js` 或 `*Config.js` 中集中定义
- [ ] **注释充分**: prompt 构建、状态转换、反作弊逻辑是否有注释
- [ ] **中文文档**: 协作文档、路线图、领域注释是否使用中文
- [ ] **变更范围**: 是否只包含本次功能相关的改动，无无关重构

### D. 测试覆盖

- [ ] **测试存在**: 对应的 `test/*.test.js` 是否已创建或更新
- [ ] **边界测试**: 数值边界 (min/max)、空值、异常输入是否有测试
- [ ] **治理测试**: `npm run check:docs-governance` 是否通过
- [ ] **冒烟测试**: `npm run smoke:dual-mode` 是否通过

### E. 文档同步

- [ ] **SHARED_CONTEXT.md**: Current Snapshot 是否已更新
- [ ] **DEVELOPMENT_STEPS.md**: 步骤 ID、完成内容、验证结果、提交哈希是否记录
- [ ] **AGENTS.md / CLAUDE.md**: 如有流程变更，是否同步更新
- [ ] **契约文档**: 涉及新领域时是否创建/更新 `docs/*_CONTRACT.md`

## 审查报告模板

```markdown
## 审查报告 — [步骤ID]

### 变更概述
- 文件数: X
- 新增测试: X
- 影响范围: [模块列表]

### 检查结果
- [ ] 游戏逻辑正确性: ✅/❌ [说明]
- [ ] AI 集成安全性: ✅/❌ [说明]
- [ ] 代码质量: ✅/❌ [说明]
- [ ] 测试覆盖: ✅/❌ [说明]
- [ ] 文档同步: ✅/❌ [说明]

### 风险项
- [列出需要关注的风险]

### 建议
- [改进建议]

### 结论
✅ 通过 / ❌ 需修改 / ⚠️ 有条件通过
```

## 与 SCALE OS 方法论的关系

本技能遵循 SCALE OS 的核心理念：
- **认知脚手架**: 审查清单不是死规则，而是帮助 AI 和人类开发者系统性思考的工具
- **验证优先**: 每个维度都有明确的验证命令或检查点
- **渐进演化**: 审查清单可根据项目演进持续更新
```

---

## 5. P1-B: AI Provider 调试技能

### 5.1 为什么需要

千秋项目有 6 种 AI provider，切换和调试是高频操作。这个技能提供标准化的调试流程。

### 5.2 技能定义

**文件**: `.skills/ai-provider-debug.md`

```markdown
# AI Provider 调试技能 — 千秋项目

## 触发条件

当以下情况发生时使用本技能：
- AI 返回的 JSON 解析失败
- Provider 切换后行为异常
- Mock 模式下功能正常但真实 provider 失败
- 需要测试新 provider 的集成

## Provider 架构概览

```
src/ai/index.js          — Provider 工厂 + Mock 降级包装
src/ai/providers/
  mock.js                — Mock provider (默认可玩)
  openai.js              — OpenAI (GPT-4o / o4-mini)
  deepseek.js            — DeepSeek
  mimo.js                — MiMo (小米)
  mimoDeepseek.js        — MiMo+DeepSeek 混合路由
  anthropic.js           — Anthropic (Claude)
  remoteHelpers.js       — 远程 provider 共用工具
src/ai/schemas.js        — JSON Schema 验证 (479 行)
src/ai/prompts.js        — Prompt 模板
src/ai/promptContextAssembler.js — 上下文组装
```

## 调试流程

### Step 1: 确认当前 Provider

```bash
# 查看 .env 中的配置
cat .env | grep AI_PROVIDER

# 可选值: mock / openai / deepseek / mimo / mimo-deepseek / anthropic
```

### Step 2: 运行 Provider 冒烟测试

```bash
# 测试当前 provider 的基本连通性
npm run smoke:provider

# 测试路由健康
npm run smoke:provider:route

# 长时间稳定性测试
npm run smoke:provider:long
```

### Step 3: 测试 JSON 解析

```bash
# 运行 AI Schema 测试
node --test test/aiSchemas.test.js

# 运行 AI 评估 fixtures 测试
node --test test/aiEvalFixtures.test.js
```

### Step 4: 切换 Provider 对比测试

```bash
# 方法 1: 临时切换环境变量
AI_PROVIDER=mock npm test
AI_PROVIDER=openai npm test
AI_PROVIDER=deepseek npm test

# 方法 2: 在 .env 中修改
# AI_PROVIDER=mock  ← 改为此值测试
```

### Step 5: 检查 Mock 降级

```bash
# 双模式验收测试 (Mock + 真实 Provider 对比)
npm run smoke:dual-mode
```

## 常见问题排查

### 问题 1: JSON 解析失败

**症状**: `Model did not return valid JSON`

**排查**:
1. 检查 `src/ai/schemas.js` 中的 schema 定义是否匹配
2. 检查 `src/utils/json.js` 中的 `parseJsonFromText()` 是否正确处理 code fence
3. 在 `test/aiEvalFixtures.test.js` 中添加对应的 fixture

**修复**:
- 如果是 schema 过严: 放宽 `additionalProperties` 或 `required` 字段
- 如果是 prompt 问题: 调整 `src/ai/prompts.js` 中的输出格式指令

### 问题 2: Provider 超时

**症状**: `AI provider xxx attempt 1 failed: timeout`

**排查**:
1. 检查网络连接
2. 检查 API key 是否有效
3. 检查 `src/ai/providers/remoteHelpers.js` 中的超时配置

**修复**:
- 增加超时时间
- 减少 prompt 长度
- 使用 streaming 模式 (`supportsStreaming`)

### 问题 3: Mock 正常但真实 Provider 失败

**症状**: `npm run smoke:dual-mode` 报告差异

**排查**:
1. 对比 Mock 和真实 provider 的返回格式
2. 检查 `wrapWithMockFallback()` 的降级逻辑
3. 查看 `test/aiControlRedTeam.test.js` 中的安全测试

### 问题 4: MiMo+DeepSeek 混合路由问题

**症状**: `mimo-deepseek` provider 的特定方法失败

**排查**:
1. 检查 `src/ai/providers/mimoDeepseek.js` 中的路由逻辑
2. MiMo 负责: startGame / runTurn / streamTurn / generateExamQuestion
3. DeepSeek 负责: gradeExamEssay
4. 检查对应的环境变量: `MIMO_*` 和 `DEEPSEEK_*`

## Provider 测试矩阵

| 测试类型 | mock | openai | deepseek | mimo | mimo-deepseek | anthropic |
|----------|------|--------|----------|------|---------------|-----------|
| 基本连通 | ✅ | 需key | 需key | 需key | 需key | 需key |
| JSON 验证 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Schema 测试 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 双模式对比 | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| 冒烟测试 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

> **安全提醒**: 不要在代码或日志中打印 API key。`.env` 已被 gitignore。

## 新增 Provider 指南

如需添加新 provider:

1. 创建 `src/ai/providers/newProvider.js`
2. 实现以下方法: `startGame`, `runTurn`, `generateExamQuestion`, `gradeExamEssay`
3. 在 `src/ai/index.js` 的 `PROVIDERS` 对象中注册
4. 在 `src/ai/index.js` 的 `PROVIDER_ALIASES` 中添加别名（如需要）
5. 添加对应的测试: `test/newProvider.test.js`
6. 更新本文档的 Provider 测试矩阵
7. 更新 `docs/SHARED_CONTEXT.md` 的 AI providers 列表
```

---

## 6. P2-A: 游戏状态验证技能

### 6.1 为什么需要

千秋的核心是状态管理。`src/ai/schemas.js` (479 行) 定义了 AI 输出的 JSON Schema，`src/game/stateRules.js` 定义了数值边界。这个技能帮助系统性地维护和扩展这些验证规则。

### 6.2 技能定义

**文件**: `.skills/game-state-validation.md`

```markdown
# 游戏状态验证技能 — 千秋项目

## 触发条件

当以下情况发生时使用本技能：
- 新增游戏数据域（如新的属性、新的实体类型）
- 修改 AI 可以修改的字段（statePatch）
- 发现 AI 返回的 JSON 被错误拒绝或错误接受
- 新增科举、官职、经济等子系统

## 验证架构

```
验证层级:
  1. JSON 解析       → src/utils/json.js (parseJsonFromText)
  2. Schema 验证     → src/ai/schemas.js (validatePayload)
  3. 数值边界        → src/game/stateRules.js (NUMERIC_RANGES + applyStatePatch)
  4. 业务规则        → src/game/*.js (各领域模块)
  5. 服务器裁决      → src/routes/*.js (API 路由层)
```

## 关键文件说明

### src/ai/schemas.js — AI 输出 Schema

这是 AI 返回 JSON 的"契约"。所有 AI 输出必须通过 `validatePayload()` 验证。

**核心 Schema 列表**:
- `turnResponseSchema` — 每回合 AI 返回（叙事 + statePatch + 关系变化 + 事件 + 考试触发）
- `examQuestionSchema` — 科举题目
- `examGradeSchema` — 科举评分（含真实性检查）
- `startGameResponseSchema` — 游戏初始化

**添加新字段的步骤**:

1. 在对应的 schema 的 `properties` 中添加字段定义
2. 如果是 AI 可修改的字段，在 `statePatchSchema` 中注册
3. 在 `src/game/stateRules.js` 的 `NUMERIC_RANGES` 中添加数值范围
4. 在 `test/aiSchemas.test.js` 中添加测试用例
5. 在 `test/aiEvalFixtures.test.js` 或 `testdata/aiEvalFixtures.js` 中添加 fixture

### src/game/stateRules.js — 数值边界

`NUMERIC_RANGES` 定义了所有数值字段的合法范围 `[min, max]`。

**当前覆盖的字段** (约 40+):
- 时间: year, month, tenDayPeriod
- 属性: health, academia, literaryTalent, adaptability, mentality, reputation, ...
- 经济: treasury, grainReserve, population, publicOrder, taxRate, corruption
- 军事: armySize, armyMorale, borderThreat, troops, supply, ...
- 官场: courtControl, mandate, influence, integrity, superiorFavor, ...
- 地方: localTreasury, localOrder, gentryRelations, banditPressure, ...

**添加新数值字段**:

```javascript
// 在 NUMERIC_RANGES 中添加:
"newFieldName": [最小值, 最大值]
```

### src/game/stateRules.js — applyStatePatch

`applyStatePatch()` 负责将 AI 提出的 statePatch 安全地应用到游戏状态。

**安全机制**:
- 只处理 `statePatchSchema` 中注册的字段
- 对数值字段使用 `Math.max(min, Math.min(max, value))` 进行 clamp
- 拒绝未知字段

## 验证测试模式

### 单元测试模式 (test/aiSchemas.test.js)

```javascript
test("turn schema accepts whitelisted state patches", () => {
  const payload = {
    narrative: "A turn happened.",
    statePatch: { publicOrder: 72 },
    attributeChanges: [],
    relationshipChanges: [],
    events: ["event"],
    examTrigger: { shouldStart: false, level: null, reason: "" }
  };
  const result = validatePayload("turn", payload);
  assert.equal(result.valid, true);
});

test("turn schema rejects unknown statePatch fields", () => {
  const payload = {
    narrative: "A turn happened.",
    statePatch: { unknownField: 999 },  // 未注册字段
    // ...
  };
  const result = validatePayload("turn", payload);
  assert.equal(result.valid, false);
});
```

### 红队测试模式 (test/aiControlRedTeam.test.js)

测试 AI 是否被正确约束：
- 不能直接修改 canonical 状态
- 不能泄露 hidden 信息
- 不能绕过服务器裁决

### 边界测试模式

```javascript
test("数值字段 clamp 到合法范围", () => {
  const state = createInitialState();
  applyStatePatch(state, { health: 150 });  // 超出 [0, 100]
  assert.equal(state.player.health, 100);    // 被 clamp

  applyStatePatch(state, { health: -10 });
  assert.equal(state.player.health, 0);      // 被 clamp
});
```

## 新增数据域检查清单

当新增一个数据域（如 S68 科举深化）时：

- [ ] 在 `src/ai/schemas.js` 添加新的 schema 或扩展现有 schema
- [ ] 在 `src/game/stateRules.js` 的 `NUMERIC_RANGES` 添加数值范围
- [ ] 在 `src/game/stateRules.js` 的 `applyStatePatch` 中处理新字段（如适用）
- [ ] 创建对应的 `test/*.test.js` 测试文件
- [ ] 在 `testdata/` 下添加 eval fixtures（如需要红队测试）
- [ ] 更新 `docs/*_CONTRACT.md` 契约文档
- [ ] 运行 `npm test` 确认所有测试通过
- [ ] 运行 `npm run smoke:dual-mode` 确认 Mock 和真实 provider 一致
```

---

## 7. P2-B: 文档同步检查技能

### 7.1 为什么需要

千秋项目有极其完善的文档治理（`checkGovernanceDocs.js` + `documentationGovernance.test.js`），但检查范围可以扩展。

### 7.2 技能定义

**文件**: `.skills/doc-sync-check.md`

```markdown
# 文档同步检查技能 — 千秋项目

## 触发条件

当以下情况发生时使用本技能：
- 完成一个 roadmap step
- 修改了游戏逻辑或 AI 集成
- 准备进行 coherent commit

## 现有检查

项目已有以下自动化检查：

```bash
npm run check:docs-governance   # scripts/checkGovernanceDocs.js
npm test                         # 包含 test/documentationGovernance.test.js
```

这些检查覆盖：
- DEVELOPMENT_GOVERNANCE.md 的保护段落完整性
- 活动路线图中的必守规则
- 必读文档的存在性

## 扩展检查清单

在现有检查之上，还需手动确认：

### A. SHARED_CONTEXT.md 同步

- [ ] `Current Snapshot` 中的产品描述是否准确
- [ ] `Current Snapshot` 中的 runtime target 是否正确
- [ ] `Current Snapshot` 中的 active roadmap 是否是最新的
- [ ] `Core Invariants` 是否需要新增条目
- [ ] `Content Protection` 是否需要更新

### B. DEVELOPMENT_STEPS.md 同步

- [ ] 本次步骤的 ID 是否已记录
- [ ] 完成内容是否清晰描述
- [ ] 验证结果是否记录（测试通过数、冒烟测试结果）
- [ ] 提交哈希是否填写

### C. 契约文档同步

如果修改涉及数据域：
- [ ] 对应的 `docs/*_CONTRACT.md` 是否已创建/更新
- [ ] 契约中的字段定义是否与代码一致
- [ ] 契约中的边界值是否与 `NUMERIC_RANGES` 一致

### D. AGENTS.md / CLAUDE.md 同步

如果修改了工作流：
- [ ] `Mandatory Workflow` 部分是否需要更新
- [ ] `Coding Preferences` 部分是否需要更新
- [ ] 两个文件的指令是否一致

## 快速验证命令

```bash
# 一键检查所有文档同步状态
echo "=== 治理检查 ===" && npm run check:docs-governance && \
echo "=== 测试套件 ===" && npm test && \
echo "=== Git 状态 ===" && git status --short && \
echo "=== SHARED_CONTEXT 最后更新 ===" && git log -1 --format="%h %ai %s" -- docs/SHARED_CONTEXT.md && \
echo "=== DEVELOPMENT_STEPS 最后更新 ===" && git log -1 --format="%h %ai %s" -- docs/DEVELOPMENT_STEPS.md
```
```

---

## 8. TDD 适配专题

### 8.1 核心问题

千秋项目**不适合传统 TDD**，原因如下：

| 传统 TDD 假设 | 千秋项目现实 |
|--------------|-------------|
| 输入 → 输出确定性 | AI 输出是非确定性的 |
| 测试先行写代码 | 很多逻辑是 AI prompt → JSON → 状态转换 |
| 单元测试覆盖核心逻辑 | 核心逻辑分散在 AI prompt、schema 验证、状态规则中 |
| Mock 是测试替身 | Mock 是**默认可玩模式**，不是测试替身 |

### 8.2 千秋的实际测试策略

千秋项目采用的是**三层测试策略**，这不是传统 TDD 但更适合 AI-first 架构：

```
第一层: 确定性逻辑测试 (传统单元测试)
├── test/examRules.test.js        — 科举规则
├── test/economicFiscal.test.js   — 财政逻辑
├── test/officialCareer.test.js   — 官职逻辑
└── ... (大部分 test/*.test.js)
    → 这些可以用 TDD 方式开发

第二层: Schema 验证测试 (AI 契约测试)
├── test/aiSchemas.test.js        — JSON Schema 验证
├── test/aiEvalFixtures.test.js   — AI 输出评估
└── test/aiControlRedTeam.test.js — 安全边界
    → 这些是"AI 输出契约"测试，不是 TDD

第三层: 集成/冒烟测试
├── test/dualModeAcceptanceScript.test.js
├── test/browserSmokeScript.test.js
├── test/providerRouteHealth.test.js
└── test/providerLongRun.test.js
    → 这些是端到端验证，不是 TDD
```

### 8.3 哪些部分可以用 TDD

**适合 TDD 的模块** (确定性逻辑):

| 模块 | 文件 | 原因 |
|------|------|------|
| 科举规则 | `src/game/exams.js` | 纯规则判断，输入输出确定 |
| 财政计算 | `src/game/economicFiscal.js` | 数值计算，边界明确 |
| 官职系统 | `src/game/officialCareer.js` | 状态机，转换确定 |
| 数值边界 | `src/game/stateRules.js` | clamp 逻辑，纯函数 |
| 候选人生成 | `src/game/candidates.js` | 虚拟候选人生成逻辑 |
| 作弊检测 | `src/game/essayChecks.js` | 文本检查规则 |
| JSON 解析 | `src/utils/json.js` | 字符串处理，确定性 |

**不适合 TDD 的模块** (AI 驱动):

| 模块 | 文件 | 原因 |
|------|------|------|
| AI 叙事生成 | `src/ai/prompts.js` | 输出由 AI 模型决定 |
| 评分逻辑 | `src/ai/providers/*.js` | 评分由 AI 模型决定 |
| Prompt 组装 | `src/ai/promptContextAssembler.js` | 依赖 AI 理解能力 |
| 世界观引擎 | 整体架构 | AI 是核心引擎 |

### 8.4 推荐的混合开发流程

```
对确定性模块 (如 exams.js):
  1. 先写测试 (RED)
  2. 实现代码 (GREEN)
  3. 重构 (REFACTOR)
  → 标准 TDD

对 AI 驱动模块 (如 prompts.js):
  1. 先定义 Schema (契约)
  2. 实现 prompt
  3. 用真实/Mock AI 运行
  4. 用 eval fixtures 验证输出
  5. 用 red team 测试安全边界
  → 契约驱动开发 (Contract-Driven Development)

对混合模块 (如 exams + AI 评分):
  1. TDD 实现确定性部分 (考试资格、晋级规则)
  2. 契约驱动实现 AI 部分 (题目生成、评分)
  3. 集成测试验证协作
  → 混合模式
```

### 8.5 TDD 集成技能（如果要添加）

**文件**: `.skills/tdd-hybrid.md`

```markdown
# 混合 TDD 技能 — 千秋项目

## 开发新功能的决策树

```
新功能 → 是否涉及 AI 输出?
  ├── 否 → 使用 TDD (RED-GREEN-REFACTOR)
  └── 是 → 是否有确定性子逻辑?
       ├── 是 → 确定性部分用 TDD，AI 部分用契约驱动
       └── 否 → 纯契约驱动开发
```

## TDD 流程 (确定性模块)

### RED 阶段
1. 在 `test/` 创建测试文件
2. 写失败的测试用例
3. 运行 `node --test test/xxx.test.js` 确认失败

### GREEN 阶段
1. 在 `src/` 实现最小代码使测试通过
2. 运行 `node --test test/xxx.test.js` 确认通过
3. 运行 `npm test` 确认不破坏现有测试

### REFACTOR 阶段
1. 改善代码质量
2. 确保测试仍然通过
3. 检查是否需要更新文档

## 契约驱动流程 (AI 模块)

### 定义契约
1. 在 `src/ai/schemas.js` 定义 JSON Schema
2. 在 `docs/*_CONTRACT.md` 记录契约语义

### 实现 + 验证
1. 实现 prompt 或 provider 逻辑
2. 在 `testdata/aiEvalFixtures.js` 添加测试 fixture
3. 在 `test/aiEvalFixtures.test.js` 添加验证用例
4. 运行 `node --test test/aiSchemas.test.js`
5. 运行 `node --test test/aiEvalFixtures.test.js`

### 安全验证
1. 在 `test/aiControlRedTeam.test.js` 添加红队测试
2. 测试: AI 不能绕过 schema
3. 测试: AI 不能泄露 hidden 信息
4. 测试: AI 不能直接修改 canonical 状态

## 测试命名规范

```
test/{模块名}.test.js
  - {功能} accepts {合法输入}
  - {功能} rejects {非法输入}
  - {功能} clamps {边界值}
  - {功能} preserves {不变量}

test/aiEvalFixtures.test.js
  - {schema名} accepts valid {场景}
  - {schema名} rejects invalid {场景}
  - red team: {攻击描述}
```
```

---

## 9. 验证清单

完成所有配置后，运行以下验证：

```bash
# 1. 确认技能文件存在
ls -la .skills/
# 应该看到: code-review.md, ai-provider-debug.md, game-state-validation.md, doc-sync-check.md

# 2. 确认 Hooks 配置存在
cat .scale-hooks.yaml

# 3. 确认 Codex 配置存在
cat .codex/config.toml

# 4. 确认所有测试仍然通过
npm test

# 5. 确认文档治理检查仍然通过
npm run check:docs-governance

# 6. 确认 Mock 模式可玩
npm start
# 浏览器打开 http://localhost:3000 确认可以正常游玩

# 7. 确认 Codex 可以识别技能
codex --help  # 确认 codex 命令可用
```

---

## 10. 回滚策略

如果配置出现问题：

```bash
# 删除 SCALE OS 相关文件
rm -rf .skills/
rm -f .scale-hooks.yaml
rm -f .codex/config.toml

# 删除克隆的引擎（如果存在）
rm -rf /tmp/scale-engine

# 项目本身不受影响，因为这些都是新增文件
npm test  # 确认测试仍然通过
```

---

## 附录: 文件清单

配置完成后，项目新增以下文件：

```
/mnt/e/LSMNQ/
├── .skills/                        # [新增] SCALE OS 技能目录
│   ├── code-review.md              # 代码审查技能
│   ├── ai-provider-debug.md        # AI Provider 调试技能
│   ├── game-state-validation.md    # 游戏状态验证技能
│   └── doc-sync-check.md           # 文档同步检查技能
├── .codex/                         # [新增] Codex CLI 配置目录
│   └── config.toml                 # Codex 配置
├── .scale-hooks.yaml               # [新增] Hooks 配置
└── docs/
    └── SCALE_OS_INTEGRATION_GUIDE.md  # [新增] 本文档
```

> **重要**: `.skills/` 和 `.codex/` 应该加入 `.gitignore` 还是提交到仓库？
> 建议: 提交到仓库。这样团队中的其他 AI agent (Claude Code) 也能使用这些技能。
> 如果包含敏感配置（如 API key），则加入 `.gitignore`。

---

*本文档由 Hermes Agent 生成，基于 SCALE OS v10.1 方法论。*
*最后更新: 2026-05-11*
