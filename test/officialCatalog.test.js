const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getBureau,
  getOffice,
  getOfficeLadder,
  inferOfficeByTitle,
  listBureaus,
  listOffices,
  listOutpostCandidates,
  listPromotionCandidates,
  listTransferCandidates,
  summarizeOfficeForPlayer
} = require("../src/game/officialCatalog");

test("catalog covers S42.1 bureaus and returns defensive copies", () => {
  const bureaus = listBureaus();
  const bureauIds = bureaus.map((bureau) => bureau.id).sort();

  assert.deepEqual(bureauIds, [
    "censorate",
    "hanlin_academy",
    "ministry_justice",
    "ministry_personnel",
    "ministry_revenue",
    "ministry_rites",
    "ministry_war",
    "ministry_works",
    "prefecture_county",
    "provincial_admin",
    "provincial_judicial"
  ].sort());

  bureaus[0].name = "被污染";
  assert.equal(getBureau("hanlin_academy").name, "翰林院");
});

test("catalog exposes common central, censorate, provincial, and local offices", () => {
  const titles = listOffices().map((office) => office.title);

  for (const title of [
    "翰林院庶吉士",
    "户部主事",
    "吏部郎中",
    "监察御史",
    "都察院佥都御史",
    "布政司参议",
    "按察司佥事",
    "知府",
    "知县",
    "候勘官员"
  ]) {
    assert.ok(titles.includes(title), `missing ${title}`);
  }

  assert.equal(getOffice("ministry_revenue_principal").bureauName, "户部");
});

test("inferOfficeByTitle resolves exact, alias, and decorated titles", () => {
  assert.equal(inferOfficeByTitle("户部主事").id, "ministry_revenue_principal");
  assert.equal(inferOfficeByTitle("度支主事").title, "户部主事");
  assert.equal(inferOfficeByTitle("户部云南清吏司主事").title, "户部主事");
  assert.equal(inferOfficeByTitle("苏州府推官").title, "府推官");
  assert.equal(inferOfficeByTitle("候勘").title, "候勘官员");
  assert.equal(inferOfficeByTitle("官员"), null);
  assert.equal(inferOfficeByTitle("不存在的官职"), null);
});

test("summarizeOfficeForPlayer returns a Chinese player-facing summary", () => {
  const summary = summarizeOfficeForPlayer("户部主事");

  assert.equal(summary.title, "户部主事");
  assert.equal(summary.bureau, "户部");
  assert.deepEqual(summary.duties, ["钱粮", "仓场", "奏销"]);
  assert.match(summary.text, /户部主事隶属户部/);
  assert.match(summary.text, /钱粮、仓场、奏销/);
});

test("office ladder and candidate helpers provide promotion, transfer, and outpost lists", () => {
  const ladder = getOfficeLadder();
  assert.equal(ladder[0].title, "六部观政进士");
  assert.ok(ladder.some((office) => office.title === "都察院佥都御史"));

  const promotions = listPromotionCandidates("户部主事");
  assert.ok(promotions.some((office) => ["户部员外郎", "户部郎中", "监察御史"].includes(office.title)));
  assert.ok(promotions.every((office) => office.title !== "户部主事"));

  const transfers = listTransferCandidates("户部主事");
  assert.ok(transfers.some((office) => office.title === "礼部主事"));
  assert.ok(transfers.every((office) => office.outpost === false));

  const outposts = listOutpostCandidates("监察御史");
  assert.ok(outposts.length > 0);
  assert.ok(outposts.every((office) => office.outpost === true));
});

test("listOffices supports focused filters for future officialCareer imports", () => {
  const revenueOffices = listOffices({ bureauId: "ministry_revenue" });
  assert.ok(revenueOffices.length >= 3);
  assert.ok(revenueOffices.every((office) => office.bureauId === "ministry_revenue"));

  const localOutposts = listOffices({ track: "local", outpost: true });
  assert.ok(localOutposts.some((office) => office.title === "知县"));
  assert.ok(localOutposts.every((office) => office.track === "local" && office.outpost));
});
