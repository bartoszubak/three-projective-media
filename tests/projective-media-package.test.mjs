import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as THREE from "three";

import * as projectiveMedia from "../src/index.js";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.resolve(testsDirectory, "..");
const sourceDirectory = path.join(packageDirectory, "src");

const createVideoDouble = () => {
  const listeners = new Map();

  return {
    currentTime: 0,
    error: null,
    loop: false,
    muted: false,
    defaultMuted: false,
    volume: 1,
    pauseCalls: 0,
    loadCalls: 0,
    removedListenerCalls: 0,
    addEventListener(type, listener) {
      const bucket = listeners.get(type) || new Set();
      bucket.add(listener);
      listeners.set(type, bucket);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type)?.delete(listener)) {
        this.removedListenerCalls += 1;
      }
    },
    dispatch(type, event = {}) {
      for (const listener of Array.from(listeners.get(type) || [])) {
        listener({ type, ...event });
      }
    },
    listenerCount() {
      return Array.from(listeners.values()).reduce(
        (count, bucket) => count + bucket.size,
        0,
      );
    },
    setAttribute() {},
    removeAttribute(name) {
      if (name === "src") this.src = "";
    },
    play() {
      return Promise.resolve();
    },
    pause() {
      this.pauseCalls += 1;
    },
    load() {
      this.loadCalls += 1;
    },
  };
};

test("projective-media package exposes the declared neutral package boundary", () => {
  const manifest = JSON.parse(
    readFileSync(path.join(packageDirectory, "package.json"), "utf8"),
  );

  assert.equal(manifest.name, "three-projective-media");
  assert.equal(manifest.version, "0.1.0");
  assert.notEqual(manifest.private, true);
  assert.equal(manifest.type, "module");
  assert.equal(manifest.exports?.["."], "./src/index.js");
  for (const publishedPath of ["src", "README.md", "LICENSE"]) {
    assert.ok(manifest.files?.includes(publishedPath), publishedPath);
  }
  assert.equal(manifest.license, "MIT");
  assert.equal(manifest.repository?.type, "git");
  assert.equal(
    manifest.repository?.url,
    "git+https://github.com/bartoszubak/three-projective-media.git",
  );
  assert.equal(manifest.peerDependencies?.three, ">=0.185.0 <0.186.0");
  assert.equal(manifest.devDependencies?.three, "0.185.0");
  assert.equal(manifest.devDependencies?.vite, "8.1.3");
  assert.equal(manifest.scripts?.dev, "vite --config vite.config.js");
  assert.equal(
    manifest.scripts?.["build:demo"],
    "vite build --config vite.config.js",
  );
  assert.equal(
    manifest.scripts?.["preview:demo"],
    "vite preview --config vite.config.js",
  );
  assert.equal(
    manifest.scripts?.["verify:demo"],
    "node scripts/verify-demo.mjs --static-only",
  );
  assert.equal(manifest.scripts?.test, "node --test tests/*.test.mjs");
  assert.equal(
    manifest.scripts?.verify,
    "npm test && npm run verify:demo && npm run build:demo && node scripts/verify-demo.mjs --require-build",
  );
  assert.deepEqual(
    readdirSync(sourceDirectory)
      .filter((file) => file.endsWith(".js"))
      .sort(),
    [
      "createProjectiveMediaMaterial.js",
      "createProjectiveMediaProjector.js",
      "createProjectiveMediaSource.js",
      "index.js",
      "projectiveMediaMath.js",
    ],
  );
});

