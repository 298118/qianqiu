export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };

export type GameRole = "scholar" | "official" | "emperor" | "minister" | "general" | "magistrate";

export type AiProviderName = "mock" | "openai" | "deepseek" | "mimo" | "mimo-deepseek" | "anthropic";

export type AiTaskType =
  | "narrator"
  | "actor_mind"
  | "planner"
  | "domain_specialist"
  | "critic"
  | "safety_gate"
  | "memory_summarizer"
  | "monthly_briefing"
  | "time_skip_planner"
  | "quick_action"
  | "topic_draft"
  | "background_claim_parser"
  | "npc_dialogue"
  | "npc_private_planner"
  | "trade_negotiator"
  | "delegated_task_planner"
  | "delegated_task_reporter"
  | "inventory_effect_explainer";

export type PlayerStatePatch = {
  readonly health?: number;
  readonly gold?: number;
  readonly academia?: number;
  readonly literaryTalent?: number;
  readonly adaptability?: number;
  readonly mentality?: number;
  readonly reputation?: number;
  readonly studiedBooks?: readonly string[];
  readonly connections?: readonly string[];
  readonly personalPower?: number;
  readonly courtControl?: number;
  readonly mandate?: number;
  readonly faction?: string;
  readonly influence?: number;
  readonly integrity?: number;
  readonly superiorFavor?: number;
  readonly peerNetwork?: number;
  readonly performanceMerit?: number;
  readonly promotionProspect?: number;
  readonly impeachmentRisk?: number;
  readonly cleanReputation?: number;
  readonly command?: number;
  readonly troops?: number;
  readonly supply?: number;
  readonly battleReputation?: number;
  readonly scouting?: number;
  readonly campaignRisk?: number;
  readonly countyName?: string;
  readonly localTreasury?: number;
  readonly localOrder?: number;
  readonly gentryRelations?: number;
  readonly banditPressure?: number;
  readonly pendingLawsuits?: number;
  readonly corveeBurden?: number;
  readonly waterworks?: number;
};

export type ProviderStatePatch = {
  readonly treasury?: number;
  readonly grainReserve?: number;
  readonly population?: number;
  readonly publicOrder?: number;
  readonly taxRate?: number;
  readonly corruption?: number;
  readonly armySize?: number;
  readonly armyMorale?: number;
  readonly borderThreat?: number;
  readonly factions?: Readonly<Record<string, number>>;
  readonly player?: PlayerStatePatch;
};

export const RAW_LEDGER_KEYS = [
  "actorMemoryLedger",
  "sessionSummary",
  "assetLedger",
  "resourceLedger",
  "inventoryLedger",
  "npcRoster",
  "delegatedTaskLedger",
  "npcInteractionLedger",
  "tradeLedger",
  "openingBackgroundClaims",
  "marketPriceLedger",
  "npcEconomyLedger",
  "npcActiveRequestLedger"
] as const;

export type RawLedgerKey = (typeof RAW_LEDGER_KEYS)[number];

export type WorldStatePlayer = {
  readonly role?: GameRole | string;
  readonly roleLabel?: string;
  readonly name?: string;
  readonly portraitRef?: string | null;
  readonly health?: number;
  readonly gold?: number;
  readonly examRank?: string | null;
  readonly palaceRank?: string | null;
  readonly officeTitle?: string | null;
  readonly position?: string;
  readonly [key: string]: unknown;
};

export type WorldState = {
  readonly sessionId: string;
  readonly year?: number;
  readonly month?: number;
  readonly tenDayPeriod?: number;
  readonly dynasty?: string;
  readonly turnCount?: number;
  readonly player?: WorldStatePlayer;
  readonly eventHistory?: readonly string[];
  readonly activeExam?: JsonObject | null;
  readonly [key: string]: unknown;
};

