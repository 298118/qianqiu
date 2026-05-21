import type { CSSProperties } from "react";
import { Link } from "react-router";
import type { JsonObject, JsonValue, PlayerSummary } from "../api";
import { RoleCycleSection } from "./RoleCycleSection";

type EmperorPanelProps = {
  readonly player?: PlayerSummary | null;
  readonly roleCycleView?: JsonObject | null;
  readonly officialPostingsView?: JsonObject | null;
  readonly eventArchiveView?: JsonObject | null;
  readonly actorMemoryView?: JsonObject | null;
  readonly aiControlAuditView?: JsonObject | null;
  readonly worldEntityView?: JsonObject | null;
  readonly worldThreadView?: JsonObject | null;
  readonly courtConsequenceView?: JsonObject | null;
  readonly courtResponseView?: JsonObject | null;
  readonly mapRuntimeView?: unknown;
  readonly roleBackgroundPath?: string;
  readonly courtHref?: string;
  readonly archiveHref?: string;
  readonly onDraft: (text: string) => void;
  readonly runnable?: boolean;
};

type SafeListItem = {
  readonly id: string;
  readonly title: string;
  readonly meta?: string;
  readonly body?: string;
};

type SafeDraftAction = {
  readonly id: string;
  readonly label: string;
  readonly text: string;
};

