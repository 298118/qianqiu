const {
  EXAM_NETWORK_LIMITS,
  EXAM_NETWORK_SCHEMA_VERSION,
  LEVEL_NETWORK_CONFIG
} = require("./examNetworksConfig");
const { normalizeRelationshipLedger } = require("./relationships");

const UNSAFE_PUBLIC_TEXT_PATTERNS = Object.freeze([
  /SEALED_[A-Z0-9_]+/gi,
  /hiddenNotes|hidden_notes|hiddenIntent|hidden_intent|sealedMapping|sealed_mapping/gi,
  /raw provider|raw_provider|provider proposal|raw audit|raw_audit|prompt/i,
  /OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sk-[A-Za-z0-9_-]+/gi,
  /data\/sessions\/[^\s，。；]*|data\/audit\/[^\s，。；]*|\/mnt\/[^\s，。；]*|[A-Z]:\\[^\s，。；]*/gi
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, fallback = "", maxLength = EXAM_NETWORK_LIMITS.textPreviewLength) {
  if (typeof value !== "string") return fallback;
  let trimmed = value.trim().replace(/\s+/g, " ");
  for (const pattern of UNSAFE_PUBLIC_TEXT_PATTERNS) {
    trimmed = trimmed.replace(pattern, "已遮蔽");
  }
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function cleanId(value, fallback = "") {
  const text = cleanText(value, fallback, 96);
  return /^[a-z0-9][a-z0-9_-]*$/i.test(text) ? text : fallback;
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

function ensureCharacter(worldState, character) {
  const id = cleanId(character?.id, "");
  const name = cleanText(character?.name, "", 48);
  if (!id || !name) return null;
  worldState.characters = Array.isArray(worldState.characters) ? worldState.characters : [];
  let existing = worldState.characters.find((entry) => entry.id === id);
  if (!existing) {
    existing = {
      id,
      name,
      role: cleanText(character.role, "科场联系人", 48),
      loyalty: clampNumber(character.loyalty, 0, 100, 56),
      ambition: clampNumber(character.ambition, 0, 100, 48),
      skill: clampNumber(character.skill, 0, 100, 68),
      alive: true
    };
    worldState.characters.push(existing);
  } else {
    existing.name = name;
    existing.role = cleanText(character.role, existing.role || "科场联系人", 48);
    existing.alive = existing.alive !== false;
  }
  return existing;
}

function setLedgerEntry(worldState, character, relationship) {
  const id = cleanId(character?.id, "");
  if (!id) return null;
  const ledger = normalizeRelationshipLedger(worldState.relationshipLedger, worldState);
  const previous = ledger.characters[id] || {};
  const nextRelationship = Math.max(
    clampNumber(previous.relationship, -100, 100, -100),
    clampNumber(relationship.relationship, -100, 100, 0)
  );
  const nextResentment = Math.min(
    clampNumber(previous.resentment, 0, 100, 100),
    clampNumber(relationship.resentment, 0, 100, 0)
  );
  ledger.characters[id] = {
    id,
    name: cleanText(character.name, previous.name || "科场联系人", 48),
    role: cleanText(character.role, previous.role || "科场联系人", 48),
    stance: cleanText(relationship.stance, previous.stance || "科场关系", 80),
    relationship: nextRelationship,
    resentment: nextResentment,
    networkSource: cleanText(relationship.networkSource, previous.networkSource || "科场网络", 80),
    recentIntent: cleanText(relationship.recentIntent, previous.recentIntent || "观察科场后续往来。", 120),
    visible: true,
    lastUpdatedTurn: clampNumber(worldState.turnCount, 0, Number.MAX_SAFE_INTEGER, 0)
  };
  worldState.relationshipLedger = normalizeRelationshipLedger(ledger, worldState);
  return worldState.relationshipLedger.characters[id] || null;
}

function appendRelationshipNote(worldState, name, note) {
  const cleanName = cleanText(name, "", 48);
  const cleanNote = cleanText(note, "", 120);
  if (!cleanName || !cleanNote) return null;
  const ledger = normalizeRelationshipLedger(worldState.relationshipLedger, worldState);
  ledger.recentNotes = Array.isArray(ledger.recentNotes) ? ledger.recentNotes : [];
  ledger.recentNotes.push(`${cleanName}: ${cleanNote}`.slice(0, 120));
  worldState.relationshipLedger = normalizeRelationshipLedger(ledger, worldState);
  return worldState.relationshipLedger.recentNotes.at(-1) || null;
}

function titleForRankEntry(entry = {}) {
  return cleanText(entry.honorTitle || entry.rankLabel || (entry.place ? `第${entry.place}名` : ""), "", 64);
}

function peerRelationshipForPlace(candidateEntry = {}, playerEntry = {}) {
  const candidatePlace = clampNumber(candidateEntry.place, 1, 10000, 1);
  const playerPlace = clampNumber(playerEntry.place, 1, 10000, 1);
  const beatPlayer = candidatePlace < playerPlace;
  return {
    relationship: beatPlayer ? 10 : 18,
    resentment: beatPlayer ? 8 : 2,
    stance: beatPlayer ? "同年竞争者" : "同年声援"
  };
}

function createPeerContact(worldState, exam, candidateEntry, playerEntry, config) {
  const rival = Array.isArray(worldState.examCalendar?.rivals)
    ? worldState.examCalendar.rivals.find((entry) => entry.id === candidateEntry.id)
    : null;
  const id = cleanId(
    candidateEntry.contactId ||
      rival?.contactId ||
      `exam-peer-${exam.level}-${cleanId(candidateEntry.id, "candidate")}`,
    ""
  );
  const name = cleanText(candidateEntry.name, "同场士子", 48);
  if (!id || !name) return null;
  if (rival && !rival.contactId) rival.contactId = id;
  const relation = peerRelationshipForPlace(candidateEntry, playerEntry);
  ensureCharacter(worldState, {
    id,
    name,
    role: config.peerRole,
    loyalty: relation.relationship >= 18 ? 58 : 48,
    ambition: candidateEntry.place <= 3 ? 72 : 56,
    skill: Math.max(45, Math.min(95, clampNumber(candidateEntry.score, 0, 100, 60)))
  });
  const ledgerEntry = setLedgerEntry(worldState, {
    id,
    name,
    role: config.peerRole
  }, {
    ...relation,
    networkSource: config.peerNetworkSource,
    recentIntent: config.peerIntent
  });
  appendRelationshipNote(
    worldState,
    name,
    `${exam.name}同榜相识，${titleForRankEntry(candidateEntry) || `榜列第${candidateEntry.place}`}。`
  );
  return {
    id,
    name,
    role: config.peerRole,
    relationKind: "same_year",
    place: clampNumber(candidateEntry.place, 1, 10000, 1),
    rankLabel: titleForRankEntry(candidateEntry),
    stance: ledgerEntry?.stance || relation.stance,
    relationship: ledgerEntry?.relationship ?? relation.relationship,
    networkSource: config.peerNetworkSource,
    publicSummary: `${name}为${exam.name}同年，${titleForRankEntry(candidateEntry) || `榜列第${candidateEntry.place}`}。`
  };
}

function createExaminerContact(worldState, exam, examinerConfig, playerEntry, examHonor) {
  const id = cleanId(examinerConfig.id, "");
  const name = cleanText(examinerConfig.name, "科场考官", 48);
  if (!id || !name) return null;
  ensureCharacter(worldState, {
    id,
    name,
    role: examinerConfig.role,
    loyalty: 62,
    ambition: examinerConfig.relationKind === "seat_teacher" ? 58 : 46,
    skill: 82
  });
  const ledgerEntry = setLedgerEntry(worldState, {
    id,
    name,
    role: examinerConfig.role
  }, {
    stance: examinerConfig.stance,
    relationship: examinerConfig.relationship,
    resentment: examinerConfig.resentment,
    networkSource: examinerConfig.networkSource,
    recentIntent: examinerConfig.recentIntent
  });
  const title = examHonor?.currentHonor?.title || playerEntry?.honorTitle || playerEntry?.rankLabel || "";
  appendRelationshipNote(
    worldState,
    name,
    `${exam.name}取中后成为${examinerConfig.stance}${title ? `，记${title}` : ""}。`
  );
  return {
    id,
    name,
    role: examinerConfig.role,
    actor: examinerConfig.actor,
    relationKind: examinerConfig.relationKind,
    stance: ledgerEntry?.stance || examinerConfig.stance,
    relationship: ledgerEntry?.relationship ?? examinerConfig.relationship,
    networkSource: examinerConfig.networkSource,
    publicSummary: `${name}以${examinerConfig.role}身份入玩家${exam.name}公开人脉。`
  };
}

function normalizeNetworkSnapshot(snapshot = {}) {
  const source = isPlainObject(snapshot) ? snapshot : {};
  const date = isPlainObject(source.date) ? source.date : {};
  return {
    schemaVersion: EXAM_NETWORK_SCHEMA_VERSION,
    level: cleanText(source.level, "exam", 40),
    examName: cleanText(source.examName, "科场", 48),
    date: {
      year: clampNumber(date.year, 1, 9999, 1644),
      month: clampNumber(date.month, 1, 12, 1),
      tenDayPeriod: clampNumber(date.tenDayPeriod, 1, 3, 1),
      turnCount: clampNumber(date.turnCount, 0, Number.MAX_SAFE_INTEGER, 0)
    },
    sameYearContacts: (Array.isArray(source.sameYearContacts) ? source.sameYearContacts : [])
      .map((contact) => ({
        id: cleanId(contact.id, ""),
        name: cleanText(contact.name, "同年", 48),
        role: cleanText(contact.role, "同年", 48),
        relationKind: "same_year",
        place: clampNumber(contact.place, 1, 10000, 1),
        rankLabel: cleanText(contact.rankLabel, "", 64),
        stance: cleanText(contact.stance, "同年", 80),
        relationship: clampNumber(contact.relationship, -100, 100, 0),
        networkSource: cleanText(contact.networkSource, "科场同年", 80),
        publicSummary: cleanText(contact.publicSummary, "同年关系已入公开人脉。")
      }))
      .filter((contact) => contact.id)
      .slice(0, EXAM_NETWORK_LIMITS.maxSnapshotContacts),
    examinerContacts: (Array.isArray(source.examinerContacts) ? source.examinerContacts : [])
      .map((contact) => ({
        id: cleanId(contact.id, ""),
        name: cleanText(contact.name, "考官", 48),
        role: cleanText(contact.role, "考官", 48),
        actor: cleanText(contact.actor, "examiner", 40),
        relationKind: cleanText(contact.relationKind, "examiner", 40),
        stance: cleanText(contact.stance, "科场关系", 80),
        relationship: clampNumber(contact.relationship, -100, 100, 0),
        networkSource: cleanText(contact.networkSource, "科场考官", 80),
        publicSummary: cleanText(contact.publicSummary, "考官关系已入公开人脉。")
      }))
      .filter((contact) => contact.id)
      .slice(0, EXAM_NETWORK_LIMITS.maxSnapshotContacts),
    publicSummary: cleanText(source.publicSummary, "科场同年与座师关系已由服务器归档。"),
    authorityBoundary: "examNetwork 只从服务器 canonical ranking、公开阅卷摘要和安全考试历史派生；不读取模型原始建议、弥封映射、考官私意或保结密注。"
  };
}

function resolveExamNetwork({ worldState = {}, activeExam = {}, exam = {}, ranking = [], promotionResult = {}, examHonor = null }) {
  if (!promotionResult?.passed) {
    return normalizeNetworkSnapshot({
      level: exam.level || activeExam.level,
      examName: activeExam.examName || exam.name,
      date: getDateStamp(worldState),
      publicSummary: "本场未取中，未新增同年或座师公开关系。"
    });
  }

  const config = LEVEL_NETWORK_CONFIG[exam.level] || LEVEL_NETWORK_CONFIG.child_exam;
  const playerEntry = Array.isArray(ranking) ? ranking.find((entry) => entry.isPlayer) || null : null;
  const passingEntries = Array.isArray(ranking)
    ? ranking.filter((entry) => !entry.isPlayer && entry.rank !== "落第")
    : [];
  const peerContacts = passingEntries
    .slice(0, EXAM_NETWORK_LIMITS.maxSameYearContacts)
    .map((entry) => createPeerContact(worldState, exam, entry, playerEntry || {}, config))
    .filter(Boolean);
  const examinerContacts = (config.examinerContacts || [])
    .map((contact) => createExaminerContact(worldState, exam, contact, playerEntry, examHonor))
    .filter(Boolean);
  const title = examHonor?.currentAchievement?.title ||
    examHonor?.currentHonor?.title ||
    playerEntry?.honorTitle ||
    playerEntry?.rankLabel ||
    promotionResult.rank ||
    "";
  const summary = `${activeExam.examName || exam.name}放榜后，服务器从定榜顺序派生${peerContacts.length}名同年、${examinerContacts.length}名座师/考官公开关系${title ? `，并记${title}` : ""}。`;

  return normalizeNetworkSnapshot({
    level: exam.level || activeExam.level,
    examName: activeExam.examName || exam.name,
    date: getDateStamp(worldState),
    sameYearContacts: peerContacts,
    examinerContacts,
    publicSummary: summary
  });
}

function summarizeExamNetworkForPrompt(worldState = {}) {
  const latest = Array.isArray(worldState.player?.examHistory)
    ? worldState.player.examHistory.map((entry) => entry.examNetwork).filter(Boolean).at(-1)
    : null;
  if (!latest) return null;
  const snapshot = normalizeNetworkSnapshot(latest);
  return {
    schemaVersion: snapshot.schemaVersion,
    level: snapshot.level,
    examName: snapshot.examName,
    sameYearContacts: snapshot.sameYearContacts.slice(0, 3).map((contact) => ({
      id: contact.id,
      name: contact.name,
      role: contact.role,
      stance: contact.stance,
      relationship: contact.relationship,
      publicSummary: contact.publicSummary
    })),
    examinerContacts: snapshot.examinerContacts.slice(0, 3).map((contact) => ({
      id: contact.id,
      name: contact.name,
      role: contact.role,
      relationKind: contact.relationKind,
      stance: contact.stance,
      publicSummary: contact.publicSummary
    })),
    publicSummary: snapshot.publicSummary,
    authorityBoundary: "prompt 只能读取公开同年/座师摘要；不得要求模型创造隐藏考官关系、弥封映射、原始模型建议或直接改关系账本。"
  };
}

module.exports = {
  normalizeNetworkSnapshot,
  resolveExamNetwork,
  summarizeExamNetworkForPrompt
};
