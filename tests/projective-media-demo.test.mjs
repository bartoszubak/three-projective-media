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
const demoMediaPath = path.join(
  demoDirectory,
  "public",
  "media",
  "projector-space-demo.mp4",
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
  const sources = sourceFiles.map((filePath) => readFileSync(filePath, "utf8"));
  const javascript = sourceFiles
    .filter((filePath) => /\.(?:js|mjs)$/i.test(filePath))
    .map((filePath) => readFileSync(filePath, "utf8"))
    .join("\n");

  assert.match(javascript, /\bfrom\s+["']three-projective-media["']/);
  assert.match(
    javascript,
    /["'`](?:\.\/)?media\/projector-space-demo\.mp4["'`]/,
  );
  assert.doesNotMatch(
    javascript,
    /["'`]\/media\/projector-space-demo\.mp4["'`]/,
  );
  for (const source of sources) {
    assert.doesNotMatch(
      source,
      /\b(?:from\s*|import\s*\()["'][^"']*(?:^|\/)src\//m,
    );
    assert.doesNotMatch(
      source,
      /\b(?:GardenPlanner|Garden Planner|Zafiro|projectionEffects|PublicAssetResolver)\b/i,
    );
    assert.doesNotMatch(source, /\b(?:React|ReactDOM|styled-components)\b/i);
    assert.doesNotMatch(
      source,
      /(?:unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|esm\.sh|skypack\.dev)/i,
    );
  }
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

test("demo media is local, documented, and remains below three megabytes", () => {
  assert.ok(existsSync(demoMediaPath), "procedural media file");
  assert.ok(existsSync(demoMediaReadmePath), "procedural media README");
  assert.ok(statSync(demoMediaPath).size > 0);
  assert.ok(statSync(demoMediaPath).size < 3 * 1024 * 1024);

  const mediaHash = createHash("sha256")
    .update(readFileSync(demoMediaPath))
    .digest("hex");
  const mediaReadme = readFileSync(demoMediaReadmePath, "utf8");
  assert.match(mediaReadme, /procedurally generated|procedural/i);
  assert.match(mediaReadme, /ffmpeg/i);
  assert.ok(mediaReadme.toLowerCase().includes(mediaHash));
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
  "built demo contains relative JS/CSS assets and an unchanged media copy",
  { skip: !existsSync(distDirectory) },
  () => {
    const indexPath = path.join(distDirectory, "index.html");
    const assetsDirectory = path.join(distDirectory, "assets");
    const builtMediaPath = path.join(
      distDirectory,
      "media",
      "projector-space-demo.mp4",
    );

    assert.ok(existsSync(indexPath));
    assert.ok(existsSync(assetsDirectory));
    assert.ok(existsSync(builtMediaPath));
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
    assert.match(
      builtJavascript,
      /["'`](?:\.\/)?media\/projector-space-demo\.mp4["'`]/,
    );
    assert.doesNotMatch(
      builtJavascript,
      /["'`]\/media\/projector-space-demo\.mp4["'`]/,
    );

    const hash = (filePath) =>
      createHash("sha256").update(readFileSync(filePath)).digest("hex");
    assert.equal(hash(builtMediaPath), hash(demoMediaPath));
  },
);
