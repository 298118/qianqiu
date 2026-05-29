export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];
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
  "cityPolicyLedger",
  "militaryDiplomacyLedger",
  "judicialCaseLedger",
  "marketPriceLedger",
  "npcEconomyLedger",
  "npcActiveRequestLedger",
  "officialCourtConsequences",
  "officialCourtResponses"
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

export type RawLedgerExcludedFields = {
  readonly [K in RawLedgerKey]?: never;
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
} & RawLedgerExcludedFields & {
  readonly [key: string]: unknown;
};

export type OfficialFirstMonthExperienceView = JsonObject & {
  readonly schemaVersion?: string;
  readonly active?: boolean;
  readonly assignment?: JsonObject | null;
  readonly receipt?: JsonObject | null;
  readonly assessmentSignals?: readonly JsonValue[];
  readonly nextActions?: readonly JsonObject[];
  readonly monthlyBriefingHint?: string;
  readonly authorityBoundary?: string;
};

export type OfficialCourtEntryView = JsonObject & {
  readonly schemaVersion?: string;
  readonly active?: boolean;
  readonly id?: string | null;
  readonly title?: string;
  readonly publicSummary?: string;
  readonly targetSurfaces?: readonly JsonObject[];
  readonly memorialEntry?: JsonObject | null;
  readonly courtDebateEntry?: JsonObject | null;
  readonly assessmentTrace?: JsonObject | null;
  readonly latestResolution?: JsonObject | null;
  readonly resolutionHistory?: readonly JsonObject[];
  readonly latestFollowUp?: JsonObject | null;
  readonly followUpHistory?: readonly JsonObject[];
  readonly followUpScenePreview?: JsonObject | null;
  readonly followUpNextActions?: readonly JsonObject[];
  readonly superiorFollowUp?: string;
  readonly peerFollowUp?: string;
  readonly nextActions?: readonly JsonObject[];
  readonly authorityBoundary?: string;
};

export type OfficialCareerView = JsonObject & {
  readonly firstMonthExperience?: OfficialFirstMonthExperienceView;
  readonly courtEntry?: OfficialCourtEntryView;
  readonly courtEntryResolutions?: readonly JsonObject[];
  readonly courtEntryFollowUps?: readonly JsonObject[];
  readonly courtEntries?: readonly JsonObject[];
};

export type CourtResponseView = JsonObject & {
  readonly schemaVersion?: string;
  readonly active?: boolean;
  readonly role?: string;
  readonly responseRole?: string;
  readonly responseRoleLabel?: string;
  readonly summary?: string;
  readonly counts?: JsonObject;
  readonly chainItems?: readonly JsonObject[];
  readonly responseItems?: readonly JsonObject[];
  readonly recentResponses?: readonly JsonObject[];
  readonly nextActions?: readonly JsonObject[];
  readonly aiReadScope?: readonly JsonValue[];
  readonly toolPermissions?: string;
  readonly proposalBoundaries?: readonly JsonValue[];
  readonly serverAdjudication?: string;
  readonly authorityBoundary?: string;
  readonly safety?: JsonObject;
};

export type CourtConsequenceView = JsonObject & {
  readonly schemaVersion?: string;
  readonly active?: boolean;
  readonly summary?: string;
  readonly pendingSources?: readonly JsonObject[];
  readonly recentSignals?: readonly JsonObject[];
  readonly nextActions?: readonly JsonObject[];
  readonly authorityBoundary?: string;
  readonly safety?: JsonObject;
};

export type RoleCycleEvidenceRef = JsonObject & {
  readonly id?: string;
  readonly label?: string;
  readonly sourceView?: string;
  readonly sourceId?: string;
  readonly sourceType?: string;
  readonly targetRouteId?: string;
  readonly targetSurfaceId?: string;
  readonly visibility?: "player_visible";
};

export type RoleCycleEntryPoint = JsonObject & {
  readonly id?: string;
  readonly label?: string;
  readonly kind?: "route" | "surface" | "reference";
  readonly publicSummary?: string;
  readonly sourceView?: string;
  readonly sourceId?: string;
  readonly targetRouteId?: string;
  readonly targetSurfaceId?: string;
  readonly evidenceRefs?: readonly RoleCycleEvidenceRef[];
  readonly visibility?: "player_visible";
};

