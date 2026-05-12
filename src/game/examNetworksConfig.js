const EXAM_NETWORK_SCHEMA_VERSION = 1;

const EXAM_NETWORK_LIMITS = Object.freeze({
  maxSameYearContacts: 3,
  maxSnapshotContacts: 8,
  textPreviewLength: 160
});

const LEVEL_NETWORK_CONFIG = Object.freeze({
  child_exam: {
    peerRole: "童试同案",
    peerNetworkSource: "童试同案",
    peerIntent: "在县学与岁试往来中观察玩家学业根基。",
    examinerContacts: [
      {
        id: "exam-seat-child",
        actor: "chief_examiner",
        name: "叶学政",
        role: "童试学政",
        relationKind: "examiner",
        stance: "取录学政",
        relationship: 14,
        resentment: 0,
        networkSource: "童试学政批语",
        recentIntent: "留意新进生员是否能守学规、续读经义。"
      }
    ]
  },
  provincial_exam: {
    peerRole: "乡试同年",
    peerNetworkSource: "乡试同年",
    peerIntent: "在举人社交、会试筹备和乡里声援中衡量彼此可否互助。",
    examinerContacts: [
      {
        id: "exam-room-provincial",
        actor: "room_officer",
        name: "沈房官",
        role: "乡试房官",
        relationKind: "room_officer",
        stance: "房师取录",
        relationship: 16,
        resentment: 0,
        networkSource: "乡试房官荐卷",
        recentIntent: "看玩家能否在会试前稳住制艺章法。"
      },
      {
        id: "exam-seat-provincial",
        actor: "chief_examiner",
        name: "冯主考",
        role: "乡试主考座师",
        relationKind: "seat_teacher",
        stance: "座师门生",
        relationship: 22,
        resentment: 0,
        networkSource: "乡试主考取中",
        recentIntent: "以座师名义观察玩家是否守礼进学。"
      }
    ]
  },
  metropolitan_exam: {
    peerRole: "会试同年",
    peerNetworkSource: "会试同年",
    peerIntent: "在殿试前后与馆选声气中判断能否互为同年援引。",
    examinerContacts: [
      {
        id: "exam-room-metropolitan",
        actor: "room_officer",
        name: "陆房官",
        role: "会试房官",
        relationKind: "room_officer",
        stance: "房师荐卷",
        relationship: 18,
        resentment: 0,
        networkSource: "会试房官荐卷",
        recentIntent: "留意玩家殿试对策是否能承接会试文气。"
      },
      {
        id: "exam-seat-metropolitan",
        actor: "chief_examiner",
        name: "周主考",
        role: "会试主考座师",
        relationKind: "seat_teacher",
        stance: "座师门生",
        relationship: 24,
        resentment: 0,
        networkSource: "会试主考取中",
        recentIntent: "在新科贡士名册中观察玩家馆选前途。"
      }
    ]
  },
  palace_exam: {
    peerRole: "同年进士",
    peerNetworkSource: "殿试同年",
    peerIntent: "在观政、馆选、铨选与初仕声气中衡量同年互助。",
    examinerContacts: [
      {
        id: "exam-reader-palace",
        actor: "chief_examiner",
        name: "许读卷官",
        role: "殿试读卷官",
        relationKind: "palace_reader",
        stance: "读卷赏识",
        relationship: 20,
        resentment: 0,
        networkSource: "殿试读卷",
        recentIntent: "观察玩家入仕后是否不负殿试甲第。"
      }
    ]
  }
});

module.exports = {
  EXAM_NETWORK_LIMITS,
  EXAM_NETWORK_SCHEMA_VERSION,
  LEVEL_NETWORK_CONFIG
};
