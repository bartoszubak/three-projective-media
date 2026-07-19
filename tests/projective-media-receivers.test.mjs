import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { createProjectiveMediaProjector } from "../src/index.js";

const createMediaSourceDouble = ({ currentTime = 12 } = {}) => {
  const texture = new THREE.Texture();
  const video = { currentTime };
  const listeners = new Set();
  let disposed = false;
  let disposeCalls = 0;

  return {
    texture,
    video,
    get disposeCalls() {
      return disposeCalls;
    },
    getSnapshot() {
      return {
        status: disposed ? "disposed" : "ready",
        disposed,
        currentTime: video.currentTime,
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (disposed) return false;
      disposed = true;
      disposeCalls += 1;
      texture.dispose();
      for (const listener of Array.from(listeners)) {
        listener(this.getSnapshot());
      }
      listeners.clear();
      return true;
    },
  };
};

const createMesh = ({
  name = "",
  geometry = new THREE.BoxGeometry(),
  material = new THREE.MeshBasicMaterial(),
} = {}) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  return mesh;
};

const disposeMeshResources = (...meshes) => {
  const geometries = new Set();
  const materials = new Set();
  for (const mesh of meshes) {
    if (mesh.geometry) geometries.add(mesh.geometry);
    const meshMaterials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of meshMaterials) {
      if (material) materials.add(material);
    }
  }
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
};

test("receiver roots bind multiple trees and deduplicate overlapping roots by mesh identity", () => {
  const mediaSource = createMediaSourceDouble();
  const outerRoot = new THREE.Group();
  const innerRoot = new THREE.Group();
  const separateRoot = new THREE.Group();
  const nestedMesh = createMesh({ name: "nested" });
  const separateMesh = createMesh({ name: "separate" });
  innerRoot.add(nestedMesh);
  outerRoot.add(innerRoot);
  separateRoot.add(separateMesh);

  const projector = createProjectiveMediaProjector({ mediaSource });
  assert.equal(
    projector.setReceiverRoots([outerRoot, innerRoot, separateRoot, outerRoot]),
    2,
  );
  assert.deepEqual(
    new Set(projector.getReceiverMeshes()),
    new Set([nestedMesh, separateMesh]),
  );
  assert.equal(projector.getOverlayMeshes().length, 2);
  assert.deepEqual(projector.getReceiverRoots(), [
    outerRoot,
    innerRoot,
    separateRoot,
  ]);
  assert.deepEqual(
    {
      receiverRootCount: projector.getStatus().receiverRootCount,
      explicitReceiverCount: projector.getStatus().explicitReceiverCount,
      receiverMeshCount: projector.getStatus().receiverMeshCount,
      overlayCount: projector.getStatus().overlayCount,
    },
    {
      receiverRootCount: 3,
      explicitReceiverCount: 0,
      receiverMeshCount: 2,
      overlayCount: 2,
    },
  );

  projector.dispose();
  disposeMeshResources(nestedMesh, separateMesh);
});

test("explicit receiver and receiver-root mutation APIs add, remove, clear, and deduplicate", () => {
  const mediaSource = createMediaSourceDouble();
  const firstRoot = new THREE.Group();
  const secondRoot = new THREE.Group();
  const first = createMesh({ name: "first" });
  const second = createMesh({ name: "second" });
  const explicit = createMesh({ name: "explicit" });
  firstRoot.add(first);
  secondRoot.add(second);

  const projector = createProjectiveMediaProjector({ mediaSource });
  assert.equal(projector.addReceiverRoot(firstRoot), 1);
  assert.equal(projector.addReceiverRoot(secondRoot), 2);
  assert.equal(projector.addReceiverRoot(firstRoot), 2);
  assert.equal(projector.removeReceiverRoot(firstRoot), 1);
  assert.deepEqual(projector.getReceiverMeshes(), [second]);
  assert.equal(projector.clearReceiverRoots(), 0);

  assert.equal(projector.setReceivers([explicit, explicit]), 1);
  assert.equal(projector.addReceiver(second), 2);
  assert.equal(projector.addReceiver(second), 2);
  assert.equal(projector.getStatus().explicitReceiverCount, 2);
  assert.equal(projector.removeReceiver(explicit), 1);
  assert.deepEqual(projector.getReceiverMeshes(), [second]);
  assert.equal(projector.clearReceivers(), 0);

  projector.setReceiverRoots([secondRoot]);
  projector.addReceiver(second);
  assert.equal(projector.getStatus().receiverMeshCount, 1);
  assert.equal(projector.getStatus().overlayCount, 1);

  projector.dispose();
  disposeMeshResources(first, second, explicit);
});

