#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function getProtectedBlock(relativePath, startMarker, endMarker, failures) {
  const text = readText(relativePath);
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);

  if (start === -1 || end === -1 || end <= start) {
    failures.push(`${relativePath}: missing protected block ${startMarker} ... ${endMarker}`);
    return "";
  }

  return text.slice(start, end + endMarker.length);
}

function requireIncludes(label, text, needles, failures) {
  for (const needle of needles) {
    if (!text.includes(needle)) {
      failures.push(`${label}: missing required text: ${needle}`);
    }
  }
}

function requireFileIncludes(relativePath, needles, failures) {
  requireIncludes(relativePath, readText(relativePath), needles, failures);
}

function defaultTestScriptIncludesGovernance(testScript) {
  if (typeof testScript !== "string" || !/\bnode\s+--test\b/.test(testScript)) {
    return false;
  }

  const explicitTestFiles = testScript.match(/(?:^|\s)test[\\/][^\s]*\.test\.js/g) || [];
  if (explicitTestFiles.length === 0) {
    return true;
  }

  if (explicitTestFiles.some((entry) => entry.trim().replaceAll("\\", "/") === "test/*.test.js")) {
    return true;
  }

  return explicitTestFiles.some((entry) =>
    entry.trim().replaceAll("\\", "/").includes("test/documentationGovernance.test.js")
  );
}

