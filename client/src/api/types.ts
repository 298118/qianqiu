export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };

export type GameRole = "scholar" | "official" | "emperor" | "minister" | "general" | "magistrate";

export type StartGameRequest = {
  readonly dynasty?: string;
  readonly year?: number;
  readonly role?: GameRole;
  readonly playerName?: string;
  readonly portraitRef?: string;
  readonly familyBackground?: "poor" | "modest" | "gentry" | "贫寒" | "普通" | "世家";
  readonly background?: string;
  readonly customSetting?: string;
  readonly nativePlace?: string;
  readonly aiSettings?: JsonObject;
};

export type PlayerSummary = {
  readonly name?: string;
  readonly role?: string;
  readonly portraitRef?: string | null;
  readonly examRank?: string;
  readonly officeTitle?: string;
};

export type WorldPeopleNpc = {
  readonly id: string;
  readonly name?: string;
  readonly portraitRef?: string | null;
  readonly courtesyName?: string;
  readonly genderLabel?: string;
  readonly age?: number;
  readonly alive?: boolean;
  readonly homeCityId?: string;
  readonly currentCityId?: string;
  readonly householdId?: string | null;
  readonly currentOfficeId?: string;
  readonly currentPostingId?: string;
  readonly rankLabel?: string;
  readonly bureauId?: string;
  readonly factionId?: string;
  readonly currentGoal?: string;
  readonly reputation?: number;
  readonly influence?: number;
  readonly visibility?: string;
  readonly knownToPlayer?: boolean;
  readonly intelConfidence?: number;
  readonly publicSummary?: string;
  readonly lastUpdatedTurn?: number;
  readonly [key: string]: unknown;
};

export type WorldPeopleRelationship = {
  readonly id: string;
  readonly sourceType?: string;
  readonly sourceId?: string;
  readonly targetType?: string;
  readonly targetId?: string;
  readonly relationship?: number;
  readonly trust?: number;
  readonly resentment?: number;
  readonly stance?: string;
  readonly recentIntent?: string;
  readonly recentNotes?: readonly string[];
  readonly visibility?: string;
  readonly knownToPlayer?: boolean;
  readonly publicSummary?: string;
  readonly [key: string]: unknown;
};

