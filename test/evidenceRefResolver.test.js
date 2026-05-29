const test = require("node:test");
const assert = require("node:assert/strict");

const {
  EVIDENCE_REF_SCHEMA_VERSION,
  buildEvidenceRef,
  buildEvidenceRefsFromRetrievalContext,
  hasUnsafeEvidenceText,
  resolveEvidenceRef
} = require("../src/ai/retrieval/evidenceRefResolver");

test("evidenceRefResolver builds stable public-safe evidence refs", () => {
  const row = {
    id: "city-beijing",
    sourceView: "worldGeography.city",
    name: "北京",
    statusLabel: "京师",
    visibility: "player_visible",
    publicSummary: "京师钱粮与官署线索公开可查。",
    priority: 42
  };
  const ref = buildEvidenceRef(row, { generatedAtTurn: 8 });
  const again = buildEvidenceRef(row, { generatedAtTurn: 8 });

  assert.equal(ref.schemaVersion, EVIDENCE_REF_SCHEMA_VERSION);
  assert.equal(ref.refId, again.refId);
  assert.equal(ref.sourceView, "worldGeography.city");
  assert.equal(ref.domain, "geography");
  assert.equal(ref.collection, "cities");
  assert.equal(ref.visibility, "player_visible");
  assert.equal(ref.generatedAtTurn, 8);
  assert.match(ref.refId, /^eref:worldGeography\.city:[a-f0-9]{14}$/);
  assert.match(ref.summary, /京师钱粮/);
});

test("evidenceRefResolver rejects hidden/private rows and raw provider pollution", () => {
  assert.equal(buildEvidenceRef({
    id: "city-private",
    sourceView: "worldGeography.city",
    visibility: "private",
    name: "私档城市",
    publicSummary: "这行即使文字干净也不该进入证据。"
  }), null);

  assert.equal(buildEvidenceRef({
    id: "city-hidden",
    sourceView: "worldGeography.city",
    visibility: "hidden",
    name: "隐藏城市",
    publicSummary: "公开字样"
  }), null);

  assert.equal(buildEvidenceRef({
    id: "raw-table-row",
    sourceView: "rawBusinessTable.row",
    visibility: "public",
    name: "伪造 raw table 来源",
    publicSummary: "文字干净但 sourceView 不在 allowlist。"
  }), null);

  assert.equal(buildEvidenceRef({
    id: "city-polluted",
    sourceView: "worldGeography.city",
    visibility: "public",
    name: "污染城市",
    publicSummary: "raw provider payload prompt_retrieval_index E:\\secret\\row.json sk-test-secret-123456"
  }), null);

  assert.equal(buildEvidenceRef({
    id: "city-header-polluted",
    sourceView: "worldGeography.city",
    visibility: "public",
    name: "头信息污染城市",
    publicSummary: "headers Authorization Bearer abcdefghijkl baseURL=https://api.example.test/v1 key=plainsecret token=plain-token /home/user/.env"
  }), null);

  assert.equal(hasUnsafeEvidenceText("providerPayload hiddenNotes prompt_retrieval_index sk-test-secret-123456"), true);
  assert.equal(hasUnsafeEvidenceText("headers Authorization Bearer abcdefghijkl"), true);
});

test("evidenceRefResolver ranks retrieval context refs and resolves only safe refs", () => {
  const context = {
    generatedAtTurn: 9,
    query: { terms: ["北京", "户部"] },
    geography: {
      cities: [{
        sourceView: "worldGeography.city",
        priority: 60,
        id: "city-beijing",
        name: "北京",
        publicSummary: "北京为京师，户部钱粮案牍汇集。",
        visibility: "public"
      }, {
        sourceView: "worldGeography.city",
        priority: 1000,
        id: "city-unsafe",
        name: "SEALED_CITY",
        publicSummary: "prompt provider event_log sk-test-secret"
      }]
    },
    offices: {
      offices: [{
        sourceView: "officialPostings.office",
        priority: 120,
        id: "ministry-revenue",
        title: "户部主事",
        publicSummary: "户部主事只读公开任所摘要。",
        visibility: "actor_visible"
      }]
    }
  };

  const refs = buildEvidenceRefsFromRetrievalContext(context, { maxRefs: 4 });
  const serialized = JSON.stringify(refs);

  assert.equal(refs.length, 2);
  assert.equal(refs[0].sourceView, "officialPostings.office");
  assert.deepEqual(refs.map((ref) => ref.rank), [1, 2]);
  assert.equal(resolveEvidenceRef(refs[0].refId, refs), refs[0]);
  assert.equal(resolveEvidenceRef("eref:bad:prompt_retrieval_index", refs), null);
  assert.doesNotMatch(serialized, /SEALED_CITY|prompt|provider|event_log|sk-test-secret/);
});