export type SessionMetadata = {
  readonly playerName: string;
  readonly role: string;
  readonly roleLabel: string;
  readonly dynasty: string;
  readonly year: number;
  readonly month: number;
  readonly tenDayPeriod: number;
  readonly turnCount: number;
  readonly examRank: string | null;
  readonly palaceRank: string | null;
  readonly officeTitle: string | null;
  readonly summary: string;
};

export type SessionRecord = {
  readonly storageSchemaVersion: number;
  readonly sessionId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly revision: number;
  readonly metadata: SessionMetadata;
  readonly worldState: WorldState;
};

export type SessionRecordNormalization = {
  readonly record: SessionRecord;
  readonly appliedMigrations: readonly string[];
};

export type SaveListEntry = SessionMetadata & {
  readonly sessionId: string;
  readonly storageSchemaVersion: number;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type PlayerVisibleState = Pick<
  WorldState,
  | "sessionId"
  | "year"
  | "month"
  | "tenDayPeriod"
  | "dynasty"
  | "turnCount"
  | "activeExam"
> & {
  readonly player: WorldStatePlayer;
  readonly [key: string]: unknown;
};

export type RawLedgerExcludedWorldState = Omit<WorldState, RawLedgerKey> & {
  readonly [K in RawLedgerKey]?: never;
};

export type PlayerStateEnvelope = {
  readonly schemaVersion: string;
  readonly source: "server_player_visible_state_projection";
  readonly sessionId: string;
  readonly storageSchemaVersion: number | null;
  readonly revision: number | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
  readonly metadata: JsonValue;
  readonly worldState: PlayerVisibleState;
  readonly redaction: {
    readonly playerVisibleOnly: true;
    readonly rawStateIncluded: false;
    readonly omittedSections: readonly string[];
  };
};

export type SafeRouteViews = {
  readonly aiSettingsView?: JsonObject;
  readonly aiInvocationSummaryView?: JsonObject;
  readonly aiControlAuditView?: JsonObject;
  readonly openingBackgroundClaimsView?: JsonObject;
  readonly assetLedgerView?: JsonObject;
  readonly resourceLedgerView?: JsonObject;
  readonly inventoryView?: JsonObject;
  readonly npcRosterView?: JsonObject;
  readonly npcInteractionView?: JsonObject;
  readonly tradeLedgerView?: JsonObject;
  readonly delegatedTaskView?: JsonObject;
  readonly marketPriceView?: JsonObject;
  readonly npcEconomyView?: JsonObject;
  readonly npcActiveRequestView?: JsonObject;
  readonly mapRuntimeView?: JsonObject;
  readonly eventArchiveView?: JsonObject;
  readonly informationPanelPageView?: JsonObject;
  readonly examCalendarView?: JsonObject;
  readonly examProcedureView?: JsonObject;
  readonly examinerPanelView?: JsonObject;
  readonly examRivalView?: JsonObject;
  readonly examHonorView?: JsonObject;
  readonly studyProfileView?: JsonObject;
  readonly officialCareerView?: JsonObject;
  readonly appointmentTrackView?: JsonObject;
  readonly officialPostingsView?: JsonObject;
  readonly localAffairsDocketView?: JsonObject;
  readonly militaryDiplomacyView?: JsonObject;
  readonly economicFiscalView?: JsonObject;
  readonly actorMemoryView?: JsonObject;
  readonly sessionSummaryView?: JsonObject;
  readonly roleWorldCouplingView?: JsonObject;
  readonly worldGeographyView?: JsonObject;
  readonly worldEntityView?: JsonObject;
  readonly worldThreadView?: JsonObject;
  readonly longTermEventView?: JsonObject;
  readonly activeNpcRequestView?: JsonObject;
  readonly playerMonthlyBriefingView?: JsonObject;
  readonly relationshipView?: JsonObject;
  readonly worldPeopleView?: JsonObject;
  readonly mapContextView?: JsonObject;
  readonly historicalEventArchiveView?: JsonObject;
  readonly intelligenceRumorView?: JsonObject;
  readonly topicSurfaceView?: JsonObject;
  readonly [key: string]: JsonValue | undefined;
};

export type GameStartResponse = SafeRouteViews & {
  readonly sessionId: string;
  readonly worldState: RawLedgerExcludedWorldState;
  readonly narrative?: string;
};

export type GameStateResponse = SafeRouteViews & {
  readonly sessionId: string;
  readonly worldState: RawLedgerExcludedWorldState;
};

export type PlayerStateResponse = PlayerStateEnvelope & {
  readonly routeViews?: SafeRouteViews;
};

export type GameTurnResponse = SafeRouteViews & {
  readonly sessionId: string;
  readonly narrative?: string;
  readonly changes?: readonly string[];
  readonly worldState: RawLedgerExcludedWorldState;
  readonly worldTick?: JsonObject;
  readonly feedback?: JsonObject;
};

export type AiModelRoute = {
  readonly taskType: AiTaskType;
  readonly provider: AiProviderName;
  readonly model: string;
  readonly purpose?: string;
  readonly temperature: number;
  readonly maxOutputTokens: number;
  readonly timeoutMs: number;
  readonly toolBudget: number;
  readonly mayUseTools: boolean;
  readonly mayRequestAdjudication: boolean;
  readonly mayWriteState: false;
  readonly mayCallServerResolvers: false;
  readonly reviewerOnly: boolean;
  readonly fallbackProvider: "mock";
  readonly audit?: JsonObject;
};

export type AiModelRoutePolicy = {
  readonly schemaVersion: string;
  readonly defaultProvider: AiProviderName;
  readonly routes: Readonly<Record<AiTaskType, AiModelRoute>>;
  readonly safeguards: {
    readonly serverOwnsState: true;
    readonly criticAndSafetyReviewOnly?: true;
    readonly noRawSqlTools?: true;
    readonly noHiddenContextUpgrade?: true;
    readonly consensusDoesNotBypassResolver: true;
  };
};

export type AiProviderResponse = {
  readonly narrative?: string;
  readonly statePatch?: ProviderStatePatch;
  readonly events?: readonly string[];
  readonly examTrigger?: JsonObject;
  readonly relationshipChanges?: readonly JsonObject[];
  readonly memoryProposals?: readonly JsonObject[];
  readonly [key: string]: unknown;
};

export type AiToolPermission = {
  readonly actorTiers?: readonly string[];
  readonly actorTypes?: readonly string[];
  readonly toolGroups?: readonly string[];
  readonly visibilityPreset?: string;
  readonly proposalOnly?: boolean;
  readonly requestAdjudicationOnly?: boolean;
  readonly [key: string]: unknown;
};

export type AiToolEnvelope<TArgs extends JsonObject = JsonObject> = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonObject;
  readonly permission: AiToolPermission;
  readonly resolver: {
    readonly kind: string;
    readonly serverOwned: true;
    readonly [key: string]: unknown;
  };
  readonly audit: JsonObject;
  readonly cooldown?: JsonObject;
  readonly mockFallback?: JsonObject;
  readonly riskTags?: readonly string[];
  readonly providerCompatibility?: JsonObject;
  readonly __args?: TArgs;
};

