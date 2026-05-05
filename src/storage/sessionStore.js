const fs = require("fs/promises");
const path = require("path");

const SESSIONS_DIR = path.join(__dirname, "..", "..", "data", "sessions");

function assertSafeSessionId(sessionId) {
  if (!/^[a-f0-9-]{36}$/i.test(sessionId)) {
    const error = new Error("Invalid session id");
    error.statusCode = 400;
    throw error;
  }
}

function sessionPath(sessionId) {
  assertSafeSessionId(sessionId);
  return path.join(SESSIONS_DIR, `${sessionId}.json`);
}

async function ensureSessionDir() {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
}

async function writeSession(worldState) {
  await ensureSessionDir();
  const filePath = sessionPath(worldState.sessionId);
  await fs.writeFile(filePath, `${JSON.stringify(worldState, null, 2)}\n`, "utf8");
  return worldState;
}

async function readSession(sessionId) {
  const filePath = sessionPath(sessionId);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      const notFound = new Error("Session not found");
      notFound.statusCode = 404;
      throw notFound;
    }
    throw error;
  }
}

module.exports = {
  readSession,
  writeSession
};