test("refreshReceivers diffs descendants while preserving overlays, media, texture, and playback time", () => {
  const mediaSource = createMediaSourceDouble({ currentTime: 47.5 });
  const root = new THREE.Group();
  const first = createMesh({ name: "first" });
  const second = createMesh({ name: "second" });
  root.add(first);

  const projector = createProjectiveMediaProjector({
    receiverRoots: [root],
    mediaSource,
  });
  const firstOverlay = projector.getOverlayMeshes()[0];
  const texture = projector.mediaSource.texture;

  root.add(second);
  assert.equal(projector.refreshReceivers(), 2);
  assert.equal(
    projector.getOverlayMeshes().find((overlay) => overlay.parent === first),
    firstOverlay,
  );
  assert.equal(projector.mediaSource, mediaSource);
  assert.equal(projector.mediaSource.texture, texture);
  assert.equal(projector.mediaSource.video.currentTime, 47.5);

  root.remove(first);
  assert.equal(projector.refreshReceivers(), 1);
  assert.deepEqual(projector.getReceiverMeshes(), [second]);
  assert.equal(firstOverlay.parent, null);
  assert.equal(projector.mediaSource, mediaSource);
  assert.equal(projector.mediaSource.texture, texture);
  assert.equal(projector.mediaSource.video.currentTime, 47.5);

  projector.dispose();
  disposeMeshResources(first, second);
});

test("detachReceiverObject removes only one subtree without changing root configuration", () => {
  const mediaSource = createMediaSourceDouble();
  const root = new THREE.Group();
  const removedSubtree = new THREE.Group();
  const removedChildGroup = new THREE.Group();
  const firstRemoved = createMesh({ name: "first-removed" });
  const secondRemoved = createMesh({ name: "second-removed" });
  const retained = createMesh({ name: "retained" });
  removedChildGroup.add(secondRemoved);
  removedSubtree.add(firstRemoved, removedChildGroup);
  root.add(removedSubtree, retained);

  const projector = createProjectiveMediaProjector({
    receiverRoots: [root],
    mediaSource,
  });
  assert.equal(projector.detachReceiverObject(removedSubtree), 2);
  assert.deepEqual(projector.getReceiverMeshes(), [retained]);
  assert.deepEqual(projector.getReceiverRoots(), [root]);

  root.remove(removedSubtree);
  const replacementSubtree = new THREE.Group();
  const replacement = createMesh({ name: "replacement" });
  replacementSubtree.add(replacement);
  root.add(replacementSubtree);
  assert.equal(projector.refreshReceivers(), 2);
  assert.deepEqual(
    new Set(projector.getReceiverMeshes()),
    new Set([retained, replacement]),
  );

  projector.dispose();
  disposeMeshResources(firstRemoved, secondRemoved, retained, replacement);
});

test("setTarget retains single-target compatibility without taking over explicit receivers", () => {
  const mediaSource = createMediaSourceDouble();
  const firstRoot = new THREE.Group();
  const secondRoot = new THREE.Group();
  const first = createMesh({ name: "first" });
  const second = createMesh({ name: "second" });
  const explicit = createMesh({ name: "explicit" });
  firstRoot.add(first);
  secondRoot.add(second);

  const projector = createProjectiveMediaProjector({
    target: firstRoot,
    receivers: [explicit],
    mediaSource,
  });
  assert.equal(projector.getTarget(), firstRoot);
  assert.deepEqual(projector.getReceiverRoots(), [firstRoot]);
  assert.deepEqual(
    new Set(projector.getReceiverMeshes()),
    new Set([first, explicit]),
  );

  projector.setReceiverRoots([secondRoot]);
  assert.equal(projector.getTarget(), null);
  assert.deepEqual(projector.getReceiverRoots(), [secondRoot]);
  assert.deepEqual(
    new Set(projector.getReceiverMeshes()),
    new Set([second, explicit]),
  );

  assert.equal(projector.setTarget(firstRoot), 2);
  assert.equal(projector.getTarget(), firstRoot);
  assert.deepEqual(projector.getReceiverRoots(), [firstRoot]);
  assert.equal(projector.setTarget(null), 1);
  assert.equal(projector.getTarget(), null);
  assert.deepEqual(projector.getReceiverRoots(), []);
  assert.deepEqual(projector.getReceiverMeshes(), [explicit]);

  projector.dispose();
  disposeMeshResources(first, second, explicit);
});

test("receiverFilter receives root and material, rejects candidates, and isolates failures", () => {
  const mediaSource = createMediaSourceDouble();
  const root = new THREE.Group();
  const accepted = createMesh({ name: "accepted" });
  const rejected = createMesh({ name: "rejected" });
  const throwing = createMesh({ name: "throwing" });
  root.add(accepted, rejected, throwing);
  const payloads = [];

  const projector = createProjectiveMediaProjector({ mediaSource });
  assert.doesNotThrow(() => {
    projector.setReceiverRoots([root], {
      receiverFilter(payload) {
        payloads.push(payload);
        if (payload.object === throwing) {
          throw new Error("broken host filter");
        }
        return payload.object === accepted;
      },
    });
  });
  assert.deepEqual(projector.getReceiverMeshes(), [accepted]);
  assert.equal(payloads.length, 3);
  for (const payload of payloads) {
    assert.equal(payload.root, root);
    assert.equal(payload.material, payload.object.material);
  }

  assert.doesNotThrow(() => projector.refreshReceivers());
  assert.deepEqual(projector.getReceiverMeshes(), [accepted]);

  projector.dispose();
  disposeMeshResources(accepted, rejected, throwing);
});

