import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { createProjectiveMediaProjector } from "../src/index.js";

const createMediaSourceDouble = ({
  currentTime = 11.25,
  disposeError = null,
  unsubscribeError = null,
  retainListenerOnUnsubscribeError = false,
  emitOnDispose = false,
  disposedSnapshotError = null,
} = {}) => {
  const texture = new THREE.Texture();
  const listeners = new Set();
  const video = { currentTime };
  const state = {
    status: "ready",
    muted: true,
    volume: 0.5,
  };
  let disposedSnapshotErrorPending = Boolean(disposedSnapshotError);

  return {
    texture,
    video,
    playCalls: 0,
    pauseCalls: 0,
    disposeCalls: 0,
    unsubscribeCalls: 0,
    setMutedCalls: 0,
    setVolumeCalls: 0,
    getSnapshot() {
      if (state.status === "disposed" && disposedSnapshotErrorPending) {
        disposedSnapshotErrorPending = false;
        throw disposedSnapshotError;
      }
      return { ...state, currentTime: video.currentTime };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        this.unsubscribeCalls += 1;
        if (!unsubscribeError || !retainListenerOnUnsubscribeError) {
          listeners.delete(listener);
        }
        if (unsubscribeError) throw unsubscribeError;
      };
    },
    emitSnapshot() {
      for (const listener of Array.from(listeners)) {
        listener(this.getSnapshot());
      }
    },
    async play() {
      this.playCalls += 1;
      state.status = "playing";
      for (const listener of Array.from(listeners)) {
        listener(this.getSnapshot());
      }
      return { ok: true, status: "playing", error: null };
    },
    pause() {
      this.pauseCalls += 1;
      state.status = "paused";
      for (const listener of Array.from(listeners)) {
        listener(this.getSnapshot());
      }
      return true;
    },
    setMuted(muted) {
      this.setMutedCalls += 1;
      state.muted = Boolean(muted);
      this.emitSnapshot();
      return state.muted;
    },
    setVolume(volume) {
      this.setVolumeCalls += 1;
      state.volume = Math.min(Math.max(Number(volume) || 0, 0), 1);
      this.emitSnapshot();
      return state.volume;
    },
    dispose() {
      this.disposeCalls += 1;
      state.status = "disposed";
      if (emitOnDispose) this.emitSnapshot();
      if (disposeError) throw disposeError;
      return true;
    },
  };
};

