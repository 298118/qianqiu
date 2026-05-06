const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createJsonStringFieldExtractor,
  findStringFieldValueStart,
  readJsonStringPrefix
} = require("../src/utils/streamingJson");

test("findStringFieldValueStart locates a JSON string field value", () => {
  assert.equal(findStringFieldValueStart('{"narrative":"text"}', "narrative"), 14);
  assert.equal(findStringFieldValueStart('{"other":"narrative","narrative" : "text"}', "narrative"), 36);
  assert.equal(findStringFieldValueStart('{"narrative":42}', "narrative"), -1);
});

test("readJsonStringPrefix decodes complete and partial string values", () => {
  assert.deepEqual(
    readJsonStringPrefix('hello\\" court\\nline"', 0),
    { complete: true, text: 'hello" court\nline' }
  );
  assert.deepEqual(
    readJsonStringPrefix("mountain \\u5c71 and unfinished \\u5", 0),
    { complete: false, text: "mountain 山 and unfinished " }
  );
});

test("createJsonStringFieldExtractor streams narrative deltas across chunk boundaries", () => {
  const chunks = [];
  const extractor = createJsonStringFieldExtractor("narrative", (delta) => chunks.push(delta));

  [
    "{\"statePatch\":{},",
    "\"narr",
    "ative\":\"松下问",
    "\\\"策\\\"，",
    "又记\\n一行",
    "文字\",\"events\":[]}"
  ].forEach((chunk) => extractor.push(chunk));

  assert.equal(chunks.join(""), "松下问\"策\"，又记\n一行文字");
  assert.equal(extractor.isComplete(), true);
});
