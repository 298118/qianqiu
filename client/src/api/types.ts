export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };

export type GameRole = "scholar" | "official" | "emperor" | "minister" | "general" | "magistrate";

export type StartGameRequest = {
  readonly dynasty?: string;
  readonly year?: number;
  readonly role?: GameRole;
  readonly playerName?: string;
  readonly familyBackground?: "poor" | "modest" | "gentry" | "贫寒" | "普通" | "世家";
  readonly background?: string;
  readonly customSetting?: string;
  readonly nativePlace?: string;
  readonly aiSettings?: JsonObject;
};

export type PlayerSummary = {
  readonly name?: string;
  readonly role?: string;
  readonly examRank?: string;
  readonly officeTitle?: string;
};

export type SafeWorldState = {
  readonly player?: PlayerSummary;
  readonly activeExam?: ExamState | null;
  readonly [key: string]: unknown;
};

export type SafeRouteViews = {
  readonly aiSettingsView?: AiSettingsView;
  readonly aiInvocationSummaryView?: JsonObject;
  readonly aiControlAuditView?: JsonObject;
  readonly mapRuntimeView?: MapRuntimeView;
  readonly eventArchiveView?: JsonObject;
  readonly informationPanelPageView?: JsonObject;
  readonly examCalendarView?: JsonObject;
  readonly studyProfileView?: JsonObject;
  readonly officialCareerView?: JsonObject;
  readonly appointmentTrackView?: JsonObject;
  readonly officialPostingsView?: JsonObject;
  readonly localAffairsDocketView?: JsonObject;
  readonly militaryDiplomacyView?: JsonObject;
  readonly economicFiscalView?: JsonObject;
  readonly actorMemoryView?: JsonObject;
  readonly worldEntityView?: JsonObject;
  readonly worldThreadView?: JsonObject;
  readonly [key: string]: unknown;
};

export type StartGameResponse = SafeRouteViews & {
  readonly sessionId: string;
  readonly worldState: SafeWorldState;
  readonly narrative: string;
};

export type PlayerStateResponse = SafeRouteViews & {
  readonly source: "server_player_visible_state_projection";
  readonly sessionId: string;
  readonly worldState: SafeWorldState;
};

export type TurnRequest = {
  readonly sessionId: string;
  readonly input: string;
};

export type TurnResponse = SafeRouteViews & {
  readonly sessionId: string;
  readonly worldState: SafeWorldState;
  readonly narrative?: string;
  readonly examTrigger?: JsonObject | null;
  readonly examScene?: JsonObject | null;
};

export type QuickActionSource = "local-rule" | "mock-ai" | "provider-ai" | "map-runtime" | "surface";