test("update performs no receiver-root traversal and broad-phase culls only bindings with usable spheres", () => {
  const mediaSource = createMediaSourceDouble();
  const root = new THREE.Group();
  const bounded = createMesh({ name: "bounded" });
  const fallback = createMesh({
    name: "fallback",
    geometry: new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [-0.5, -0.5, 0, 0.5, -0.5, 0, 0, 0.5, 0],
        3,
      ),
    ),
  });
  bounded.geometry.computeBoundingSphere();
  assert.equal(fallback.geometry.boundingSphere, null);
  root.add(bounded, fallback);

  const projector = createProjectiveMediaProjector({
    receiverRoots: [root],
    mediaSource,
    projector: {
      position: [0, 0, 5],
      target: [0, 0, 0],
      fovDeg: 53,
      aspectRatio: 1,
      near: 0.1,
      far: 20,
    },
  });
  const boundedOverlay = projector
    .getOverlayMeshes()
    .find((overlay) => overlay.parent === bounded);
  const fallbackOverlay = projector
    .getOverlayMeshes()
    .find((overlay) => overlay.parent === fallback);
  assert.equal(boundedOverlay.visible, true);
  assert.equal(fallbackOverlay.visible, true);

  root.traverse = () => {
    throw new Error("update must not scan receiver roots");
  };
  bounded.position.set(100, 0, 0);
  fallback.position.set(100, 0, 0);
  assert.doesNotThrow(() => projector.update());
  assert.equal(boundedOverlay.visible, false);
  assert.equal(
    fallbackOverlay.visible,
    true,
    "missing bounding spheres use a conservative visible fallback",
  );
  assert.equal(fallback.geometry.boundingSphere, null);
  assert.equal(projector.getStatus().visibleReceiverCount, 1);

  bounded.position.set(0, 0, 0);
  assert.doesNotThrow(() => projector.update());
  assert.equal(boundedOverlay.visible, true);
  assert.equal(projector.getStatus().visibleReceiverCount, 2);

  bounded.visible = false;
  projector.update();
  assert.equal(boundedOverlay.visible, false);
  bounded.visible = true;

  projector.dispose();
  disposeMeshResources(bounded, fallback);
});

test("pose and projector-parameter changes do not scan roots or replace media state", () => {
  const mediaSource = createMediaSourceDouble({ currentTime: 81 });
  const root = new THREE.Group();
  const receiver = createMesh({ name: "receiver" });
  receiver.geometry.computeBoundingSphere();
  root.add(receiver);

  const projector = createProjectiveMediaProjector({
    receiverRoots: [root],
    mediaSource,
    projector: {
      position: [0, 0, 5],
      target: [0, 0, 0],
      far: 100,
    },
  });
  const originalTexture = projector.mediaSource.texture;
  const originalOverlay = projector.getOverlayMeshes()[0];
  root.traverse = () => {
    throw new Error("pose changes must not scan roots");
  };

  assert.doesNotThrow(() =>
    projector.setPose({
      position: [4, 2, 6],
      target: [0, 1, 0],
    }),
  );
  assert.doesNotThrow(() =>
    projector.setProjectorParameters({
      fovDeg: 70,
      aspectRatio: 4 / 3,
      near: 0.2,
      far: 80,
    }),
  );
  assert.equal(projector.mediaSource, mediaSource);
  assert.equal(projector.mediaSource.texture, originalTexture);
  assert.equal(projector.mediaSource.video.currentTime, 81);
  assert.equal(projector.getOverlayMeshes()[0], originalOverlay);
  assert.deepEqual(projector.camera.position.toArray(), [4, 2, 6]);
  assert.equal(projector.camera.fov, 70);

  projector.dispose();
  disposeMeshResources(receiver);
});

test("dispose detaches every overlay and leaves source geometry and materials host-owned", () => {
  const mediaSource = createMediaSourceDouble();
  const root = new THREE.Group();
  const first = createMesh({ name: "first" });
  const second = createMesh({ name: "second" });
  root.add(first, second);
  let geometryDisposeCalls = 0;
  let materialDisposeCalls = 0;
  for (const mesh of [first, second]) {
    mesh.geometry.addEventListener("dispose", () => {
      geometryDisposeCalls += 1;
    });
    mesh.material.addEventListener("dispose", () => {
      materialDisposeCalls += 1;
    });
  }

  const projector = createProjectiveMediaProjector({
    receiverRoots: [root],
    mediaSource,
  });
  const overlays = projector.getOverlayMeshes();
  assert.equal(overlays.length, 2);
  assert.equal(projector.dispose(), true);
  assert.equal(projector.dispose(), false);
  assert.equal(projector.getOverlayMeshes().length, 0);
  assert.equal(projector.getReceiverMeshes().length, 0);
  assert.equal(mediaSource.disposeCalls, 1);
  assert.equal(geometryDisposeCalls, 0);
  assert.equal(materialDisposeCalls, 0);
  for (const overlay of overlays) assert.equal(overlay.parent, null);

  disposeMeshResources(first, second);
  assert.equal(geometryDisposeCalls, 2);
  assert.equal(materialDisposeCalls, 2);
});
