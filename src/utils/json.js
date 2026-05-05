function stripCodeFence(text) {
  const trimmed = String(text || "").trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function extractJsonCandidate(text) {
  const stripped = stripCodeFence(text);
  if (!stripped) return stripped;
  if (stripped.startsWith("{") || stripped.startsWith("[")) return stripped;

  const firstObject = stripped.indexOf("{");
  const firstArray = stripped.indexOf("[");
  const first = [firstObject, firstArray].filter((index) => index >= 0).sort((a, b) => a - b)[0];
  if (first === undefined) return stripped;

  const lastObject = stripped.lastIndexOf("}");
  const lastArray = stripped.lastIndexOf("]");
  const last = Math.max(lastObject, lastArray);
  return last > first ? stripped.slice(first, last + 1) : stripped;
}

function parseJsonFromText(value) {
  if (value && typeof value === "object") return value;

  const candidate = extractJsonCandidate(value);
  try {
    return JSON.parse(candidate);
  } catch (error) {
    const err = new Error(`Model did not return valid JSON: ${error.message}`);
    err.cause = error;
    err.rawText = String(value || "").slice(0, 1000);
    throw err;
  }
}

function formatValidationErrors(errors = []) {
  return errors
    .map((error) => {
      const path = error.instancePath || "/";
      return `${path} ${error.message}`;
    })
    .join("; ");
}

module.exports = {
  formatValidationErrors,
  parseJsonFromText
};
