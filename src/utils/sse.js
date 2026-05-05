function writeSseHeaders(res) {
  res.status(200);
  res.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }
}

function formatSseEvent(event, data) {
  const safeEvent = /^[\w-]+$/.test(event) ? event : "message";
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  const lines = String(payload).split(/\r?\n/);
  const dataLines = lines.map((line) => `data: ${line}`).join("\n");

  return `event: ${safeEvent}\n${dataLines}\n\n`;
}

function sendSseEvent(res, event, data) {
  res.write(formatSseEvent(event, data));
}

function closeSse(res) {
  res.end();
}

function chunkTextForSse(text, size = 80) {
  const source = String(text || "");
  const chunkSize = Math.max(1, size);
  const chunks = [];

  for (let index = 0; index < source.length; index += chunkSize) {
    chunks.push(source.slice(index, index + chunkSize));
  }

  return chunks;
}

module.exports = {
  writeSseHeaders,
  formatSseEvent,
  sendSseEvent,
  closeSse,
  chunkTextForSse
};
