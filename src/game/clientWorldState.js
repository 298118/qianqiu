function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function buildClientWorldState(worldState = {}) {
  const clientState = cloneJson(worldState) || {};
  delete clientState.actorMemoryLedger;
  delete clientState.sessionSummary;
  delete clientState.assetLedger;
  delete clientState.resourceLedger;
  delete clientState.inventoryLedger;
  delete clientState.npcRoster;
  delete clientState.delegatedTaskLedger;
  delete clientState.npcInteractionLedger;
  delete clientState.tradeLedger;
  delete clientState.openingBackgroundClaims;
  delete clientState.marketPriceLedger;
  delete clientState.npcEconomyLedger;
  delete clientState.npcActiveRequestLedger;
  return clientState;
}

module.exports = {
  buildClientWorldState
};
