const SCENE_RUNTIME_SCHEMA_VERSION = "s71.sceneRuntime.v1";

const SCENE_RUNTIME_TYPES = Object.freeze({
  courtDebate: "court_debate",
  judicialHearing: "judicial_hearing",
  diplomaticSummit: "diplomatic_summit",
  battleCouncil: "battle_council"
});

const SCENE_RUNTIME_PROPOSAL_KINDS = Object.freeze([
  "city_policy",
  "judicial_case",
  "military_order",
  "diplomacy_move",
  "pressure_event",
  "procedural_note"
]);

const SCENE_RUNTIME_LIMITS = Object.freeze({
  maxActors: 6,
  maxRounds: 3,
  maxActorEvidenceRefs: 8,
  maxProposalsPerRound: 8,
  maxTranscriptLines: 12,
  maxTextLength: 180
});

const SCENE_RUNTIME_TYPE_CONFIG = Object.freeze({
  [SCENE_RUNTIME_TYPES.courtDebate]: Object.freeze({
    label: "朝议",
    defaultProposalKind: "city_policy",
    defaultActionKind: "relief",
    allowedProposalKinds: Object.freeze(["city_policy", "judicial_case", "pressure_event", "procedural_note"]),
    evidenceDomains: Object.freeze(["economy", "market", "local_docket", "events", "geography"]),
    participantPresets: Object.freeze([
      Object.freeze({
        participantRole: "presiding_ruler",
        label: "御前裁断",
        actorSource: "office",
        actorType: "emperor",
        officeRef: { officeId: "emperor" },
        defaultProposalKind: "procedural_note"
      }),
      Object.freeze({
        participantRole: "revenue_minister",
        label: "户部钱粮",
        actorSource: "office",
        actorType: "minister",
        officeRef: "ministry_revenue_director",
        defaultProposalKind: "city_policy",
        defaultActionKind: "relief"
      }),
      Object.freeze({
        participantRole: "censor",
        label: "台谏纠核",
        actorSource: "office",
        actorType: "censor",
        officeRef: "censorate_investigating_censor",
        defaultProposalKind: "pressure_event"
      })
    ])
  }),
  [SCENE_RUNTIME_TYPES.judicialHearing]: Object.freeze({
    label: "堂审",
    defaultProposalKind: "judicial_case",
    defaultActionKind: "investigate",
    allowedProposalKinds: Object.freeze(["judicial_case", "procedural_note"]),
    evidenceDomains: Object.freeze(["local_docket", "people", "events", "geography"]),
    participantPresets: Object.freeze([
      Object.freeze({
        participantRole: "presiding_magistrate",
        label: "堂官",
        actorSource: "player",
        fallbackActorType: "magistrate",
        defaultProposalKind: "judicial_case",
        defaultActionKind: "investigate"
      }),
      Object.freeze({
        participantRole: "clerk",
        label: "刑房书吏",
        actorSource: "office",
        actorType: "clerk",
        officeRef: "prefecture_county_clerk",
        defaultProposalKind: "judicial_case",
        defaultActionKind: "summon"
      }),
      Object.freeze({
        participantRole: "local_gentry",
        label: "乡绅旁听",
        actorSource: "office",
        actorType: "gentry",
        officeRef: "prefecture_county_gentry",
        defaultProposalKind: "procedural_note"
      })
    ])
  }),
  [SCENE_RUNTIME_TYPES.diplomaticSummit]: Object.freeze({
    label: "会盟",
    defaultProposalKind: "diplomacy_move",
    defaultActionKind: "envoy",
    allowedProposalKinds: Object.freeze(["diplomacy_move", "procedural_note"]),
    evidenceDomains: Object.freeze(["diplomacy", "military", "intel", "economy", "market", "geography"]),
    participantPresets: Object.freeze([
      Object.freeze({
        participantRole: "rites_minister",
        label: "礼部主议",
        actorSource: "office",
        actorType: "minister",
        officeRef: "ministry_rites_principal",
        defaultProposalKind: "diplomacy_move",
        defaultActionKind: "envoy"
      }),
      Object.freeze({
        participantRole: "war_minister",
        label: "兵部边议",
        actorSource: "office",
        actorType: "general",
        officeRef: "ministry_war_principal",
        defaultProposalKind: "diplomacy_move",
        defaultActionKind: "warn_border"
      }),
      Object.freeze({
        participantRole: "censor",
        label: "台谏复核",
        actorSource: "office",
        actorType: "censor",
        officeRef: "censorate_investigating_censor",
        defaultProposalKind: "procedural_note"
      })
    ])
  }),
  [SCENE_RUNTIME_TYPES.battleCouncil]: Object.freeze({
    label: "战役军议",
    defaultProposalKind: "military_order",
    defaultActionKind: "scout",
    allowedProposalKinds: Object.freeze(["military_order", "procedural_note"]),
    evidenceDomains: Object.freeze(["military", "intel", "economy", "market", "geography"]),
    participantPresets: Object.freeze([
      Object.freeze({
        participantRole: "field_commander",
        label: "主将",
        actorSource: "player",
        fallbackActorType: "general",
        defaultProposalKind: "military_order",
        defaultActionKind: "scout"
      }),
      Object.freeze({
        participantRole: "war_office",
        label: "兵部军务",
        actorSource: "office",
        actorType: "general",
        officeRef: "ministry_war_principal",
        defaultProposalKind: "military_order",
        defaultActionKind: "defend"
      }),
      Object.freeze({
        participantRole: "supply_office",
        label: "粮台转运",
        actorSource: "office",
        actorType: "minister",
        officeRef: "ministry_revenue_director",
        defaultProposalKind: "military_order",
        defaultActionKind: "supply"
      })
    ])
  })
});

module.exports = {
  SCENE_RUNTIME_LIMITS,
  SCENE_RUNTIME_PROPOSAL_KINDS,
  SCENE_RUNTIME_SCHEMA_VERSION,
  SCENE_RUNTIME_TYPES,
  SCENE_RUNTIME_TYPE_CONFIG
};
