const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function publicAppSource() {
  return readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");
}

test("save-load narrative replay uses safe event archive projection", () => {
  const source = publicAppSource();

  assert.match(source, /const history = archiveNarrativeEntriesFromPayload\(payload\);/);
  assert.match(source, /function archiveNarrativeEntriesFromPayload\(payload\)/);
  assert.match(source, /eventArchiveView/);
  assert.doesNotMatch(source, /const history = payload\.worldState\.eventHistory/);
});