test("projector binds receiver overlays without mutating or owning host resources", async () => {
  const sourceMedia = createMediaSourceDouble();
  const sourceGeometry = new THREE.BoxGeometry(2, 2, 2);
  const sourceMaterial = new THREE.MeshStandardMaterial();
  const sourceMesh = new THREE.Mesh(sourceGeometry, sourceMaterial);
  const receiverRoot = new THREE.Group();
  receiverRoot.add(sourceMesh);
  let sourceGeometryDisposeCalls = 0;
  let sourceMaterialDisposeCalls = 0;
  sourceGeometry.addEventListener("dispose", () => {
    sourceGeometryDisposeCalls += 1;
  });
  sourceMaterial.addEventListener("dispose", () => {
    sourceMaterialDisposeCalls += 1;
  });

  const projector = createProjectiveMediaProjector({
    mediaSource: sourceMedia,
    receiverRoots: [receiverRoot],
    projector: {
      position: [0, 0, 5],
      target: [0, 0, 0],
      fovDeg: 50,
      aspectRatio: 16 / 9,
      near: 0.1,
      far: 100,
    },
    appearance: {
      enabled: true,
      opacity: 0.65,
      edgeFeather: 0.1,
      blendMode: "alpha",
    },
  });

  const [overlay] = projector.getOverlayMeshes();
  assert.ok(overlay?.isMesh);
  assert.equal(overlay.parent, sourceMesh);
  assert.equal(overlay.geometry, sourceGeometry);
  assert.notEqual(overlay.material, sourceMaterial);
  assert.equal(sourceMesh.material, sourceMaterial);
  assert.equal(projector.mediaSource, sourceMedia);
  assert.equal(projector.getStatus().overlayCount, 1);

  projector.setEnabled(false);
  assert.equal(overlay.visible, false);
  projector.setEnabled(true);
  assert.equal(overlay.visible, true);
  assert.equal(projector.setOpacity(2), 1);
  assert.equal(projector.setMuted(false), false);
  assert.equal(projector.setVolume(0.25), 0.25);
  assert.equal(sourceMedia.video.currentTime, 11.25);
  assert.equal((await projector.play()).ok, true);
  assert.equal(projector.pause(), true);
  assert.equal(sourceMedia.playCalls, 1);
  assert.equal(sourceMedia.pauseCalls, 1);

  const replacementGeometry = new THREE.BoxGeometry(3, 2, 1);
  const replacementMaterial = new THREE.MeshBasicMaterial();
  const replacementMesh = new THREE.Mesh(
    replacementGeometry,
    replacementMaterial,
  );
  assert.equal(projector.setReceiverRoots([replacementMesh]), 1);
  assert.equal(overlay.parent, null);
  assert.equal(projector.mediaSource, sourceMedia);
  assert.equal(sourceMedia.video.currentTime, 11.25);
  assert.equal(projector.getOverlayMeshes()[0].geometry, replacementGeometry);

  assert.equal(projector.clearReceiverRoots(), 0);
  assert.equal(projector.getStatus().overlayCount, 0);
  assert.equal(sourceGeometryDisposeCalls, 0);
  assert.equal(sourceMaterialDisposeCalls, 0);

  let ownedMaterialDisposeEvents = 0;
  projector.material.addEventListener("dispose", () => {
    ownedMaterialDisposeEvents += 1;
  });
  assert.equal(projector.dispose(), true);
  assert.equal(projector.dispose(), false);
  assert.equal(sourceMedia.disposeCalls, 1);
  assert.equal(ownedMaterialDisposeEvents, 1);
  assert.equal(sourceGeometryDisposeCalls, 0);
  assert.equal(sourceMaterialDisposeCalls, 0);
  assert.equal(sourceMesh.material, sourceMaterial);

  sourceGeometry.dispose();
  replacementGeometry.dispose();
  sourceMaterial.dispose();
  replacementMaterial.dispose();
  sourceMedia.texture.dispose();
});

test("projector handles empty and unsupported receiver collections without recreating media", () => {
  const sourceMedia = createMediaSourceDouble();
  const projector = createProjectiveMediaProjector({
    mediaSource: sourceMedia,
  });
  const emptyRoot = new THREE.Group();
  assert.equal(projector.setReceiverRoots([emptyRoot]), 0);
  assert.equal(projector.getStatus().receiverRootCount, 1);

  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshBasicMaterial();
  const skinnedMesh = new THREE.SkinnedMesh(geometry, material);
  assert.equal(projector.setReceivers([skinnedMesh]), 0);
  assert.equal(projector.mediaSource, sourceMedia);

  const plainMesh = new THREE.Mesh(geometry, material);
  assert.equal(projector.setReceivers([plainMesh]), 1);
  const firstOverlay = projector.getOverlayMeshes()[0];
  sourceMedia.video.currentTime = 23;
  assert.equal(projector.setReceivers([plainMesh]), 1);
  assert.equal(projector.getOverlayMeshes()[0], firstOverlay);
  assert.equal(firstOverlay.parent, plainMesh);
  assert.equal(sourceMedia.video.currentTime, 23);
  assert.equal(sourceMedia.disposeCalls, 0);

  projector.dispose();
  geometry.dispose();
  material.dispose();
  sourceMedia.texture.dispose();
});