export type AiProviderFacade = {
  readonly supportsStreaming?: boolean;
  readonly modelRoute?: Pick<
    AiModelRoute,
    | "taskType"
    | "provider"
    | "model"
    | "reviewerOnly"
    | "mayUseTools"
    | "mayRequestAdjudication"
    | "maxOutputTokens"
    | "timeoutMs"
    | "temperature"
  >;
  startGame(...args: readonly unknown[]): Promise<AiProviderResponse>;
  runTurn(...args: readonly unknown[]): Promise<AiProviderResponse>;
  streamTurn(...args: readonly unknown[]): Promise<unknown>;
  generateExamQuestion(...args: readonly unknown[]): Promise<AiProviderResponse>;
  suggestQuickActions(...args: readonly unknown[]): Promise<AiProviderResponse>;
  draftTopicSurface(...args: readonly unknown[]): Promise<AiProviderResponse>;
  parseBackgroundClaims(...args: readonly unknown[]): Promise<AiProviderResponse>;
  runNpcDialogue(...args: readonly unknown[]): Promise<AiProviderResponse>;
  planNpcPrivateIntent(...args: readonly unknown[]): Promise<AiProviderResponse>;
  negotiateTrade(...args: readonly unknown[]): Promise<AiProviderResponse>;
  planDelegatedTask(...args: readonly unknown[]): Promise<AiProviderResponse>;
  reportDelegatedTask(...args: readonly unknown[]): Promise<AiProviderResponse>;
  explainInventoryEffect(...args: readonly unknown[]): Promise<AiProviderResponse>;
  gradeExamEssay(...args: readonly unknown[]): Promise<AiProviderResponse>;
};

