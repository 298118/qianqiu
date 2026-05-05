const test = require("node:test");
const assert = require("node:assert/strict");

const { chunkTextForSse, formatSseEvent } = require("../src/utils/sse");

test("formatSseEvent writes named events with data lines", () => {
  assert.equal(
    formatSseEvent("narrative_chunk", "line one\nline two"),
    "event: narrative_chunk\ndata: line one\ndata: line two\n\n"
  );
});

test("formatSseEvent JSON-encodes object payloads and sanitizes event names", () => {
  assert.equal(
    formatSseEvent("bad\nevent", { ok: true }),
    'event: message\ndata: {"ok":true}\n\n'
  );
});

test("chunkTextForSse splits narrative text into stable chunks", () => {
  assert.deepEqual(chunkTextForSse("abcdef", 2), ["ab", "cd", "ef"]);
  assert.deepEqual(chunkTextForSse("", 2), []);
});