export type QuickActionSuggestionPayload = {
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

export type QuickActionRequest = {
  readonly page: string;
  readonly draftPreview?: string;
  readonly count?: number;
};

export type QuickActionResponse = {
  readonly schemaVersion: string;
  readonly sessionId: string;
  readonly generatedAtTurn?: number;
  readonly source: QuickActionSource;
  readonly status: "ready" | "fallback";
  readonly stale?: boolean;
  readonly fallbackReason?: string;
  readonly quickActionSuggestions: readonly QuickActionSuggestionPayload[];
};

export type SaveMetadata = {
  readonly sessionId: string;
  readonly playerName?: string;
  readonly role?: string;
  readonly roleLabel?: string;
  readonly examRank?: string;
  readonly palaceRank?: string | null;
  readonly officeTitle?: string;
  readonly dynasty?: string;
  readonly year?: number;
  readonly month?: number;
  readonly tenDayPeriod?: number;
  readonly turnCount?: number;
  readonly summary?: string | null;
  readonly createdAt?: string;
  readonly updatedAt?: string;
};

export type SavesResponse = {
  readonly saves: SaveMetadata[];
  readonly skipped: JsonObject[];
};

export type ExamLevel = "child_exam" | "provincial_exam" | "metropolitan_exam" | "palace_exam";

export type ExamState = {
  readonly examId?: string;
  readonly level?: ExamLevel | string;
  readonly examName?: string;
  readonly examQuestion?: string;
  readonly status?: string;
};

export type ExamQuestionRequest = {
  readonly sessionId: string;
  readonly level?: ExamLevel;
};

export type ExamQuestionResponse = SafeRouteViews & ExamState & {
  readonly sessionId: string;
  readonly questionType?: string;
  readonly difficulty?: string;
  readonly requirements?: JsonValue;
  readonly wordCount?: number;
  readonly passScore?: number;
};

export type ExamProgressRequest = {
  readonly sessionId: string;
  readonly examId: string;
  readonly action: string;
};

export type ExamProgressResponse = ExamQuestionResponse & {
  readonly narrative?: string;
  readonly examScene?: JsonObject | null;
  readonly worldTick?: JsonObject | null;
};

export type ExamSubmitRequest = {
  readonly sessionId: string;
  readonly examId: string;
  readonly essay: string;
};

export type ExamSubmitResponse = SafeRouteViews & {
  readonly sessionId: string;
  readonly examId: string;
  readonly level?: string;
  readonly examName?: string;
  readonly score?: JsonObject;
  readonly ranking?: JsonValue;
  readonly promotionResult?: JsonObject;
  readonly worldState: SafeWorldState;
};

export type AiSettingsView = JsonObject & {
  readonly schemaVersion?: string;
  readonly preset?: string;
  readonly providerOptions?: JsonObject[];
  readonly taskRoutes?: JsonObject[];
};

export type AiSettingsResponse = {
  readonly sessionId: string;
  readonly aiSettingsView: AiSettingsView;
  readonly aiInvocationSummaryView?: JsonObject;
  readonly aiControlAuditView?: JsonObject;
};

export type UpdateAiSettingsRequest = {
  readonly settings: JsonObject;
};

export type AiConnectionTestRequest = {
  readonly provider?: string;
};

export type AiConnectionTestResponse = JsonObject & {
  readonly ok?: boolean;
  readonly provider?: string;
  readonly status?: string;
};

export type SafeApiErrorPayload = {
  readonly error?: string;
  readonly message?: string;
};

export type MapRuntimePosition = {
  readonly x: number;
  readonly y: number;
};

export type MapRuntimeStyle = {
  readonly token?: string;
  readonly layer?: string;
  readonly [key: string]: unknown;
};

export type MapRuntimeRef = {
  readonly mapEntityRef?: string;
  readonly sourceRef?: string;
  readonly sourceRefs?: string[];
  readonly label?: string;
  readonly summary?: string;
  readonly layout?: MapRuntimePosition;
  readonly style?: MapRuntimeStyle;
  readonly actionDraftRefs?: string[];
  readonly [key: string]: unknown;
};

export type MapRuntimeRoute = {
  readonly mapEntityRef?: string;
  readonly sourceRef?: string;
  readonly label?: string;
  readonly summary?: string;
  readonly layoutPath?: readonly (readonly [number, number])[];
  readonly actionDraftRefs?: string[];
  readonly [key: string]: unknown;
};

export type MapRuntimeEventEffect = {
  readonly targetRef?: string;
  readonly sourceRefs?: string[];
  readonly label?: string;
  readonly kind?: string;
  readonly severity?: number;
  readonly animationToken?: string;
  readonly [key: string]: unknown;
};

export type MapRuntimeActionDraft = {
  readonly label?: string;
  readonly actionText?: string;
  readonly [key: string]: unknown;
};

export type MapRuntimeView = {
  readonly schemaVersion?: number | string;
  readonly refs?: MapRuntimeRef[];
  readonly routes?: MapRuntimeRoute[];
  readonly eventEffects?: MapRuntimeEventEffect[];
  readonly actionDrafts?: Record<string, MapRuntimeActionDraft>;
  readonly hiddenNotice?: string;
  readonly [key: string]: unknown;
};
