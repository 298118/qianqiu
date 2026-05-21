const DOMAIN_CONSEQUENCE_ECHO_REF_PATTERN = /^domainConsequenceEcho:[a-z0-9]+$/;
const DOMAIN_CONSEQUENCE_ECHO_REF_GLOBAL_PATTERN = /domainConsequenceEcho:[a-z0-9]+/g;
const MAX_DOMAIN_CONSEQUENCE_ECHO_REFS = 8;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanDomainConsequenceEchoRef(value, fallback = "") {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  const text = String(value).trim();
  return DOMAIN_CONSEQUENCE_ECHO_REF_PATTERN.test(text) ? text : fallback;
}

function collectDomainConsequenceEchoRefs(...values) {
  const refs = [];
  const seen = new Set();
  const queue = [...values];

  while (queue.length && refs.length < MAX_DOMAIN_CONSEQUENCE_ECHO_REFS) {
    const value = queue.shift();
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value);
      const matches = text.match(DOMAIN_CONSEQUENCE_ECHO_REF_GLOBAL_PATTERN) || [];
      for (const match of matches) {
        const ref = cleanDomainConsequenceEchoRef(match, "");
        if (!ref || seen.has(ref)) continue;
        seen.add(ref);
        refs.push(ref);
        if (refs.length >= MAX_DOMAIN_CONSEQUENCE_ECHO_REFS) break;
      }
      continue;
    }
    if (Array.isArray(value)) {
      queue.push(...value);
      continue;
    }
    if (isPlainObject(value)) {
      queue.push(...Object.values(value));
    }
  }

  return refs;
}

module.exports = {
  DOMAIN_CONSEQUENCE_ECHO_REF_PATTERN,
  cleanDomainConsequenceEchoRef,
  collectDomainConsequenceEchoRefs
};
