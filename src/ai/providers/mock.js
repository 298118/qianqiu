function describeOpening(worldState) {
  const { dynasty, year, player, setup } = worldState;
  const background = setup.background ? `出身记载：${setup.background}` : "家世未显，前路由一念开端。";
  const custom = setup.customSetting ? `乡里传闻：${setup.customSetting}` : "窗外风声入砚，坊间消息尚待探问。";

  if (player.role === "scholar") {
    return [
      `${dynasty}${year}年，${player.name}以${player.roleLabel}之身居于县学左近。`,
      background,
      custom,
      "案上有《论语》《孟子》与残旧策论数卷，童试之路尚远，却已能闻见考棚纸墨气。",
      "你可以先研读经典、拜访塾师、游学结交，也可直接请求赴考。"
    ].join("\n");
  }

  return [
    `${dynasty}${year}年，${player.name}以${player.roleLabel}之身立于局中。`,
    background,
    custom,
    "天下财赋、粮储、民心、军情皆会随你的文字行动逐步变化。"
  ].join("\n");
}

async function startGame(worldState) {
  return {
    narrative: describeOpening(worldState),
    events: [
      `${worldState.dynasty}${worldState.year}年，${worldState.player.name}开始其${worldState.player.roleLabel}生涯。`
    ]
  };
}

module.exports = {
  startGame
};
