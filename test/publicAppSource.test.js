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
  assert.match(source, /function renderExamProcedurePanel\(examProcedureView = currentExamProcedureView\)/);
  assert.match(source, /function createExaminerPanelBlock\(examinerPanelView/);
  assert.match(source, /payload\.examProcedureView/);
  assert.match(source, /payload\.examinerPanelView/);
  assert.match(source, /examProcedureView\.rollLifecycle/);
  assert.match(source, /examProcedureView\.examinerPanelView/);
  assert.match(source, /currentExaminerPanelView/);
  assert.match(source, /createExamProcedureBlock\(payload\.examProcedureView \|\| payload\.examProcedure\)/);
  assert.match(source, /createExaminerPanelBlock\(payload\.examinerPanelView/);
  assert.match(source, /appendOptionalPanel\(renderExamProcedurePanel\(\)\);/);
  assert.doesNotMatch(source, /worldState\?\.examProcedure/);
  assert.doesNotMatch(source, /worldState\.activeExam\.procedure\./);
});
