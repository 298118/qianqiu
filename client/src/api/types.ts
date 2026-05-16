export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };

export type GameRole = "scholar" | "official" | "emperor" | "minister" | "general" | "magistrate";

export type StartGameRequest = {
  readonly dynasty?: string;
  readonly year?: number;
  readonly role?: GameRole;
  readonly playerName?: string;
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
  readonly mapRuntimeView?: JsonObject;
  readonly eventArchiveView?: JsonObject;
  readonly informationPanelPageView?: JsonObject;
  readonly examCalendarView?: JsonObject;
  readonly studyProfileView?: JsonObject;
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

export type SaveMetadata = {
  readonly sessionId: string;
  readonly playerName?: string;
  readonly role?: string;
  readonly examRank?: string;
  readonly officeTitle?: string;
  readonly dynasty?: string;
  readonly year?: number;
  readonly month?: number;
  readonly tenDayPeriod?: number;
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