const unsafeEmperorFragments = [
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

const memorialKindLabels: Record<string, string> = {
  memorial: "奏折",
  court: "朝议",
  personnel: "铨选",
  appointment: "任免",
  reward: "赏",
  punishment: "罚",
  military: "军务",
  fiscal: "钱粮",
  local: "地方"
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

function cleanEmperorText(value: unknown, fallback = "未载", maxLength = 112) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return fallback;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  const lowered = text.toLowerCase();
  if (/[a-z]:[\\/]/i.test(text) || /(?:file|https?):\/\//i.test(text)) return fallback;
  if (unsafeEmperorFragments.some((fragment) => lowered.includes(fragment.toLowerCase()))) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function cleanOptionalText(value: unknown, maxLength = 112) {
  const cleaned = cleanEmperorText(value, "", maxLength);
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
  if (unsafeEmperorFragments.some((fragment) => value.toLowerCase().includes(fragment.toLowerCase()))) return undefined;
  return value;
}

function rowsFromKeys(source: JsonObject, keys: readonly string[]) {
  return keys.flatMap((key) => asArray(source[key]));
}

function labelKind(value: unknown) {
  const kind = cleanEmperorText(value, "", 28).toLowerCase();
  return memorialKindLabels[kind] || cleanOptionalText(value, 24);
}

function listFromRows(rows: readonly JsonValue[], key: string, limit: number, fallbackTitle: string): SafeListItem[] {
  return rows
    .slice(0, limit)
    .map((entry, index) => {
      if (typeof entry === "string" || typeof entry === "number") {
        return {
          id: `${key}-${index}`,
          title: cleanEmperorText(entry, fallbackTitle, 56)
        };
      }

      const item = asRecord(entry);
      const kind = labelKind(item.kind || item.domain || item.type || item.category);
      const title = cleanEmperorText(
        item.title || item.label || item.name || item.officeTitle || item.actorLabel || item.entityLabel || item.eventTitle,
        fallbackTitle,
        58
      );
      const meta = cleanOptionalText(
        [
          kind,
          cleanOptionalText(item.chainStageLabel || item.statusLabel || item.status || item.visibility || item.stage, 24),
          item.riskScore === undefined && item.pressureScore === undefined && item.severity === undefined
            ? undefined
            : `警势 ${cleanNumber(item.riskScore ?? item.pressureScore ?? item.severity, 0)}`
        ].filter(Boolean).join(" · "),
        72
      );
      const body = cleanOptionalText(
        item.publicSummary ||
          item.visibleSummary ||
          item.summary ||
          item.publicFinding ||
          item.description ||
          item.followUp,
        148
      );
      return {
        id: cleanEmperorText(item.id || item.ref || item.sourceRef || item.eventId || `${key}-${index}`, `${key}-${index}`, 76),
        title,
        meta,
        body
      };
    })
    .filter((item) => item.title !== fallbackTitle || item.meta || item.body);
}

function getEmperorDesk(player: PlayerSummary | null | undefined, officialPostings: JsonObject, eventArchive: JsonObject) {
  const court = asRecord(officialPostings.courtSummary || officialPostings.currentCourt || eventArchive.courtSummary);
  return {
    title: cleanEmperorText(player?.officeTitle || court.officeTitle || "御案临朝", "御案临朝", 42),
    date: cleanEmperorText(eventArchive.dateLabel || officialPostings.dateLabel || court.dateLabel, "时令未载", 36),
    summary: cleanEmperorText(
      court.publicSummary || eventArchive.publicSummary || officialPostings.publicSummary,
      "御案只读奏折、官职、人事、朝议和审计摘要的安全投影；朱批、圣旨、任免与赏罚只先落成草稿。",
      156
    )
  };
}

function getMemorialQueue(eventArchive: JsonObject, worldThread: JsonObject, mapRuntime: JsonObject) {
  const archiveRows = rowsFromKeys(eventArchive, ["memorials", "events", "items", "entries"]).filter((entry) => {
    const item = asRecord(entry);
    const text = cleanEmperorText([item.kind, item.domain, item.type, item.title, item.label].filter(Boolean).join(" "), "", 90).toLowerCase();
    return !text || /memorial|court|edict|personnel|fiscal|military|local|奏|朝|旨|任|官|钱|粮|军|民/.test(text);
  });
  const threadRows = rowsFromKeys(worldThread, ["threads", "items", "entries", "recentThreads"]);
  const mapRows = rowsFromKeys(mapRuntime, ["eventEffects"]);
  const items = listFromRows([...archiveRows, ...threadRows, ...mapRows], "memorial", 5, "奏折");
  return items.length ? items : [{ id: "memorial-empty", title: "暂无急奏", body: "可先阅旧牍，择钱粮、边防、吏治与民生四项发问。" }];
}

function getCourtResponseAgenda(courtResponse: JsonObject) {
  const responseRows = [
    ...rowsFromKeys(courtResponse, ["chainItems"]),
    ...rowsFromKeys(courtResponse, ["responseItems"]),
    ...rowsFromKeys(courtResponse, ["recentResponses"])
  ];
  const items = listFromRows(responseRows, "court-response", 4, "奏议回应");
  const actions: SafeDraftAction[] = asArray(courtResponse.nextActions)
    .map(asRecord)
    .map((action, index) => ({
      id: cleanEmperorText(action.id, `court-response-action-${index}`, 48),
      label: cleanEmperorText(action.label, "拟回应", 24),
      text: cleanEmperorText(action.text, "", 176)
    }))
    .filter((action) => action.text);
  return {
    active: courtResponse.active === true && items.length > 0,
    summary: cleanEmperorText(
      courtResponse.summary,
      "奏议回应只读服务器公开投影；朱批、覆奏、补据与考成观察只先写成草稿。",
      148
    ),
    items,
    actions
  };
}

function getCourtConsequenceAgenda(courtConsequence: JsonObject) {
  const consequenceRows = [
    ...rowsFromKeys(courtConsequence, ["pendingSources"]),
    ...rowsFromKeys(courtConsequence, ["recentSignals"])
  ];
  const items = listFromRows(consequenceRows, "court-consequence", 4, "官场后果");
  const actions: SafeDraftAction[] = asArray(courtConsequence.nextActions)
    .map(asRecord)
    .map((action, index) => ({
      id: cleanEmperorText(action.id, `court-consequence-action-${index}`, 48),
      label: cleanEmperorText(action.label, "记后果", 24),
      text: cleanEmperorText(action.text, "", 176)
    }))
    .filter((action) => action.text);
  return {
    active: courtConsequence.active === true && (items.length > 0 || actions.length > 0),
    summary: cleanEmperorText(
      courtConsequence.summary,
      "官场长期后果只读服务器公开投影；考成、风宪、月报和世界议程只先作观察。",
      148
    ),
    items,
    actions
  };
}

function getCourtDebate(actorMemory: JsonObject, worldThread: JsonObject, eventArchive: JsonObject) {
  const memoryRows = rowsFromKeys(actorMemory, ["actors", "recentUpdates", "relationships"]);
  const threadRows = rowsFromKeys(worldThread, ["courtThreads", "threads", "items"]);
  const archiveRows = rowsFromKeys(eventArchive, ["courtDebates", "events", "items"]);
  return listFromRows([...threadRows, ...memoryRows, ...archiveRows], "court", 4, "朝臣");
}

function getAppointmentCandidates(officialPostings: JsonObject, actorMemory: JsonObject, worldEntity: JsonObject) {
  const postingRows = rowsFromKeys(officialPostings, [
    "appointmentCandidates",
    "candidates",
    "postings",
    "assessmentRecords",
    "bureauCandidates",
    "bureaus"
  ]);
  const actorRows = rowsFromKeys(actorMemory, ["actors", "recentUpdates"]);
  const entityRows = rowsFromKeys(worldEntity, ["entities", "items", "entries"]).filter((entry) => {
    const item = asRecord(entry);
    const text = cleanEmperorText([item.kind, item.domain, item.type, item.title, item.label].filter(Boolean).join(" "), "", 90).toLowerCase();
    return /personnel|appointment|court|ministry|任|官|部|铨|察/.test(text);
  });
  return listFromRows([...postingRows, ...actorRows, ...entityRows], "appointment", 5, "候选");
}

function getRewardPunishmentItems(aiControlAudit: JsonObject, eventArchive: JsonObject, worldThread: JsonObject) {
  const publicPanel = asRecord(aiControlAudit.publicPanel);
  const auditRows = [
    ...rowsFromKeys(aiControlAudit, ["publicResults", "auditSummary", "toolResults", "records"]),
    ...rowsFromKeys(publicPanel, ["publicResults", "items", "records"])
  ];
  const archiveRows = rowsFromKeys(eventArchive, ["events", "items", "entries"]).filter((entry) => {
    const item = asRecord(entry);
    const text = cleanEmperorText([item.kind, item.domain, item.type, item.title, item.label].filter(Boolean).join(" "), "", 90).toLowerCase();
    return /reward|punishment|personnel|censor|赏|罚|奖|惩|弹|考成/.test(text);
  });
  const threadRows = rowsFromKeys(worldThread, ["threads", "items", "entries"]);
  return listFromRows([...archiveRows, ...auditRows, ...threadRows], "reward", 4, "赏罚线索");
}

function draftButtonText(label: string, text: string, enabled: boolean, onDraft: (text: string) => void) {
  return (
    <button type="button" disabled={!enabled} onClick={() => onDraft(text)}>
      {label}
    </button>
  );
}

export function EmperorPanel({
  player,
  roleCycleView,
  officialPostingsView,
  eventArchiveView,
  actorMemoryView,
  aiControlAuditView,
  worldEntityView,
  worldThreadView,
  courtConsequenceView,
  courtResponseView,
  mapRuntimeView,
  roleBackgroundPath,
  courtHref,
  archiveHref,
  onDraft,
  runnable = true
}: EmperorPanelProps) {
  const officialPostings = asRecord(officialPostingsView);
  const eventArchive = asRecord(eventArchiveView);
  const actorMemory = asRecord(actorMemoryView);
  const aiControlAudit = asRecord(aiControlAuditView);
  const worldEntity = asRecord(worldEntityView);
  const worldThread = asRecord(worldThreadView);
  const courtConsequence = asRecord(courtConsequenceView);
  const courtResponse = asRecord(courtResponseView);
  const mapRuntime = asRecord(mapRuntimeView);
  const desk = getEmperorDesk(player, officialPostings, eventArchive);
  const memorials = getMemorialQueue(eventArchive, worldThread, mapRuntime);
  const consequenceAgenda = getCourtConsequenceAgenda(courtConsequence);
  const responseAgenda = getCourtResponseAgenda(courtResponse);
  const courtDebate = getCourtDebate(actorMemory, worldThread, eventArchive);
  const candidates = getAppointmentCandidates(officialPostings, actorMemory, worldEntity);
  const rewardPunishments = getRewardPunishmentItems(aiControlAudit, eventArchive, worldThread);
  const counts = asRecord(eventArchive.counts);
  const backgroundPath = safeAssetPath(roleBackgroundPath);
  const backgroundStyle = backgroundPath ? ({ "--scholar-panel-bg": `url(${backgroundPath})` } as CSSProperties) : undefined;
  const canDraft = runnable !== false;

  return (
    <section
      className="scholarPanel emperorPanel"
      aria-labelledby="emperor-panel-title"
      data-role-background={backgroundPath ?? "/assets/ui/roles/role-emperor-imperial-desk-v1.webp"}
      style={backgroundStyle}
    >
      <header className="scholarPanelHeader">
        <div>
          <p className="scholarPanelEyebrow">御案 · {desk.date}</p>
          <h2 id="emperor-panel-title">御案朝仪</h2>
          <p>{desk.title}前，奏折、朱批、圣旨草稿、朝议、任免候选与赏罚预留并列案头。</p>
          <p>{desk.summary}</p>
        </div>
        <dl className="scholarPanelStatus" aria-label="皇帝摘要">
          <div>
            <dt>奏折</dt>
            <dd>{cleanCount(counts.memorials ?? counts.events ?? memorials.length, memorials.length)} 件</dd>
          </div>
          <div>
            <dt>候选</dt>
            <dd>{candidates.length} 条 · 朝议 {courtDebate.length}</dd>
          </div>
          <div>
            <dt>边界</dt>
            <dd>拟旨只作草稿</dd>
          </div>
        </dl>
      </header>

      <div className="scholarPanelGrid emperorPanelGrid">
        <RoleCycleSection
          roleCycleView={roleCycleView}
          idPrefix="emperor-role-cycle"
          runnable={runnable}
          onDraft={onDraft}
        />
        <article className="scholarPanelCard emperorPanelMemorials" aria-labelledby="emperor-memorials-title">
          <h3 id="emperor-memorials-title">奏折队列</h3>
          <p>案头奏折来自服务器公开投影，只能帮助组织询问顺序，不写成已经裁决的朝廷事实。</p>
          <EmperorPanelList items={memorials} emptyText="暂无奏折投影，可先命内阁录入钱粮、边防、吏治与民生四项。" />
          <div className="scholarPanelActions">
            {draftButtonText("朱批奏折", "朱批近日奏折，逐条询问钱粮、边防、吏治与民生，只写成行动草稿候服务器裁决。", canDraft, onDraft)}
            {archiveHref ? <Link to={archiveHref}>查史册</Link> : null}
          </div>
        </article>

        <article className="scholarPanelCard emperorPanelResponses" aria-labelledby="emperor-responses-title">
          <h3 id="emperor-responses-title">奏议回应</h3>
          <p>{responseAgenda.summary}</p>
          <EmperorPanelList
            items={responseAgenda.items}
            emptyText="暂无可回应奏议；不得补造批旨、署名、赏罚或已生效结果。"
          />
          <div className="scholarPanelActions">
            {responseAgenda.actions.slice(0, 3).map((action) => (
              <button key={action.id} type="button" disabled={!canDraft} onClick={() => onDraft(action.text)}>
                {action.label}
              </button>
            ))}
            {!responseAgenda.actions.length
              ? draftButtonText("拟奏议回应", "朱批奏议回应，令部院只据公开材料覆奏，后果仍候服务器裁决。", canDraft, onDraft)
              : null}
          </div>
        </article>

        <article className="scholarPanelCard emperorPanelVermilion" aria-labelledby="emperor-vermilion-title">
          <h3 id="emperor-vermilion-title">朱批拟稿</h3>
          <ul className="scholarPanelMetrics" aria-label="朱批四项">
            <li>
              <span>钱粮</span>
              <strong>{cleanNumber(counts.fiscalScore ?? counts.fiscal, 50)}</strong>
              <em>待问</em>
            </li>
            <li>
              <span>边防</span>
              <strong>{cleanNumber(counts.militaryScore ?? counts.military, 50)}</strong>
              <em>待核</em>
            </li>
            <li>
              <span>吏治</span>
              <strong>{cleanNumber(counts.personnelScore ?? counts.personnel, 50)}</strong>
              <em>待议</em>
            </li>
            <li>
              <span>民生</span>
              <strong>{cleanNumber(counts.localScore ?? counts.local, 50)}</strong>
              <em>待察</em>
            </li>
          </ul>
          <p>朱批按钮只把问政文字写入底部奏折；真正的生效、反响和持久化仍在回合提交后由服务器处理。</p>
          {draftButtonText("批问四务", "朱批问政：请中枢分别具奏钱粮、边防、吏治、民生四务，列明证据与可裁事项。", canDraft, onDraft)}
        </article>

        <article className="scholarPanelCard emperorPanelEdict" aria-labelledby="emperor-edict-title">
          <h3 id="emperor-edict-title">圣旨草稿</h3>
          <p>此处只保留拟旨文本、意图和待核证据，不写入已经生效的国策记录。</p>
          <div className="scholarPanelActions">
            {draftButtonText("拟旨", "草拟一道明发谕旨，请内阁先核证据、适用官制与可行后果；此稿未生效。", canDraft, onDraft)}
            {courtHref ? <Link to={courtHref}>入朝议页</Link> : null}
          </div>
          <dl className="scholarPanelCompactDl">
            <div>
              <dt>格式</dt>
              <dd>圣旨草稿</dd>
            </div>
            <div>
              <dt>状态</dt>
              <dd>未生效</dd>
            </div>
            <div>
              <dt>落点</dt>
              <dd>底部奏折</dd>
            </div>
          </dl>
        </article>

        <article className="scholarPanelCard emperorPanelCourt" aria-labelledby="emperor-court-title">
          <h3 id="emperor-court-title">朝议</h3>
          <p>朝臣发言只显示公开摘要；立场、私议和未公开动机不会在前端定论。</p>
          <EmperorPanelList items={courtDebate} emptyText="暂无朝议投影，可先召内阁、六部、言官各陈所见。" />
          {draftButtonText("召集朝议", "召集朝议，命内阁、六部、言官就奏折队列分别陈奏，先形成问政草稿。", canDraft, onDraft)}
        </article>

        <article className="scholarPanelCard emperorPanelAppointments" aria-labelledby="emperor-appointments-title">
          <h3 id="emperor-appointments-title">任免候选</h3>
          <p>候选列表只是官职与人事安全摘要，不能在前端直接任官、罢官或改写考成。</p>
          <EmperorPanelList items={candidates} emptyText="暂无任免候选投影，可先命吏部具名列缺、资历和考成。" />
          {draftButtonText("审看任免", "审看任免候选，命吏部列明资历、缺额、考成和争议，只拟成候裁草稿。", canDraft, onDraft)}
        </article>

        <article className="scholarPanelCard emperorPanelRewards" aria-labelledby="emperor-rewards-title">
          <h3 id="emperor-rewards-title">赏罚预留</h3>
          <p>赏罚线索只作预留；功过、处分、封赏与追责不得由界面直接结算。</p>
          {consequenceAgenda.active ? (
            <>
              <p>官场后果：{consequenceAgenda.summary}</p>
              <EmperorPanelList
                items={consequenceAgenda.items}
                emptyText="暂无官场后果信号；考成和风宪仍候服务器规则。"
              />
            </>
          ) : null}
          <EmperorPanelList items={rewardPunishments} emptyText="暂无赏罚线索，可先请都察院与吏部各具公开证据。" />
          <div className="scholarPanelActions">
            {consequenceAgenda.actions.slice(0, 3).map((action) => (
              <button key={action.id} type="button" disabled={!canDraft} onClick={() => onDraft(action.text)}>
                {action.label}
              </button>
            ))}
            {draftButtonText("预拟赏罚", "预拟赏罚清单，先列功过证据、关联奏折与待核争议，不直接生效。", canDraft, onDraft)}
          </div>
        </article>

        <article className="scholarPanelCard emperorPanelBoundary" aria-labelledby="emperor-boundary-title">
          <h3 id="emperor-boundary-title">御案边界</h3>
          <ul className="scholarPanelBoundary">
            <li>本面板只读服务器清洗后的公开朝廷视图，不展示内部推演细节、连接凭据或私密宫档。</li>
            <li>按钮只把朱批、拟旨、朝议、任免审看和赏罚预留写入底部行动草稿。</li>
            <li>任免、赏罚、处分、朱批成案、圣旨生效、时间推进和持久化都由服务器裁决。</li>
          </ul>
        </article>
      </div>
    </section>
  );
}

function EmperorPanelList({ items, emptyText }: { readonly items: readonly SafeListItem[]; readonly emptyText: string }) {
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
