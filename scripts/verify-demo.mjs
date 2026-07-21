import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  DEFAULT_DEMO_MEDIA_ID,
  DEMO_MEDIA_CATALOG,
  getDemoMediaOption,
} from "../examples/basic/demoMediaCatalog.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.resolve(scriptDirectory, "..");
const demoDirectory = path.join(packageDirectory, "examples", "basic");
const demoPublicDirectory = path.join(demoDirectory, "public");
const demoMediaDirectory = path.join(demoPublicDirectory, "media");
const demoMediaPaths = DEMO_MEDIA_CATALOG.map(({ url }) =>
  path.join(demoPublicDirectory, url.replace(/^\.\//, "")),
);
const demoMediaReadmePath = path.join(
  demoMediaDirectory,
  "README.md",
);
const viteConfigPath = path.join(packageDirectory, "vite.config.js");
const distDirectory = path.join(packageDirectory, "dist");
const maxMediaBytes = 3 * 1024 * 1024;
const maxTotalMediaBytes = 10 * 1024 * 1024;
const requireBuild = process.argv.includes("--require-build");
const staticOnly = process.argv.includes("--static-only");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const createTokenPattern = (tokens) =>
  new RegExp(`(?:${tokens.map(escapeRegExp).join("|")})`, "i");
const forbiddenHostPattern = createTokenPattern([
  ["Garden", "Planner"].join(""),
  ["Garden", " ", "Planner"].join(""),
  ["projection", "Effects"].join(""),
  ["Public", "Asset", "Resolver"].join(""),
]);
const forbiddenRuntimeAttributionPattern = createTokenPattern([
  ["Za", "firo"].join(""),
]);
const forbiddenUiPattern = createTokenPattern([
  ["Re", "act"].join(""),
  ["Re", "act", "DOM"].join(""),
  ["styled", "-", "components"].join(""),
]);

assert.ok(
  !(requireBuild && staticOnly),
  "--require-build and --static-only cannot be combined",
);

const normalizePath = (value) => value.split(path.sep).join("/");

const collectFiles = (directory) => {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
  });
};

const readUtf8 = (filePath) => readFileSync(filePath, "utf8");

const assertFile = (filePath, label) => {
  assert.ok(existsSync(filePath), `${label} is missing: ${filePath}`);
  assert.ok(statSync(filePath).isFile(), `${label} is not a file: ${filePath}`);
};

