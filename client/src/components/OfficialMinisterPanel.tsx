import type { CSSProperties } from "react";
import { Link } from "react-router";
import type { EconomyTraceView, JsonObject, JsonValue, PlayerSummary } from "../api";
import type { LocalSurface } from "../state/uiState";
import { rewritePlayerFacingWorldText } from "../text/worldText";
import { DomainConsequenceSection } from "./DomainConsequenceSection";
import { EconomyTraceSection } from "./EconomyTraceSection";
import { RoleCycleSection } from "./RoleCycleSection";

type OfficialMinisterPanelProps = {
  readonly player?: PlayerSummary | null;
  readonly roleCycleView?: JsonObject | null;
  readonly officialCareerView?: JsonObject | null;
  readonly appointmentTrackView?: JsonObject | null;
  readonly officialPostingsView?: JsonObject | null;
  readonly actorMemoryView?: JsonObject | null;
  readonly aiControlAuditView?: JsonObject | null;
  readonly playerMonthlyBriefingView?: JsonObject | null;
  readonly courtConsequenceView?: JsonObject | null;
  readonly courtResponseView?: JsonObject | null;
  readonly economyTraceView?: EconomyTraceView | null;
  readonly domainConsequenceView?: JsonObject | null;
  readonly roleBackgroundPath?: string;
  readonly onDraft: (text: string) => void;
  readonly resolveRoleCycleRouteHref?: (routeId: string) => string | null;
  readonly onOpenRoleCycleSurface?: (surface: LocalSurface) => void;
  readonly courtHref?: string;
  readonly runnable?: boolean;
};

type SafeListItem = {
  readonly id: string;
  readonly title: string;
  readonly meta?: string;
  readonly body?: string;
  readonly score?: number;
};

type SafeDraftAction = {
  readonly id: string;
  readonly label: string;
  readonly text: string;
};

const unsafeOfficialMinisterFragments = [
  "provider",
  "proposal",
  "raw",
  "prompt",
  "path",
  "key",
  "hidden",
  "sealed",
  "sqlite",
  "localstorage",
  "sessionstorage",
  "data/sessions",
  "data\\sessions",
  "api_key",
  "apikey",
  "sk-",
  "tp-",
  "完整提示词",
  "提示词",
  "本地路径",
  "密钥",
  "隐藏",
  "私档",
  "原始返回",
  "模型原文",
  "开发诊断"
] as const;

const officialEconomyTraceTypes = [
  "market_price_signal",
  "trade_negotiation",
  "trade_expiry",
  "trade_blocked",
  "delegated_task_budget",
  "delegated_task_result",
  "human_debt_monthly",
  "npc_relationship_monthly",
  "monthly_economy_event"
] as const;

const assignmentKindLabels: Record<string, string> = {
  relief: "赈务",
  audit: "稽核",
  military: "军务",
  revenue: "钱粮",
  judicial: "刑名",
  ceremony: "礼制",
  memorial: "章奏",
  memorial_drafting: "章奏",
  personnel: "铨选",
  personnel_review: "铨选",
  routine_office: "清册",
  land_survey: "册籍",
  case_review: "刑名",
  riverworks: "河工",
  military_supply: "军务",
  salt_transport: "盐漕",
  exam_supervision: "科场"
};

function isRecord(value: JsonValue | unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: JsonValue | unknown): JsonObject {
  return isRecord(value) ? value : {};
}

function asArray(value: JsonValue | unknown): readonly JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function cleanOfficialMinisterText(value: unknown, fallback = "未载", maxLength = 108) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return fallback;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  const lowered = text.toLowerCase();
  if (/[a-z]:[\\/]/i.test(text) || /(?:file|https?):\/\//i.test(text)) return fallback;
  if (unsafeOfficialMinisterFragments.some((fragment) => lowered.includes(fragment.toLowerCase()))) return fallback;
  const rewritten = rewritePlayerFacingWorldText(text);
  return rewritten.length > maxLength ? `${rewritten.slice(0, maxLength)}…` : rewritten;
}

function cleanOptionalText(value: unknown, maxLength = 108) {
  const cleaned = cleanOfficialMinisterText(value, "", maxLength);
  return cleaned || undefined;
}

function cleanNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : fallback;
}