export type RoleCycleItem = JsonObject & {
  readonly id?: string;
  readonly title?: string;
  readonly publicSummary?: string;
  readonly sourceView?: string;
  readonly sourceId?: string;
  readonly targetRouteId?: string;
  readonly targetSurfaceId?: string;
  readonly evidenceRefs?: readonly RoleCycleEvidenceRef[];
};

export type RoleCycleCurrentRole = JsonObject & {
  readonly role?: string;
  readonly roleLabel?: string;
  readonly entryPoints?: readonly RoleCycleEntryPoint[];
  readonly items?: readonly RoleCycleItem[];
  readonly evidenceRefs?: readonly RoleCycleEvidenceRef[];
  readonly riskSignals?: readonly JsonObject[];
  readonly nextActions?: readonly JsonObject[];
};

export type RoleCycleView = JsonObject & {
  readonly schemaVersion?: string;
  readonly generatedAtTurn?: number;
  readonly dateLabel?: string;
  readonly activeRole?: string;
  readonly activeRoleLabel?: string;
  readonly summary?: string;
  readonly currentRole?: RoleCycleCurrentRole;
  readonly roleMatrix?: readonly JsonObject[];
  readonly aiReadScope?: JsonObject;
  readonly toolPermissions?: string;
  readonly proposalBoundaries?: readonly JsonValue[];
  readonly serverAdjudication?: string;
  readonly authorityBoundary?: string;
  readonly safety?: JsonObject;
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
  readonly economyTraceView?: JsonObject;
  readonly npcActiveRequestView?: JsonObject;
  readonly roleCycleView?: RoleCycleView;
  readonly mapRuntimeView?: JsonObject;
  readonly eventArchiveView?: JsonObject;
  readonly informationPanelPageView?: JsonObject;
  readonly examCalendarView?: JsonObject;
  readonly examProcedureView?: JsonObject;
  readonly examinerPanelView?: JsonObject;
  readonly examRivalView?: JsonObject;
  readonly examHonorView?: JsonObject;
  readonly examAftermathView?: JsonObject;
  readonly studyProfileView?: JsonObject;
  readonly officialCareerView?: OfficialCareerView;
  readonly courtConsequenceView?: CourtConsequenceView;
  readonly courtResponseView?: CourtResponseView;
  readonly domainConsequenceView?: JsonObject;
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

export type PlayerStateResponse = PlayerStateEnvelope & SafeRouteViews;

export type CommonTurnViews = SafeRouteViews;

export type RouteEnvelope = {
  readonly sessionId: string;
};

export type RouteErrorPayload = {
  readonly error?: string;
  readonly message?: string;
  readonly details?: JsonValue;
};

export type TopicSurfaceResponse = RouteEnvelope & {
  readonly topicSurfaceView: JsonObject;
};

export type SafeWorldSearchResponse = RouteEnvelope & {
  readonly safeWorldSearchView: JsonObject;
};

export type SavesResponse = {
  readonly saves: readonly SaveListEntry[];
  readonly skipped: readonly JsonObject[];
};

export type InventoryResponse = RouteEnvelope & {
  readonly resourceLedgerView?: JsonObject;
  readonly assetLedgerView?: JsonObject;
  readonly inventoryView: JsonObject;
  readonly economyTraceView?: JsonObject;
};

export type InventoryTransferResponse = RouteEnvelope & {
  readonly accepted: boolean;
  readonly reason?: string;
  readonly fromContainerId?: string | null;
  readonly toContainerId?: string | null;
  readonly inventoryView: JsonObject;
  readonly economyTraceView?: JsonObject;
};

export type NpcListResponse = RouteEnvelope & {
  readonly npcRosterView: JsonObject;
  readonly npcInteractionView?: JsonObject;
  readonly delegatedTaskView?: JsonObject;
};

export type NpcDetailResponse = RouteEnvelope & {
  readonly npcDetailView: JsonObject;
  readonly npcInteractionView?: JsonObject;
  readonly tradeLedgerView?: JsonObject;
  readonly delegatedTaskView?: JsonObject;
};

export type NpcInteractionResponse = RouteEnvelope & {
  readonly accepted: boolean;
  readonly errors?: readonly string[];
  readonly npcDialogueView?: JsonObject;
  readonly npcActionResolutionView?: JsonObject | null;
  readonly npcInteractionView: JsonObject;
  readonly npcDetailView?: JsonObject | null;
  readonly actorMemory?: JsonObject;
  readonly actorMemoryView?: JsonObject;
  readonly eventArchiveView?: JsonObject;
  readonly worldEntityView?: JsonObject;
  readonly worldThreadView?: JsonObject;
  readonly worldEntityImpacts?: readonly JsonValue[];
};

export type TradeResponse = RouteEnvelope & {
  readonly accepted: boolean;
  readonly errors?: readonly string[];
  readonly tradeRecord?: JsonObject;
  readonly tradeLedgerView: JsonObject;
  readonly resourceLedgerView?: JsonObject;
  readonly inventoryView?: JsonObject;
  readonly economyTraceView?: JsonObject;
};

export type NpcCommandResponse = RouteEnvelope & {
  readonly accepted: boolean;
  readonly errors?: readonly string[];
  readonly delegatedTaskPlanView?: JsonObject;
  readonly delegatedTask?: JsonObject | null;
  readonly delegatedTaskView: JsonObject;
  readonly economyTraceView?: JsonObject;
};

export type RouteFeedbackView = {
  readonly schemaVersion?: string;
  readonly cadence?: string;
  readonly summary?: string;
  readonly events?: readonly JsonValue[];
  readonly attributeChanges?: readonly JsonObject[];
  readonly outcome?: JsonObject | null;
  readonly [key: string]: JsonValue | undefined;
};

export type LongTermEventFeedbackView = RouteFeedbackView & {
  readonly scheduled?: readonly JsonObject[];
  readonly resolved?: readonly JsonObject[];
};

export type PlayerMonthlyBriefingFeedbackView = {
  readonly generated: boolean;
  readonly summary: string;
  readonly events: readonly JsonValue[];
  readonly reportId: string | null;
};

export type ActorMemoryFeedbackView = {
  readonly appliedCount?: number;
  readonly reinforcedCount?: number;
  readonly rejectedCount?: number;
  readonly rejectedReasons?: readonly string[];
  readonly decayed?: number;
  readonly removed?: number;
};

export type SessionSummaryFeedbackView = {
  readonly updated?: boolean;
  readonly reason?: string;
  readonly summaryId?: string | null;
  readonly publicSummary?: string;
};

export type GameTurnResponse = SafeRouteViews & RouteEnvelope & {
  readonly narrative?: string;
  readonly changes?: readonly string[];
  readonly attributeChanges?: readonly JsonObject[];
  readonly relationshipChanges?: readonly JsonObject[];
  readonly activeNpcRequestEvents?: readonly JsonValue[];
  readonly npcActiveRequestEvents?: readonly JsonValue[];
  readonly worldEntityImpacts?: readonly JsonValue[];
  readonly worldState: RawLedgerExcludedWorldState;
  readonly worldTick?: JsonObject | null;
  readonly feedback?: JsonObject;
  readonly npcActiveRequests?: RouteFeedbackView;
  readonly npcEconomy?: RouteFeedbackView;
  readonly officialCourtConsequence?: RouteFeedbackView;
  readonly officialCourtResponse?: RouteFeedbackView;
  readonly roleWorldCoupling?: RouteFeedbackView;
  readonly roleCycleDomainAdjudication?: RouteFeedbackView;
  readonly longTermEvents?: LongTermEventFeedbackView;
  readonly officialCareer?: RouteFeedbackView;
  readonly playerMonthlyBriefing?: PlayerMonthlyBriefingFeedbackView;
  readonly actorMemory?: ActorMemoryFeedbackView;
  readonly sessionSummary?: SessionSummaryFeedbackView;
  readonly timeSkip?: JsonObject | null;
  readonly examTrigger?: JsonObject | null;
  readonly examScene?: JsonObject | null;
};

export type GameTurnSseStatePreviewResponse = SafeRouteViews & {
  readonly sessionId: string;
  readonly status?: "accepted";
  readonly attributeChanges?: readonly JsonObject[];
  readonly relationshipChanges?: readonly JsonObject[];
  readonly activeNpcRequestEvents?: readonly JsonValue[];
  readonly npcActiveRequestEvents?: readonly JsonValue[];
  readonly worldEntityImpacts?: readonly JsonValue[];
  readonly npcActiveRequests?: RouteFeedbackView;
  readonly npcEconomy?: RouteFeedbackView;
  readonly officialCourtConsequence?: RouteFeedbackView;
  readonly officialCourtResponse?: RouteFeedbackView;
  readonly roleWorldCoupling?: RouteFeedbackView;
  readonly roleCycleDomainAdjudication?: RouteFeedbackView;
  readonly longTermEvents?: LongTermEventFeedbackView;
  readonly officialCareer?: RouteFeedbackView;
  readonly playerMonthlyBriefing?: PlayerMonthlyBriefingFeedbackView;
  readonly actorMemory?: ActorMemoryFeedbackView;
  readonly sessionSummary?: SessionSummaryFeedbackView;
  readonly timeSkip?: JsonObject | null;
  readonly examTrigger?: JsonObject | null;
  readonly examScene?: JsonObject | null;
  readonly worldTick?: JsonObject | null;
  readonly worldState?: never;
};

export type ExamWordCount =
  | number
  | {
      readonly min?: number;
      readonly max?: number;
      readonly target?: number;
      readonly recommended?: number;
    };

export type ExamPayload = SafeRouteViews & RouteEnvelope & {
  readonly examId: string;
  readonly level: string;
  readonly examName: string;
  readonly examQuestion: string;
  readonly questionType?: string;
  readonly difficulty?: string;
  readonly requirements?: JsonValue;
  readonly wordCount?: ExamWordCount;
  readonly passScore?: number;
  readonly promotionRank?: string;
  readonly readiness?: JsonObject;
  readonly entryPreparation?: JsonObject | null;
  readonly examCalendar?: JsonObject | null;
  readonly sceneTime?: JsonObject | null;
  readonly worldState: RawLedgerExcludedWorldState;
};

export type ExamQuestionResponse = ExamPayload;

export type ExamProgressResponse = ExamPayload & {
  readonly narrative?: string;
  readonly examScene?: JsonObject | null;
  readonly worldTick?: JsonObject | null;
};

export type ExamSubmitResponse = SafeRouteViews & RouteEnvelope & {
  readonly examId: string;
  readonly level: string;
  readonly examName: string;
  readonly examQuestion: string;
  readonly essay?: string;
  readonly entryPreparation?: JsonObject | null;
  readonly examCalendar?: JsonObject | null;
  readonly sceneTime?: JsonObject | null;
  readonly examStartedAt?: string;
  readonly examSubmittedAt?: string;
  readonly score?: JsonObject;
  readonly scoreBeforeExaminerReview?: JsonObject;
  readonly authenticityCheck?: JsonObject;
  readonly virtualCandidates?: readonly JsonObject[];
  readonly ranking?: readonly JsonObject[];
  readonly promotionResult?: JsonObject;
  readonly cohortResult?: JsonObject;
  readonly actorMemory?: ActorMemoryFeedbackView;
  readonly worldState: RawLedgerExcludedWorldState;
};

export type AiSettingsView = {
  readonly schemaVersion?: string;
  readonly preset?: string;
  readonly presetLabel?: string;
  readonly presets?: readonly JsonObject[];
  readonly providerOptions?: readonly JsonObject[];
  readonly controls?: JsonObject;
  readonly taskRoutes?: readonly JsonObject[];
  readonly safeguards?: JsonObject;
  readonly [key: string]: JsonValue | undefined;
};

export type AiSettingsRouteResponse = RouteEnvelope & {
  readonly targetSessionId?: string | null;
  readonly scope: "global" | "session" | string;
  readonly updatedAt?: string | null;
  readonly globalSettingsExists?: boolean;
  readonly settings?: JsonObject;
  readonly routePolicy?: AiModelRoutePolicy;
  readonly aiSettingsView: AiSettingsView;
  readonly aiInvocationSummaryView?: JsonObject;
  readonly aiControlAuditView?: JsonObject;
};

export type AiPublicTraceSummary = AiPublicForbiddenFields & {
  readonly schemaVersion: string;
  readonly traceId: string;
  readonly taskKind: string;
  readonly taskType: string;
  readonly promptPackId: string;
  readonly promptVersion: string;
  readonly provider: string;
  readonly model: string;
  readonly latencyMs: number;
  readonly status: "running" | "ok" | "fallback" | "failed" | "rejected" | string;
  readonly fallbackReason: string;
  readonly retrievalCounts: JsonObject;
  readonly toolCounts: JsonObject;
  readonly validationFlags: JsonObject;
};

export type AiTraceFeedbackOption = {
  readonly id: "useful" | "off_tone" | "forgot_context" | "too_short" | "too_long" | "role_mismatch" | string;
  readonly label: string;
};

export type AiTraceFeedbackEntry = AiPublicForbiddenFields & {
  readonly schemaVersion: string;
  readonly feedbackRecordId: string;
  readonly traceId: string;
  readonly taskType: string;
  readonly taskLabel: string;
  readonly feedbackId: string;
  readonly label: string;
  readonly recordedTurn: number;
  readonly createdAt: string;
  readonly changesGameState: false;
};

export type AiTraceDebugView = AiPublicForbiddenFields & {
  readonly schemaVersion: string;
  readonly sessionId: string;
  readonly generatedAtTurn: number;
  readonly traceCount: number;
  readonly traces: readonly AiPublicTraceSummary[];
  readonly feedbackOptions: readonly AiTraceFeedbackOption[];
  readonly recentFeedback: readonly AiTraceFeedbackEntry[];
  readonly safety: JsonObject;
};

export type AiTraceDebugResponse = RouteEnvelope & {
  readonly aiTraceDebugView: AiTraceDebugView;
};

export type AiTraceFeedbackResponse = RouteEnvelope & {
  readonly accepted: boolean;
  readonly feedback: AiTraceFeedbackEntry;
  readonly aiTraceDebugView: AiTraceDebugView;
};

export type AiConnectionTestResponse = AiPublicForbiddenFields & {
  readonly ok: boolean;
  readonly provider: string;
  readonly configuredProvider?: string;
  readonly checkedAt?: string;
  readonly latencyMs?: number;
  readonly supportsStreaming?: boolean;
  readonly models?: JsonObject;
  readonly openingEventCount?: number;
  readonly narrativePreview?: string;
  readonly error?: string;
};

export type QuickActionSource = "local-rule" | "mock-ai" | "provider-ai";

export type QuickActionSuggestionView = {
  readonly id: string;
  readonly source: QuickActionSource;
  readonly sourceLabel?: string;
  readonly title: string;
  readonly label: string;
  readonly text: string;
  readonly roleTags: readonly string[];
  readonly toolIntent?: string;
  readonly evidenceRefs?: readonly string[];
  readonly status?: "ready" | "loading" | "failed" | "stale" | "applied";
};

export type QuickActionResponse = RouteEnvelope & {
  readonly schemaVersion: string;
  readonly generatedAtTurn?: number;
  readonly source: QuickActionSource;
  readonly status: "ready" | "fallback";
  readonly stale?: boolean;
  readonly fallbackReason?: string;
  readonly quickActionSuggestions: readonly QuickActionSuggestionView[];
};

export type TopicDraftResponse = RouteEnvelope & {
  readonly schemaVersion: string;
  readonly generatedAtTurn?: number;
  readonly surfaceId: string;
  readonly source: QuickActionSource;
  readonly status: "ready" | "fallback";
  readonly fallbackReason?: string;
  readonly topicDraft: JsonObject;
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
  readonly allowStrictSchema?: boolean;
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

export type AiPublicForbiddenField =
  | "rawPayload"
  | "rawProviderPayload"
  | "providerPayload"
  | "rawPrompt"
  | "fullPrompt"
  | "prompt"
  | "instructions"
  | "input"
  | "request"
  | "requestBody"
  | "response"
  | "responseBody"
  | "headers"
  | "apiKey"
  | "key"
  | "token"
  | "baseURL"
  | "baseUrl"
  | "localPath"
  | "statePatch"
  | "worldState";

export type AiPublicForbiddenFields = {
  readonly [K in AiPublicForbiddenField]?: never;
};

export type AiRemoteTaskEnvelope = {
  readonly promptPack?: string;
  readonly schemaName: string;
  readonly schema: JsonObject;
  readonly instructions: string;
  readonly input: string;
  readonly maxOutputTokens?: number;
  readonly onTextDelta?: (delta: string) => void;
};

export type AiPromptTaskEnvelope = Omit<AiRemoteTaskEnvelope, "schema" | "onTextDelta"> & {
  readonly schema?: never;
};

export type AiRemoteRawModelResult = string | JsonObject;

export type AiRemoteTextRequester = (
  task: AiRemoteTaskEnvelope
) => Promise<AiRemoteRawModelResult>;

export type AiRemoteStreamRequester = (
  task: AiRemoteTaskEnvelope & { readonly onTextDelta: (delta: string) => void }
) => Promise<AiRemoteRawModelResult | null | undefined | void>;

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
  readonly domain_schema_version?: number;
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

export type SqlitePromptRetrievalSourceName = "server_visible_prompt_projection";
export type SqliteSafeSearchSourceName = "server_visible_safe_search_projection";

export type SqlitePromptRetrievalRow = BaseSqliteDerivedRow & {
  readonly domain_schema_version: number;
  readonly revision: number;
  readonly row_revision: number;
  readonly source: SqlitePromptRetrievalSourceName;
  readonly source_view: string;
  readonly domain: string;
  readonly collection: string;
  readonly visibility: "public" | string;
  readonly sort_priority: number;
  readonly payload_json: string;
  readonly search_text: string;
  readonly metadata_json: string;
  readonly created_at: string;
  readonly updated_at: string;
};

export type SqliteSafeSearchIndexRow = {
  readonly session_id: string;
  readonly row_id: string;
  readonly safe_search_schema_version: number;
  readonly revision: number;
  readonly row_revision: number;
  readonly source: SqliteSafeSearchSourceName;
  readonly source_view: string;
  readonly domain: string;
  readonly source_id: string;
  readonly title: string;
  readonly summary: string;
  readonly confidence: number;
  readonly visibility: "public" | string;
  readonly related_refs_json: string;
  readonly route_view_ref_json: string;
  readonly search_text: string;
  readonly metadata_json: string;
  readonly created_at: string;
  readonly updated_at: string;
};

export type SqliteSafeSearchFtsRow = Pick<
  SqliteSafeSearchIndexRow,
  "session_id" | "row_id" | "domain" | "title" | "summary" | "search_text"
>;

export type SqliteDerivedRepairStatus = {
  readonly count?: number;
  readonly counts?: JsonObject;
  readonly contentMismatches?: boolean;
  readonly expectedCount?: number;
  readonly expectedCounts?: JsonObject;
  readonly ftsAvailable?: boolean;
  readonly ftsMismatches?: boolean;
  readonly missingOrMismatched?: boolean;
  readonly mismatchedRowIds?: boolean;
  readonly needsRepair: boolean;
  readonly staleRows?: boolean;
  readonly tableNeedsRepair: boolean;
  readonly worldStateChanged?: boolean;
};

export type SqlitePromptRetrievalRepairStatus = SqliteDerivedRepairStatus & {
  readonly contentMismatches: boolean;
  readonly count: number;
  readonly expectedCount: number;
  readonly missingOrMismatched: boolean;
  readonly mismatchedRowIds: boolean;
  readonly staleRows: boolean;
};

export type SqliteSafeSearchRepairStatus = SqlitePromptRetrievalRepairStatus & {
  readonly ftsAvailable: boolean;
  readonly ftsMismatches: boolean;
};

export type SqlitePromptRetrievalSource = Readonly<Record<string, Readonly<Record<string, readonly JsonObject[]>>>>;

export type SqliteDerivedPublicDriftStatus = SqliteDerivedRepairStatus & {
  readonly missingTables?: readonly string[];
};

export type SqliteSessionDerivedDriftStatus = {
  readonly sessionId: string;
  readonly revision: number;
  readonly domains: Readonly<Record<string, SqliteDerivedPublicDriftStatus>>;
  readonly needsRepair: boolean;
};

export type SqliteDerivedTableDriftStatus = {
  readonly checked: number;
  readonly missingWorldSessionsTable: boolean;
  readonly needsRepair: boolean;
  readonly sessions: readonly SqliteSessionDerivedDriftStatus[];
  readonly skipped: readonly {
    readonly sessionId: string;
    readonly reason: string;
  }[];
};

export type SqliteDatabaseStatus = {
  readonly databasePathRedacted: true;
  readonly journalMode: string;
  readonly size: JsonObject;
  readonly counts: JsonObject;
  readonly migrations: JsonObject;
};

export type SqliteIndexHealth = {
  readonly ok: boolean;
  readonly checkedTables: number;
  readonly checkedIndexes: number;
  readonly missingTables: readonly string[];
  readonly missingIndexes: readonly string[];
  readonly presentTableCount: number;
  readonly presentIndexCount: number;
};

export type SqliteSafeDiagnostics = {
  readonly command: "export-safe";
  readonly generatedAt: string;
  readonly status: SqliteDatabaseStatus;
  readonly indexHealth: SqliteIndexHealth;
  readonly derivedTableDrift: SqliteDerivedTableDriftStatus;
};
