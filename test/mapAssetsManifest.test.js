const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const publicRoot = path.join(__dirname, "..", "public");
const manifestPath = path.join(publicRoot, "assets", "maps", "ink-map-manifest.json");

const FORBIDDEN_TEXT =
  /(OPENAI_API_KEY|DEEPSEEK_API_KEY|MIMO_API_KEY|ANTHROPIC_API_KEY|sk-[A-Za-z0-9_-]{6,}|tp-[A-Za-z0-9_-]{6,}|[A-Za-z]:[\\/]|file:\/\/|data[\\/](?:sessions|audit)|world_sessions|prompt_retrieval_index|event_log|hiddenNotes|hiddenIntent|raw[_ -]?(?:table|prompt|provider|audit|coordinate))/i;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolvePublicPath(assetPath) {
  assert.equal(assetPath.startsWith("/assets/maps/"), true);
  assert.equal(assetPath.includes(".."), false);
  assert.equal(/^https?:\/\//i.test(assetPath), false);
  return path.join(publicRoot, assetPath.replace(/^\//, ""));
}

function readPngInfo(buffer) {
  assert.equal(buffer.toString("hex", 0, 8), "89504e470d0a1a0a");
  const colorType = buffer.readUInt8(25);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    alpha: colorType === 4 || colorType === 6
  };
}

function readUInt24LE(buffer, offset) {
  return buffer[offset] + (buffer[offset + 1] << 8) + (buffer[offset + 2] << 16);
}

function readWebpInfo(buffer) {
  assert.equal(buffer.toString("ascii", 0, 4), "RIFF");
  assert.equal(buffer.toString("ascii", 8, 12), "WEBP");
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunk = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (chunk === "VP8X") {
      const flags = buffer.readUInt8(data);
      return {
        width: readUInt24LE(buffer, data + 4) + 1,
        height: readUInt24LE(buffer, data + 7) + 1,
        alpha: Boolean(flags & 0x10)
      };
    }
    if (chunk === "VP8 ") {
      return {
        width: buffer.readUInt16LE(data + 6) & 0x3fff,
        height: buffer.readUInt16LE(data + 8) & 0x3fff,
        alpha: false
      };
    }
    if (chunk === "VP8L") {
      const b0 = buffer[data + 1];
      const b1 = buffer[data + 2];
      const b2 = buffer[data + 3];
      const b3 = buffer[data + 4];
      return {
        width: 1 + (((b1 & 0x3f) << 8) | b0),
        height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
        alpha: true
      };
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error("Unsupported WebP encoding");
}

function readImageInfo(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (filePath.endsWith(".png")) return readPngInfo(buffer);
  if (filePath.endsWith(".webp")) return readWebpInfo(buffer);
  throw new Error(`Unsupported image type: ${filePath}`);
}

test("S72.3 ink map manifest references local safe assets with expected dimensions", () => {
  const manifestText = fs.readFileSync(manifestPath, "utf8");
  assert.doesNotMatch(manifestText, FORBIDDEN_TEXT);
  const manifest = JSON.parse(manifestText);

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.assetSetId, "ink-map-v1");
  assert.equal(manifest.coordinateSpace, "normalized-image-space");
  assert.ok(Array.isArray(manifest.assets));
  assert.equal(manifest.assets.length >= 5, true);

  const checkedPaths = new Set();
  for (const asset of manifest.assets) {
    const filePath = resolvePublicPath(asset.path);
    checkedPaths.add(asset.path);
    assert.equal(fs.existsSync(filePath), true, asset.path);
    const info = readImageInfo(filePath);
    assert.equal(info.width, asset.width, asset.id);
    assert.equal(info.height, asset.height, asset.id);
    assert.equal(info.alpha, asset.alpha, asset.id);
  }

  for (const collectionName of ["icons", "effects", "routes"]) {
    for (const [token, assetPath] of Object.entries(manifest[collectionName])) {
      assert.match(token, /^[a-z0-9_]+$/);
      const filePath = resolvePublicPath(assetPath);
      checkedPaths.add(assetPath);
      assert.equal(fs.existsSync(filePath), true, `${collectionName}.${token}`);
      const info = readImageInfo(filePath);
      assert.equal(info.width > 0 && info.height > 0, true);
      if (collectionName === "icons" && assetPath.startsWith("/assets/maps/icons/")) {
        assert.equal(info.width, 256, `${token} icon width`);
        assert.equal(info.height, 256, `${token} icon height`);
      }
      if (assetPath.endsWith(".png")) assert.equal(info.alpha, true, assetPath);
    }
  }

  assert.equal(checkedPaths.has("/assets/maps/icons/city-prefecture-v1.png"), true);
  assert.equal(checkedPaths.has("/assets/maps/effects/ink-ripple-red-v1.png"), true);
});