test("runtime disposal reaches one final state when media unsubscribe throws", async () => {
  const unsubscribeError = new Error("unsubscribe failed");
  const sourceMedia = createMediaSourceDouble({
    unsubscribeError,
    retainListenerOnUnsubscribeError: true,
    emitOnDispose: true,
  });
  const sourceGeometry = new THREE.BoxGeometry();
  const sourceMaterial = new THREE.MeshBasicMaterial();
  const sourceMesh = new THREE.Mesh(sourceGeometry, sourceMaterial);
  const receiverRoot = new THREE.Group();
  receiverRoot.add(sourceMesh);
  const cameraParent = new THREE.Group();
  const projector = createProjectiveMediaProjector({
    mediaSource: sourceMedia,
    receiverRoots: [receiverRoot],
    receivers: [sourceMesh],
  });
  cameraParent.add(projector.camera);

  const [overlay] = projector.getOverlayMeshes();
  let materialDisposeCalls = 0;
  let cameraDetachCalls = 0;
  projector.material.addEventListener("dispose", () => {
    materialDisposeCalls += 1;
  });
  const removeCameraFromParent =
    projector.camera.removeFromParent.bind(projector.camera);
  projector.camera.removeFromParent = () => {
    cameraDetachCalls += 1;
    return removeCameraFromParent();
  };

  const healthyStatuses = [];
  let throwingStatusCalls = 0;
  projector.subscribeStatus(() => {
    throwingStatusCalls += 1;
    throw new Error("broken final status listener");
  });
  projector.subscribeStatus((status) => {
    healthyStatuses.push(status);
  });

  let firstDisposeResult;
  assert.doesNotThrow(() => {
    firstDisposeResult = projector.dispose();
  });
  assert.equal(firstDisposeResult, true);
  assert.equal(projector.dispose(), false);
  assert.equal(sourceMedia.unsubscribeCalls, 1);
  assert.equal(sourceMedia.disposeCalls, 1);
  assert.equal(materialDisposeCalls, 1);
  assert.equal(cameraDetachCalls, 1);
  assert.equal(projector.camera.parent, null);
  assert.equal(overlay.parent, null);
  assert.deepEqual(projector.getReceiverRoots(), []);
  assert.deepEqual(projector.getReceiverMeshes(), []);
  assert.deepEqual(projector.getOverlayMeshes(), []);
  assert.deepEqual(
    {
      disposed: projector.getStatus().disposed,
      receiverRootCount: projector.getStatus().receiverRootCount,
      explicitReceiverCount: projector.getStatus().explicitReceiverCount,
      receiverMeshCount: projector.getStatus().receiverMeshCount,
      visibleReceiverCount: projector.getStatus().visibleReceiverCount,
      overlayCount: projector.getStatus().overlayCount,
    },
    {
      disposed: true,
      receiverRootCount: 0,
      explicitReceiverCount: 0,
      receiverMeshCount: 0,
      visibleReceiverCount: 0,
      overlayCount: 0,
    },
  );
  assert.equal(healthyStatuses.length, 1);
  assert.equal(healthyStatuses[0].disposed, true);
  assert.equal(throwingStatusCalls, 1);

  sourceMedia.emitSnapshot();
  assert.equal(healthyStatuses.length, 1);
  assert.equal(throwingStatusCalls, 1);
  assert.equal(projector.setMuted(false), false);
  assert.equal(projector.setVolume(0.75), null);
  assert.deepEqual(await projector.play(), {
    ok: false,
    status: "disposed",
    error: null,
  });
  assert.equal(projector.pause(), false);
  assert.equal(sourceMedia.setMutedCalls, 0);
  assert.equal(sourceMedia.setVolumeCalls, 0);
  assert.equal(sourceMedia.playCalls, 0);
  assert.equal(sourceMedia.pauseCalls, 0);

  sourceGeometry.dispose();
  sourceMaterial.dispose();
  sourceMedia.texture.dispose();
});