function runGovernanceChecks() {
  const failures = [];

  const canonicalBlock = getProtectedBlock(
    "docs/DEVELOPMENT_GOVERNANCE.md",
    "<!-- GOVERNANCE_CANONICAL_START -->",
    "<!-- GOVERNANCE_CANONICAL_END -->",
    failures
  );

  requireIncludes(
    "docs/DEVELOPMENT_GOVERNANCE.md protected block",
    canonicalBlock,
    [
      "用户已明确授权 Codex 在本仓库使用子代理",
      "git status --short",
      "关键决策不能只留在聊天记录里",
      "Mock AI 必须默认完整可玩",
      "scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official",
      "不以“最小实现点”或“最小改动点”为目标",
      "复杂功能必须坚持前后端分离和大步骤拆分",
      "前端不得代替服务器裁决资源、身份、交易、NPC 行动、经济结果或隐藏信息",
      "后端契约、API/view 类型、安全 projection",
      "TS 类型也不能替代 Ajv 与服务器 runtime 校验",
      "route/API response shape",
      "src/contracts/serverContracts.ts",
      "npm run typecheck:server",
      "whole-file `@ts-check` 大型 route 文件",
      "raw ledger 剥离",
      "AI 是《千秋》的核心世界引擎",
      "工具权限、proposal 边界、服务器裁决、审计记录和 Mock/no-key 降级",
      "服务器拥有状态边界、时间推进、科举晋级、作弊处罚",
      "可调参数不得散落为魔法数字",
      "src/config/GameConfig.js",
      "优先使用中文",
      "不得运行 `git add`、`git commit`、`git push` 或创建 PR",
      "只读子代理审查最终 diff 与验证证据",
      "风险、遗漏、测试缺口和建议",
      "低风险纯文档改动可跳过子代理复审",
      "依赖、插件与开源参考治理",
      "React + TypeScript + Vite",
      "npm run check:docs-governance",
      "npm test"
    ],
    failures
  );

  const roadmapBlock = getProtectedBlock(
    "docs/DEVELOPMENT_STEPS.md",
    "<!-- GOVERNANCE_REQUIRED_START -->",
    "<!-- GOVERNANCE_REQUIRED_END -->",
    failures
  );

  requireIncludes(
    "docs/DEVELOPMENT_STEPS.md protected block",
    roadmapBlock,
    [
      "docs/DEVELOPMENT_GOVERNANCE.md",
      "用户已明确授权 Codex 在本仓库使用子代理",
      "关键决策不能只留在聊天记录里",
      "Mock AI 默认完整可玩",
      "scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official",
      "不以“最小实现点”或“最小改动点”为目标",
      "复杂功能必须坚持前后端分离和大步骤拆分",
      "前端不得代替服务器裁决资源、身份、交易、NPC 行动、经济结果或隐藏信息",
      "后端契约、API/view 类型、安全 projection",
      "TS 类型也不能替代 Ajv 与服务器 runtime 校验",
      "route/API response shape",
      "src/contracts/serverContracts.ts",
      "npm run typecheck:server",
      "whole-file `@ts-check` 大型 route 文件",
      "raw ledger 剥离",
      "AI 是《千秋》的核心世界引擎",
      "工具权限、proposal 边界、服务器裁决、审计记录和 Mock/no-key 降级",
      "服务器继续拥有时间推进",
      "可调参数不得散落为魔法数字",
      "src/config/GameConfig.js",
      "优先使用中文",
      "不得运行 `git add`、`git commit`、`git push` 或创建 PR",
      "只读子代理审查最终 diff 与验证证据",
      "风险、遗漏、测试缺口和建议",
      "依赖、插件与开源参考治理",
      "AI_CONTROL_AUDIT_MATRIX.md"
    ],
    failures
  );

  const governanceReference = ["docs/DEVELOPMENT_GOVERNANCE.md"];
  for (const relativePath of [
    "AGENTS.md",
    "CLAUDE.md",
    "README.md",
    "docs/SHARED_CONTEXT.md",
    "docs/QIANQIU_DEVELOPMENT_BRIEF.md",
    "docs/DEVELOPMENT_STEPS.md"
  ]) {
    requireFileIncludes(relativePath, governanceReference, failures);
  }
  const frontendBackendSeparationNeedles = [
    "复杂功能必须坚持前后端分离和大步骤拆分",
    "前端不得代替服务器裁决资源、身份、交易、NPC 行动、经济结果或隐藏信息"
  ];
  for (const relativePath of [
    "AGENTS.md",
    "CLAUDE.md",
    "docs/SHARED_CONTEXT.md",
    "docs/QIANQIU_DEVELOPMENT_BRIEF.md"
  ]) {
    requireFileIncludes(relativePath, frontendBackendSeparationNeedles, failures);
  }
  requireFileIncludes(
    "README.md",
    ["后续施工必须前后端分离", "先做后端/API/数据/AI 契约"],
    failures
  );
  const routeResponseTypeNeedles = [
    "route/API response shape",
    "src/contracts/serverContracts.ts",
    "npm run typecheck:server",
    "whole-file `@ts-check` 大型 route 文件"
  ];
  for (const relativePath of [
    "AGENTS.md",
    "CLAUDE.md",
    "docs/SHARED_CONTEXT.md",
    "docs/QIANQIU_DEVELOPMENT_BRIEF.md",
    "docs/DEVELOPMENT_STEPS.md"
  ]) {
    requireFileIncludes(relativePath, routeResponseTypeNeedles, failures);
  }
  requireFileIncludes(
    "README.md",
    ["TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ROADMAP.md", "route/API response shape"],
    failures
  );
  requireFileIncludes(
    "docs/SHARED_CONTEXT.md",
    ["magic numbers", "src/config/GameConfig.js"],
    failures
  );
  requireFileIncludes(
    "docs/QIANQIU_DEVELOPMENT_BRIEF.md",
    ["魔法数字", "src/config/GameConfig.js"],
    failures
  );

  const packageJson = JSON.parse(readText("package.json"));
  if (packageJson.scripts?.["check:docs-governance"] !== "node scripts/checkGovernanceDocs.js") {
    failures.push("package.json: missing check:docs-governance script");
  }
  if (!defaultTestScriptIncludesGovernance(packageJson.scripts?.test)) {
    failures.push("package.json: npm test must run node --test without excluding test/documentationGovernance.test.js");
  }

  requireFileIncludes("test/documentationGovernance.test.js", ["checkGovernanceDocs.js"], failures);

  return failures;
}

if (require.main === module) {
  const failures = runGovernanceChecks();

  if (failures.length > 0) {
    console.error("Documentation governance check failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Documentation governance check passed.");
}

module.exports = {
  runGovernanceChecks
};
