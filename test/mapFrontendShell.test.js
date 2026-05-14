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
  assert.match(rendererJs, /this\.options\.onNeedsUpdate/);
  assert.match(rendererJs, /\.destroy\(\{ children: true \}\);/);
});

test("S72.5 map frontend links selected refs to safe information-panel cards", () => {
  const rendererJs = readPublicFile("mapRenderer.js");
  assert.match(rendererJs, /this\.selectRef\(route, midPoint\)/);
  assert.match(rendererJs, /this\.selectRef\(ref, pos\)/);
  assert.match(rendererJs, /effectDisplay\.hitArea = new PIXI\.Circle/);
  assert.match(rendererJs, /sourceRefs: effect\.sourceRefs \|\| \[\]/);

  const panelJs = readPublicFile("mapPanel.js");
  assert.match(panelJs, /function findInformationPanelCard\(ref\)/);
  assert.match(panelJs, /article\[data-entity-id\], article\[data-event-id\]/);
  assert.match(panelJs, /function activateInformationPanelPage\(page\)/);
  assert.match(panelJs, /function focusInformationPanelCard\(ref\)/);
  assert.match(panelJs, /requestAnimationFrame\(\(\) => \{/);
  assert.match(panelJs, /freshCard && freshCard\.isConnected/);
  assert.doesNotMatch(panelJs, /querySelector\(`article\[data-entity-id="\$\{entityId\}"\]`\)/);
  assert.doesNotMatch(panelJs, /\.click\(\);/);
  assert.match(panelJs, /input\.value = draft\.actionText;/);
  assert.doesNotMatch(panelJs, /fetch\([^)]*turn/);
});

test("S72.6 map renderer gates ink motion and keeps selection in cinnabar style", () => {
  const rendererJs = readPublicFile("mapRenderer.js");

  assert.match(rendererJs, /const ROUTE_ANIMATION_LIMIT = 15;/);
  assert.match(rendererJs, /const EFFECT_ANIMATION_LIMIT = 25;/);
  assert.match(rendererJs, /IntersectionObserver/);
  assert.match(rendererJs, /document\.addEventListener\("visibilitychange"/);
  assert.match(rendererJs, /document\.removeEventListener\("visibilitychange"/);
  assert.match(rendererJs, /this\.reducedMotion \|\| !this\.isPanelVisible \|\| !this\.isDocumentVisible/);

  assert.match(rendererJs, /type: 'route'[\s\S]*baseAlpha: ROUTE_BASE_ALPHA/);
  assert.match(rendererJs, /if \(eff\.type === "route"\)[\s\S]*eff\.sprite\.alpha = eff\.baseAlpha \+ wave \* ROUTE_ALPHA_PULSE;/);
  assert.match(rendererJs, /else if \(eff\.type === "ripple"\)[\s\S]*eff\.sprite\.scale\.set\(eff\.baseScale \* \(1 \+ spread \* RIPPLE_SCALE_PULSE\)\)/);
  assert.doesNotMatch(rendererJs, /eff\.sprite\.scale\.set\(eff\.baseScale \+ Math\.sin/);

  assert.match(rendererJs, /highlight\.lineStyle\(3, 0x9b2f22, 0\.84\);/);
  assert.match(rendererJs, /highlight\.lineStyle\(1, 0x9b2f22, 0\.64\);/);
  assert.doesNotMatch(rendererJs, /highlight\.lineStyle\(2, 0x2f6f5e/);
});