test("runtime disposal isolates throwing owned media-source disposal", () => {
  const sourceMedia = createMediaSourceDouble({
    disposeError: new Error("source disposal failed"),
  });
  const sourceGeometry = new THREE.BoxGeometry();
  const sourceMaterial = new THREE.MeshBasicMaterial();
  const sourceMesh = new THREE.Mesh(sourceGeometry, sourceMaterial);
  const receiverRoot = new THREE.Group();
  receiverRoot.add(sourceMesh);
  const cameraParent = new THREE.Group();
  const projector = createProjectiveMediaProjector({
    mediaSource: sourceMedia,
    receiverRoots: [receiverRoot],
  });
  cameraParent.add(projector.camera);
  const [overlay] = projector.getOverlayMeshes();

  let hostGeometryDisposeCalls = 0;
  let hostMaterialDisposeCalls = 0;
  let projectorMaterialDisposeCalls = 0;
  sourceGeometry.addEventListener("dispose", () => {
    hostGeometryDisposeCalls += 1;
  });
  sourceMaterial.addEventListener("dispose", () => {
    hostMaterialDisposeCalls += 1;
  });
  projector.material.addEventListener("dispose", () => {
    projectorMaterialDisposeCalls += 1;
  });
  const finalStatuses = [];
  projector.subscribeStatus((status) => finalStatuses.push(status));

  let disposeResult;
  assert.doesNotThrow(() => {
    disposeResult = projector.dispose();
  });
  assert.equal(disposeResult, true);
  assert.equal(projector.dispose(), false);
  assert.equal(sourceMedia.disposeCalls, 1);
  assert.equal(sourceMedia.unsubscribeCalls, 1);
  assert.equal(projectorMaterialDisposeCalls, 1);
  assert.equal(projector.camera.parent, null);
  assert.equal(overlay.parent, null);
  assert.deepEqual(projector.getReceiverRoots(), []);
  assert.deepEqual(projector.getReceiverMeshes(), []);
  assert.deepEqual(projector.getOverlayMeshes(), []);
  assert.equal(projector.getStatus().disposed, true);
  assert.equal(finalStatuses.length, 1);
  assert.equal(finalStatuses[0].disposed, true);
  assert.equal(hostGeometryDisposeCalls, 0);
  assert.equal(hostMaterialDisposeCalls, 0);

  sourceGeometry.dispose();
  sourceMaterial.dispose();
  sourceMedia.texture.dispose();
});

test("runtime disposal preserves host-owned media despite throwing unsubscribe", () => {
  const sourceMedia = createMediaSourceDouble({
    unsubscribeError: new Error("host unsubscribe failed"),
    retainListenerOnUnsubscribeError: true,
  });
  const sourceGeometry = new THREE.BoxGeometry();
  const sourceMaterial = new THREE.MeshBasicMaterial();
  const sourceMesh = new THREE.Mesh(sourceGeometry, sourceMaterial);
  const receiverRoot = new THREE.Group();
  receiverRoot.add(sourceMesh);
  const cameraParent = new THREE.Group();
  const projector = createProjectiveMediaProjector({
    mediaSource: sourceMedia,
    disposeMediaSource: false,
    receiverRoots: [receiverRoot],
  });
  cameraParent.add(projector.camera);
  const [overlay] = projector.getOverlayMeshes();
  const finalStatuses = [];
  let materialDisposeCalls = 0;
  projector.material.addEventListener("dispose", () => {
    materialDisposeCalls += 1;
  });
  projector.subscribeStatus((status) => finalStatuses.push(status));

  assert.doesNotThrow(() => assert.equal(projector.dispose(), true));
  assert.equal(projector.dispose(), false);
  assert.equal(sourceMedia.unsubscribeCalls, 1);
  assert.equal(sourceMedia.disposeCalls, 0);
  assert.equal(materialDisposeCalls, 1);
  assert.equal(projector.camera.parent, null);
  assert.equal(overlay.parent, null);
  assert.equal(projector.getStatus().disposed, true);
  assert.deepEqual(projector.getReceiverRoots(), []);
  assert.deepEqual(projector.getReceiverMeshes(), []);
  assert.deepEqual(projector.getOverlayMeshes(), []);
  assert.equal(finalStatuses.length, 1);
  sourceMedia.emitSnapshot();
  assert.equal(finalStatuses.length, 1);

  sourceGeometry.dispose();
  sourceMaterial.dispose();
  sourceMedia.texture.dispose();
});

