import type { CSSProperties } from "react";
import { Link } from "react-router";
import type { JsonObject, JsonValue, PlayerSummary } from "../api";

type OfficialMinisterPanelProps = {
  readonly player?: PlayerSummary | null;
  readonly officialCareerView?: JsonObject | null;
  readonly appointmentTrackView?: JsonObject | null;
  readonly officialPostingsView?: JsonObject | null;
  readonly actorMemoryView?: JsonObject | null;
  readonly aiControlAuditView?: JsonObject | null;
  readonly roleBackgroundPath?: string;
  readonly onDraft: (text: string) => void;
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

const assignmentKindLabels: Record<string, string> = {
  relief: "赈务",
  audit: "稽核",
  military: "军务",
  revenue: "钱粮",
  judicial: "刑名",
  ceremony: "礼制",
  memorial: "章奏",
  personnel: "铨选"
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
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
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
          cleanOptionalText(item.statusLabel || item.status || item.recommendation || item.deadlineLabel, 24),
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
    summary: cleanOfficialMinisterText(bureau.summary || bureauRow.publicSummary, "部院职掌只读安全投影，差遣、升降和处分仍由服务器裁决。", 142),
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
    appointmentSummary: cleanOfficialMinisterText(appointmentTrack.publicSummary, "授官、回避、补缺和升转仍由服务器裁决。", 132),
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
    notice: cleanOfficialMinisterText(procedure.visibleNotice, "朝局与弹劾只作公开风险提示，成案与处分仍由服务器裁决。", 132),
    auditSummary: cleanOfficialMinisterText(auditPanel.summary, "AI 调动只显示服务器整理后的公开摘要。", 132),
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
    finding: cleanOfficialMinisterText(assessmentRecord.publicFinding || assessmentRecord.publicSummary, "考成簿只读公开摘要；荐举、降调、弹劾和留任仍由服务器裁决。", 142),
    notes: asArray(assessment.notes).slice(-3).map((note) => cleanOfficialMinisterText(note, "考语未载", 72))
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
  officialCareerView,
  appointmentTrackView,
  officialPostingsView,
  actorMemoryView,
  aiControlAuditView,
  roleBackgroundPath,
  onDraft,
  courtHref,
  runnable = true
}: OfficialMinisterPanelProps) {
  const officialCareer = asRecord(officialCareerView);
  const appointmentTrack = asRecord(appointmentTrackView);
  const officialPostings = asRecord(officialPostingsView);
  const actorMemory = asRecord(actorMemoryView);
  const aiAudit = asRecord(aiControlAuditView);
  const posting = currentPostingFromView(officialPostings);
  const assessmentRecord = currentAssessmentFromView(officialPostings);
  const bureau = getBureauSummary(officialCareer, officialPostings, posting);
  const careerLedger = getCareerLedger(officialCareer, appointmentTrack, posting);
  const assignments = getAssignmentItems(officialCareer);
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
          <p>{playerName}现任{officeTitle}，官职履历、部院公文、同年座师、朝局风险和考成只读服务器安全投影。</p>
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
            <dd>只写草稿，结果由服务器裁决</dd>
          </div>
        </dl>
      </header>

      <div className="scholarPanelGrid officialMinisterPanelGrid">
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
          <div className="scholarPanelActions">
            {draftButtonText("自陈考成", "据公开考成簿自陈本任功过，列明可核证事件与待裁疑点。", canDraft, onDraft)}
            {draftButtonText("回应弹劾", "若有弹劾风声，先拟辨疏，说明事实、证据和请核事项，不自行成案。", canDraft, onDraft)}
          </div>
        </article>

        <article className="scholarPanelCard officialMinisterPanelMemorial" aria-labelledby="official-memorial-title">
          <h3 id="official-memorial-title">奏疏入口</h3>
          <p>此处只把上疏、回堂官、请核考成或辨弹劾写入底部奏折草稿；呈上回合、时间推进、任免奖惩和处分仍走服务器裁决。</p>
          <div className="scholarPanelActions">
            {draftButtonText("拟具奏疏", `臣${playerName}谨就${officeTitle}本职差遣、考成风险与朝局风声拟具奏疏，请服务器裁决后果。`, canDraft, onDraft)}
            {courtHref ? <Link to={courtHref}>入朝议页</Link> : null}
          </div>
          <ul className="scholarPanelBoundary">
            <li>本面板不提交回合、不调用 resolver、不推进时间。</li>
            <li>不得在前端直接任免、奖惩、处分、弹劾成案或改写考成。</li>
            <li>官缺、派系、人脉记忆和 AI 调动摘要只显示清洗后的公开 view。</li>
          </ul>
        </article>
      </div>
    </section>
  );
}

function OfficialMinisterPanelList({ items, emptyText }: { readonly items: readonly SafeListItem[]; readonly emptyText: string }) {
  if (!items.length) {
    return <p className="scholarPanelEmpty">{emptyText}</p>;
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
