const test = require("node:test");
const assert = require("node:assert/strict");

const { createInitialState } = require("../src/game/initialState");
const {
  buildAiActorProfileView,
  buildNpcAiActorProfile,
  buildOfficeAiActorProfile,
  buildPlayerAiActorProfile,
  buildSystemEngineActorProfile,
  summarizeAiActorProfileForPrompt
} = require("../src/game/aiActorProfiles");

function serializedPublicProfile(profile) {
  return JSON.stringify({
    view: buildAiActorProfileView(profile),
    prompt: summarizeAiActorProfileForPrompt(profile)
  });
}

test("S70.2 builds player actor profiles from current role and visible office context", () => {
  const scholar = createInitialState({ role: "scholar", playerName: "许秋声", nativePlace: "苏州府" });
  const magistrate = createInitialState({ role: "magistrate", playerName: "清河县令" });
  const emperor = createInitialState({ role: "emperor", playerName: "天子" });

  const scholarProfile = buildPlayerAiActorProfile(scholar);
  const magistrateProfile = buildPlayerAiActorProfile(magistrate);
  const emperorProfile = buildPlayerAiActorProfile(emperor);

  assert.equal(scholarProfile.actorType, "scholar");
  assert.equal(scholarProfile.authorityTier, "T1");
  assert.equal(scholarProfile.allowedToolGroups.includes("study"), true);
  assert.equal(scholarProfile.allowedToolGroups.includes("ruler"), false);
  assert.equal(serializedPublicProfile(scholarProfile).includes("苏州府"), true);

  assert.equal(magistrateProfile.actorType, "magistrate");
  assert.equal(magistrateProfile.authorityTier, "T3");
  assert.equal(magistrateProfile.allowedToolGroups.includes("judicial"), true);
  assert.equal(magistrateProfile.allowedToolGroups.includes("ruler"), false);
  assert.ok(magistrateProfile.jurisdictionRefs.some((ref) => ref.includes("city-") || ref.includes("county:")));

  assert.equal(emperorProfile.actorType, "emperor");
  assert.equal(emperorProfile.authorityTier, "T5");
  assert.equal(emperorProfile.allowedToolGroups.includes("ruler"), true);
  assert.equal(emperorProfile.visibilityProfile.preset, "imperial_broad");
});

test("S70.2 official player profiles infer central authority from official postings", () => {
  const worldState = createInitialState({ role: "official", playerName: "新科观政" });
  const profile = buildPlayerAiActorProfile(worldState);
  const view = buildAiActorProfileView(profile);
  const prompt = summarizeAiActorProfileForPrompt(profile);

  assert.equal(profile.actorType, "minister");
  assert.equal(profile.authorityTier, "T4");
  assert.equal(profile.allowedToolGroups.includes("career"), true);
  assert.equal(profile.allowedToolGroups.includes("ruler"), false);
  assert.equal(view.actorId, "player:P1");
  assert.equal(prompt.authorityTier, "T4");
  assert.ok(profile.knownRefs.some((ref) => ref.includes("officialPostingsView")));
});

test("S70.2 NPC actor profiles only use worldPeopleView visible rows", () => {
  const worldState = createInitialState({ role: "scholar", playerName: "问学书生" });
  worldState.characters.push({
    id: "C99",
    name: "密札中人",
    role: "隐藏线人",
    loyalty: 50,
    ambition: 50,
    skill: 50,
    alive: true
  });
  worldState.relationshipLedger.characters.C99 = {
    id: "C99",
    name: "密札中人",
    role: "隐藏线人",
    stance: "sealed",
    relationship: 0,
    resentment: 0,
    networkSource: "sealed",
    recentIntent: "SEALED_AI_ACTOR_INTENT hiddenNotes raw provider proposal /mnt/e/secret",
    visible: false,
    lastUpdatedTurn: 0
  };

  const teacherProfile = buildNpcAiActorProfile(worldState, "C01");
  const hiddenProfile = buildNpcAiActorProfile(worldState, "C99");
  const serialized = serializedPublicProfile(teacherProfile);

  assert.equal(teacherProfile.actorType, "teacher");
  assert.equal(teacherProfile.authorityTier, "T1");
  assert.equal(teacherProfile.allowedToolGroups.includes("study"), true);
  assert.equal(hiddenProfile, null);
  assert.equal(serialized.includes("SEALED_AI_ACTOR"), false);
  assert.equal(serialized.includes("hiddenNotes"), false);
  assert.equal(serialized.includes("hidden"), false);
  assert.equal(serialized.includes("raw"), false);
  assert.equal(serialized.includes("provider"), false);
  assert.equal(serialized.includes("path"), false);
  assert.equal(serialized.includes("key"), false);
  assert.equal(serialized.includes("raw provider"), false);
  assert.equal(serialized.includes("/mnt/e/secret"), false);
});

test("S70.2 office and system actor profiles are generated without route-hidden state", () => {
  const official = createInitialState({ role: "official", playerName: "部院官" });
  const officeProfile = buildOfficeAiActorProfile(official, "posting-player-current");
  const systemProfile = buildSystemEngineActorProfile(official, "pressure_events");
  const officeSerialized = serializedPublicProfile(officeProfile);
  const systemSerialized = serializedPublicProfile(systemProfile);

  assert.equal(officeProfile.actorType, "minister");
  assert.equal(officeProfile.authorityTier, "T4");
  assert.equal(officeProfile.allowedToolGroups.includes("office_read"), true);
  assert.equal(officeProfile.allowedToolGroups.includes("ruler"), false);
  assert.ok(officeProfile.knownRefs.some((ref) => ref.includes("officialPostingsView")));

  assert.equal(systemProfile.actorType, "system_engine");
  assert.equal(systemProfile.authorityTier, "T6");
  assert.equal(systemProfile.allowedToolGroups.includes("event"), true);
  assert.equal(systemProfile.allowedToolGroups.includes("ruler"), false);
  assert.equal(officeSerialized.includes("world_sessions"), false);
  assert.equal(systemSerialized.includes("statePatch"), false);
});