const verifyStaticDemoBoundary = async () => {
  const indexPath = path.join(demoDirectory, "index.html");
  const packageManifestPath = path.join(packageDirectory, "package.json");

  assertFile(indexPath, "Demo HTML entry");
  assertFile(viteConfigPath, "Vite configuration");
  assertFile(demoMediaReadmePath, "Demo media README");

  assert.equal(DEMO_MEDIA_CATALOG.length, 4, "Demo catalog must have four entries");
  assert.ok(Object.isFrozen(DEMO_MEDIA_CATALOG), "Demo catalog must be frozen");
  assert.ok(
    DEMO_MEDIA_CATALOG.every(Object.isFrozen),
    "Every demo catalog entry must be frozen",
  );
  assert.equal(
    DEMO_MEDIA_CATALOG.filter(({ origin }) => origin === "author-recorded")
      .length,
    3,
    "Demo catalog must have three author-recorded entries",
  );
  assert.equal(
    DEMO_MEDIA_CATALOG.filter(({ origin }) => origin === "procedural").length,
    1,
    "Demo catalog must have one procedural entry",
  );
  assert.equal(
    new Set(DEMO_MEDIA_CATALOG.map(({ id }) => id)).size,
    DEMO_MEDIA_CATALOG.length,
    "Demo media ids must be unique",
  );
  assert.equal(
    new Set(DEMO_MEDIA_CATALOG.map(({ url }) => url)).size,
    DEMO_MEDIA_CATALOG.length,
    "Demo media URLs must be unique",
  );
  assert.equal(
    getDemoMediaOption(DEFAULT_DEMO_MEDIA_ID)?.origin,
    "author-recorded",
    "The default demo media must be author-recorded",
  );
  assert.ok(
    DEMO_MEDIA_CATALOG.every(({ url }) => /^\.\/media\/[\w-]+\.mp4$/.test(url)),
    "Demo media URLs must be relative MP4 paths",
  );

  const demoTextFiles = collectFiles(demoDirectory).filter((filePath) =>
    /\.(?:css|html|js|json|md|mjs)$/i.test(filePath),
  );
  assert.ok(demoTextFiles.length > 0, "Demo does not contain text source files");

  const demoSources = demoTextFiles.map((filePath) => ({
    filePath,
    relativePath: normalizePath(path.relative(packageDirectory, filePath)),
    source: readUtf8(filePath),
  }));
  const runtimeNeutralPaths = new Set([
    "examples/basic/main.js",
    "examples/basic/demoMediaCatalog.js",
    "examples/basic/index.html",
    "examples/basic/styles.css",
  ]);
  const javascriptSource = demoSources
    .filter(({ filePath }) => /\.(?:js|mjs)$/i.test(filePath))
    .map(({ source }) => source)
    .join("\n");
  const catalogSource = readUtf8(path.join(demoDirectory, "demoMediaCatalog.js"));
  assert.doesNotMatch(
    catalogSource,
    /\b(?:document|window|fetch|XMLHttpRequest)\b/,
    "Demo media catalog must import without browser-only dependencies",
  );
  const mainSource = readUtf8(path.join(demoDirectory, "main.js"));
  const resetSource = mainSource.match(
    /const\s+resetDemo\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\n\};\n\nlisten\(controlsById\.get\("reset-demo"\)/,
  )?.[0];
  assert.ok(resetSource, "Demo reset flow is missing");
  assert.doesNotMatch(
    resetSource,
    /mediaId|switchDemoMedia|createProjectorSession/,
    "Reset must not replace or change the active media session",
  );

  assert.match(
    javascriptSource,
    /\bfrom\s+["']three-projective-media["']/,
    "Demo must import the package through its public self-reference",
  );
  for (const { url } of DEMO_MEDIA_CATALOG) {
    assert.ok(
      javascriptSource.includes(url),
      `Demo catalog omits ${url}`,
    );
    assert.ok(
      !javascriptSource.includes(`"/${url.replace(/^\.\//, "")}"`) &&
        !javascriptSource.includes(`'/${url.replace(/^\.\//, "")}'`),
      `Demo media URL must remain relative: ${url}`,
    );
  }

  for (const { relativePath, source } of demoSources) {
    assert.doesNotMatch(
      source,
      /\b(?:from\s*|import\s*\()["'][^"']*(?:^|\/)src\//m,
      `${relativePath} imports package internals`,
    );
    assert.doesNotMatch(
      source,
      forbiddenHostPattern,
      `${relativePath} contains host-product semantics`,
    );
    if (runtimeNeutralPaths.has(relativePath)) {
      assert.doesNotMatch(
        source,
        forbiddenRuntimeAttributionPattern,
        `${relativePath} contains host attribution in runtime/UI source`,
      );
    }
    assert.doesNotMatch(
      source,
      forbiddenUiPattern,
      `${relativePath} contains a forbidden UI dependency`,
    );
    assert.doesNotMatch(
      source,
      /(?:unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|esm\.sh|skypack\.dev)/i,
      `${relativePath} references a CDN`,
    );

    for (const match of source.matchAll(/https?:\/\/[^\s"'<>`)]+/g)) {
      const isRepositoryUrl =
        /^https:\/\/github\.com\/bartoszubak\/three-projective-media(?:[/?#]|$)/.test(
          match[0],
        );
      const isMediaProvenanceUrl =
        relativePath === "examples/basic/public/media/README.md" &&
        match[0] === "https://playzafiro.com/isle-lab/";
      assert.ok(
        isRepositoryUrl || isMediaProvenanceUrl,
        `${relativePath} references an unexpected external URL: ${match[0]}`,
      );
    }
  }

  const mediaReadme = readUtf8(demoMediaReadmePath);
  assert.deepEqual(
    readdirSync(demoMediaDirectory).sort(),
    [
      "README.md",
      ...DEMO_MEDIA_CATALOG.map(({ url }) => path.basename(url)),
    ].sort(),
    "Public media directory must contain only the catalog and its README",
  );
  let totalMediaBytes = 0;
  const mediaHashes = new Map();
  for (const mediaPath of demoMediaPaths) {
    assertFile(mediaPath, `Demo media ${path.basename(mediaPath)}`);
    const mediaStats = statSync(mediaPath);
    assert.ok(mediaStats.size > 0, `${path.basename(mediaPath)} is empty`);
    assert.ok(
      mediaStats.size < maxMediaBytes,
      `${path.basename(mediaPath)} must remain below 3 MB`,
    );
    totalMediaBytes += mediaStats.size;
    const mediaSha256 = createHash("sha256")
      .update(readFileSync(mediaPath))
      .digest("hex");
    mediaHashes.set(path.basename(mediaPath), mediaSha256);
    assert.ok(
      mediaReadme.toLowerCase().includes(mediaSha256),
      `Demo media README must contain ${path.basename(mediaPath)} SHA-256`,
    );
  }
  assert.ok(
    totalMediaBytes < maxTotalMediaBytes,
    `Combined demo media must remain below 10 MB (${totalMediaBytes} bytes)`,
  );

  assert.match(mediaReadme, /Zafiro Isle Lab/);
  assert.match(mediaReadme, /https:\/\/playzafiro\.com\/isle-lab\//);
  assert.match(mediaReadme, /Bartek Bąk/);
  assert.match(mediaReadme, /Copyright © 2026 Bartek Bąk/);
  assert.match(mediaReadme, /screen recordings|captured and produced/i);
  assert.match(mediaReadme, /provenance/i);
  assert.match(mediaReadme, /procedurally generated|procedural/i);
  assert.match(mediaReadme, /ffmpeg/i);
  assert.match(mediaReadme, /H\.264|h264/i);
  assert.match(mediaReadme, /640\s*[×x]\s*360/i);
  assert.match(mediaReadme, /30\s*(?:fps|frames per second)/i);
  const terrainRights = mediaReadme.split("## Abstract Color Field")[0];
  assert.doesNotMatch(terrainRights, /public domain|\bCC0\b|royalty free/i);
  assert.doesNotMatch(
    terrainRights,
    /separate permission|redistribution prohibited|reuse outside this demo|not covered by (?:the )?MIT/i,
  );

  const html = readUtf8(indexPath);
  assert.match(html, /<label\s+for=["']projection-video-source["']/i);
  assert.match(html, /<select[^>]+data-projector-space-video-select/i);
  assert.doesNotMatch(html, /<video\b/i);
  assert.doesNotMatch(html, /\bpreload\s*=/i);

  const configUrl = `${pathToFileURL(viteConfigPath).href}?verify-demo=${Date.now()}`;
  const configModule = await import(configUrl);
  const config =
    typeof configModule.default === "function"
      ? await configModule.default({ command: "build", mode: "production" })
      : configModule.default;
  assert.ok(
    config && typeof config === "object",
    "Vite config must export an object",
  );

  const resolvedRoot = path.resolve(packageDirectory, config.root || ".");
  const resolvedOutDir = path.resolve(
    resolvedRoot,
    config.build?.outDir || "dist",
  );
  assert.equal(resolvedRoot, demoDirectory, "Vite root must be examples/basic");
  assert.equal(resolvedOutDir, distDirectory, "Vite output must be root dist");
  assert.equal(config.base, "./", "Vite base must use relative URLs");
  assert.equal(
    config.build?.emptyOutDir,
    true,
    "Vite must empty root dist before build",
  );
  assert.equal(
    config.build?.sourcemap,
    false,
    "Public demo source maps must be disabled",
  );

  const aliases = config.resolve?.alias;
  const aliasEntries = Array.isArray(aliases)
    ? aliases
    : Object.entries(aliases || {}).map(([find, replacement]) => ({
        find,
        replacement,
      }));
  for (const alias of aliasEntries) {
    const replacement = String(alias.replacement || "");
    assert.doesNotMatch(
      normalizePath(replacement),
      /(?:^|\/)src(?:\/|$)/,
      `Vite alias ${String(alias.find)} bypasses the package export`,
    );
  }

  const manifest = JSON.parse(readUtf8(packageManifestPath));
  const publishedPaths = manifest.files || [];
  assert.ok(publishedPaths.includes("src"), "Package files must publish src");
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
      `Package files unexpectedly publish ${forbiddenPath}`,
    );
  }

  const publicPackage = await import("three-projective-media");
  assert.equal(
    typeof publicPackage.createProjectiveMediaProjector,
    "function",
    "Package self-reference must resolve through the public export",
  );

  return {
    mediaBytes: totalMediaBytes,
    mediaHashes,
    sourceFileCount: demoSources.length,
  };
};

const verifyBuildOutput = () => {
  const indexPath = path.join(distDirectory, "index.html");
  const assetsDirectory = path.join(distDirectory, "assets");

  assertFile(indexPath, "Built demo HTML");
  assert.ok(
    existsSync(assetsDirectory) && statSync(assetsDirectory).isDirectory(),
    "Built demo assets directory is missing",
  );

  const assetFiles = collectFiles(assetsDirectory);
  assert.ok(
    assetFiles.some((filePath) => filePath.endsWith(".js")),
    "Built demo does not contain a JavaScript asset",
  );
  assert.ok(
    assetFiles.some((filePath) => filePath.endsWith(".css")),
    "Built demo does not contain a CSS asset",
  );

  const builtIndex = readUtf8(indexPath);
  assert.match(builtIndex, /(?:src|href)="\.\/assets\//);
  assert.doesNotMatch(builtIndex, /(?:src|href)="\/assets\//);
  const builtJavascript = assetFiles
    .filter((filePath) => filePath.endsWith(".js"))
    .map(readUtf8)
    .join("\n");
  for (const sourceMediaPath of demoMediaPaths) {
    const fileName = path.basename(sourceMediaPath);
    const builtMediaPath = path.join(distDirectory, "media", fileName);
    assertFile(builtMediaPath, `Built demo media ${fileName}`);
    assert.ok(
      builtJavascript.includes(`./media/${fileName}`),
      `Built demo must keep a relative URL for ${fileName}`,
    );
    const sourceMediaHash = createHash("sha256")
      .update(readFileSync(sourceMediaPath))
      .digest("hex");
    const builtMediaHash = createHash("sha256")
      .update(readFileSync(builtMediaPath))
      .digest("hex");
    assert.equal(
      builtMediaHash,
      sourceMediaHash,
      `Vite must copy ${fileName} without modifying it`,
    );
  }

  for (const filePath of [indexPath, ...assetFiles].filter((entry) =>
    /\.(?:css|html|js|map)$/i.test(entry),
  )) {
    const relativePath = normalizePath(path.relative(packageDirectory, filePath));
    const source = readUtf8(filePath);
    assert.doesNotMatch(
      source,
      forbiddenHostPattern,
      `${relativePath} contains host-product data`,
    );
    assert.doesNotMatch(
      source,
      forbiddenRuntimeAttributionPattern,
      `${relativePath} contains host attribution in built runtime/UI output`,
    );
    assert.doesNotMatch(
      source,
      /\/(?:Users|home)\//,
      `${relativePath} contains a local absolute path`,
    );
  }

  return { assetCount: assetFiles.length };
};

const verifyPackedArtifact = () => {
  const npmCacheDirectory = mkdtempSync(
    path.join(tmpdir(), "projective-media-npm-cache-"),
  );
  const existingTarballs = new Set(
    readdirSync(packageDirectory).filter((entry) => entry.endsWith(".tgz")),
  );
  const packResult = spawnSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: packageDirectory,
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_cache: npmCacheDirectory,
    },
  });

  try {
    assert.equal(
      packResult.status,
      0,
      `npm pack --dry-run failed:\n${packResult.stderr || packResult.stdout}`,
    );
    const packReports = JSON.parse(packResult.stdout);
    assert.equal(packReports.length, 1, "Expected one npm pack report");
    const packedFiles = packReports[0].files.map(({ path: packedPath }) =>
      normalizePath(packedPath),
    );
    assert.equal(packedFiles.length, 8, "Expected eight approved package files");

    for (const requiredPath of ["package.json", "README.md", "LICENSE"]) {
      assert.ok(
        packedFiles.includes(requiredPath),
        `Tarball omits ${requiredPath}`,
      );
    }
    assert.ok(
      packedFiles.some((packedPath) => packedPath.startsWith("src/")),
      "Tarball omits package source",
    );

    const forbiddenPatterns = [
      /^(?:examples|tests|docs|scripts|dist)(?:\/|$)/,
      /(?:^|\/)[^/]+\.mp4$/,
      /(?:^|\/)package-lock\.json$/,
      /(?:^|\/)[^/]+\.tgz$/,
    ];
    for (const packedPath of packedFiles) {
      for (const pattern of forbiddenPatterns) {
        assert.doesNotMatch(
          packedPath,
          pattern,
          `Tarball contains forbidden path ${packedPath}`,
        );
      }
    }

    return { packedFiles };
  } finally {
    for (const tarball of readdirSync(packageDirectory).filter((entry) =>
      entry.endsWith(".tgz"),
    )) {
      if (!existingTarballs.has(tarball)) {
        unlinkSync(path.join(packageDirectory, tarball));
      }
    }
    rmSync(npmCacheDirectory, { force: true, recursive: true });
  }
};

const staticResult = await verifyStaticDemoBoundary();
console.log(
  `Demo source verified (${staticResult.sourceFileCount} text files, ${staticResult.mediaBytes} media bytes).`,
);

if (!staticOnly) {
  if (existsSync(distDirectory)) {
    const buildResult = verifyBuildOutput();
    console.log(`Demo build output verified (${buildResult.assetCount} assets).`);
  } else if (requireBuild) {
    assert.fail("Demo build output is required but root dist does not exist");
  } else {
    console.log("Demo build output not present; post-build checks skipped.");
  }

  const packResult = verifyPackedArtifact();
  console.log(`Package dry-run verified (${packResult.packedFiles.length} files).`);
}
