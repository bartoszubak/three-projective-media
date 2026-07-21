import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.resolve(testsDirectory, "..");
const demoDirectory = path.join(packageDirectory, "examples", "basic");
const {
  DEFAULT_DEMO_MEDIA_ID,
  DEMO_MEDIA_CATALOG,
  getDemoMediaOption,
} = await import(
  pathToFileURL(path.join(demoDirectory, "demoMediaCatalog.js")).href
);
const demoMediaDirectory = path.join(demoDirectory, "public", "media");
const demoMediaPaths = DEMO_MEDIA_CATALOG.map(({ url }) =>
  path.join(demoDirectory, "public", url.replace(/^\.\//, "")),
);
const demoMediaReadmePath = path.join(
  demoDirectory,
  "public",
  "media",
  "README.md",
);
const viteConfigPath = path.join(packageDirectory, "vite.config.js");
const distDirectory = path.join(packageDirectory, "dist");

const collectFiles = (directory) => {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
  });
};

test("standalone demo uses the public package entrypoint without host dependencies", () => {
  const indexPath = path.join(demoDirectory, "index.html");
  assert.ok(existsSync(indexPath), "examples/basic/index.html");

  const sourceFiles = collectFiles(demoDirectory).filter((filePath) =>
    /\.(?:css|html|js|json|md|mjs)$/i.test(filePath),
  );
  const sourceEntries = sourceFiles.map((filePath) => ({
    relativePath: path.relative(packageDirectory, filePath).split(path.sep).join("/"),
    source: readFileSync(filePath, "utf8"),
  }));
  const javascript = sourceFiles
    .filter((filePath) => /\.(?:js|mjs)$/i.test(filePath))
    .map((filePath) => readFileSync(filePath, "utf8"))
    .join("\n");

  assert.match(javascript, /\bfrom\s+["']three-projective-media["']/);
  for (const { url } of DEMO_MEDIA_CATALOG) {
    assert.ok(javascript.includes(url), url);
    assert.ok(!javascript.includes(`"/${url.replace(/^\.\//, "")}"`));
  }
  const runtimeNeutralPaths = new Set([
    "examples/basic/main.js",
    "examples/basic/demoMediaCatalog.js",
    "examples/basic/index.html",
    "examples/basic/styles.css",
  ]);
  for (const { relativePath, source } of sourceEntries) {
    assert.doesNotMatch(
      source,
      /\b(?:from\s*|import\s*\()["'][^"']*(?:^|\/)src\//m,
    );
    assert.doesNotMatch(
      source,
      /\b(?:GardenPlanner|Garden Planner|projectionEffects|PublicAssetResolver)\b/i,
    );
    if (runtimeNeutralPaths.has(relativePath)) {
      assert.doesNotMatch(source, /\bZafiro\b/i);
    }
    assert.doesNotMatch(source, /\b(?:React|ReactDOM|styled-components)\b/i);
    assert.doesNotMatch(
      source,
      /(?:unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|esm\.sh|skypack\.dev)/i,
    );
  }

  const html = readFileSync(indexPath, "utf8");
  assert.match(html, /<label\s+for=["']projection-video-source["']/i);
  assert.match(html, /<select[^>]+data-projector-space-video-select/i);
  assert.match(
    html,
    /aria-describedby=["']projection-video-source-help["']/i,
  );
  assert.doesNotMatch(html, /<video\b/i);
  assert.doesNotMatch(html, /\bpreload\s*=/i);
});

test("demo status announcements exclude continuously updating diagnostics", () => {
  const indexPath = path.join(demoDirectory, "index.html");
  const html = readFileSync(indexPath, "utf8");
  const statusGrid = html.match(/<dl\s+class=["']status-grid["'][^>]*>/i)?.[0];
  const runtimeMessage = html.match(
    /<[^>]+id=["']runtime-message["'][^>]*>/i,
  )?.[0];
  const rebuildResult = html.match(
    /<[^>]+id=["']rebuild-result["'][^>]*>/i,
  )?.[0];

  assert.ok(statusGrid, "status grid");
  assert.doesNotMatch(statusGrid, /\baria-live\s*=/i);
  assert.match(runtimeMessage || "", /\baria-live=["']polite["']/i);
  assert.match(rebuildResult || "", /\baria-live=["']polite["']/i);
});

test("verification scripts perform one controlled pack gate", () => {
  const manifest = JSON.parse(
    readFileSync(path.join(packageDirectory, "package.json"), "utf8"),
  );
  const verificationSource = readFileSync(
    path.join(packageDirectory, "scripts", "verify-demo.mjs"),
    "utf8",
  );

  assert.equal(
    manifest.scripts?.["verify:demo"],
    "node scripts/verify-demo.mjs --static-only",
  );
  assert.equal(
    manifest.scripts?.verify,
    "npm test && npm run verify:demo && npm run build:demo && node scripts/verify-demo.mjs --require-build",
  );
  assert.doesNotMatch(manifest.scripts.verify, /npm run pack:dry-run/);
  assert.equal(
    (manifest.scripts.verify.match(/--require-build/g) || []).length,
    1,
  );
  assert.equal(
    (
      verificationSource.match(
        /spawnSync\("npm", \["pack", "--dry-run", "--json"\]/g,
      ) || []
    ).length,
    1,
  );
});

test("sandbox media catalog is frozen, complete, local, and provenance-documented", () => {
  const catalogSource = readFileSync(
    path.join(demoDirectory, "demoMediaCatalog.js"),
    "utf8",
  );
  assert.doesNotMatch(catalogSource, /\b(?:document|window|fetch|XMLHttpRequest)\b/);
  assert.equal(DEMO_MEDIA_CATALOG.length, 4);
  assert.ok(Object.isFrozen(DEMO_MEDIA_CATALOG));
  assert.ok(DEMO_MEDIA_CATALOG.every(Object.isFrozen));
  assert.equal(
    DEMO_MEDIA_CATALOG.filter(({ origin }) => origin === "author-recorded")
      .length,
    3,
  );
  assert.equal(
    DEMO_MEDIA_CATALOG.filter(({ origin }) => origin === "procedural").length,
    1,
  );
  assert.equal(new Set(DEMO_MEDIA_CATALOG.map(({ id }) => id)).size, 4);
  assert.equal(new Set(DEMO_MEDIA_CATALOG.map(({ url }) => url)).size, 4);
  assert.equal(getDemoMediaOption(DEFAULT_DEMO_MEDIA_ID)?.origin, "author-recorded");
  assert.notEqual(DEFAULT_DEMO_MEDIA_ID, "abstract-color-field");
  assert.ok(
    DEMO_MEDIA_CATALOG.every(({ url }) => /^\.\/media\/[\w-]+\.mp4$/.test(url)),
  );

  assert.ok(existsSync(demoMediaReadmePath), "demo media README");
  assert.deepEqual(
    readdirSync(demoMediaDirectory).sort(),
    [
      "README.md",
      ...DEMO_MEDIA_CATALOG.map(({ url }) => path.basename(url)),
    ].sort(),
  );

  const mediaReadme = readFileSync(demoMediaReadmePath, "utf8");
  let totalMediaBytes = 0;
  for (const mediaPath of demoMediaPaths) {
    assert.ok(existsSync(mediaPath), path.basename(mediaPath));
    const mediaBytes = statSync(mediaPath).size;
    assert.ok(mediaBytes > 0);
    assert.ok(mediaBytes < 3 * 1024 * 1024);
    totalMediaBytes += mediaBytes;
    const mediaHash = createHash("sha256")
      .update(readFileSync(mediaPath))
      .digest("hex");
    assert.ok(mediaReadme.toLowerCase().includes(mediaHash));
  }
  assert.ok(totalMediaBytes < 10 * 1024 * 1024);

  assert.match(mediaReadme, /Zafiro Isle Lab/);
  assert.match(mediaReadme, /https:\/\/playzafiro\.com\/isle-lab\//);
  assert.match(mediaReadme, /Bartek Bąk/);
  assert.match(mediaReadme, /Copyright © 2026 Bartek Bąk/);
  assert.match(mediaReadme, /screen recordings|captured and produced/i);
  assert.match(mediaReadme, /provenance/i);
  assert.match(mediaReadme, /procedurally generated|procedural/i);
  assert.match(mediaReadme, /ffmpeg/i);
  const terrainRights = mediaReadme.split("## Abstract Color Field")[0];
  assert.doesNotMatch(terrainRights, /public domain|\bCC0\b|royalty free/i);
  assert.doesNotMatch(
    terrainRights,
    /separate permission|redistribution prohibited|reuse outside this demo|not covered by (?:the )?MIT/i,
  );
});

test("sandbox host replaces media sessions without extending the package API", () => {
  const mainSource = readFileSync(path.join(demoDirectory, "main.js"), "utf8");
  assert.match(mainSource, /let\s+projector\s*=/);
  assert.match(mainSource, /let\s+projectorHelper\s*=/);
  assert.match(mainSource, /let\s+unsubscribeStatus\s*=/);
  assert.match(mainSource, /const\s+switchDemoMedia\s*=\s*async/);
  assert.match(mainSource, /receiverRoots:\s*\[\]/);
  assert.match(mainSource, /candidateProjector\.setReceiverRoots\(\[receiverRoot\]\)/);
  assert.match(mainSource, /oldProjector\.dispose\(\)/);
  assert.match(mainSource, /timelineTransferred:\s*false/);
  assert.match(mainSource, /nextMediaId\s*===\s*activeMediaId/);
  assert.match(mainSource, /settings\.mediaId\s*=\s*activeMediaId/);
  const switchStart = mainSource.indexOf("const switchDemoMedia = async");
  const prepareReceivers = mainSource.indexOf(
    "candidateProjector.setReceiverRoots([receiverRoot])",
    switchStart,
  );
  const prepareHelper = mainSource.indexOf(
    "candidateHelper = new THREE.CameraHelper(candidateProjector.camera)",
    switchStart,
  );
  const prepareSubscription = mainSource.indexOf(
    "candidateUnsubscribe = candidateProjector.subscribeStatus",
    switchStart,
  );
  const commitProjector = mainSource.indexOf(
    "projector = candidateProjector",
    switchStart,
  );
  const oldProjectorCleanup = mainSource.indexOf(
    "() => oldProjector.dispose()",
    switchStart,
  );
  for (const [label, sourceIndex] of [
    ["candidate receiver preparation", prepareReceivers],
    ["candidate helper preparation", prepareHelper],
    ["candidate status subscription", prepareSubscription],
    ["candidate commit", commitProjector],
    ["old projector cleanup", oldProjectorCleanup],
  ]) {
    assert.ok(sourceIndex > switchStart, `${label} is missing from switchDemoMedia`);
  }
  assert.ok(prepareReceivers < oldProjectorCleanup);
  assert.ok(prepareHelper < oldProjectorCleanup);
  assert.ok(prepareSubscription < oldProjectorCleanup);
  assert.ok(commitProjector < oldProjectorCleanup);
  const rollbackStart = mainSource.indexOf("const rollbackCandidateSession");
  const rollbackEnd = mainSource.indexOf(
    "const switchDemoMedia = async",
    rollbackStart,
  );
  const rollbackSource = mainSource.slice(rollbackStart, rollbackEnd);
  assert.match(rollbackSource, /candidateProjector\?\.dispose/);
  assert.doesNotMatch(rollbackSource, /oldProjector|oldUnsubscribeStatus/);
  assert.match(
    mainSource.slice(switchStart, commitProjector),
    /rollbackCandidateSession\(\{[\s\S]*?candidateProjector/,
  );
  const resetSource = mainSource.match(
    /const\s+resetDemo\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\n\};\n\nlisten\(controlsById\.get\("reset-demo"\)/,
  )?.[0];
  assert.ok(resetSource, "resetDemo source");
  assert.doesNotMatch(
    resetSource,
    /mediaId|switchDemoMedia|createProjectorSession/,
  );
  assert.doesNotMatch(mainSource, /currentTime\s*=/);
  assert.doesNotMatch(mainSource, /setMediaUrl|replaceMedia|setVideo|setSource/);
});

test("Vite serves examples/basic and builds relative assets into root dist", async () => {
  assert.ok(existsSync(viteConfigPath), "vite.config.js");
  const configModule = await import(
    `${pathToFileURL(viteConfigPath).href}?demo-test=${Date.now()}`,
  );
  const config =
    typeof configModule.default === "function"
      ? await configModule.default({ command: "build", mode: "test" })
      : configModule.default;
  const root = path.resolve(packageDirectory, config.root || ".");
  const outDir = path.resolve(root, config.build?.outDir || "dist");

  assert.equal(root, demoDirectory);
  assert.equal(outDir, distDirectory);
  assert.equal(config.base, "./");
  assert.equal(config.build?.emptyOutDir, true);
  assert.equal(config.build?.sourcemap, false);

  const aliases = config.resolve?.alias;
  const aliasEntries = Array.isArray(aliases)
    ? aliases
    : Object.entries(aliases || {}).map(([find, replacement]) => ({
        find,
        replacement,
      }));
  for (const alias of aliasEntries) {
    assert.doesNotMatch(
      String(alias.replacement || ""),
      /(?:^|[\\/])src(?:[\\/]|$)/,
    );
  }
});

test("package publication allowlist excludes demo and repository-only evidence", () => {
  const manifest = JSON.parse(
    readFileSync(path.join(packageDirectory, "package.json"), "utf8"),
  );
  const publishedPaths = manifest.files || [];
  assert.ok(publishedPaths.includes("src"));
  assert.ok(publishedPaths.includes("README.md"));
  assert.ok(publishedPaths.includes("LICENSE"));

  for (const forbiddenPath of [
    "examples",
    "tests",
    "docs",
    "scripts",
    "dist",
    "package-lock.json",
  ]) {
    assert.ok(
      !publishedPaths.some(
        (entry) =>
          entry === forbiddenPath || entry.startsWith(`${forbiddenPath}/`),
      ),
      forbiddenPath,
    );
  }
});

test("demo verification script passes its static pre-build checks", () => {
  const result = spawnSync(
    process.execPath,
    [path.join(packageDirectory, "scripts", "verify-demo.mjs"), "--static-only"],
    {
      cwd: packageDirectory,
      encoding: "utf8",
      env: process.env,
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Demo source verified/);
});

test(
  "built demo contains relative JS/CSS assets and unchanged media copies",
  {
    skip:
      !existsSync(distDirectory) ||
      !DEMO_MEDIA_CATALOG.every(({ url }) =>
        existsSync(path.join(distDirectory, url.replace(/^\.\//, ""))),
      ),
  },
  () => {
    const indexPath = path.join(distDirectory, "index.html");
    const assetsDirectory = path.join(distDirectory, "assets");

    assert.ok(existsSync(indexPath));
    assert.ok(existsSync(assetsDirectory));
    const assets = collectFiles(assetsDirectory);
    assert.ok(assets.some((filePath) => filePath.endsWith(".js")));
    assert.ok(assets.some((filePath) => filePath.endsWith(".css")));

    const builtIndex = readFileSync(indexPath, "utf8");
    assert.match(builtIndex, /(?:src|href)="\.\/assets\//);
    assert.doesNotMatch(builtIndex, /(?:src|href)="\/assets\//);
    const builtJavascript = assets
      .filter((filePath) => filePath.endsWith(".js"))
      .map((filePath) => readFileSync(filePath, "utf8"))
      .join("\n");
    const hash = (filePath) =>
      createHash("sha256").update(readFileSync(filePath)).digest("hex");
    for (const sourceMediaPath of demoMediaPaths) {
      const fileName = path.basename(sourceMediaPath);
      const builtMediaPath = path.join(distDirectory, "media", fileName);
      assert.ok(existsSync(builtMediaPath), fileName);
      assert.ok(builtJavascript.includes(`./media/${fileName}`), fileName);
      assert.ok(!builtJavascript.includes(`"/media/${fileName}"`));
      assert.ok(!builtJavascript.includes(`'/media/${fileName}'`));
      assert.equal(hash(builtMediaPath), hash(sourceMediaPath));
    }
  },
);