test("runtime disposal continues after material and camera cleanup failures", () => {
  const sourceMedia = createMediaSourceDouble();
  const sourceGeometry = new THREE.BoxGeometry();
  const sourceMaterial = new THREE.MeshBasicMaterial();
  const sourceMesh = new THREE.Mesh(sourceGeometry, sourceMaterial);
  const receiverRoot = new THREE.Group();
  receiverRoot.add(sourceMesh);
  const cameraParent = new THREE.Group();
  const projector = createProjectiveMediaProjector({
    mediaSource: sourceMedia,
    receiverRoots: [receiverRoot],
  });
  cameraParent.add(projector.camera);
  const [overlay] = projector.getOverlayMeshes();
  let materialDisposeAttempts = 0;
  let cameraDetachAttempts = 0;
  projector.material.dispose = () => {
    materialDisposeAttempts += 1;
    throw new Error("material disposal failed");
  };
  projector.camera.removeFromParent = () => {
    cameraDetachAttempts += 1;
    throw new Error("camera detach failed");
  };
  const finalStatuses = [];
  projector.subscribeStatus((status) => finalStatuses.push(status));

  assert.doesNotThrow(() => assert.equal(projector.dispose(), true));
  assert.equal(projector.dispose(), false);
  assert.equal(materialDisposeAttempts, 1);
  assert.equal(cameraDetachAttempts, 1);
  assert.equal(sourceMedia.disposeCalls, 1);
  assert.equal(overlay.parent, null);
  assert.deepEqual(projector.getReceiverRoots(), []);
  assert.deepEqual(projector.getReceiverMeshes(), []);
  assert.deepEqual(projector.getOverlayMeshes(), []);
  assert.equal(projector.getStatus().disposed, true);
  assert.equal(finalStatuses.length, 1);
  assert.equal(finalStatuses[0].disposed, true);

  cameraParent.remove(projector.camera);
  sourceGeometry.dispose();
  sourceMaterial.dispose();
  sourceMedia.texture.dispose();
});

test("runtime disposal isolates a failing final status emission path", () => {
  const sourceMedia = createMediaSourceDouble({
    disposedSnapshotError: new Error("final media snapshot failed"),
  });
  const sourceGeometry = new THREE.BoxGeometry();
  const sourceMaterial = new THREE.MeshBasicMaterial();
  const sourceMesh = new THREE.Mesh(sourceGeometry, sourceMaterial);
  const receiverRoot = new THREE.Group();
  receiverRoot.add(sourceMesh);
  const projector = createProjectiveMediaProjector({
    mediaSource: sourceMedia,
    receiverRoots: [receiverRoot],
  });
  const [overlay] = projector.getOverlayMeshes();
  let statusCalls = 0;
  projector.subscribeStatus(() => {
    statusCalls += 1;
  });

  assert.doesNotThrow(() => assert.equal(projector.dispose(), true));
  assert.equal(projector.dispose(), false);
  assert.equal(statusCalls, 0);
  assert.equal(sourceMedia.disposeCalls, 1);
  assert.equal(overlay.parent, null);
  assert.deepEqual(projector.getReceiverRoots(), []);
  assert.deepEqual(projector.getReceiverMeshes(), []);
  assert.deepEqual(projector.getOverlayMeshes(), []);
  assert.equal(projector.getStatus().disposed, true);

  sourceGeometry.dispose();
  sourceMaterial.dispose();
  sourceMedia.texture.dispose();
});

