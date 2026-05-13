function parseAllowedCorsOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function buildAllowedCorsOrigins(appPort = process.env.PORT || 3000, extraOrigins = process.env.CORS_ALLOWED_ORIGINS) {
  return new Set([
    `http://localhost:${appPort}`,
    `http://127.0.0.1:${appPort}`,
    `http://[::1]:${appPort}`,
    ...parseAllowedCorsOrigins(extraOrigins)
  ]);
}

function isLoopbackOrigin(origin) {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
  } catch (error) {
    return false;
  }
}

function isLoopbackAddress(address) {
  const normalized = String(address || "").trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === "localhost" || normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;

  const ipv4 = normalized.startsWith("::ffff:")
    ? normalized.slice("::ffff:".length)
    : normalized;
  const parts = ipv4.split(".");
  return parts.length === 4
    && parts[0] === "127"
    && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function isLoopbackRemoteAddress(reqOrAddress) {
  if (typeof reqOrAddress === "string") {
    return isLoopbackAddress(reqOrAddress);
  }
  return isLoopbackAddress(
    reqOrAddress?.ip
      || reqOrAddress?.socket?.remoteAddress
      || reqOrAddress?.connection?.remoteAddress
  );
}

function isAllowedLocalOrigin(origin, options = {}) {
  if (!origin) return true;
  const appPort = options.appPort || process.env.PORT || 3000;
  const allowedOrigins = buildAllowedCorsOrigins(appPort, options.extraOrigins);
  return allowedOrigins.has(origin) && isLoopbackOrigin(origin);
}

function isLocalRequestOrigin(req, options = {}) {
  return isLoopbackRemoteAddress(req) && isAllowedLocalOrigin(req?.get?.("origin"), options);
}

module.exports = {
  buildAllowedCorsOrigins,
  isAllowedLocalOrigin,
  isLoopbackAddress,
  isLoopbackOrigin,
  isLoopbackRemoteAddress,
  isLocalRequestOrigin,
  parseAllowedCorsOrigins
};
