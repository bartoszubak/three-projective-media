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

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.resolve(scriptDirectory, "..");
const demoDirectory = path.join(packageDirectory, "examples", "basic");
const demoPublicDirectory = path.join(demoDirectory, "public");
const demoMediaPath = path.join(
  demoPublicDirectory,
  "media",
  "projector-space-demo.mp4",
);
const demoMediaReadmePath = path.join(
  demoPublicDirectory,
  "media",
  "README.md",
);
const viteConfigPath = path.join(packageDirectory, "vite.config.js");
const distDirectory = path.join(packageDirectory, "dist");
const maxMediaBytes = 3 * 1024 * 1024;
const requireBuild = process.argv.includes("--require-build");
const staticOnly = process.argv.includes("--static-only");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const createTokenPattern = (tokens) =>
  new RegExp(`(?:${tokens.map(escapeRegExp).join("|")})`, "i");
const forbiddenHostPattern = createTokenPattern([
  ["Garden", "Planner"].join(""),
  ["Garden", " ", "Planner"].join(""),
  ["Za", "firo"].join(""),
  ["projection", "Effects"].join(""),
  ["Public", "Asset", "Resolver"].join(""),
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
  assertFile(demoMediaPath, "Procedural demo media");
  assertFile(demoMediaReadmePath, "Demo media README");

  const demoTextFiles = collectFiles(demoDirectory).filter((filePath) =>
    /\.(?:css|html|js|json|md|mjs)$/i.test(filePath),
  );
  assert.ok(demoTextFiles.length > 0, "Demo does not contain text source files");

  const demoSources = demoTextFiles.map((filePath) => ({
    filePath,
    relativePath: normalizePath(path.relative(packageDirectory, filePath)),
    source: readUtf8(filePath),
  }));
  const javascriptSource = demoSources
    .filter(({ filePath }) => /\.(?:js|mjs)$/i.test(filePath))
    .map(({ source }) => source)
    .join("\n");

  assert.match(
    javascriptSource,
    /\bfrom\s+["']three-projective-media["']/,
    "Demo must import the package through its public self-reference",
  );
  assert.match(
    javascriptSource,
    /["'`](?:\.\/)?media\/projector-space-demo\.mp4["'`]/,
    "Demo must resolve the procedural video from its local public media path",
  );
  assert.doesNotMatch(
    javascriptSource,
    /["'`]\/media\/projector-space-demo\.mp4["'`]/,
    "Demo media URL must remain relative for the Pages base path",
  );

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
      assert.match(
        match[0],
        /^https:\/\/github\.com\/bartoszubak\/three-projective-media(?:[/?#]|$)/,
        `${relativePath} references an unexpected external URL: ${match[0]}`,
      );
    }
  }

  const mediaStats = statSync(demoMediaPath);
  assert.ok(mediaStats.size > 0, "Procedural demo media is empty");
  assert.ok(
    mediaStats.size < maxMediaBytes,
    `Procedural demo media must remain below 3 MB (${mediaStats.size} bytes)`,
  );

  const mediaReadme = readUtf8(demoMediaReadmePath);
  const mediaSha256 = createHash("sha256")
    .update(readFileSync(demoMediaPath))
    .digest("hex");
  assert.match(mediaReadme, /procedurally generated|procedural/i);
  assert.match(mediaReadme, /ffmpeg/i);
  assert.match(mediaReadme, /H\.264|h264/i);
  assert.match(mediaReadme, /640\s*[×x]\s*360/i);
  assert.match(mediaReadme, /30\s*(?:fps|frames per second)/i);
  assert.match(mediaReadme, /third[- ]party/i);
  assert.match(mediaReadme, /MIT/i);
  assert.ok(
    mediaReadme.toLowerCase().includes(mediaSha256),
    "Demo media README must contain the current media SHA-256",
  );

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
    mediaBytes: mediaStats.size,
    mediaSha256,
    sourceFileCount: demoSources.length,
  };
};

const verifyBuildOutput = () => {
  const indexPath = path.join(distDirectory, "index.html");
  const assetsDirectory = path.join(distDirectory, "assets");
  const builtMediaPath = path.join(
    distDirectory,
    "media",
    "projector-space-demo.mp4",
  );

  assertFile(indexPath, "Built demo HTML");
  assert.ok(
    existsSync(assetsDirectory) && statSync(assetsDirectory).isDirectory(),
    "Built demo assets directory is missing",
  );
  assertFile(builtMediaPath, "Built procedural demo media");

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
  assert.match(
    builtJavascript,
    /["'`](?:\.\/)?media\/projector-space-demo\.mp4["'`]/,
    "Built demo must keep a relative public-media URL",
  );
  assert.doesNotMatch(
    builtJavascript,
    /["'`]\/media\/projector-space-demo\.mp4["'`]/,
  );

  const sourceMediaHash = createHash("sha256")
    .update(readFileSync(demoMediaPath))
    .digest("hex");
  const builtMediaHash = createHash("sha256")
    .update(readFileSync(builtMediaPath))
    .digest("hex");
  assert.equal(
    builtMediaHash,
    sourceMediaHash,
    "Vite must copy demo media without modifying it",
  );

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
      /(?:^|\/)projector-space-demo\.mp4$/,
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
