const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "..");

function readPublicFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, "public", relativePath), "utf8");
}

test("S72.4 map frontend shell wires PixiJS and map scripts in contract order", () => {
  const indexHtml = readPublicFile("index.html");
  const pixiVendorPath = path.join(rootDir, "public", "vendor", "pixi.min.js");
  const pixiLicensePath = path.join(rootDir, "public", "vendor", "pixi-LICENSE.txt");

  assert.equal(fs.existsSync(pixiVendorPath), true, "local PixiJS vendor must exist");
  assert.equal(fs.statSync(pixiVendorPath).size > 100_000, true, "PixiJS vendor should not be an empty placeholder");
  assert.match(fs.readFileSync(pixiLicensePath, "utf8"), /The MIT License/);

  const expectedOrder = [
    '<script src="/vendor/pixi.min.js"></script>',
    "https://cdn.jsdelivr.net/npm/pixi.js@7.4.3/dist/pixi.min.js",
    '<script src="/mapRenderer.js"></script>',
    '<script src="/mapPanel.js"></script>',
    '<script src="/app.js"></script>'
  ];
  let lastIndex = -1;
  for (const marker of expectedOrder) {
    const markerIndex = indexHtml.indexOf(marker);
    assert.notEqual(markerIndex, -1, `missing script marker: ${marker}`);
    assert.equal(markerIndex > lastIndex, true, `script marker is out of order: ${marker}`);
    lastIndex = markerIndex;
  }
});

test("S72.4 map scripts keep the shell syntax-valid and manifest-driven", () => {
  for (const scriptPath of ["public/app.js", "public/mapPanel.js", "public/mapRenderer.js"]) {
    const result = spawnSync(process.execPath, ["--check", scriptPath], {
      cwd: rootDir,
      encoding: "utf8"
    });
    assert.equal(result.status, 0, `${scriptPath} syntax check failed: ${result.stderr}`);
  }

  const appJs = readPublicFile("app.js");
  assert.match(appJs, /let currentMapRuntimeView = null;/);
  assert.match(appJs, /currentMapRuntimeView = payload\.mapRuntimeView \|\| null;/);
  assert.doesNotMatch(appJs, /worldState\.mapRuntimeView/);

  const rendererJs = readPublicFile("mapRenderer.js");
  assert.match(rendererJs, /\/assets\/maps\/ink-map-manifest\.json/);
  assert.match(rendererJs, /PIXI\.Assets\.loadBundle/);
  assert.match(rendererJs, /\.destroy\(\{ children: true \}\);/);
});