export type WorldPeopleView = {
  readonly schemaVersion?: number | string;
  readonly generatedAtTurn?: number;
  readonly npcs?: readonly WorldPeopleNpc[];
  readonly relationships?: readonly WorldPeopleRelationship[];
  readonly households?: readonly JsonObject[];
  readonly assets?: readonly JsonObject[];
  readonly estates?: readonly JsonObject[];
  readonly hiddenNotice?: string;
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

export type DomainConsequenceItemView = JsonObject & {
  readonly schemaVersion?: number | string;
  readonly id?: string;
  readonly sourceType?: "city_policy" | "military_diplomacy" | "judicial_case" | "npc_economy" | string;
  readonly sourceLabel?: string;
  readonly sourceId?: string;
  readonly publicEchoRef?: string;
  readonly kind?: string;
  readonly kindLabel?: string;
  readonly title?: string;
  readonly publicSummary?: string;
  readonly status?: string;
  readonly statusLabel?: string;
  readonly generatedAtTurn?: number;
  readonly year?: number;
  readonly month?: number;
  readonly tenDayPeriod?: number;
  readonly affectedMetricLabels?: readonly string[];
  readonly severity?: number;
  readonly consequenceRefs?: readonly string[];
  readonly nextStep?: string;
};

export type DomainConsequenceView = JsonObject & {
  readonly schemaVersion?: number | string;
  readonly generatedAtTurn?: number;
  readonly active?: boolean;
  readonly summary?: string;
  readonly counts?: JsonObject;
  readonly caps?: JsonObject & {
    readonly recentConsequences?: number;
    readonly sourceRowsPerLedger?: number;
    readonly nextActions?: number;
    readonly publicCandidates?: number;
    readonly roleEligibleCandidates?: number;
    readonly visibleConsequences?: number;
    readonly roleLimited?: boolean;
    readonly capped?: boolean;
  };
  readonly roleVisibility?: JsonObject & {
    readonly viewerRole?: string;
    readonly viewerRoleLabel?: string;
    readonly visibleSourceTypes?: readonly string[];
    readonly omittedSourceTypes?: readonly string[];
  };
  readonly trackingEntryPoints?: readonly JsonObject[];
  readonly recentConsequences?: readonly DomainConsequenceItemView[];
  readonly nextActions?: readonly JsonObject[];
  readonly aiReadScope?: string;
  readonly actorIntelligence?: string;
  readonly toolPermissions?: string;
  readonly proposalBoundaries?: readonly JsonValue[];
  readonly serverAdjudication?: string;
  readonly safety?: JsonObject;
};

export type SafeWorldState = {
  readonly player?: PlayerSummary;
  readonly activeExam?: ExamState | null;
  readonly [key: string]: unknown;
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
  readonly proposalBoundaries?: readonly unknown[];
  readonly serverAdjudication?: string;
  readonly authorityBoundary?: string;
  readonly safety?: JsonObject;
};

export type SafeRouteViews = {
  readonly aiSettingsView?: AiSettingsView;
  readonly aiInvocationSummaryView?: JsonObject;
  readonly aiControlAuditView?: JsonObject;
  readonly openingBackgroundClaimsView?: OpeningBackgroundClaimsView;
  readonly assetLedgerView?: AssetLedgerView;
  readonly resourceLedgerView?: ResourceLedgerView;
  readonly inventoryView?: InventoryView;
  readonly npcRosterView?: NpcRosterView;
  readonly npcInteractionView?: NpcInteractionView;
  readonly tradeLedgerView?: TradeLedgerView;
  readonly delegatedTaskView?: DelegatedTaskView;
  readonly marketPriceView?: MarketPriceView;
  readonly npcEconomyView?: NpcEconomyView;
  readonly npcActiveRequestView?: NpcActiveRequestView;
  readonly roleCycleView?: RoleCycleView;
  readonly mapRuntimeView?: MapRuntimeView;
  readonly eventArchiveView?: JsonObject;
  readonly informationPanelPageView?: JsonObject;
  readonly examCalendarView?: JsonObject;
  readonly examProcedureView?: ExamProcedureView;
  readonly examinerPanelView?: JsonObject;
  readonly examRivalView?: JsonObject;
  readonly examHonorView?: JsonObject;
  readonly examAftermathView?: JsonObject;
  readonly studyProfileView?: JsonObject;
  readonly officialCareerView?: OfficialCareerView;
  readonly courtConsequenceView?: CourtConsequenceView;
  readonly courtResponseView?: CourtResponseView;
  readonly domainConsequenceView?: DomainConsequenceView;
  readonly appointmentTrackView?: JsonObject;
  readonly officialPostingsView?: JsonObject;
  readonly localAffairsDocketView?: JsonObject;
  readonly militaryDiplomacyView?: JsonObject;
  readonly economicFiscalView?: JsonObject;
  readonly actorMemoryView?: JsonObject;
  readonly worldEntityView?: JsonObject;
  readonly worldThreadView?: JsonObject;
  readonly activeNpcRequestView?: JsonObject;
  readonly playerMonthlyBriefingView?: JsonObject;
  readonly relationshipView?: JsonObject;
  readonly worldPeopleView?: WorldPeopleView;
  readonly topicSurfaceView?: TopicSurfaceView;
  readonly [key: string]: unknown;
};

export type OpeningBackgroundClaimsView = JsonObject & {
  readonly schemaVersion?: string;
  readonly status?: string;
  readonly publicSummary?: string;
  readonly counts?: JsonObject;
  readonly decisions?: readonly {
    readonly claimId?: string;
    readonly claimType?: string;
    readonly claimSummary?: string;
    readonly decision?: string;
    readonly publicSummary?: string;
    readonly acceptedRefs?: readonly string[];
    readonly riskTags?: readonly string[];
    readonly serverReason?: string;
  }[];
};

export type MarketPriceRowView = {
  readonly priceId: string;
  readonly label: string;
  readonly category?: string;
  readonly baseSilverLiang?: number;
  readonly currentSilverLiang?: number;
  readonly currentCopperCash?: number;
  readonly roleMultiplier?: number;
  readonly marketPressure?: number;
  readonly availability?: string;
  readonly trend?: string;
  readonly trendLabel?: string;
  readonly drivers?: readonly string[];
  readonly authorityBoundary?: string;
};

export type MarketPriceView = JsonObject & {
  readonly schemaVersion?: string;
  readonly generatedAtTurn?: number;
  readonly date?: JsonObject;
  readonly dateLabel?: string;
  readonly role?: string;
  readonly averagePriceIndex?: number;
  readonly priceRows?: readonly MarketPriceRowView[];
  readonly recentSignals?: readonly string[];
  readonly history?: readonly JsonObject[];
  readonly safeguards?: JsonObject;
};

export type NpcEconomyView = JsonObject & {
  readonly schemaVersion?: string;
  readonly generatedAtTurn?: number;
  readonly lastTickTurn?: number | null;
  readonly lastMonthlyPeriodKey?: string;
  readonly recentEvents?: readonly string[];
  readonly lastOutcome?: JsonObject | null;
  readonly safeguards?: JsonObject;
};

export type NpcActiveRequestItemView = JsonObject & {
  readonly requestId?: string;
  readonly type?: string;
  readonly typeLabel?: string;
  readonly status?: string;
  readonly npc?: JsonObject;
  readonly title?: string;
  readonly ask?: string;
  readonly stakes?: string;
  readonly intentSummary?: string;
  readonly proposalBoundary?: string;
  readonly riskTags?: readonly string[];
  readonly allowedResponseActions?: readonly string[];
  readonly responseOptions?: readonly NpcActiveRequestResponseOptionView[];
  readonly createdTurn?: number;
  readonly dueTurn?: number;
  readonly lastUpdatedTurn?: number;
  readonly turnsRemaining?: number;
  readonly outcome?: (JsonObject & {
    readonly followUpView?: JsonObject;
    readonly followUpResolutions?: readonly JsonObject[];
  }) | null;
};

export type NpcActiveRequestResponseOptionView = JsonObject & {
  readonly responseAction?: string;
  readonly label?: string;
  readonly shortLabel?: string;
  readonly draftText?: string;
  readonly serverBoundary?: string;
};

export type NpcActiveRequestFollowUpTaskView = JsonObject & {
  readonly schemaVersion?: string;
  readonly taskId?: string;
  readonly sourceType?: string;
  readonly requestId?: string;
  readonly requestType?: string;
  readonly requestTypeLabel?: string;
  readonly publicResolutionRef?: string;
  readonly followUpKind?: string;
  readonly taskRoute?: string;
  readonly taskRouteLabel?: string;
  readonly status?: string;
  readonly statusLabel?: string;
  readonly latestResolution?: JsonObject | null;
  readonly title?: string;
  readonly publicSummary?: string;
  readonly nextStep?: string;
  readonly draftText?: string;
  readonly npc?: JsonObject & {
    readonly npcId?: string;
    readonly displayName?: string;
    readonly title?: string;
  };
  readonly evidenceRefs?: readonly string[];
  readonly riskTags?: readonly string[];
  readonly urgency?: string;
  readonly createdTurn?: number;
  readonly lastUpdatedTurn?: number;
  readonly boundaries?: JsonObject & {
    readonly serverOwnsFollowUp?: boolean;
    readonly proposalOnly?: boolean;
    readonly browserDraftOnly?: boolean;
    readonly resourcesNotApplied?: boolean;
    readonly relationshipNotFinal?: boolean;
    readonly marriageAndDisciplineNotFinal?: boolean;
    readonly privateNpcDossierRedacted?: boolean;
    readonly noHiddenTruthAdjudication?: boolean;
  };
};

export type NpcActiveRequestFollowUpEvidenceView = JsonObject & {
  readonly schemaVersion?: string;
  readonly evidenceId?: string;
  readonly sourceType?: string;
  readonly requestId?: string;
  readonly requestType?: string;
  readonly requestTypeLabel?: string;
  readonly taskRoute?: string;
  readonly taskRouteLabel?: string;
  readonly evidenceKind?: string;
  readonly evidenceKindLabel?: string;
  readonly domain?: string;
  readonly searchDomain?: string;
  readonly topicSurfaceIds?: readonly string[];
  readonly title?: string;
  readonly publicSummary?: string;
  readonly summary?: string;
  readonly nextStep?: string;
  readonly status?: string;
  readonly statusLabel?: string;
  readonly visibility?: string;
  readonly confidence?: number;
  readonly urgency?: string;
  readonly npc?: JsonObject;
  readonly riskTags?: readonly string[];
  readonly sourceRefs?: readonly string[];
  readonly boundaries?: JsonObject;
};

export type NpcActiveRequestFollowUpEvidenceGroupView = JsonObject & {
  readonly schemaVersion?: string;
  readonly generatedAtTurn?: number;
  readonly items?: readonly NpcActiveRequestFollowUpEvidenceView[];
  readonly people?: readonly NpcActiveRequestFollowUpEvidenceView[];
  readonly events?: readonly NpcActiveRequestFollowUpEvidenceView[];
  readonly economy?: readonly NpcActiveRequestFollowUpEvidenceView[];
  readonly counts?: JsonObject;
  readonly safeguards?: JsonObject;
};

export type NpcActiveRequestView = JsonObject & {
  readonly schemaVersion?: string;
  readonly ownerActorId?: string;
  readonly totalItems?: number;
  readonly items?: readonly NpcActiveRequestItemView[];
  readonly followUpTasks?: readonly NpcActiveRequestFollowUpTaskView[];
  readonly followUpEvidence?: NpcActiveRequestFollowUpEvidenceGroupView;
  readonly recentEvents?: readonly string[];
  readonly allowedRequestTypes?: readonly string[];
  readonly allowedResponseActions?: readonly string[];
  readonly safeguards?: JsonObject;
};

export type ResourceAccountView = {
  readonly accountId: string;
  readonly resourceId?: string;
  readonly label: string;
  readonly amount: number;
  readonly unit?: string;
  readonly ownerActorId?: string;
  readonly updatedTurn?: number;
};

export type ResourceLedgerView = {
  readonly schemaVersion?: string;
  readonly viewerActorId?: string;
  readonly accounts: readonly ResourceAccountView[];
  readonly counts?: JsonObject;
  readonly authorityBoundary?: string;
  readonly [key: string]: unknown;
};

export type AssetView = {
  readonly assetId: string;
  readonly assetType?: string;
  readonly typeLabel?: string;
  readonly name: string;
  readonly ownerActorId?: string;
  readonly locationRef?: string;
  readonly condition?: string;
  readonly productivity?: number;
  readonly upkeepSilver?: number;
  readonly legalStatus?: string;
  readonly visibility?: string;
  readonly effectRefs?: readonly string[];
  readonly provenance?: readonly JsonObject[];
};

export type AssetLedgerView = {
  readonly schemaVersion?: string;
  readonly viewerActorId?: string;
  readonly assets: readonly AssetView[];
  readonly counts?: JsonObject;
  readonly resourceLedgerView?: ResourceLedgerView;
  readonly authorityBoundary?: string;
  readonly [key: string]: unknown;
};

export type InventoryContainerView = {
  readonly containerId: string;
  readonly type?: string;
  readonly label: string;
  readonly ownerActorId?: string;
  readonly custodianActorId?: string;
  readonly locationRef?: string;
  readonly capacityWeight?: number;
  readonly currentWeight?: number;
  readonly visibility?: string;
  readonly locked?: boolean;
};

export type InventoryItemView = {
  readonly itemId: string;
  readonly templateId?: string;
  readonly name: string;
  readonly category?: string;
  readonly subtype?: string;
  readonly ownerActorId?: string;
  readonly custodianActorId?: string;
  readonly containerId?: string;
  readonly quantity?: number;
  readonly unit?: string;
  readonly quality?: number;
  readonly rarity?: string;
  readonly durability?: number;
  readonly condition?: string;
  readonly legalStatus?: string;
  readonly transferPolicy?: string;
  readonly effects?: readonly string[];
  readonly important?: boolean;
  readonly credential?: boolean;
  readonly provenance?: readonly JsonObject[];
};

export type ImportantCredentialView = {
  readonly itemId: string;
  readonly name: string;
  readonly legalStatus?: string;
  readonly transferPolicy?: string;
  readonly containerId?: string;
  readonly authorityBoundary?: string;
};

export type InventoryView = {
  readonly schemaVersion?: string;
  readonly viewerActorId?: string;
  readonly containers: readonly InventoryContainerView[];
  readonly items: readonly InventoryItemView[];
  readonly importantCredentials: readonly ImportantCredentialView[];
  readonly counts?: JsonObject;
  readonly authorityBoundary?: string;
  readonly [key: string]: unknown;
};

export type InventoryResponse = {
  readonly sessionId: string;
  readonly resourceLedgerView?: ResourceLedgerView;
  readonly assetLedgerView?: AssetLedgerView;
  readonly inventoryView: InventoryView;
};

export type InventoryTransferRequest = {
  readonly itemId: string;
  readonly toContainerId: string;
  readonly locationRef?: string;
};

export type InventoryTransferResponse = {
  readonly sessionId?: string;
  readonly accepted: boolean;
  readonly reason?: string;
  readonly inventoryView: InventoryView;
};

export type NpcRosterItem = {
  readonly npcId: string;
  readonly displayName: string;
  readonly tier?: string;
  readonly roleTags?: readonly string[];
  readonly stageTags?: readonly string[];
  readonly portraitRef?: string | null;
  readonly publicProfile?: {
    readonly title?: string;
    readonly origin?: string;
    readonly posting?: string;
    readonly summary?: string;
    readonly visibleAbilities?: readonly string[];
    readonly [key: string]: unknown;
  };
  readonly relationshipSummary?: {
    readonly closeness?: number;
    readonly trust?: number;
    readonly awe?: number;
    readonly hostility?: number;
    readonly favorsOwed?: number;
    readonly labels?: readonly string[];
    readonly [key: string]: unknown;
  };
  readonly availableInteractions?: readonly string[];
};

export type NpcRosterView = {
  readonly schemaVersion?: string;
  readonly generatedFor?: JsonObject;
  readonly page?: number;
  readonly pageSize?: number;
  readonly totalItems?: number;
  readonly items: readonly NpcRosterItem[];
  readonly safeguards?: JsonObject;
  readonly [key: string]: unknown;
};

export type NpcDetailView = Omit<NpcRosterItem, "relationshipSummary"> & {
  readonly sourceRef?: string;
  readonly relationship?: NpcRosterItem["relationshipSummary"];
  readonly inventoryRefs?: readonly string[];
  readonly assetRefs?: readonly string[];
  readonly resourceAccountRefs?: readonly string[];
  readonly socialProfile?: JsonObject;
  readonly relationshipActionEligibilityView?: JsonObject & {
    readonly actions?: readonly (JsonObject & {
      readonly actionType?: string;
      readonly label?: string;
      readonly requestLabel?: string;
      readonly available?: boolean;
      readonly blockers?: readonly string[];
      readonly riskTags?: readonly string[];
      readonly serverBoundary?: string;
    })[];
  };
  readonly safeguards?: JsonObject;
};

export type NpcInteractionRecordView = {
  readonly recordId?: string;
  readonly turn?: number;
  readonly date?: JsonObject;
  readonly npcId?: string;
  readonly npcName?: string;
  readonly actionType?: string;
  readonly serverStatus?: string;
  readonly serverReasons?: readonly string[];
  readonly dialogueText?: string;
  readonly mood?: string;
  readonly followUpSuggestions?: readonly string[];
  readonly actionKind?: string;
  readonly outcomeSummary?: string;
  readonly serverAdjudication?: JsonObject | null;
  readonly riskTags?: readonly string[];
  readonly resolverTrace?: JsonObject | null;
  readonly eligibilityView?: JsonObject | null;
  readonly relationshipImpactView?: JsonObject | null;
  readonly resourceImpactView?: JsonObject | null;
  readonly worldPeopleImpactView?: JsonObject | null;
  readonly ignoredClientResultFields?: readonly string[];
};

export type NpcInteractionView = {
  readonly schemaVersion?: string;
  readonly ownerActorId?: string;
  readonly totalItems?: number;
  readonly items: readonly NpcInteractionRecordView[];
  readonly safeguards?: JsonObject;
  readonly [key: string]: unknown;
};

export type NpcDialogueView = {
  readonly npcId?: string;
  readonly dialogueText?: string;
  readonly mood?: string;
  readonly followUpSuggestions?: readonly string[];
};

export type NpcListResponse = {
  readonly sessionId: string;
  readonly npcRosterView: NpcRosterView;
  readonly npcInteractionView?: NpcInteractionView;
  readonly delegatedTaskView?: DelegatedTaskView;
};

export type NpcDetailResponse = {
  readonly sessionId: string;
  readonly npcDetailView: NpcDetailView;
  readonly npcInteractionView?: NpcInteractionView;
  readonly tradeLedgerView?: TradeLedgerView;
  readonly delegatedTaskView?: DelegatedTaskView;
};

export type NpcInteractionRequest = {
  readonly npcId: string;
  readonly actionType?: "talk" | "ask" | "gift" | "trade" | "command" | "request" | "debate" | "duel" | "courtship" | "marriage" | string;
  readonly utterance?: string;
  readonly itemId?: string;
  readonly offerSummary?: string;
};

export type NpcInteractionResponse = {
  readonly sessionId: string;
  readonly accepted: boolean;
  readonly errors?: readonly string[];
  readonly npcDialogueView?: NpcDialogueView;
  readonly npcActionResolutionView?: JsonObject | null;
  readonly npcInteractionView: NpcInteractionView;
  readonly npcDetailView?: NpcDetailView;
  readonly actorMemory?: JsonObject;
  readonly actorMemoryView?: JsonObject;
  readonly eventArchiveView?: JsonObject;
};

export type TradeRecordView = {
  readonly tradeId?: string;
  readonly turn?: number;
  readonly actorAId?: string;
  readonly actorBId?: string;
  readonly npcId?: string;
  readonly npcName?: string;
  readonly status?: string;
  readonly offerSummary?: string;
  readonly itemRefs?: readonly string[];
  readonly requestedSilverDelta?: number;
  readonly npcResponse?: string;
  readonly publicSummary?: string;
  readonly serverReasons?: readonly string[];
  readonly settlementApplied?: boolean;
  readonly serverSettlement?: JsonObject;
  readonly riskTags?: readonly string[];
};

export type TradeLedgerView = {
  readonly schemaVersion?: string;
  readonly ownerActorId?: string;
  readonly totalItems?: number;
  readonly items: readonly TradeRecordView[];
  readonly safeguards?: JsonObject;
  readonly [key: string]: unknown;
};

export type TradeRequest = {
  readonly npcId: string;
  readonly tradeId?: string;
  readonly silverDelta?: number;
  readonly offerSummary?: string;
  readonly itemRefs?: readonly string[];
};

export type TradeResponse = {
  readonly sessionId: string;
  readonly accepted: boolean;
  readonly errors?: readonly string[];
  readonly tradeRecord?: TradeRecordView;
  readonly tradeLedgerView: TradeLedgerView;
  readonly resourceLedgerView?: ResourceLedgerView;
  readonly inventoryView?: InventoryView;
};

export type DelegatedTaskAssigneeView = {
  readonly npcId?: string;
  readonly displayName?: string;
  readonly title?: string;
  readonly portraitRef?: string | null;
};

export type DelegatedTaskRecordView = {
  readonly taskId?: string;
  readonly taskType?: string;
  readonly title?: string;
  readonly status?: string;
  readonly issuerActorId?: string;
  readonly assignee?: DelegatedTaskAssigneeView;
  readonly authoritySource?: string;
  readonly startTime?: JsonObject;
  readonly dueTime?: JsonObject;
  readonly cadence?: string;
  readonly requiredItems?: readonly string[];
  readonly budgetAccountRefs?: readonly string[];
  readonly budget?: number;
  readonly riskFactors?: readonly string[];
  readonly successFactors?: readonly string[];
  readonly result?: JsonObject | null;
  readonly auditRefs?: readonly string[];
  readonly safeguards?: JsonObject;
};

export type DelegatedTaskView = {
  readonly schemaVersion?: string;
  readonly ownerActorId?: string;
  readonly totalItems?: number;
  readonly items: readonly DelegatedTaskRecordView[];
  readonly allowedTaskTypes?: readonly string[];
  readonly allowedStatuses?: readonly string[];
  readonly safeguards?: JsonObject;
  readonly [key: string]: unknown;
};

export type DelegatedTaskPlanView = {
  readonly taskType?: string;
  readonly planSummary?: string;
  readonly riskTags?: readonly string[];
  readonly successFactors?: readonly string[];
  readonly suggestedDueTurns?: number;
};

export type NpcCommandRequest = {
  readonly assigneeActorId: string;
  readonly taskType: string;
  readonly authoritySource: string;
  readonly targetRef?: string;
  readonly commandText: string;
  readonly budget?: number;
  readonly title?: string;
};

export type NpcCommandResponse = {
  readonly sessionId: string;
  readonly accepted: boolean;
  readonly errors?: readonly string[];
  readonly delegatedTaskPlanView?: DelegatedTaskPlanView;
  readonly delegatedTask?: JsonObject | null;
  readonly delegatedTaskView: DelegatedTaskView;
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
  readonly draftContext?: TurnDraftContext;
};

export type TurnDraftContext = {
  readonly surfaceId?: string;
  readonly draftKind?: string;
  readonly evidenceRefs?: readonly string[];
  readonly canonicalEchoRefs?: readonly string[];
  readonly generatedAtTurn?: number;
  readonly status?: string;
};

export type NpcEconomyFeedback = JsonObject & {
  readonly schemaVersion?: string;
  readonly cadence?: "ten_day" | "monthly" | string;
  readonly summary?: string;
  readonly events?: readonly string[];
  readonly attributeChanges?: readonly JsonObject[];
  readonly outcome?: JsonObject;
};

export type TurnResponse = SafeRouteViews & {
  readonly sessionId: string;
  readonly worldState: SafeWorldState;
  readonly narrative?: string;
  readonly npcEconomy?: NpcEconomyFeedback;
  readonly npcActiveRequests?: JsonObject;
  readonly officialCourtConsequence?: JsonObject;
  readonly officialCourtResponse?: JsonObject;
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

export type TopicSurfaceId =
  | "memorial-review"
  | "edict-draft"
  | "court-debate"
  | "trial"
  | "war-council"
  | "npc-profile";

export type TopicSurfaceEvidenceRef = {
  readonly refId: string;
  readonly sourceView?: string;
  readonly sourceId?: string;
  readonly canonicalEchoRefs?: readonly string[];
  readonly domain?: string;
  readonly label: string;
  readonly summary: string;
  readonly visibility?: string;
  readonly confidence?: number;
  readonly freshness?: string;
  readonly scopeRefs?: readonly string[];
};

export type TopicSurfaceItem = {
  readonly id: string;
  readonly kind?: string;
  readonly title: string;
  readonly summary: string;
  readonly sourceView?: string;
  readonly statusLabel?: string;
  readonly evidenceRefs?: readonly string[];
  readonly urgency?: string;
};

export type TopicSurfaceDraftSlot = {
  readonly id: string;
  readonly label: string;
  readonly draftKind: string;
  readonly template?: string;
};

export type TopicSurfaceScenePreview = {
  readonly sceneType?: string;
  readonly title?: string;
  readonly participantLabels?: readonly string[];
  readonly proposalBudget?: JsonObject;
  readonly authorityBoundary?: string;
};

export type TopicSurfaceView = {
  readonly schemaVersion: string;
  readonly sessionId?: string;
  readonly generatedAtTurn?: number;
  readonly surfaceId: TopicSurfaceId;
  readonly surfaceType?: string;
  readonly label: string;
  readonly title: string;
  readonly summary: string;
  readonly sourceViews?: readonly JsonObject[];
  readonly filters?: readonly JsonObject[];
  readonly items: readonly TopicSurfaceItem[];
  readonly evidenceRefs: readonly TopicSurfaceEvidenceRef[];
  readonly draftSlots: readonly TopicSurfaceDraftSlot[];
  readonly scenePreview?: TopicSurfaceScenePreview | null;
  readonly lastPublicResults?: readonly JsonObject[];
  readonly authorityBoundary: string;
  readonly emptyState: string;
  readonly safety?: JsonObject;
};

export type TopicSurfaceResponse = {
  readonly sessionId: string;
  readonly topicSurfaceView: TopicSurfaceView;
};

export type TopicDraftRequest = {
  readonly surfaceId: TopicSurfaceId;
  readonly draftKind?: string;
  readonly selectedEvidenceRefs?: readonly string[];
  readonly evidenceRefs?: readonly string[];
  readonly playerNote?: string;
};

export type TopicDraftPayload = {
  readonly surfaceId: TopicSurfaceId;
  readonly draftKind: string;
  readonly draftTitle: string;
  readonly draftText: string;
  readonly evidenceRefs: readonly string[];
  readonly canonicalEchoRefs?: readonly string[];
  readonly riskNote?: string;
  readonly nextStep?: string;
  readonly source: "local-rule" | "mock-ai" | "provider-ai";
};

export type TopicDraftResponse = {
  readonly schemaVersion: string;
  readonly sessionId: string;
  readonly generatedAtTurn?: number;
  readonly surfaceId: TopicSurfaceId;
  readonly source: "local-rule" | "mock-ai" | "provider-ai";
  readonly status: "ready" | "fallback";
  readonly fallbackReason?: string;
  readonly topicDraft: TopicDraftPayload;
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
  readonly readiness?: JsonObject;
  readonly entryPreparation?: JsonObject;
  readonly examCalendar?: JsonObject;
  readonly sceneTime?: JsonObject;
};

export type ExamQuestionRequest = {
  readonly sessionId: string;
  readonly level?: ExamLevel;
};

export type ExamWordCount =
  | number
  | {
    readonly min?: number;
    readonly max?: number;
    readonly target?: number;
    readonly recommended?: number;
  };

export type ExamPhaseFeedbackView = JsonObject & {
  readonly schemaVersion?: number;
  readonly phase?: string;
  readonly phaseLabel?: string;
  readonly pressureScore?: number;
  readonly pressureLabel?: string;
  readonly publicSummary?: string;
  readonly environmentSummary?: string;
  readonly actionEcho?: string;
  readonly riskNotes?: readonly string[];
  readonly visibleNextActions?: readonly string[];
  readonly authorityBoundary?: string;
};

export type ExamProcedureView = JsonObject & {
  readonly phase?: string;
  readonly phaseLabel?: string;
  readonly phaseFeedback?: ExamPhaseFeedbackView;
};

export type ExamQuestionResponse = SafeRouteViews & ExamState & {
  readonly sessionId: string;
  readonly questionType?: string;
  readonly difficulty?: string;
  readonly requirements?: JsonValue;
  readonly wordCount?: ExamWordCount;
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
  readonly presetLabel?: string;
  readonly presets?: JsonObject[];
  readonly providerOptions?: JsonObject[];
  readonly taskRoutes?: JsonObject[];
  readonly controls?: JsonObject;
  readonly safeguards?: JsonObject;
};

export type AiSettingsResponse = {
  readonly sessionId: string;
  readonly targetSessionId?: string | null;
  readonly scope?: "global" | "session" | string;
  readonly updatedAt?: string | null;
  readonly globalSettingsExists?: boolean;
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