export type SessionStorageAdapter = {
  readonly name: "json" | "sqlite";
  readonly CURRENT_STORAGE_SCHEMA_VERSION: number;
  readonly SESSIONS_DIR?: string;
  readSession(sessionId: string): Promise<WorldState>;
  readSessionRecord(sessionId: string): Promise<SessionRecordNormalization>;
  writeSession(worldState: WorldState, options?: JsonObject): Promise<WorldState>;
  mutateSession<T = WorldState>(
    sessionId: string,
    mutator: (worldState: WorldState, context: JsonObject) => T | Promise<T>
  ): Promise<T | WorldState>;
  listSessions(): Promise<{ readonly saves: readonly SaveListEntry[]; readonly skipped: readonly JsonObject[] }>;
  deleteSession(sessionId: string): Promise<void>;
  appendAuditEvent(sessionId: string, event: JsonObject, options?: JsonObject): Promise<JsonObject>;
  appendAiProposal(sessionId: string, proposal: JsonObject, options?: JsonObject): Promise<JsonObject>;
  listAuditEvents(sessionId: string, options?: JsonObject): Promise<readonly JsonObject[]>;
  listAiProposals(sessionId: string, options?: JsonObject): Promise<readonly JsonObject[]>;
  cleanupSessionTempFiles?(options?: JsonObject): Promise<JsonObject>;
  searchSafeSearchIndex?(sessionId: string, options?: JsonObject): Promise<JsonObject>;
  importSessionRecord?(record: SessionRecord, options?: JsonObject): Promise<SessionRecord>;
  close?(): void;
  buildSessionMetadata(worldState: WorldState): SessionMetadata;
  normalizeSessionRecord(
    parsed: unknown,
    expectedSessionId?: string,
    options?: JsonObject
  ): SessionRecordNormalization;
};

export type SqliteWorldSessionRow = {
  readonly session_id: string;
  readonly storage_schema_version: number;
  readonly revision: number;
  readonly created_at: string;
  readonly updated_at: string;
  readonly player_name: string;
  readonly role: string;
  readonly role_label: string;
  readonly dynasty: string;
  readonly year: number;
  readonly month: number;
  readonly ten_day_period: number;
  readonly turn_count: number;
  readonly exam_rank: string | null;
  readonly palace_rank: string | null;
  readonly office_title: string | null;
  readonly summary: string;
  readonly metadata_json: string;
  readonly world_state_json: string;
};

export type BaseSqliteDerivedRow = {
  readonly session_id: string;
  readonly row_id: string;
  readonly domain_schema_version?: string;
  readonly revision?: number;
  readonly row_revision?: number;
  readonly source?: string;
  readonly visibility?: string;
  readonly summary?: string;
  readonly refs_json?: string;
  readonly metadata_json?: string;
  readonly created_at?: string;
  readonly updated_at?: string;
};