function cleanCount(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function safeAssetPath(value: string | undefined) {
  if (!value || !value.startsWith("/assets/ui/")) return undefined;
  if (unsafeOfficialMinisterFragments.some((fragment) => value.toLowerCase().includes(fragment.toLowerCase()))) return undefined;
  return value;
}

function getPlayerName(player: PlayerSummary | null | undefined) {
  return cleanOfficialMinisterText(player?.name, "案主", 32);
}

function getPlayerRoleLabel(player: PlayerSummary | null | undefined) {
  if (player?.role === "minister") return "大臣";
  if (player?.role === "official") return "入仕官员";
  return cleanOfficialMinisterText(player?.role, "入仕官员", 24);
}

function getPlayerOffice(player: PlayerSummary | null | undefined, officialCareer: JsonObject, posting: JsonObject) {
  return cleanOfficialMinisterText(
    player?.officeTitle || officialCareer.currentPosting || posting.officeTitle || "候选观政",
    "候选观政",
    42
  );
}

function currentPostingFromView(officialPostings: JsonObject) {
  return asArray(officialPostings.postings)
    .map(asRecord)
    .find((posting) => posting.holderType === "player" || posting.id === "posting-player-current") || {};
}

function currentAssessmentFromView(officialPostings: JsonObject) {
  return asArray(officialPostings.assessmentRecords)
    .map(asRecord)
    .find((record) => record.holderType === "player" || record.postingId === "posting-player-current") || {};
}

function listFromRows(rows: readonly JsonValue[], key: string, limit: number, fallbackTitle: string): SafeListItem[] {
  return rows
    .slice(0, limit)
    .map((entry, index) => {
      if (typeof entry === "string" || typeof entry === "number") {
        return {
          id: `${key}-${index}`,
          title: cleanOfficialMinisterText(entry, fallbackTitle, 52)
        };
      }

      const item = asRecord(entry);
      const title = cleanOfficialMinisterText(
        item.title || item.label || item.officeTitle || item.actorLabel || item.honorTitle || item.trackLabel || item.type,
        fallbackTitle,
        52
      );
      const meta = cleanOptionalText(
        [
          cleanOptionalText(item.chainStageLabel || item.statusLabel || item.status || item.recommendation || item.deadlineLabel, 24),
          item.risk === undefined && item.riskScore === undefined ? undefined : `风险 ${cleanNumber(item.risk ?? item.riskScore, 0)}`,
          item.progress === undefined ? undefined : `进度 ${cleanNumber(item.progress, 0)}`
        ].filter(Boolean).join(" · "),
        64
      );
      const body = cleanOptionalText(
        item.visibleSummary ||
          item.publicSummary ||
          item.publicFinding ||
          item.publicReason ||
          item.summary ||
          item.visibleNotice ||
          item.publicStake,
        142
      );
      return {
        id: cleanOfficialMinisterText(item.id || item.memoryId || item.actorId || `${key}-${index}`, `${key}-${index}`, 72),
        title,
        meta,
        body,
        score: item.risk === undefined && item.riskScore === undefined ? undefined : cleanNumber(item.risk ?? item.riskScore, 0)
      };
    })
    .filter((item) => item.title !== fallbackTitle || item.meta || item.body);
}

function getBureauSummary(officialCareer: JsonObject, officialPostings: JsonObject, posting: JsonObject) {
  const bureau = asRecord(officialCareer.bureau);
  const bureauId = cleanOfficialMinisterText(bureau.id || posting.bureauId, "", 48);
  const bureauRow = asArray(officialPostings.bureaus).map(asRecord).find((row) => cleanOfficialMinisterText(row.id, "", 48) === bureauId) || {};
  const duties = asArray(bureau.duties || bureauRow.duties)
    .slice(0, 4)
    .map((duty) => cleanOfficialMinisterText(duty, "署务", 36));

  return {
    name: cleanOfficialMinisterText(bureau.name || bureauRow.name, "部院未明", 36),
    officeTitle: cleanOfficialMinisterText(bureau.officeTitle || posting.officeTitle, "候选观政", 42),
    summary: cleanOfficialMinisterText(bureau.summary || bureauRow.publicSummary, "部院职掌只读公开卷宗，差遣、升降和处分仍候案卷回批。", 142),
    duties
  };
}

function getCareerLedger(officialCareer: JsonObject, appointmentTrack: JsonObject, posting: JsonObject) {
  const latestTrack = asRecord(appointmentTrack.latestTrack);
  const latestDecision = asRecord(appointmentTrack.latestDecision);
  const lastOutcome = asRecord(officialCareer.lastOutcome);
  const recentOutcomes = listFromRows(asArray(officialCareer.recentOutcomes).slice().reverse(), "career-outcome", 4, "履历");
  const trackRecords = listFromRows(asArray(appointmentTrack.records).slice().reverse(), "appointment-track", 3, "授官轨迹");

  return {
    tenureMonths: cleanCount(officialCareer.tenureMonths, cleanCount(posting.termMonths, 0)),
    currentPosting: cleanOfficialMinisterText(officialCareer.currentPosting || posting.officeTitle, "候选观政", 42),
    latestTrack: cleanOfficialMinisterText(latestTrack.honorTitle || latestTrack.trackLabel || latestDecision.trackLabel, "授官未详", 42),
    latestOffice: cleanOfficialMinisterText(latestTrack.officeTitle || latestDecision.officeTitle || posting.officeTitle, "官缺未详", 42),
    lastOutcome: cleanOfficialMinisterText(lastOutcome.label || lastOutcome.type, "暂无近次履历结果", 52),
    appointmentSummary: cleanOfficialMinisterText(appointmentTrack.publicSummary, "授官、回避、补缺和升转仍候案卷回批。", 132),
    recentOutcomes,
    trackRecords
  };
}

function getAssignmentItems(officialCareer: JsonObject) {
  return listFromRows(asArray(officialCareer.assignments), "assignment", 4, "部院公文")
    .map((item) => {
      const kind = cleanOfficialMinisterText(asRecord(asArray(officialCareer.assignments).find((entry) => {
        const row = asRecord(entry);
        return cleanOfficialMinisterText(row.id, "", 72) === item.id;
      })).kind, "", 32);
      return {
        ...item,
        title: `${assignmentKindLabels[kind] || ""}${assignmentKindLabels[kind] ? " · " : ""}${item.title}`
      };
    });
}

function getOfficeNetwork(officialCareer: JsonObject, actorMemory: JsonObject, officialPostings: JsonObject) {
  const networkSummary = asRecord(officialCareer.networkSummary);
  const sameYear = listFromRows(
    [
      ...asArray(networkSummary.sameYearPeers),
      ...asArray(networkSummary.classmates),
      ...asArray(networkSummary.teachers)
    ],
    "career-network",
    4,
    "同年座师"
  );
  const memoryActors = listFromRows(asArray(actorMemory.actors), "actor-memory", 4, "人脉记忆");
  const superiorAndColleagues = listFromRows(
    asArray(officialPostings.postings)
      .map(asRecord)
      .filter((row) => row.holderType !== "player" && row.knownToPlayer !== false),
    "office-posting",
    4,
    "官署人脉"
  );

  return {
    summary: cleanOfficialMinisterText(networkSummary.publicSummary || networkSummary.summary, "同年、座师、堂官与属员只显示公开关系线索。", 132),
    items: sameYear.length ? sameYear : memoryActors.length ? memoryActors : superiorAndColleagues
  };
}

function getFactionRisk(officialCareer: JsonObject, actorMemory: JsonObject, aiAudit: JsonObject) {
  const procedure = asRecord(officialCareer.procedureSummary);
  const auditPanel = asRecord(aiAudit.publicPanel);
  const recentUpdates = listFromRows(asArray(actorMemory.recentUpdates).slice().reverse(), "memory-update", 3, "近次人情");
  const publicResults = listFromRows(asArray(auditPanel.publicResults), "ai-result", 3, "公开结果");
  const risk = Math.max(
    cleanNumber(officialCareer.riskScore, 0),
    cleanNumber(procedure.risk, 0),
    cleanNumber(auditPanel.rejectedToolCallCount, 0)
  );

  return {
    risk,
    impeachmentStage: cleanOfficialMinisterText(procedure.impeachmentStage, "未成案", 24),
    notice: cleanOfficialMinisterText(procedure.visibleNotice, "朝局与弹劾只作公开风险提示，成案与处分仍候案卷回批。", 132),
    auditSummary: cleanOfficialMinisterText(auditPanel.summary, "推演调度只显示已整理的公开摘要。", 132),
    items: recentUpdates.length ? recentUpdates : publicResults
  };
}

function getAssessment(officialCareer: JsonObject, assessmentRecord: JsonObject, posting: JsonObject) {
  const assessment = asRecord(officialCareer.assessment);
  return {
    merit: cleanNumber(assessment.meritScore ?? assessmentRecord.meritScore ?? posting.performanceScore, 50),
    risk: cleanNumber(assessment.riskScore ?? assessmentRecord.riskScore ?? posting.impeachmentRisk, 0),
    career: cleanNumber(officialCareer.careerScore, 50),
    reputation: cleanNumber(posting.publicReputation, 50),
    recommendation: cleanOfficialMinisterText(assessment.pendingRecommendation || assessmentRecord.recommendation, "候考成", 28),
    nextReview: cleanOfficialMinisterText(assessment.nextReviewInMonths ?? officialCareer.nextReviewInMonths, "未计", 16),
    finding: cleanOfficialMinisterText(assessmentRecord.publicFinding || assessmentRecord.publicSummary, "考成簿只读公开摘要；荐举、降调、弹劾和留任仍候案卷回批。", 142),
    notes: asArray(assessment.notes).slice(-3).map((note) => cleanOfficialMinisterText(note, "考语未载", 72))
  };
}

function getFirstMonthExperience(officialCareer: JsonObject, monthlyBriefing: JsonObject) {
  const firstMonth = asRecord(officialCareer.firstMonthExperience);
  const assignment = asRecord(firstMonth.assignment);
  const receipt = asRecord(firstMonth.receipt);
  const latestMonthly = asRecord(monthlyBriefing.latest);
  const active = firstMonth.active === true && Object.keys(assignment).length > 0;
  const nextActions = asArray(firstMonth.nextActions)
    .map(asRecord)
    .map((action, index) => ({
      id: cleanOfficialMinisterText(action.id, `first-month-action-${index}`, 48),
      label: cleanOfficialMinisterText(action.label, "拟行动", 24),
      text: cleanOfficialMinisterText(action.text, "", 160)
    }))
    .filter((action) => action.text);

  return {
    active,
    title: cleanOfficialMinisterText(assignment.title, "首月差事", 52),
    phase: cleanOfficialMinisterText(assignment.phaseLabel, "进度未明", 24),
    risk: cleanOfficialMinisterText(assignment.riskLabel, "风险未明", 24),
    progress: cleanNumber(assignment.progress, 0),
    riskScore: cleanNumber(assignment.risk, 0),
    deadline: cleanOfficialMinisterText(assignment.deadlineLabel, "限期未明", 36),
    summary: cleanOfficialMinisterText(assignment.visibleSummary || receipt.publicSummary, "首月差事已按公开官场材料入卷。", 142),
    receiptTitle: cleanOfficialMinisterText(receipt.title, "官署回执", 40),
    receiptSummary: cleanOfficialMinisterText(receipt.publicSummary, "回执只确认公开进度与请裁事项。", 142),
    superiorFeedback: cleanOfficialMinisterText(receipt.superiorFeedback, "上官反馈只读公开摘要。", 112),
    peerFeedback: cleanOfficialMinisterText(receipt.peerFeedback, "同僚风向只读公开摘要。", 112),
    bureauReply: cleanOfficialMinisterText(receipt.bureauReply, "官署回执不能直接改变官职、奖惩或弹劾结果。", 132),
    assessmentSignals: asArray(firstMonth.assessmentSignals)
      .slice(0, 4)
      .map((signal) => cleanOfficialMinisterText(signal, "考成信号", 84)),
    monthlyHint: cleanOfficialMinisterText(
      firstMonth.monthlyBriefingHint || latestMonthly.publicSummary,
      "月末月报会摘录首月差事进度、上官同僚反馈和下月可行事项。",
      132
    ),
    nextActions
  };
}

function getCourtEntry(officialCareer: JsonObject) {
  const entry = asRecord(officialCareer.courtEntry);
  const memorial = asRecord(entry.memorialEntry);
  const debate = asRecord(entry.courtDebateEntry);
  const assessmentTrace = asRecord(entry.assessmentTrace);
  const latestResolution = asRecord(entry.latestResolution);
  const latestFollowUp = asRecord(entry.latestFollowUp);
  const active = entry.active === true;
  const targetLabels = asArray(entry.targetSurfaces)
    .map(asRecord)
    .map((target) => cleanOfficialMinisterText(target.label, "", 28))
    .filter(Boolean)
    .slice(0, 3);
  const nextActions = asArray(entry.nextActions)
    .map(asRecord)
    .map((action, index) => ({
      id: cleanOfficialMinisterText(action.id, `court-entry-action-${index}`, 48),
      label: cleanOfficialMinisterText(action.label, "拟行动", 28),
      text: cleanOfficialMinisterText(action.text, "", 168)
    }))
    .filter((action) => action.text);
  const followUpNextActions = asArray(entry.followUpNextActions)
    .map(asRecord)
    .map((action, index) => ({
      id: cleanOfficialMinisterText(action.id, `court-follow-up-action-${index}`, 48),
      label: cleanOfficialMinisterText(action.label, "拟跟进", 28),
      text: cleanOfficialMinisterText(action.text, "", 168)
    }))
    .filter((action) => action.text);
  const followUpParticipants = asArray(latestFollowUp.participantSummaries)
    .map(asRecord)
    .map((participant, index) => ({
      id: cleanOfficialMinisterText(participant.actorId || `follow-up-participant-${index}`, `follow-up-participant-${index}`, 48),
      title: cleanOfficialMinisterText(participant.roleLabel, "参议", 28),
      body: cleanOptionalText(participant.publicPosition, 128)
    }));
  const signals = asArray(assessmentTrace.signals)
    .slice(0, 4)
    .map((signal) => cleanOfficialMinisterText(signal, "考成信号", 84));

  return {
    active,
    title: cleanOfficialMinisterText(entry.title, "首月回署材料", 56),
    summary: cleanOfficialMinisterText(entry.publicSummary, "首月回署材料可入奏折或朝议筹议。", 156),
    statusLabel: cleanOfficialMinisterText(entry.statusLabel, "待筹议", 28),
    targetLabel: targetLabels.length ? targetLabels.join("、") : "奏折队列、朝议筹议",
    memorialTitle: cleanOfficialMinisterText(memorial.title, "奏折材料", 48),
    memorialSummary: cleanOfficialMinisterText(memorial.publicSummary, "回署材料只读公开摘要。", 124),
    debateTitle: cleanOfficialMinisterText(debate.title, "朝议题", 48),
    debateSummary: cleanOfficialMinisterText(debate.publicSummary, "朝议只收集公开意见。", 124),
    superiorFollowUp: cleanOfficialMinisterText(entry.superiorFollowUp, "上官后续只看公开进度与凭据。", 116),
    peerFollowUp: cleanOfficialMinisterText(entry.peerFollowUp, "同僚后续只形成公开风向。", 116),
    traceLabel: cleanOfficialMinisterText(assessmentTrace.traceLabel, "考成期未明", 32),
    merit: cleanNumber(assessmentTrace.meritScore, 0),
    risk: cleanNumber(assessmentTrace.riskScore, 0),
    latestResolution: latestResolution.id || latestResolution.publicSummary
      ? {
        status: cleanOfficialMinisterText(latestResolution.statusLabel, "近次裁决", 32),
        summary: cleanOfficialMinisterText(latestResolution.publicSummary, "近次呈上已入卷，后续仍候普通回合。", 156),
        nextStep: cleanOfficialMinisterText(latestResolution.nextStep, "后续仍按普通回合补证、复核和考成结算。", 116)
      }
      : null,
    latestFollowUp: latestFollowUp.id || latestFollowUp.publicSummary
      ? {
        stage: cleanOfficialMinisterText(latestFollowUp.stageLabel, "朝议跟进", 32),
        status: cleanOfficialMinisterText(latestFollowUp.statusLabel, "批复", 32),
        summary: cleanOfficialMinisterText(latestFollowUp.publicSummary, "奏议后续已入卷，后续仍候普通回合。", 156),
        nextStep: cleanOfficialMinisterText(latestFollowUp.nextStep, "后续仍按普通回合补证、复核和考成结算。", 116)
      }
      : null,
    followUpParticipants,
    signals,
    nextActions,
    followUpNextActions
  };
}

function getCourtResponseDocket(courtResponseView: JsonObject) {
  const rows = [
    ...asArray(courtResponseView.chainItems),
    ...asArray(courtResponseView.responseItems),
    ...asArray(courtResponseView.recentResponses)
  ];
  const items = listFromRows(rows, "court-response", 4, "奏议回应");
  const actions: SafeDraftAction[] = asArray(courtResponseView.nextActions)
    .map(asRecord)
    .map((action, index) => ({
      id: cleanOfficialMinisterText(action.id, `court-response-action-${index}`, 48),
      label: cleanOfficialMinisterText(action.label, "拟回应", 24),
      text: cleanOfficialMinisterText(action.text, "", 168)
    }))
    .filter((action) => action.text);
  return {
    active: courtResponseView.active === true && items.length > 0,
    summary: cleanOfficialMinisterText(
      courtResponseView.summary,
      "跨身份奏议回应只读公开材料；票拟、补据、覆奏和考成观察只先写成草稿。",
      148
    ),
    items,
    actions
  };
}

function getCourtConsequenceDocket(courtConsequenceView: JsonObject) {
  const rows = [
    ...asArray(courtConsequenceView.pendingSources),
    ...asArray(courtConsequenceView.recentSignals)
  ];
  const items = listFromRows(rows, "court-consequence", 4, "官场后果");
  const actions: SafeDraftAction[] = asArray(courtConsequenceView.nextActions)
    .map(asRecord)
    .map((action, index) => ({
      id: cleanOfficialMinisterText(action.id, `court-consequence-action-${index}`, 48),
      label: cleanOfficialMinisterText(action.label, "记后果", 24),
      text: cleanOfficialMinisterText(action.text, "", 168)
    }))
    .filter((action) => action.text);
  return {
    active: courtConsequenceView.active === true && (items.length > 0 || actions.length > 0),
    summary: cleanOfficialMinisterText(
      courtConsequenceView.summary,
      "官场长期后果只读公开信号；考成、风宪、月报和世界议程只先写成草稿或观察。",
      148
    ),
    items,
    actions
  };
}

function draftButtonText(label: string, text: string, enabled: boolean, onDraft: (text: string) => void) {
  return (
    <button type="button" disabled={!enabled} onClick={() => onDraft(text)}>
      {label}
    </button>
  );
}

export function OfficialMinisterPanel({
  player,
  roleCycleView,
  officialCareerView,
  appointmentTrackView,
  officialPostingsView,
  actorMemoryView,
  aiControlAuditView,
  playerMonthlyBriefingView,
  courtConsequenceView,
  courtResponseView,
  economyTraceView,
  domainConsequenceView,
  roleBackgroundPath,
  onDraft,
  resolveRoleCycleRouteHref,
  onOpenRoleCycleSurface,
  courtHref,
  runnable = true
}: OfficialMinisterPanelProps) {
  const officialCareer = asRecord(officialCareerView);
  const appointmentTrack = asRecord(appointmentTrackView);
  const officialPostings = asRecord(officialPostingsView);
  const actorMemory = asRecord(actorMemoryView);
  const aiAudit = asRecord(aiControlAuditView);
  const monthlyBriefing = asRecord(playerMonthlyBriefingView);
  const courtConsequence = getCourtConsequenceDocket(asRecord(courtConsequenceView));
  const courtResponse = getCourtResponseDocket(asRecord(courtResponseView));
  const posting = currentPostingFromView(officialPostings);
  const assessmentRecord = currentAssessmentFromView(officialPostings);
  const bureau = getBureauSummary(officialCareer, officialPostings, posting);
  const careerLedger = getCareerLedger(officialCareer, appointmentTrack, posting);
  const assignments = getAssignmentItems(officialCareer);
  const firstMonth = getFirstMonthExperience(officialCareer, monthlyBriefing);
  const courtEntry = getCourtEntry(officialCareer);
  const network = getOfficeNetwork(officialCareer, actorMemory, officialPostings);
  const factionRisk = getFactionRisk(officialCareer, actorMemory, aiAudit);
  const assessment = getAssessment(officialCareer, assessmentRecord, posting);
  const playerName = getPlayerName(player);
  const roleLabel = getPlayerRoleLabel(player);
  const officeTitle = getPlayerOffice(player, officialCareer, posting);
  const assignmentSummary = asRecord(officialCareer.assignmentSummary);
  const activeAssignmentCount = cleanCount(assignmentSummary.activeCount, assignments.length);
  const urgentAssignmentCount = cleanCount(assignmentSummary.urgentCount, 0);
  const dateLabel = cleanOfficialMinisterText(posting.startedAt || assessmentRecord.date || officialCareer.generatedAtTurn, "时令未载", 36);
  const backgroundPath = safeAssetPath(roleBackgroundPath);
  const backgroundStyle = backgroundPath ? ({ "--scholar-panel-bg": `url(${backgroundPath})` } as CSSProperties) : undefined;
  const canDraft = runnable !== false;

  return (
    <section
      className="scholarPanel officialMinisterPanel"
      aria-labelledby="official-minister-panel-title"
      data-role-background={backgroundPath ?? "/assets/ui/roles/role-official-bureau-desk-v1.webp"}
      style={backgroundStyle}
    >
      <header className="scholarPanelHeader">
        <div>
          <p className="scholarPanelEyebrow">{roleLabel} · {dateLabel}</p>
          <h2 id="official-minister-panel-title">部院官署</h2>
          <p>{playerName}现任{officeTitle}，官职履历、部院公文、同年座师、朝局风险和考成只读公开卷宗。</p>
          <p>{bureau.summary}</p>
        </div>
        <dl className="scholarPanelStatus" aria-label="入仕官员摘要">
          <div>
            <dt>衙门</dt>
            <dd>{bureau.name}</dd>
          </div>
          <div>
            <dt>公文</dt>
            <dd>{activeAssignmentCount} 件 · 急 {urgentAssignmentCount}</dd>
          </div>
          <div>
            <dt>边界</dt>
            <dd>只写草稿，结果候回批</dd>
          </div>
        </dl>
      </header>

      <div className="scholarPanelGrid officialMinisterPanelGrid">
        <RoleCycleSection
          roleCycleView={roleCycleView}
          idPrefix="official-role-cycle"
          runnable={runnable}
          resolveRouteHref={resolveRoleCycleRouteHref}
          onOpenSurface={onOpenRoleCycleSurface}
          onDraft={onDraft}
        />
        <article className="scholarPanelCard officialMinisterPanelCareer" aria-labelledby="official-career-title">
          <h3 id="official-career-title">官职履历</h3>
          <dl className="scholarPanelCompactDl">
            <div>
              <dt>现任</dt>
              <dd>{careerLedger.currentPosting}</dd>
            </div>
            <div>
              <dt>授官</dt>
              <dd>{careerLedger.latestTrack} · {careerLedger.latestOffice}</dd>
            </div>
            <div>
              <dt>任月</dt>
              <dd>{careerLedger.tenureMonths}</dd>
            </div>
          </dl>
          <p>{careerLedger.appointmentSummary}</p>
          <p>近次：{careerLedger.lastOutcome}</p>
          <OfficialMinisterPanelList items={careerLedger.recentOutcomes.length ? careerLedger.recentOutcomes : careerLedger.trackRecords} emptyText="暂无新履历，可先从本职差遣起笔。" />
          {draftButtonText("整理履历", `整理${officeTitle}履历、授官轨迹与避嫌事项，先拟成自陈奏稿。`, canDraft, onDraft)}
        </article>

        <article className="scholarPanelCard officialMinisterPanelAssignments" aria-labelledby="official-assignments-title">
          <h3 id="official-assignments-title">部院公文</h3>
          <p>{bureau.officeTitle}职掌：{bureau.duties.length ? bureau.duties.join("、") : "公文、稽核、奏报与差遣"}</p>
          <OfficialMinisterPanelList items={assignments} emptyText="暂无在办公文，可先查阅部院题本与旧牍。" />
          <div className="scholarPanelActions">
            {draftButtonText("查办公文", "查阅部院公文，分清急牍、常牍、涉民利害和需上奏事项。", canDraft, onDraft)}
            {draftButtonText("拟回堂官", "就当前差遣拟一纸回堂官札，说明进度、风险与待裁事项。", canDraft, onDraft)}
          </div>
        </article>

        {firstMonth.active ? (
          <article className="scholarPanelCard officialMinisterPanelFirstMonth" aria-labelledby="official-first-month-title">
            <h3 id="official-first-month-title">官署首月</h3>
            <dl className="scholarPanelCompactDl">
              <div>
                <dt>差事</dt>
                <dd>{firstMonth.title}</dd>
              </div>
              <div>
                <dt>进度</dt>
                <dd>{firstMonth.phase} · {firstMonth.progress}</dd>
              </div>
              <div>
                <dt>风险</dt>
                <dd>{firstMonth.risk} · {firstMonth.riskScore}</dd>
              </div>
              <div>
                <dt>限期</dt>
                <dd>{firstMonth.deadline}</dd>
              </div>
            </dl>
            <p>{firstMonth.receiptTitle}：{firstMonth.receiptSummary}</p>
            <p>上官：{firstMonth.superiorFeedback}</p>
            <p>同僚：{firstMonth.peerFeedback}</p>
            <OfficialMinisterPanelList
              items={firstMonth.assessmentSignals.map((signal, index) => ({
                id: `first-month-signal-${index}`,
                title: signal
              }))}
              emptyText={firstMonth.summary}
            />
            <p>{firstMonth.monthlyHint}</p>
            <div className="scholarPanelActions">
              {firstMonth.nextActions.slice(0, 2).map((action) => (
                <button key={action.id} type="button" disabled={!canDraft} onClick={() => onDraft(action.text)}>
                  {action.label}
                </button>
              ))}
            </div>
          </article>
        ) : null}

        <article className="scholarPanelCard officialMinisterPanelNetwork" aria-labelledby="official-network-title">
          <h3 id="official-network-title">同年座师与人脉</h3>
          <p>{network.summary}</p>
          <OfficialMinisterPanelList items={network.items} emptyText="暂无可见人脉摘要，可先拜会座师或堂官。" />
          {draftButtonText("拜会座师", "具帖拜会座师、同年或堂官，询问本职差遣与朝局风向，只形成行动草稿。", canDraft, onDraft)}
        </article>

        <article className="scholarPanelCard officialMinisterPanelFaction" aria-labelledby="official-faction-title">
          <h3 id="official-faction-title">派系与朝局风险</h3>
          <dl className="scholarPanelCompactDl">
            <div>
              <dt>风险</dt>
              <dd>{factionRisk.risk}</dd>
            </div>
            <div>
              <dt>弹劾</dt>
              <dd>{factionRisk.impeachmentStage}</dd>
            </div>
            <div>
              <dt>调度</dt>
              <dd>{factionRisk.auditSummary}</dd>
            </div>
          </dl>
          <p>{factionRisk.notice}</p>
          <OfficialMinisterPanelList items={factionRisk.items} emptyText="暂无公开风声；不据此直接定罪、结党或处分。" />
          {draftButtonText("探问朝局", "谨慎探问朝局风声，记录可公开线索、避嫌事项与可能弹劾风险。", canDraft, onDraft)}
        </article>

        <article className="scholarPanelCard officialMinisterPanelAssessment" aria-labelledby="official-assessment-title">
          <h3 id="official-assessment-title">考成与弹劾</h3>
          <ul className="scholarPanelMetrics" aria-label="官场考成">
            <li>
              <span>功绩</span>
              <strong>{assessment.merit}</strong>
              <em>{assessment.recommendation}</em>
            </li>
            <li>
              <span>风险</span>
              <strong>{assessment.risk}</strong>
              <em>弹劾</em>
            </li>
            <li>
              <span>官声</span>
              <strong>{assessment.reputation}</strong>
              <em>公开</em>
            </li>
            <li>
              <span>前程</span>
              <strong>{assessment.career}</strong>
              <em>{assessment.nextReview} 月</em>
            </li>
          </ul>
          <p>{assessment.finding}</p>
          {assessment.notes.length ? (
            <ul>
              {assessment.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
          {courtConsequence.active ? (
            <>
              <p>官场后果：{courtConsequence.summary}</p>
              <OfficialMinisterPanelList
                items={courtConsequence.items}
                emptyText="暂无官场后果信号；不得补造考成、风宪或朝廷终局。"
              />
            </>
          ) : null}
          <div className="scholarPanelActions">
            {draftButtonText("自陈考成", "据公开考成簿自陈本任功过，列明可核证事件与待裁疑点。", canDraft, onDraft)}
            {draftButtonText("回应弹劾", "若有弹劾风声，先拟辨疏，说明事实、证据和请核事项，不自行成案。", canDraft, onDraft)}
            {courtConsequence.actions.slice(0, 3).map((action) => (
              <button key={action.id} type="button" disabled={!canDraft} onClick={() => onDraft(action.text)}>
                {action.label}
              </button>
            ))}
          </div>
        </article>

        <DomainConsequenceSection
          domainConsequenceView={domainConsequenceView}
          title="领域后果"
          summaryFallback="跨域后果只读已经入卷的地方、军务、刑名和人物经济公开余波；考成、弹劾、财政和天下议程仍继续回响。"
          emptyText="暂无可公开追踪的跨域后果；不得从内部账本、隐藏证据或模型提案补造事实。"
          runnable={runnable}
          onDraft={onDraft}
        />

        <EconomyTraceSection
          traceView={economyTraceView}
          title="经济线索与官署材料"
          summaryFallback="交易议价、委派预算/回禀、人情债和市价解释只作奏折、考成或朝议材料；资源、关系和成交仍候案卷回批。"
          idPrefix="official-economy-trace"
          maxItems={5}
          traceTypes={officialEconomyTraceTypes}
          runnable={runnable}
          onDraft={onDraft}
        />

        <article className="scholarPanelCard officialMinisterPanelMemorial" aria-labelledby="official-memorial-title">
          <h3 id="official-memorial-title">奏折朝议入口</h3>
          {courtResponse.active ? (
            <>
              <p>{courtResponse.summary}</p>
              <OfficialMinisterPanelList
                items={courtResponse.items}
                emptyText="暂无可回应奏议；不得补造批旨、赏罚、处分或弹劾结果。"
              />
            </>
          ) : null}
          {courtEntry.active ? (
            <>
              <dl className="scholarPanelCompactDl">
                <div>
                  <dt>材料</dt>
                  <dd>{courtEntry.title}</dd>
                </div>
                <div>
                  <dt>流向</dt>
                  <dd>{courtEntry.targetLabel}</dd>
                </div>
                <div>
                  <dt>考成</dt>
                  <dd>{courtEntry.traceLabel}</dd>
                </div>
                <div>
                  <dt>风险</dt>
                  <dd>{courtEntry.merit} / {courtEntry.risk}</dd>
                </div>
              </dl>
              <p>{courtEntry.summary}</p>
              <p>{courtEntry.memorialTitle}：{courtEntry.memorialSummary}</p>
              <p>{courtEntry.debateTitle}：{courtEntry.debateSummary}</p>
              {courtEntry.latestResolution ? (
                <p>近次裁决：{courtEntry.latestResolution.summary} 后续：{courtEntry.latestResolution.nextStep}</p>
              ) : null}
              {courtEntry.latestFollowUp ? (
                <p>朝议跟进：{courtEntry.latestFollowUp.stage} · {courtEntry.latestFollowUp.status}：{courtEntry.latestFollowUp.summary} 后续：{courtEntry.latestFollowUp.nextStep}</p>
              ) : null}
              {courtEntry.followUpParticipants.length ? (
                <OfficialMinisterPanelList
                  items={courtEntry.followUpParticipants}
                  emptyText="朝议、部院、台谏和御前只显示公开中间意见。"
                />
              ) : null}
              <p>上官后续：{courtEntry.superiorFollowUp}</p>
              <p>同僚后续：{courtEntry.peerFollowUp}</p>
              <OfficialMinisterPanelList
                items={courtEntry.signals.map((signal, index) => ({
                  id: `court-entry-signal-${index}`,
                  title: signal
                }))}
                emptyText="长期考成追踪只读取公开功绩、风险和回署材料。"
              />
            </>
          ) : (
            <p>此处只把上疏、回堂官、请核考成或辨弹劾写入底部奏折草稿；呈上回合、时间推进、任免奖惩和处分仍候案卷回批。</p>
          )}
          <div className="scholarPanelActions">
            {courtEntry.nextActions.slice(0, 3).map((action) => (
              <button key={action.id} type="button" disabled={!canDraft} onClick={() => onDraft(action.text)}>
                {action.label}
              </button>
            ))}
            {courtEntry.followUpNextActions.slice(0, 3).map((action) => (
              <button key={action.id} type="button" disabled={!canDraft} onClick={() => onDraft(action.text)}>
                {action.label}
              </button>
            ))}
            {courtResponse.actions.slice(0, 3).map((action) => (
              <button key={action.id} type="button" disabled={!canDraft} onClick={() => onDraft(action.text)}>
                {action.label}
              </button>
            ))}
            {!courtEntry.nextActions.length
              ? draftButtonText("拟具奏疏", `臣${playerName}谨就${officeTitle}本职差遣、考成风险与朝局风声拟具奏疏，请案卷回批后果。`, canDraft, onDraft)
              : null}
            {courtHref ? <Link to={courtHref}>入朝议页</Link> : null}
          </div>
          <ul className="scholarPanelBoundary">
            <li>本面板不提交回合、不推进时间。</li>
            <li>不得在前端直接任免、奖惩、处分、弹劾成案或改写考成。</li>
            <li>官缺、派系、人脉记忆和推演调度只显示已公开摘要。</li>
          </ul>
        </article>
      </div>
    </section>
  );
}

function OfficialMinisterPanelList({ items, emptyText }: { readonly items: readonly SafeListItem[]; readonly emptyText: string }) {
  if (!items.length) {
    return <p className="scholarPanelEmpty paperMotionEmpty">{emptyText}</p>;
  }

  return (
    <ul className="scholarPanelList">
      {items.map((item) => (
        <li key={item.id}>
          <strong>{item.title}</strong>
          {item.meta ? <span>{item.meta}</span> : null}
          {item.body ? <p>{item.body}</p> : null}
        </li>
      ))}
    </ul>
  );
}