test("runtime disposal removes every binding when one overlay detach throws", () => {
  const sourceMedia = createMediaSourceDouble();
  const firstGeometry = new THREE.BoxGeometry();
  const secondGeometry = new THREE.BoxGeometry();
  const firstMaterial = new THREE.MeshBasicMaterial();
  const secondMaterial = new THREE.MeshBasicMaterial();
  const firstReceiver = new THREE.Mesh(firstGeometry, firstMaterial);
  const secondReceiver = new THREE.Mesh(secondGeometry, secondMaterial);
  const receiverRoot = new THREE.Group();
  receiverRoot.add(firstReceiver, secondReceiver);
  const projector = createProjectiveMediaProjector({
    mediaSource: sourceMedia,
    receiverRoots: [receiverRoot],
  });
  const overlays = projector.getOverlayMeshes();
  let firstDetachAttempts = 0;
  overlays[0].removeFromParent = () => {
    firstDetachAttempts += 1;
    throw new Error("overlay detach failed");
  };

  let hostGeometryDisposeCalls = 0;
  let hostMaterialDisposeCalls = 0;
  for (const geometry of [firstGeometry, secondGeometry]) {
    geometry.addEventListener("dispose", () => {
      hostGeometryDisposeCalls += 1;
    });
  }
  for (const material of [firstMaterial, secondMaterial]) {
    material.addEventListener("dispose", () => {
      hostMaterialDisposeCalls += 1;
    });
  }

  assert.doesNotThrow(() => assert.equal(projector.dispose(), true));
  assert.equal(projector.dispose(), false);
  assert.equal(firstDetachAttempts, 1);
  assert.equal(overlays[0].parent, null);
  assert.equal(overlays[1].parent, null);
  assert.deepEqual(projector.getReceiverRoots(), []);
  assert.deepEqual(projector.getReceiverMeshes(), []);
  assert.deepEqual(projector.getOverlayMeshes(), []);
  assert.equal(projector.getStatus().disposed, true);
  assert.equal(sourceMedia.disposeCalls, 1);
  assert.equal(hostGeometryDisposeCalls, 0);
  assert.equal(hostMaterialDisposeCalls, 0);

  firstGeometry.dispose();
  secondGeometry.dispose();
  firstMaterial.dispose();
  secondMaterial.dispose();
  sourceMedia.texture.dispose();
});

test("invalid media source construction result follows projector ownership", () => {
  const ownedInvalidSource = {
    texture: null,
    disposeCalls: 0,
    dispose() {
      this.disposeCalls += 1;
    },
  };
  assert.throws(
    () =>
      createProjectiveMediaProjector({
        mediaSourceFactory: () => ownedInvalidSource,
      }),
    /A media source with a texture is required/,
  );
  assert.equal(ownedInvalidSource.disposeCalls, 1);

  const hostInvalidSource = {
    texture: null,
    disposeCalls: 0,
    dispose() {
      this.disposeCalls += 1;
    },
  };
  assert.throws(
    () =>
      createProjectiveMediaProjector({
        mediaSource: hostInvalidSource,
        disposeMediaSource: false,
      }),
    /A media source with a texture is required/,
  );
  assert.equal(hostInvalidSource.disposeCalls, 0);
});

