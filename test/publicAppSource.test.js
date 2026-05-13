const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function publicAppSource() {
  return readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");
}

function sourceBetween(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  assert.notEqual(start, -1, `${startToken} not found`);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.notEqual(end, -1, `${endToken} not found after ${startToken}`);
  return source.slice(start, end);
}

test("save-load narrative replay uses safe event archive projection", () => {
  const source = publicAppSource();

  assert.match(source, /const history = archiveNarrativeEntriesFromPayload\(payload\);/);
  assert.match(source, /function archiveNarrativeEntriesFromPayload\(payload\)/);
  assert.match(source, /eventArchiveView/);
  assert.doesNotMatch(source, /const history = payload\.worldState\.eventHistory/);
});

test("scholar study profile panel reads route studyProfileView", () => {
  const source = publicAppSource();

  assert.match(source, /let currentStudyProfileView = null;/);
  assert.match(source, /function renderStudyProfilePanel\(studyProfileView = currentStudyProfileView\)/);
  assert.match(source, /payload\.studyProfileView/);
  assert.match(source, /studyProfileView\.teacherFeedback/);
  assert.match(source, /studyProfileView\.academyNetwork/);
  assert.match(source, /studyProfileView\.smallExercises/);
  assert.match(source, /currentStudyProfileView\?\.academyNetwork\?\.teacher\?\.name/);
  assert.match(source, /appendOptionalPanel\(renderStudyProfilePanel\(\)\);/);
  assert.doesNotMatch(source, /worldState\?\.studyProfile/);
  assert.doesNotMatch(source, /worldState\.studyProfile\.teacherAdvice\.forEach/);
  assert.doesNotMatch(source, /worldState\.studyProfile\.teacherFeedback/);
  assert.doesNotMatch(source, /createPanelValue\("师承", player\.teacher/);
});

test("exam procedure panel reads route examProcedureView", () => {
  const source = publicAppSource();

  assert.match(source, /let currentExamProcedureView = null;/);
  assert.match(source, /let currentExaminerPanelView = null;/);
  assert.match(source, /let currentExamHonorView = null;/);
  assert.match(source, /function renderExamProcedurePanel\(examProcedureView = currentExamProcedureView\)/);
  assert.match(source, /function createExaminerPanelBlock\(examinerPanelView/);
  assert.match(source, /function createExamHonorBlock\(examHonorView/);
  assert.match(source, /payload\.examProcedureView/);
  assert.match(source, /payload\.examinerPanelView/);
  assert.match(source, /payload\.examHonorView/);
  assert.match(source, /examProcedureView\.rollLifecycle/);
  assert.match(source, /examProcedureView\.examinerPanelView/);
  assert.match(source, /currentExaminerPanelView/);
  assert.match(source, /currentExamHonorView/);
  assert.match(source, /createExamProcedureBlock\(payload\.examProcedureView \|\| payload\.examProcedure\)/);
  assert.match(source, /createExaminerPanelBlock\(payload\.examinerPanelView/);
  assert.match(source, /createExamHonorBlock\(payload\.examHonorView \|\| payload\.examHonor/);
  assert.match(source, /appendOptionalPanel\(renderExamProcedurePanel\(\)\);/);
  assert.match(source, /appendOptionalPanel\(createExamHonorBlock\(currentExamHonorView/);
  assert.doesNotMatch(source, /worldState\?\.examProcedure/);
  assert.doesNotMatch(source, /worldState\?\.examHonorLedger/);
  assert.doesNotMatch(source, /worldState\.activeExam\.procedure\./);
});

test("imperial exam archive panel reads route views and safe exam snapshots", () => {
  const source = publicAppSource();
  const archiveSource = sourceBetween(
    source,
    "function getLatestExamArchiveEntry()",
    "function createInformationSelect("
  );
  const appointmentBlockSource = sourceBetween(
    source,
    "function getAppointmentTrackDisplay(",
    "function renderStudyProfilePanel("
  );

  assert.match(source, /let currentAppointmentTrackView = null;/);
  assert.match(source, /const PUBLIC_APPOINTMENT_AUTHORITY =/);
  assert.match(source, /function getAppointmentTrackView\(appointmentTrackView\)/);
  assert.match(source, /function pickAppointmentTrackView\(primaryView, fallbackView\)/);
  assert.match(source, /function createAppointmentTrackBlock\(appointmentTrackView/);
  assert.match(source, /function renderImperialExamArchivePanel\(\)/);
  assert.match(source, /payload\.appointmentTrackView/);
  assert.match(source, /currentAppointmentTrackView = getAppointmentTrackView\(appointmentTrackView\);/);
  assert.match(source, /appendOptionalPanel\(renderImperialExamArchivePanel\(\)\);/);
  assert.match(appointmentBlockSource, /PUBLIC_APPOINTMENT_AUTHORITY/);
  assert.doesNotMatch(appointmentBlockSource, /appendIfText\(block, "p", display\.authorityBoundary/);

  assert.match(archiveSource, /currentStudyProfileView/);
  assert.match(archiveSource, /currentExamProcedureView/);
  assert.match(archiveSource, /currentExaminerPanelView/);
  assert.match(archiveSource, /currentExamHonorView/);
  assert.match(archiveSource, /currentRelationshipView/);
  assert.match(archiveSource, /currentWorldPeopleView/);
  assert.match(archiveSource, /currentAppointmentTrackView/);
  assert.match(archiveSource, /latestExam\?\.examNetwork/);
  assert.match(archiveSource, /latestExam\?\.appointmentTrack/);
  assert.match(archiveSource, /pickAppointmentTrackView\(currentAppointmentTrackView, latestExam\?\.appointmentTrack\)/);
  assert.match(archiveSource, /appointmentTrackView/);

  assert.doesNotMatch(archiveSource, /worldState\?\.studyProfile/);
  assert.doesNotMatch(archiveSource, /worldState\.activeExam\.procedure/);
  assert.doesNotMatch(archiveSource, /worldState\.examHonorLedger/);
  assert.doesNotMatch(archiveSource, /worldState\.appointmentTrack/);
  assert.doesNotMatch(archiveSource, /worldState\.relationshipLedger/);
  assert.doesNotMatch(archiveSource, /worldState\.eventHistory/);
  assert.doesNotMatch(archiveSource, /retrievalContext/);
  assert.doesNotMatch(archiveSource, /providerProposal|provider proposal|raw proposal|raw audit/i);
  assert.doesNotMatch(archiveSource, /prompt_retrieval_index|event_archive_index|world_state_json/);
});

test("S70.9 AI control panel reads route AI views instead of raw world state settings", () => {
  const source = publicAppSource();
  const aiPanelSource = sourceBetween(
    source,
    "function getAiSettingsView(",
    "function appendOptionalPanel("
  );

  assert.match(source, /let currentAiSettingsView = null;/);
  assert.match(source, /let currentAiInvocationSummaryView = null;/);
  assert.match(source, /function renderAiControlPanel\(aiSettingsView = currentAiSettingsView/);
  assert.match(source, /payload\.aiSettingsView/);
  assert.match(source, /payload\.aiInvocationSummaryView/);
  assert.match(source, /\/api\/ai\/settings\/\$\{currentSessionId\}/);
  assert.match(source, /appendOptionalPanel\(renderAiControlPanel\(\)\);/);

  assert.doesNotMatch(aiPanelSource, /worldState\?\.aiSettings/);
  assert.doesNotMatch(aiPanelSource, /worldState\.aiSettings/);
  assert.doesNotMatch(aiPanelSource, /raw proposal|raw audit|raw provider/i);
  assert.doesNotMatch(aiPanelSource, /retrievalContext|prompt_retrieval_index|event_archive_index|world_sessions/);
  assert.doesNotMatch(aiPanelSource, /OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY/);
});

test("S71.11 AI control audit panel reads route audit view only", () => {
  const source = publicAppSource();
  const auditPanelSource = sourceBetween(
    source,
    "function getAiControlAuditView(",
    "function appendOptionalPanel("
  );

  assert.match(source, /let currentAiControlAuditView = null;/);
  assert.match(source, /function renderAiControlAuditPanel\(aiControlAuditView = currentAiControlAuditView\)/);
  assert.match(source, /payload\.aiControlAuditView/);
  assert.match(source, /currentAiControlAuditView = getAiControlAuditView\(aiControlAuditView\);/);
  assert.match(source, /appendOptionalPanel\(renderAiControlAuditPanel\(\)\);/);
  assert.match(auditPanelSource, /publicPanel/);
  assert.match(auditPanelSource, /routeCostSummary/);
  assert.match(auditPanelSource, /toolCallSummary/);
  assert.match(auditPanelSource, /recentInvocations/);

  assert.doesNotMatch(auditPanelSource, /worldState\?\.aiSettings/);
  assert.doesNotMatch(auditPanelSource, /worldState\.aiSettings/);
  assert.doesNotMatch(auditPanelSource, /worldState\.actorMemoryLedger/);
  assert.doesNotMatch(auditPanelSource, /event_log|ai_change_proposals|world_state_json/);
  assert.doesNotMatch(auditPanelSource, /rawPrompt|rawProvider|providerPayload|statePatch/);
  assert.doesNotMatch(auditPanelSource, /prompt_retrieval_index|world_sessions/);
});

test("S70.10 player monthly briefing panel reads route view and turn feedback", () => {
  const source = publicAppSource();
  const monthlyPanelSource = sourceBetween(
    source,
    "function getPlayerMonthlyBriefingView(",
    "function getAiSettingsView("
  );

  assert.match(source, /let currentPlayerMonthlyBriefingView = null;/);
  assert.match(source, /function renderPlayerMonthlyBriefingPanel\(playerMonthlyBriefingView = currentPlayerMonthlyBriefingView\)/);
  assert.match(source, /function appendPlayerMonthlyBriefingFeedback\(playerMonthlyBriefing\)/);
  assert.match(source, /payload\.playerMonthlyBriefingView/);
  assert.match(source, /appendPlayerMonthlyBriefingFeedback\(payload\.playerMonthlyBriefing\);/);
  assert.match(source, /appendOptionalPanel\(renderPlayerMonthlyBriefingPanel\(\)\);/);

  assert.match(monthlyPanelSource, /getPlayerMonthlyBriefingView\(playerMonthlyBriefingView\)/);
  assert.match(monthlyPanelSource, /view\?\.latest/);
  assert.match(monthlyPanelSource, /recentReports/);
  assert.match(monthlyPanelSource, /publicSummary/);
  assert.match(monthlyPanelSource, /actionItems/);
  assert.match(monthlyPanelSource, /riskItems/);
  assert.match(monthlyPanelSource, /sourceRefs/);

  assert.doesNotMatch(monthlyPanelSource, /worldState\?\.playerMonthlyBriefing/);
  assert.doesNotMatch(monthlyPanelSource, /worldState\.playerMonthlyBriefing/);
  assert.doesNotMatch(monthlyPanelSource, /raw|proposal|audit|prompt|table|path|key/i);
});

test("S70.11 time skip feedback reads turn payload summary only", () => {
  const source = publicAppSource();
  const timeSkipSource = sourceBetween(
    source,
    "function appendTimeSkipFeedback(",
    "function getExamSceneTime("
  );

  assert.match(source, /function appendTimeSkipFeedback\(timeSkip\)/);
  assert.match(source, /appendTimeSkipFeedback\(payload\.timeSkip\);/);
  assert.match(timeSkipSource, /timeSkip\.summary/);
  assert.match(timeSkipSource, /timeSkip\.interrupted/);
  assert.match(timeSkipSource, /timeSkip\.nextTodo/);
  assert.doesNotMatch(timeSkipSource, /worldState\?\.timeSkip/);
  assert.doesNotMatch(timeSkipSource, /worldState\.timeSkip/);
  assert.doesNotMatch(timeSkipSource, /raw|proposal|audit|prompt|table|path|key/i);
});

test("S70.12 browser does not read raw actor memory or session summary ledgers", () => {
  const source = publicAppSource();

  assert.doesNotMatch(source, /worldState\?\.actorMemoryLedger/);
  assert.doesNotMatch(source, /worldState\.actorMemoryLedger/);
  assert.doesNotMatch(source, /worldState\?\.sessionSummary/);
  assert.doesNotMatch(source, /worldState\.sessionSummary/);
});

test("S71.4 browser loads saved state and information pages through player-state route", () => {
  const source = publicAppSource();
  const loadSaveSource = sourceBetween(
    source,
    "async function loadSaveSession(sessionId, options = {})",
    "function createPanelValue("
  );
  const informationSource = sourceBetween(
    source,
    "async function fetchInformationPanelPage(tabId, patch = {})",
    "function renderInformationControls("
  );

  assert.match(loadSaveSource, /\/api\/game\/player-state\/\$\{sessionId\}/);
  assert.doesNotMatch(loadSaveSource, /\/api\/game\/state\/\$\{sessionId\}/);
  assert.match(informationSource, /\/api\/game\/player-state\/\$\{currentSessionId\}\?\$\{params\.toString\(\)\}/);
  assert.doesNotMatch(informationSource, /\/api\/game\/state\/\$\{currentSessionId\}/);
});
