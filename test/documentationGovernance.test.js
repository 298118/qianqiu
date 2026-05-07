const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");

test("documentation governance guard passes", () => {
  const result = spawnSync(process.execPath, ["scripts/checkGovernanceDocs.js"], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
