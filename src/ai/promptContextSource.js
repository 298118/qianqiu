const PROMPT_RETRIEVAL_SOURCE = Symbol.for("qianqiu.promptRetrievalSource");

function attachPromptRetrievalSource(worldState, source) {
  if (!worldState || typeof worldState !== "object" || typeof source !== "function") return worldState;
  Object.defineProperty(worldState, PROMPT_RETRIEVAL_SOURCE, {
    configurable: true,
    enumerable: false,
    value: source
  });
  return worldState;
}

function getPromptRetrievalSource(worldState) {
  if (!worldState || typeof worldState !== "object") return null;
  return worldState[PROMPT_RETRIEVAL_SOURCE] || null;
}

module.exports = {
  attachPromptRetrievalSource,
  getPromptRetrievalSource
};