test("projective-media source imports only Three.js or sibling modules", () => {
  const forbiddenTokens = [
    /GardenPlanner/i,
    /Zafiro/i,
    /buildingMass/i,
    /placeableStore/i,
    /compatibilityTarget/,
    /compatibilityTargetMode/,
    /targetBound/,
    /\bsetTarget\s*[(:]/,
    /\bgetTarget\s*[(:]/,
  ];

  for (const file of readdirSync(sourceDirectory).filter((entry) =>
    entry.endsWith(".js"),
  )) {
    const source = readFileSync(path.join(sourceDirectory, file), "utf8");
    const importSpecifiers = Array.from(
      source.matchAll(
        /\b(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
      ),
      (match) => match[1],
    );

    for (const specifier of importSpecifiers) {
      assert.ok(
        specifier === "three" ||
          (specifier.startsWith("./") && !specifier.includes("/../")),
        `${file} imports forbidden dependency ${specifier}`,
      );
    }
    for (const token of forbiddenTokens) {
      assert.doesNotMatch(source, token, `${file} contains ${token}`);
    }
  }
});

test("projective-media tests depend only on the public entrypoint, Three.js, and Node builtins", () => {
  const testFiles = readdirSync(testsDirectory).filter((entry) =>
    entry.endsWith(".test.mjs"),
  );

  for (const file of testFiles) {
    const source = readFileSync(path.join(testsDirectory, file), "utf8");
    assert.doesNotMatch(source, /(?:^|[/'"])src\/(?:products|app)(?:[/'"]|$)/);
    const importSpecifiers = Array.from(
      source.matchAll(
        /\b(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
      ),
      (match) => match[1],
    );

    for (const specifier of importSpecifiers) {
      assert.ok(
        specifier.startsWith("node:") ||
          specifier === "three" ||
          specifier === "../src/index.js",
        `${file} bypasses the public package entrypoint with ${specifier}`,
      );
    }
  }
});

test("projective-media root exports the source, material, projector, and math API", () => {
  for (const exportName of [
    "createProjectiveMediaSource",
    "createProjectiveMediaMaterial",
    "createProjectiveMediaProjector",
    "projectWorldPositionToProjectiveMedia",
    "resolveProjectiveMediaEdgeFactor",
    "updateProjectiveMediaCamera",
  ]) {
    assert.equal(typeof projectiveMedia[exportName], "function", exportName);
  }
  assert.equal(
    projectiveMedia.PROJECTIVE_MEDIA_BLEND_MODES.ADDITIVE,
    "additive",
  );
  assert.equal(typeof projectiveMedia.PROJECTIVE_MEDIA_VERTEX_SHADER, "string");
  assert.equal(
    typeof projectiveMedia.PROJECTIVE_MEDIA_FRAGMENT_SHADER,
    "string",
  );
});

test("projector owns overlays and media lifecycle without owning receiver resources", () => {
  const texture = new THREE.Texture();
  let mediaDisposeCalls = 0;
  let mediaUnsubscribeCalls = 0;
  const mediaSource = {
    texture,
    getSnapshot: () => ({ status: "ready" }),
    subscribe: () => () => {
      mediaUnsubscribeCalls += 1;
    },
    dispose: () => {
      mediaDisposeCalls += 1;
    },
  };
  const geometry = new THREE.BoxGeometry();
  const targetMaterial = new THREE.MeshBasicMaterial();
  const target = new THREE.Mesh(geometry, targetMaterial);
  let geometryDisposeCalls = 0;
  let targetMaterialDisposeCalls = 0;
  geometry.addEventListener("dispose", () => {
    geometryDisposeCalls += 1;
  });
  targetMaterial.addEventListener("dispose", () => {
    targetMaterialDisposeCalls += 1;
  });

  const projector = projectiveMedia.createProjectiveMediaProjector({
    receiverRoots: [target],
    mediaSource,
  });
  const overlay = projector.getOverlayMeshes()[0];
  let projectorMaterialDisposeCalls = 0;
  projector.material.addEventListener("dispose", () => {
    projectorMaterialDisposeCalls += 1;
  });

  assert.equal(projector.getStatus().overlayCount, 1);
  assert.equal(overlay.parent, target);
  assert.equal(overlay.geometry, geometry);
  assert.equal(projector.clearReceiverRoots(), 0);
  assert.equal(overlay.parent, null);
  assert.equal(geometryDisposeCalls, 0);
  assert.equal(targetMaterialDisposeCalls, 0);

  assert.equal(projector.setReceiverRoots([target]), 1);
  assert.equal(projector.dispose(), true);
  assert.equal(projector.dispose(), false);
  assert.equal(projector.getOverlayMeshes().length, 0);
  assert.equal(projectorMaterialDisposeCalls, 1);
  assert.equal(mediaUnsubscribeCalls, 1);
  assert.equal(mediaDisposeCalls, 1);
  assert.equal(geometryDisposeCalls, 0);
  assert.equal(targetMaterialDisposeCalls, 0);

  geometry.dispose();
  targetMaterial.dispose();
  texture.dispose();
});

test("media source isolates throwing subscribers from events, controls, and disposal", () => {
  const video = createVideoDouble();
  const source = projectiveMedia.createProjectiveMediaSource({
    url: "/media/test-video.mp4",
    muted: true,
    volume: 0.25,
    createVideoElement: () => video,
  });
  const healthySnapshots = [];
  let throwingCalls = 0;
  let textureDisposeCalls = 0;
  source.texture.addEventListener("dispose", () => {
    textureDisposeCalls += 1;
  });
  source.subscribe(() => {
    throwingCalls += 1;
    throw new Error("broken media subscriber");
  });
  source.subscribe((snapshot) => {
    healthySnapshots.push(snapshot);
  });

  assert.doesNotThrow(() => video.dispatch("playing"));
  assert.equal(source.getSnapshot().status, "playing");
  assert.equal(healthySnapshots.at(-1).status, "playing");

  let mutedResult;
  assert.doesNotThrow(() => {
    mutedResult = source.setMuted(false);
  });
  assert.equal(mutedResult, false);
  assert.equal(source.getSnapshot().muted, false);
  assert.equal(healthySnapshots.at(-1).muted, false);

  let volumeResult;
  assert.doesNotThrow(() => {
    volumeResult = source.setVolume(0.75);
  });
  assert.equal(volumeResult, 0.75);
  assert.equal(source.getSnapshot().volume, 0.75);
  assert.equal(healthySnapshots.at(-1).volume, 0.75);

  let disposeResult;
  assert.doesNotThrow(() => {
    disposeResult = source.dispose();
  });
  assert.equal(disposeResult, true);
  assert.equal(source.dispose(), false);
  assert.equal(source.getSnapshot().disposed, true);
  assert.equal(source.getSnapshot().status, "disposed");
  assert.equal(healthySnapshots.at(-1).disposed, true);
  assert.equal(throwingCalls, 4);
  assert.equal(healthySnapshots.length, 4);
  assert.equal(textureDisposeCalls, 1);
  assert.equal(video.listenerCount(), 0);
  assert.equal(video.removedListenerCalls, 6);
  assert.equal(video.pauseCalls, 1);
  assert.equal(video.loadCalls, 1);
  assert.equal(video.src, "");
});

test("projector isolates nested source and status subscriber failures from every lifecycle operation", () => {
  const video = createVideoDouble();
  const source = projectiveMedia.createProjectiveMediaSource({
    url: "/media/test-video.mp4",
    muted: true,
    volume: 0.25,
    createVideoElement: () => video,
  });
  let sourceThrowingCalls = 0;
  source.subscribe(() => {
    sourceThrowingCalls += 1;
    throw new Error("broken source subscriber");
  });

  const geometry = new THREE.BoxGeometry();
  const targetMaterial = new THREE.MeshBasicMaterial();
  const target = new THREE.Mesh(geometry, targetMaterial);
  const replacementGeometry = new THREE.BoxGeometry();
  const replacementMaterial = new THREE.MeshBasicMaterial();
  const replacementTarget = new THREE.Mesh(
    replacementGeometry,
    replacementMaterial,
  );
  const projector = projectiveMedia.createProjectiveMediaProjector({
    receiverRoots: [target],
    mediaSource: source,
  });
  const healthyStatuses = [];
  let statusThrowingCalls = 0;
  let projectorMaterialDisposeCalls = 0;
  let textureDisposeCalls = 0;
  projector.material.addEventListener("dispose", () => {
    projectorMaterialDisposeCalls += 1;
  });
  source.texture.addEventListener("dispose", () => {
    textureDisposeCalls += 1;
  });
  projector.subscribeStatus(() => {
    statusThrowingCalls += 1;
    throw new Error("broken projector subscriber");
  });
  projector.subscribeStatus((status) => {
    healthyStatuses.push(status);
  });

  assert.doesNotThrow(() => video.dispatch("playing"));
  assert.equal(healthyStatuses.at(-1).media.status, "playing");

  assert.doesNotThrow(() => projector.setMuted(false));
  assert.equal(projector.getStatus().media.muted, false);
  assert.doesNotThrow(() => projector.setVolume(0.6));
  assert.equal(projector.getStatus().media.volume, 0.6);

  let overlayCount;
  assert.doesNotThrow(() => {
    overlayCount = projector.setReceiverRoots([replacementTarget]);
  });
  assert.equal(overlayCount, 1);
  assert.equal(projector.getOverlayMeshes()[0].parent, replacementTarget);

  assert.doesNotThrow(() => projector.setEnabled(false));
  assert.equal(projector.getStatus().enabled, false);
  assert.equal(projector.getOverlayMeshes()[0].visible, false);
  assert.doesNotThrow(() => projector.setOpacity(0.4));
  assert.equal(projector.getStatus().opacity, 0.4);
  assert.doesNotThrow(() => projector.setEdgeFeather(0.2));
  assert.equal(projector.getStatus().edgeFeather, 0.2);
  assert.doesNotThrow(() => projector.setBlendMode("alpha"));
  assert.equal(projector.getStatus().blendMode, "alpha");

  const finalOverlay = projector.getOverlayMeshes()[0];
  let disposeResult;
  assert.doesNotThrow(() => {
    disposeResult = projector.dispose();
  });
  const notificationsAfterDispose = healthyStatuses.length;
  assert.equal(disposeResult, true);
  assert.equal(projector.dispose(), false);
  assert.equal(healthyStatuses.length, notificationsAfterDispose);
  assert.equal(healthyStatuses.at(-1).disposed, true);
  assert.equal(projector.getStatus().disposed, true);
  assert.equal(projector.getOverlayMeshes().length, 0);
  assert.equal(finalOverlay.parent, null);
  assert.equal(source.getSnapshot().disposed, true);
  assert.equal(projectorMaterialDisposeCalls, 1);
  assert.equal(textureDisposeCalls, 1);
  assert.equal(video.listenerCount(), 0);
  assert.equal(video.pauseCalls, 1);
  assert.equal(video.loadCalls, 1);
  assert.ok(sourceThrowingCalls >= 4);
  assert.equal(statusThrowingCalls, healthyStatuses.length);

  geometry.dispose();
  targetMaterial.dispose();
  replacementGeometry.dispose();
  replacementMaterial.dispose();
});
