const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildPublicAuditProjectionItems,
  buildPublicAuditProjectionView
} = require("../src/game/auditPublicProjection");

function publicEvent(overrides = {}) {
  return {
    eventId: "audit-event-1",
    revision: 2,
    turnCount: 8,
    year: 1644,
    month: 3,
    tenDayPeriod: 2,
    sceneCadence: "ordinary_turn",
    sourceSystem: "game_turn",
    eventType: "turn_completed",
    visibility: "public",
    summary: "县学议事已公开入档。",
    related: {
      eventHistoryCount: 4,
      hiddenNotes: "SEALED_AUDIT_HIDDEN_NOTE",
      localPath: "E:\\LSMNQ\\data\\audit\\x.jsonl"
    },
    appliedChanges: {
      turnCount: 8,
      statePatch: { worldState: "SEALED_AUDIT_STATE_PATCH" },
      apiKey: "sk-proj-audit-public-secret-123456"
    },
    createdAt: "2026-05-08T12:00:00.000Z",
    ...overrides
  };
}

test("public audit projection keeps only safe public audit summaries", () => {
  const projection = buildPublicAuditProjectionView({
    aiProposalCount: 3,
    auditEvents: [
      publicEvent({
        createdAt: "E:\\LSMNQ\\data\\audit\\created-at.jsonl sk-proj-created-at-secret-123456"
      }),
      publicEvent({
        eventId: "audit-event-private",
        visibility: "developer",
        summary: "SEALED_DEVELOPER_AUDIT"
      }),
      publicEvent({
        eventId: "audit-event-sensitive",
        summary: "prompt provider proposal event_log data/audit sk-proj-sensitive-audit-123456"
      })
    ],
    metadata: {
      dynasty: "明",
      year: 1644,
      month: 3,
      tenDayPeriod: 2,
      turnCount: 8
    },
    sessionId: "00000000-0000-4000-8000-000000000001"
  });
  const serialized = JSON.stringify(projection);

  assert.equal(projection.schemaVersion, 1);
  assert.equal(projection.counts.auditEvents, 3);
  assert.equal(projection.counts.aiProposals, 3);
  assert.equal(projection.counts.projectedItems, 1);
  assert.equal(projection.counts.droppedNonPublic, 1);
  assert.equal(projection.counts.droppedSensitiveOrEmpty, 1);
  assert.equal(projection.items[0].sourceType, "audit_public_event");
  assert.equal(projection.items[0].title, "回合结算");
  assert.equal(projection.items[0].createdAt, null);
  assert.match(projection.items[0].dateLabel, /明1644年三月中旬/);
  assert.match(serialized, /县学议事已公开入档/);
  assert.match(serialized, /近事:4/);

  for (const blocked of [
    "SEALED_DEVELOPER_AUDIT",
    "SEALED_AUDIT_HIDDEN_NOTE",
    "SEALED_AUDIT_STATE_PATCH",
    "sk-proj-created-at-secret",
    "sk-proj-sensitive-audit",
    "event_log",
    "data/audit",
    "statePatch",
    "worldState",
    "E:\\LSMNQ"
  ]) {
    assert.equal(serialized.includes(blocked), false, `${blocked} should not enter projection`);
  }
});

test("public audit projection helper returns sorted safe items and drop counts", () => {
  const result = buildPublicAuditProjectionItems([
    publicEvent({ eventId: "older", turnCount: 5, summary: "较早公开审计。" }),
    publicEvent({ eventId: "newer", turnCount: 7, summary: "较晚公开审计。" }),
    publicEvent({ eventId: "private", visibility: "private", summary: "SEALED_PRIVATE_AUDIT" })
  ]);

  assert.deepEqual(result.items.map((item) => item.summary), ["较晚公开审计。", "较早公开审计。"]);
  assert.equal(result.dropped.nonPublicVisibility, 1);
  assert.equal(result.dropped.sensitiveOrEmptySummary, 0);
});
