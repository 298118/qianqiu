const {
  APPOINTMENT_FIRST_MONTH_ASSIGNMENTS,
  APPOINTMENT_TRACK_LIMITS,
  APPOINTMENT_TRACK_METER_DELTAS,
  APPOINTMENT_TRACK_PRIORITY,
  APPOINTMENT_TRACK_SCHEMA_VERSION
} = require("./appointmentTracksConfig");
const { inferOfficeByTitle, getOffice } = require("./officialCatalog");
const { ensureOfficialCareerState } = require("./officialCareer");
const { buildOfficialPostingsView } = require("./officialPostings");
const { clamp } = require("./stateRules");
const { monthsToTurns } = require("./time");

const OFFICIAL_ROLE_LABEL = "入仕官员";
const AUTHORITY_BOUNDARY =
  "授官轨迹只读服务器定榜、科名荣誉、公开同年座师摘要和官缺摘要；吏部、皇帝或模型建议不能直接写官职事实。";

const UNSAFE_PUBLIC_TEXT_PATTERNS = Object.freeze([
  /SEALED_[A-Z0-9_]+/gi,
  /hiddenNotes|hidden_notes|hiddenIntent|hidden_intent|sealedMapping|sealed_mapping/gi,
  /raw provider|raw_provider|provider proposal|raw audit|raw_audit|prompt/i,
  /OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sk-[A-Za-z0-9_-]+|tp-[A-Za-z0-9_-]+/gi,
  /data[\\/]sessions[\\/][^\s，。；]*|data[\\/]audit[\\/][^\s，。；]*|\/mnt\/[^\s，。；]*|[A-Z]:\\[^\s，。；]*/gi
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasUnsafePublicText(value) {
  return UNSAFE_PUBLIC_TEXT_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
}

function cleanText(value, fallback = "", maxLength = APPOINTMENT_TRACK_LIMITS.textPreviewLength) {
  if (typeof value !== "string") return fallback;
  let trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return fallback;
  if (hasUnsafePublicText(trimmed)) {
    return fallback || "已按公开规则遮蔽";
  }
  return trimmed.slice(0, maxLength);
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 96);
  return text.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function clampNumber(value, min, max, fallback = min) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function getDateStamp(worldState = {}) {
  return {
    year: clampNumber(worldState.year, 1, 9999, 1644),
    month: clampNumber(worldState.month, 1, 12, 1),
    tenDayPeriod: clampNumber(worldState.tenDayPeriod, 1, 3, 1),
    turnCount: clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0)
  };
}

function createInitialAppointmentTrackLedger(worldState = {}) {
  return {
    schemaVersion: APPOINTMENT_TRACK_SCHEMA_VERSION,
    records: [],
    updatedAtTurn: worldState.turnCount ?? 0
  };
}

function normalizeDate(raw = {}) {
  return {
    year: clampNumber(raw.year, 1, 9999, 1644),
    month: clampNumber(raw.month, 1, 12, 1),
    tenDayPeriod: clampNumber(raw.tenDayPeriod, 1, 3, 1),
    turnCount: clampNumber(raw.turnCount, 0, Number.MAX_SAFE_INTEGER, 0)
  };
}

function normalizeCandidateTrack(raw = {}) {
  const status = ["candidate", "selected", "blocked"].includes(raw.status) ? raw.status : "candidate";
  const office = inferOfficeByTitle(raw.officeTitle);
  return {
    trackKey: cleanId(raw.trackKey, "appointment_track"),
    trackLabel: cleanText(raw.trackLabel, "授官路径", 48),
    phase: cleanText(raw.phase, "待铨", 48),
    officeId: cleanId(raw.officeId || office?.id, ""),
    officeTitle: cleanText(raw.officeTitle || office?.title, "候选观政", 64),
    bureauId: cleanId(raw.bureauId || office?.bureauId, ""),
    priority: clampNumber(raw.priority, 0, 200, 0),
    status,
    source: cleanText(raw.source, "server_resolver", 48),
    vacancyRef: isPlainObject(raw.vacancyRef)
      ? {
        postingId: cleanId(raw.vacancyRef.postingId, ""),
        transferId: cleanId(raw.vacancyRef.transferId, ""),
        cityId: cleanId(raw.vacancyRef.cityId, ""),
        regionId: cleanId(raw.vacancyRef.regionId, ""),
        jurisdictionId: cleanId(raw.vacancyRef.jurisdictionId, ""),
        jurisdictionLabel: cleanText(raw.vacancyRef.jurisdictionLabel, "", 96),
        pressure: clampNumber(raw.vacancyRef.pressure, 0, 100, 0)
      }
      : null,
    publicReason: cleanText(raw.publicReason, "由服务器按甲第、名次、官缺与回避复核。"),
    publicSummary: cleanText(raw.publicSummary, `${cleanText(raw.trackLabel, "授官路径", 48)}候选。`)
  };
}

function normalizeAvoidanceCheck(raw = {}) {
  const status = ["passed", "blocked", "review", "not_applicable"].includes(raw.status)
    ? raw.status
    : "review";
  return {
    trackKey: cleanId(raw.trackKey, "appointment_track"),
    officeTitle: cleanText(raw.officeTitle, "候选观政", 64),
    nativePlace: cleanText(raw.nativePlace, "", 80),
    jurisdictionLabel: cleanText(raw.jurisdictionLabel, "", 96),
    status,
    publicSummary: cleanText(raw.publicSummary, "籍贯回避已由服务器复核。")
  };
}

function normalizeDecision(raw = {}) {
  if (!isPlainObject(raw)) return null;
  const office = inferOfficeByTitle(raw.officeTitle);
  const officeTitle = cleanText(raw.officeTitle || office?.title, "", 64);
  if (!officeTitle) return null;
  return {
    trackKey: cleanId(raw.trackKey, "appointment_track"),
    trackLabel: cleanText(raw.trackLabel, "授官路径", 48),
    phase: cleanText(raw.phase, "初授", 48),
    officeId: cleanId(raw.officeId || office?.id, ""),
    officeTitle,
    bureauId: cleanId(raw.bureauId || office?.bureauId, ""),
    decisionType: cleanText(raw.decisionType, "initial_appointment", 48),
    status: cleanText(raw.status, "appointed", 48),
    publicSummary: cleanText(raw.publicSummary, `${officeTitle}由服务器授官 resolver 写定。`),
    authorityBoundary: AUTHORITY_BOUNDARY
  };
}

function normalizeAppointmentTrackSnapshot(snapshot = {}) {
  const source = isPlainObject(snapshot) ? snapshot : {};
  const candidateTracks = Array.isArray(source.candidateTracks)
    ? source.candidateTracks.map(normalizeCandidateTrack).slice(0, APPOINTMENT_TRACK_LIMITS.maxCandidateTracks)
    : [];
  const avoidanceChecks = Array.isArray(source.avoidanceChecks)
    ? source.avoidanceChecks.map(normalizeAvoidanceCheck).slice(0, APPOINTMENT_TRACK_LIMITS.maxAvoidanceChecks)
    : [];
  const serverDecision = normalizeDecision(source.serverDecision);
  return {
    schemaVersion: APPOINTMENT_TRACK_SCHEMA_VERSION,
    id: cleanId(source.id, `appointment-${source.examId || "palace"}`),
    examId: cleanId(source.examId, ""),
    level: cleanText(source.level, "palace_exam", 40),
    examName: cleanText(source.examName, "殿试", 48),
    date: normalizeDate(source.date || source),
    palaceRank: cleanText(source.palaceRank, "", 32) || null,
    palacePlace: source.palacePlace === null || source.palacePlace === undefined
      ? null
      : clampNumber(source.palacePlace, 1, 10000, 1),
    classPlace: source.classPlace === null || source.classPlace === undefined
      ? null
      : clampNumber(source.classPlace, 1, 10000, 1),
    honorTitle: cleanText(source.honorTitle, "", 48) || null,
    officeTitleBefore: source.officeTitleBefore === null || source.officeTitleBefore === undefined
      ? null
      : cleanText(source.officeTitleBefore, "", 64) || null,
    candidateTracks,
    ministryProposal: isPlainObject(source.ministryProposal)
      ? {
        status: cleanText(source.ministryProposal.status, "advisory", 40),
        publicSummary: cleanText(source.ministryProposal.publicSummary, "吏部只提交授官路径建议，服务器裁决。")
      }
      : null,
    emperorSignal: isPlainObject(source.emperorSignal)
      ? {
        status: cleanText(source.emperorSignal.status, "advisory", 40),
        publicSummary: cleanText(source.emperorSignal.publicSummary, "殿试上意只作公开用人倾向，服务器裁决。")
      }
      : null,
    serverDecision,
    avoidanceChecks,
    publicSummary: cleanText(
      source.publicSummary,
      serverDecision
        ? `${source.examName || "殿试"}后，服务器定${serverDecision.trackLabel}，初授${serverDecision.officeTitle}。`
        : "授官路径尚未写定。"
    ),
    authorityBoundary: AUTHORITY_BOUNDARY
  };
}

function normalizeAppointmentTrackLedger(raw = {}, worldState = {}) {
  const source = isPlainObject(raw) ? raw : {};
  return {
    schemaVersion: APPOINTMENT_TRACK_SCHEMA_VERSION,
    records: Array.isArray(source.records)
      ? source.records.map(normalizeAppointmentTrackSnapshot).slice(-APPOINTMENT_TRACK_LIMITS.maxRecords)
      : [],
    updatedAtTurn: clampNumber(source.updatedAtTurn, 0, Number.MAX_SAFE_INTEGER, worldState.turnCount ?? 0)
  };
}

function ensureAppointmentTrackState(worldState = {}) {
  if (!isPlainObject(worldState.appointmentTrack)) {
    worldState.appointmentTrack = createInitialAppointmentTrackLedger(worldState);
  }
  worldState.appointmentTrack = normalizeAppointmentTrackLedger(worldState.appointmentTrack, worldState);
  return worldState.appointmentTrack;
}

function getPlayerRankingEntry(ranking = []) {
  return Array.isArray(ranking) ? ranking.find((entry) => entry.isPlayer) || null : null;
}

function readPalaceInfo(worldState = {}, ranking = [], promotionResult = {}) {
  const playerEntry = getPlayerRankingEntry(ranking) || {};
  const palaceRank = cleanText(
    playerEntry.palaceRank || promotionResult.palaceRank || worldState.player?.palaceRank,
    "三甲",
    32
  );
  return {
    playerEntry,
    palaceRank,
    palacePlace: clampNumber(playerEntry.place, 1, 10000, 1),
    classPlace: playerEntry.classPlace === null || playerEntry.classPlace === undefined
      ? null
      : clampNumber(playerEntry.classPlace, 1, 10000, 1),
    honorTitle: cleanText(playerEntry.honorTitle, "", 48)
  };
}

function readNativePlace(worldState = {}) {
  const player = worldState.player || {};
  return cleanText(
    player.nativePlace ||
      player.origin ||
      player.hometown ||
      player.birthplace ||
      worldState.setup?.nativePlace ||
      "",
    "",
    80
  );
}

function normalizePlace(value = "") {
  return cleanText(value, "", 120)
    .replace(/[省府州县市路道辖区：:，。；\s]/g, "")
    .replace(/京师|北京城/g, "北京");
}

function buildPostingIndex(officialPostingsView = {}) {
  const postings = Array.isArray(officialPostingsView.postings) ? officialPostingsView.postings : [];
  const transfers = Array.isArray(officialPostingsView.transferRecords) ? officialPostingsView.transferRecords : [];
  const assessments = Array.isArray(officialPostingsView.assessmentRecords) ? officialPostingsView.assessmentRecords : [];
  const jurisdictions = Array.isArray(officialPostingsView.cityJurisdictions)
    ? officialPostingsView.cityJurisdictions
    : [];
  const postingById = new Map(postings.map((posting) => [posting.id, posting]));
  const assessmentByPostingId = new Map(assessments.map((assessment) => [assessment.postingId, assessment]));
  const jurisdictionById = new Map(jurisdictions.map((jurisdiction) => [jurisdiction.id, jurisdiction]));
  return {
    postings,
    transfers,
    assessments,
    jurisdictions,
    postingById,
    assessmentByPostingId,
    jurisdictionById
  };
}

function vacancyRefFromTransfer(transfer, index) {
  const posting = index.postingById.get(transfer.toPostingId) || null;
  const assessment = posting ? index.assessmentByPostingId.get(posting.id) || null : null;
  const jurisdiction = posting ? index.jurisdictionById.get(posting.jurisdictionId) || null : null;
  const office = getOffice(transfer.toOfficeId) || inferOfficeByTitle(posting?.officeTitle);
  if (!office || !posting) return null;
  return {
    office,
    transfer,
    posting,
    assessment,
    jurisdiction,
    pressure: clampNumber(assessment?.riskScore ?? posting.impeachmentRisk, 0, 100, 0),
    merit: clampNumber(assessment?.meritScore ?? posting.performanceScore, 0, 100, 50),
    jurisdictionLabel: cleanText(jurisdiction?.name || posting.publicSummary, "", 96)
  };
}

function listVacancyRefs(officialPostingsView = {}, type) {
  const index = buildPostingIndex(officialPostingsView);
  return index.transfers
    .filter((transfer) =>
      transfer?.status === "proposed" &&
      (!type || transfer.type === type) &&
      transfer.toPostingId &&
      transfer.toOfficeId
    )
    .map((transfer) => vacancyRefFromTransfer(transfer, index))
    .filter(Boolean);
}

function createCandidate({
  trackKey,
  trackLabel,
  phase,
  officeTitle,
  priority,
  source = "server_resolver",
  publicReason,
  vacancy = null
}) {
  const office = inferOfficeByTitle(officeTitle) || vacancy?.office || null;
  const vacancyRef = vacancy
    ? {
      postingId: vacancy.posting.id,
      transferId: vacancy.transfer.id,
      cityId: vacancy.posting.cityId,
      regionId: vacancy.posting.regionId,
      jurisdictionId: vacancy.posting.jurisdictionId,
      jurisdictionLabel: vacancy.jurisdictionLabel,
      pressure: vacancy.pressure
    }
    : null;
  return normalizeCandidateTrack({
    trackKey,
    trackLabel,
    phase,
    officeId: office?.id,
    officeTitle: office?.title || officeTitle,
    bureauId: office?.bureauId,
    priority,
    source,
    vacancyRef,
    publicReason,
    publicSummary: `${trackLabel}：拟授${office?.title || officeTitle}。`
  });
}

function checkAvoidance(candidate, worldState = {}) {
  const nativePlace = readNativePlace(worldState);
  if (!candidate.vacancyRef?.jurisdictionLabel) {
    return normalizeAvoidanceCheck({
      trackKey: candidate.trackKey,
      officeTitle: candidate.officeTitle,
      nativePlace,
      status: "not_applicable",
      publicSummary: `${candidate.officeTitle}属京署或馆阁路径，不触发本步外任籍贯回避。`
    });
  }

  const nativeNorm = normalizePlace(nativePlace);
  const targetNorm = normalizePlace(candidate.vacancyRef.jurisdictionLabel);
  const blocked = Boolean(nativeNorm && targetNorm && targetNorm.includes(nativeNorm));
  return normalizeAvoidanceCheck({
    trackKey: candidate.trackKey,
    officeTitle: candidate.officeTitle,
    nativePlace,
    jurisdictionLabel: candidate.vacancyRef.jurisdictionLabel,
    status: blocked ? "blocked" : "passed",
    publicSummary: blocked
      ? `${candidate.officeTitle}拟缺与籍贯${nativePlace}相近，按回避改候别途。`
      : `${candidate.officeTitle}拟缺已按公开籍贯资料复核，未见同籍回避阻碍。`
  });
}

function applyAvoidanceToCandidates(candidates, worldState) {
  const checks = [];
  const nextCandidates = candidates.map((candidate) => {
    const check = checkAvoidance(candidate, worldState);
    checks.push(check);
    return {
      ...candidate,
      status: check.status === "blocked" ? "blocked" : candidate.status
    };
  });
  return { candidates: nextCandidates, checks };
}

function selectCandidate(candidates) {
  return candidates
    .filter((candidate) => candidate.status !== "blocked")
    .sort((first, second) => second.priority - first.priority)[0] || null;
}

function buildCandidatesForPalaceInfo({
  worldState,
  palaceInfo,
  examHonor,
  examNetwork,
  officialPostingsView
}) {
  const { palaceRank, palacePlace, classPlace } = palaceInfo;
  const honorTitle = cleanText(
    examHonor?.currentAchievement?.title ||
      examHonor?.currentHonor?.title ||
      palaceInfo.honorTitle,
    "",
    48
  );
  const sameYearCount = Array.isArray(examNetwork?.sameYearContacts) ? examNetwork.sameYearContacts.length : 0;
  const examinerCount = Array.isArray(examNetwork?.examinerContacts) ? examNetwork.examinerContacts.length : 0;
  const reputationBoost = Math.round(clampNumber(worldState.player?.reputation, 0, 100, 10) / 20);
  const networkBoost = sameYearCount + examinerCount;
  const candidates = [];

  if (palaceRank === "一甲") {
    const isFirst = palacePlace === 1 || honorTitle === "状元";
    candidates.push(createCandidate({
      trackKey: isFirst ? "top_hanlin_compiler" : "top_hanlin_editor",
      trackLabel: isFirst ? "一甲翰林修撰" : "一甲翰林编修",
      phase: "翰林实授",
      officeTitle: isFirst ? "翰林院修撰" : "翰林院编修",
      priority: isFirst
        ? APPOINTMENT_TRACK_PRIORITY.topHanlin
        : APPOINTMENT_TRACK_PRIORITY.firstClassHanlinEditor,
      publicReason: isFirst
        ? "一甲第一名按例优先入翰林修撰。"
        : "一甲前列按例优先入翰林编修。"
    }));
    candidates.push(createCandidate({
      trackKey: "second_shujishi",
      trackLabel: "馆选庶吉士备选",
      phase: "馆选",
      officeTitle: "翰林院庶吉士",
      priority: APPOINTMENT_TRACK_PRIORITY.secondClassShujishi - 8,
      publicReason: "若馆阁缺额不足，可先入庶吉士馆选。"
    }));
    return candidates;
  }

  const centralVacancies = listVacancyRefs(officialPostingsView, "appointment");
  const outpostVacancies = listVacancyRefs(officialPostingsView, "outpost");
  const centralVacancy = centralVacancies[0] || null;

  if (palaceRank === "二甲") {
    const shujishiPriority = APPOINTMENT_TRACK_PRIORITY.secondClassShujishi +
      (classPlace && classPlace <= 1 ? 8 : 0) +
      (honorTitle === "传胪" ? 6 : 0) +
      networkBoost +
      reputationBoost;
    candidates.push(createCandidate({
      trackKey: "second_shujishi",
      trackLabel: classPlace && classPlace <= 1 ? "二甲传胪馆选" : "二甲馆选庶吉士",
      phase: "馆选",
      officeTitle: "翰林院庶吉士",
      priority: shujishiPriority,
      publicReason: "二甲前列结合馆选声气、座师同年与声望，优先入庶吉士。"
    }));
    candidates.push(createCandidate({
      trackKey: "second_observation",
      trackLabel: "二甲观政",
      phase: "观政",
      officeTitle: "六部观政进士",
      priority: APPOINTMENT_TRACK_PRIORITY.secondClassObservation + reputationBoost,
      publicReason: "二甲可先留京观政，待吏部考察后补缺。"
    }));
    if (centralVacancy) {
      candidates.push(createCandidate({
        trackKey: "ministry_appointee",
        trackLabel: "二甲部属试用",
        phase: "部属补缺",
        officeTitle: centralVacancy.office.title,
        priority: APPOINTMENT_TRACK_PRIORITY.centralVacancy + Math.round(centralVacancy.pressure / 5),
        vacancy: centralVacancy,
        source: "officialPostingsView",
        publicReason: "吏部任命池有京署缺额，可作为二甲部属试用线索。"
      }));
    }
    return candidates;
  }

  for (const vacancy of outpostVacancies.slice(0, 3)) {
    candidates.push(createCandidate({
      trackKey: "outpost_appointee",
      trackLabel: vacancy.office.title === "知县" ? "三甲外放知县" : "三甲外放铨选",
      phase: "外放",
      officeTitle: vacancy.office.title,
      priority: APPOINTMENT_TRACK_PRIORITY.thirdClassOutpost + Math.round(vacancy.pressure / 5),
      vacancy,
      source: "officialPostingsView",
      publicReason: "三甲多循铨选外放，需同时看官缺压力和籍贯回避。"
    }));
  }
  if (centralVacancy) {
    candidates.push(createCandidate({
      trackKey: "ministry_appointee",
      trackLabel: "三甲部属候补",
      phase: "部属候补",
      officeTitle: centralVacancy.office.title,
      priority: APPOINTMENT_TRACK_PRIORITY.thirdClassCentral + Math.round(centralVacancy.pressure / 6),
      vacancy: centralVacancy,
      source: "officialPostingsView",
      publicReason: "外放回避或地方缺额不宜时，可改候京署部属。"
    }));
  }
  candidates.push(createCandidate({
    trackKey: "pending_selection",
    trackLabel: "三甲候缺观政",
    phase: "候缺",
    officeTitle: "六部观政进士",
    priority: APPOINTMENT_TRACK_PRIORITY.pendingSelection,
    publicReason: "若官缺、回避或朝局尚未合宜，先留部观政候铨。"
  }));
  return candidates;
}

function buildMinistryProposal(selected, palaceInfo, officialPostingsView = {}) {
  const vacancyCount = Array.isArray(officialPostingsView.transferRecords)
    ? officialPostingsView.transferRecords.filter((row) => row.status === "proposed").length
    : 0;
  return {
    status: "advisory",
    publicSummary: `吏部按${palaceInfo.palaceRank || "甲第"}、榜次第${palaceInfo.palacePlace || "-"}名与${vacancyCount}条公开任命池线索，拟${selected.trackLabel}。`
  };
}

function buildEmperorSignal(selected, examHonor = null) {
  const title = examHonor?.currentAchievement?.title || examHonor?.currentHonor?.title || "";
  return {
    status: "advisory",
    publicSummary: title
      ? `殿试公开荣誉${title}提高馆阁关注，但上意只作倾向，不能直接任免。`
      : `${selected.trackLabel}按殿试名次和公开履历裁量，上意不越过吏部与服务器 resolver。`
  };
}

function buildServerDecision(selected) {
  return normalizeDecision({
    trackKey: selected.trackKey,
    trackLabel: selected.trackLabel,
    phase: selected.phase,
    officeId: selected.officeId,
    officeTitle: selected.officeTitle,
    bureauId: selected.bureauId,
    status: "appointed",
    publicSummary: `服务器裁决${selected.trackLabel}，初授${selected.officeTitle}。`
  });
}

function applyTrackMeterDeltas(worldState, trackKey) {
  const deltas = APPOINTMENT_TRACK_METER_DELTAS[trackKey] || {};
  const player = worldState.player || {};
  for (const [key, delta] of Object.entries(deltas)) {
    const current = Number(player[key]);
    if (!Number.isFinite(current)) continue;
    player[key] = clamp(current + delta, 0, 100);
  }
}

function getFirstMonthAssignmentTemplate(trackKey) {
  return APPOINTMENT_FIRST_MONTH_ASSIGNMENTS[trackKey] ||
    APPOINTMENT_FIRST_MONTH_ASSIGNMENTS.pending_selection;
}

function buildFirstMonthAssignment(worldState, record) {
  const decision = record?.serverDecision;
  if (!decision?.trackKey) return null;
  const template = getFirstMonthAssignmentTemplate(decision.trackKey);
  const date = record.date || getDateStamp(worldState);
  const office = inferOfficeByTitle(decision.officeTitle);
  const bureauId = decision.bureauId || office?.bureauId || template.sourceId || null;
  const dueTurn = date.turnCount + monthsToTurns(template.deadlineMonths || 1);
  return {
    id: cleanId(`ASG-${String(date.turnCount).padStart(4, "0")}-first-month-${decision.trackKey}`),
    title: cleanText(template.title, "首月官场差事", 80),
    kind: cleanText(template.kind, "routine_office", 48),
    bureauId,
    sourceType: cleanText(template.sourceType, "bureau", 48),
    sourceId: cleanId(template.sourceId || bureauId || "official_office", "official_office"),
    status: "active",
    year: date.year,
    month: date.month,
    dueTurn,
    deadlineUnit: "ten_day",
    progress: clampNumber(template.progress, 0, 100, 12),
    risk: clampNumber(template.risk, 0, 100, 20),
    publicStake: clampNumber(template.publicStake, 0, 100, 45),
    privatePressure: clampNumber(template.privatePressure, 0, 100, 20),
    visibleSummary: cleanText(
      template.visibleSummary,
      "首月差事由服务器按授官轨迹派生，AI 与前端不能直接写入或改判。",
      160
    ),
    hiddenNotes: [],
    relatedContacts: Array.isArray(template.relatedContacts)
      ? template.relatedContacts.map((entry) => cleanText(entry, "", 64)).filter(Boolean).slice(0, 5)
      : [],
    relatedFactions: Array.isArray(template.relatedFactions)
      ? template.relatedFactions.map((entry) => cleanText(entry, "", 64)).filter(Boolean).slice(0, 5)
      : []
  };
}

function appendOfficialCareerAppointment(worldState, record) {
  if (!record?.serverDecision) return null;
  ensureOfficialCareerState(worldState);
  const career = worldState.officialCareer;
  const decision = record.serverDecision;
  const office = inferOfficeByTitle(decision.officeTitle);
  const date = record.date || getDateStamp(worldState);
  const historyId = `OC-${String(date.turnCount).padStart(4, "0")}-appointment-track`;
  const historyEntry = {
    id: historyId,
    type: "appointment",
    label: "初授",
    status: "resolved",
    year: date.year,
    month: date.month,
    tenDayPeriod: date.tenDayPeriod,
    turn: date.turnCount,
    officeTitleBefore: record.officeTitleBefore || null,
    officeTitleAfter: decision.officeTitle,
    reason: decision.publicSummary
  };
  if (!career.careerHistory.some((entry) => entry.id === historyId)) {
    career.careerHistory = [...career.careerHistory, historyEntry].slice(-APPOINTMENT_TRACK_LIMITS.maxRecords);
  }
  career.currentPosting = decision.officeTitle;
  career.bureauId = decision.bureauId || office?.bureauId || career.bureauId || null;
  career.assessmentDossier = {
    ...career.assessmentDossier,
    meritScore: Math.max(career.assessmentDossier?.meritScore || 0, worldState.player?.performanceMerit || 0),
    riskScore: Math.max(career.assessmentDossier?.riskScore || 0, worldState.player?.impeachmentRisk || 0),
    pendingRecommendation: null,
    notes: [
      `${decision.trackLabel}初授${decision.officeTitle}，已入官场履历。`,
      ...(Array.isArray(career.assessmentDossier?.notes) ? career.assessmentDossier.notes : [])
    ].slice(0, 5),
    lastUpdatedTurn: date.turnCount
  };
  const firstMonthAssignment = buildFirstMonthAssignment(worldState, record);
  if (
    firstMonthAssignment &&
    !career.assignments.some((assignment) => assignment.id === firstMonthAssignment.id)
  ) {
    career.assignments = [...career.assignments, firstMonthAssignment];
    career.assessmentDossier.notes = [
      `${firstMonthAssignment.title}已列为首月差事。`,
      ...career.assessmentDossier.notes
    ].slice(0, 5);
  }
  worldState.officialCareer = career;
  ensureOfficialCareerState(worldState);
  return historyEntry;
}

function applyAppointmentDecision(worldState, record) {
  if (!record?.serverDecision) return null;
  const decision = record.serverDecision;
  const player = worldState.player || {};
  const beforeOfficeTitle = player.officeTitle || null;
  player.role = "official";
  player.roleLabel = OFFICIAL_ROLE_LABEL;
  player.officeTitle = decision.officeTitle;
  player.position = decision.officeTitle;
  player.faction = decision.trackKey === "outpost_appointee" ? "外任清流" : "新科进士";
  applyTrackMeterDeltas(worldState, decision.trackKey);
  const historyEntry = appendOfficialCareerAppointment(worldState, {
    ...record,
    officeTitleBefore: record.officeTitleBefore ?? beforeOfficeTitle
  });
  return {
    beforeOfficeTitle,
    afterOfficeTitle: decision.officeTitle,
    historyEntry
  };
}

function snapshotAppointmentPlayer(player = {}) {
  return {
    role: player.role,
    roleLabel: player.roleLabel,
    examRank: player.examRank ?? null,
    palaceRank: player.palaceRank ?? null,
    officeTitle: player.officeTitle ?? null,
    position: player.position ?? null,
    faction: player.faction ?? null,
    influence: player.influence ?? 0,
    integrity: player.integrity ?? 0,
    superiorFavor: player.superiorFavor ?? 0,
    peerNetwork: player.peerNetwork ?? 0,
    performanceMerit: player.performanceMerit ?? 0,
    promotionProspect: player.promotionProspect ?? 0,
    impeachmentRisk: player.impeachmentRisk ?? 0,
    cleanReputation: player.cleanReputation ?? 0,
    reputation: player.reputation ?? 0,
    mentality: player.mentality ?? 0
  };
}

function resolveInitialAppointmentTrack({
  worldState = {},
  activeExam = {},
  exam = {},
  ranking = [],
  promotionResult = {},
  examHonor = null,
  examNetwork = null,
  officialPostingsView = null
}) {
  ensureAppointmentTrackState(worldState);
  if (exam.level !== "palace_exam" || !promotionResult?.passed || promotionResult?.severeCheat) {
    return null;
  }

  const existing = worldState.appointmentTrack.records.find((record) =>
    record.examId && record.examId === activeExam.examId
  );
  if (existing) return existing;

  const postingsView = officialPostingsView || buildOfficialPostingsView(worldState);
  const palaceInfo = readPalaceInfo(worldState, ranking, promotionResult);
  const baseCandidates = buildCandidatesForPalaceInfo({
    worldState,
    palaceInfo,
    examHonor,
    examNetwork,
    officialPostingsView: postingsView
  });
  const { candidates, checks } = applyAvoidanceToCandidates(baseCandidates, worldState);
  const selected = selectCandidate(candidates) || candidates.find((candidate) => candidate.trackKey === "pending_selection");
  if (!selected) return null;

  const candidateTracks = candidates.map((candidate) => ({
    ...candidate,
    status: candidate.trackKey === selected.trackKey ? "selected" : candidate.status
  }));
  const serverDecision = buildServerDecision(selected);
  const date = getDateStamp(worldState);
  const snapshot = normalizeAppointmentTrackSnapshot({
    id: `appointment-${activeExam.examId || date.turnCount}`,
    examId: activeExam.examId,
    level: exam.level || activeExam.level,
    examName: activeExam.examName || exam.name,
    date,
    palaceRank: palaceInfo.palaceRank,
    palacePlace: palaceInfo.palacePlace,
    classPlace: palaceInfo.classPlace,
    honorTitle: examHonor?.currentAchievement?.title || examHonor?.currentHonor?.title || palaceInfo.honorTitle,
    officeTitleBefore: promotionResult.before?.officeTitle ?? null,
    candidateTracks,
    ministryProposal: buildMinistryProposal(selected, palaceInfo, postingsView),
    emperorSignal: buildEmperorSignal(selected, examHonor),
    serverDecision,
    avoidanceChecks: checks,
    publicSummary: `${activeExam.examName || exam.name || "殿试"}后，服务器定${serverDecision.trackLabel}，初授${serverDecision.officeTitle}。`
  });

  const application = applyAppointmentDecision(worldState, snapshot);
  promotionResult.officeTitle = serverDecision.officeTitle;
  promotionResult.appointmentTrack = {
    trackKey: serverDecision.trackKey,
    trackLabel: serverDecision.trackLabel,
    officeTitle: serverDecision.officeTitle
  };
  promotionResult.after = snapshotAppointmentPlayer(worldState.player);
  promotionResult.reason = `${promotionResult.rank || "殿试取中"}，${snapshot.publicSummary}`;
  if (application?.historyEntry) {
    promotionResult.initialAppointmentOutcome = application.historyEntry;
  }

  worldState.appointmentTrack.records.push(snapshot);
  worldState.appointmentTrack.records = worldState.appointmentTrack.records.slice(-APPOINTMENT_TRACK_LIMITS.maxRecords);
  worldState.appointmentTrack.updatedAtTurn = date.turnCount;
  return snapshot;
}

function buildAppointmentTrackView(worldState = {}) {
  const ledger = normalizeAppointmentTrackLedger(worldState.appointmentTrack, worldState);
  const records = ledger.records.slice(-APPOINTMENT_TRACK_LIMITS.maxVisibleRecords);
  const latest = records.at(-1) || null;
  return {
    schemaVersion: APPOINTMENT_TRACK_SCHEMA_VERSION,
    records,
    latestDecision: latest?.serverDecision || null,
    latestTrack: latest
      ? {
        level: latest.level,
        examName: latest.examName,
        palaceRank: latest.palaceRank,
        palacePlace: latest.palacePlace,
        classPlace: latest.classPlace,
        honorTitle: latest.honorTitle,
        trackLabel: latest.serverDecision?.trackLabel || null,
        officeTitle: latest.serverDecision?.officeTitle || null
      }
      : null,
    publicSummary: latest?.publicSummary || "授官轨迹尚无记录。",
    authorityBoundary: AUTHORITY_BOUNDARY
  };
}

function summarizeAppointmentTrackForPrompt(worldState = {}) {
  const view = buildAppointmentTrackView(worldState);
  return {
    schemaVersion: view.schemaVersion,
    records: view.records.slice(-APPOINTMENT_TRACK_LIMITS.maxPromptRecords).map((record) => ({
      level: record.level,
      examName: record.examName,
      palaceRank: record.palaceRank,
      palacePlace: record.palacePlace,
      classPlace: record.classPlace,
      honorTitle: record.honorTitle,
      decision: record.serverDecision
        ? {
          trackLabel: record.serverDecision.trackLabel,
          officeTitle: record.serverDecision.officeTitle,
          bureauId: record.serverDecision.bureauId
        }
        : null,
      avoidanceChecks: record.avoidanceChecks.map((check) => ({
        officeTitle: check.officeTitle,
        status: check.status,
        publicSummary: check.publicSummary
      })).slice(0, 3)
    })),
    latestDecision: view.latestDecision
      ? {
        trackLabel: view.latestDecision.trackLabel,
        officeTitle: view.latestDecision.officeTitle,
        bureauId: view.latestDecision.bureauId
      }
      : null,
    publicSummary: view.publicSummary,
    authorityBoundary: "prompt 只能读取公开授官轨迹摘要；不得要求模型绕过官缺、回避、甲第、服务器任免或写 officeTitle。"
  };
}

module.exports = {
  buildAppointmentTrackView,
  createInitialAppointmentTrackLedger,
  ensureAppointmentTrackState,
  normalizeAppointmentTrackSnapshot,
  resolveInitialAppointmentTrack,
  summarizeAppointmentTrackForPrompt
};