test("partial construction rollback detaches overlays and releases owned projector resources", () => {
  const sourceMedia = createMediaSourceDouble();
  const firstGeometry = new THREE.BoxGeometry();
  const secondGeometry = new THREE.BoxGeometry();
  const firstMaterial = new THREE.MeshBasicMaterial();
  const secondMaterial = new THREE.MeshBasicMaterial();
  const firstReceiver = new THREE.Mesh(firstGeometry, firstMaterial);
  const secondReceiver = new THREE.Mesh(secondGeometry, secondMaterial);
  const constructionError = new Error("receiver binding failed");
  Object.defineProperty(secondReceiver.layers, "mask", {
    configurable: true,
    get() {
      throw constructionError;
    },
  });

  let hostGeometryDisposeCalls = 0;
  let hostMaterialDisposeCalls = 0;
  for (const geometry of [firstGeometry, secondGeometry]) {
    geometry.addEventListener("dispose", () => {
      hostGeometryDisposeCalls += 1;
    });
  }
  for (const material of [firstMaterial, secondMaterial]) {
    material.addEventListener("dispose", () => {
      hostMaterialDisposeCalls += 1;
    });
  }

  const originalMaterialDispose = THREE.ShaderMaterial.prototype.dispose;
  const originalRemoveFromParent = THREE.Object3D.prototype.removeFromParent;
  let projectorMaterialDisposeCalls = 0;
  let projectorCameraRemoveCalls = 0;
  THREE.ShaderMaterial.prototype.dispose = function dispose() {
    if (this.userData?.projectiveMediaMaterial) {
      projectorMaterialDisposeCalls += 1;
    }
    return originalMaterialDispose.call(this);
  };
  THREE.Object3D.prototype.removeFromParent = function removeFromParent() {
    if (this.isPerspectiveCamera && this.name === "ProjectiveMediaProjector") {
      projectorCameraRemoveCalls += 1;
    }
    return originalRemoveFromParent.call(this);
  };

  try {
    assert.throws(
      () =>
        createProjectiveMediaProjector({
          mediaSource: sourceMedia,
          receivers: [firstReceiver, secondReceiver],
        }),
      (error) => error === constructionError,
    );
  } finally {
    THREE.ShaderMaterial.prototype.dispose = originalMaterialDispose;
    THREE.Object3D.prototype.removeFromParent = originalRemoveFromParent;
  }

  assert.equal(
    firstReceiver.children.some(
      (child) => child.userData?.projectiveMediaOverlay,
    ),
    false,
  );
  assert.equal(secondReceiver.children.length, 0);
  assert.equal(projectorMaterialDisposeCalls, 1);
  assert.equal(projectorCameraRemoveCalls, 1);
  assert.equal(sourceMedia.unsubscribeCalls, 1);
  assert.equal(sourceMedia.disposeCalls, 1);
  assert.equal(hostGeometryDisposeCalls, 0);
  assert.equal(hostMaterialDisposeCalls, 0);

  firstGeometry.dispose();
  secondGeometry.dispose();
  firstMaterial.dispose();
  secondMaterial.dispose();
  sourceMedia.texture.dispose();
});

test("partial construction rollback preserves host media ownership and the original error", () => {
  const cleanupError = new Error("unsubscribe failed");
  const sourceMedia = createMediaSourceDouble({
    unsubscribeError: cleanupError,
  });
  const constructionError = new Error("receiver traversal failed");
  const receiverRoot = new THREE.Group();
  receiverRoot.traverse = () => {
    throw constructionError;
  };

  assert.throws(
    () =>
      createProjectiveMediaProjector({
        mediaSource: sourceMedia,
        disposeMediaSource: false,
        receiverRoots: [receiverRoot],
      }),
    (error) => error === constructionError,
  );
  assert.equal(sourceMedia.unsubscribeCalls, 1);
  assert.equal(sourceMedia.disposeCalls, 0);
  sourceMedia.texture.dispose();
});

test("partial construction rollback isolates media disposal failure", () => {
  const cleanupError = new Error("source dispose failed");
  const sourceMedia = createMediaSourceDouble({ disposeError: cleanupError });
  const constructionError = new Error("receiver traversal failed");
  const receiverRoot = new THREE.Group();
  receiverRoot.traverse = () => {
    throw constructionError;
  };

  assert.throws(
    () =>
      createProjectiveMediaProjector({
        mediaSource: sourceMedia,
        receiverRoots: [receiverRoot],
      }),
    (error) => error === constructionError,
  );
  assert.equal(sourceMedia.unsubscribeCalls, 1);
  assert.equal(sourceMedia.disposeCalls, 1);
  sourceMedia.texture.dispose();
});
