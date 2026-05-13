function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function buildClientWorldState(worldState = {}) {
  const clientState = cloneJson(worldState) || {};
  delete clientState.actorMemoryLedger;
  delete clientState.sessionSummary;
  return clientState;
}

module.exports = {
  buildClientWorldState
};
