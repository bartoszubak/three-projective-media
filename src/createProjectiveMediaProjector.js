// Host-neutral Three.js projector lifecycle primitives.
import * as THREE from "three";

import {
  createProjectiveMediaMaterial,
  setProjectiveMediaMaterialBlendMode,
  setProjectiveMediaMaterialEdgeFeather,
  setProjectiveMediaMaterialOpacity,
  updateProjectiveMediaMaterial,
} from "./createProjectiveMediaMaterial.js";
import { createProjectiveMediaSource } from "./createProjectiveMediaSource.js";
import {
  applyProjectiveMediaCameraParameters,
  applyProjectiveMediaCameraPose,
  readProjectiveMediaVector3,
  updateProjectiveMediaCamera,
} from "./projectiveMediaMath.js";

const OVERLAY_FLAG = "projectiveMediaOverlay";

const notifyListeners = (listeners, payload) => {
  for (const listener of Array.from(listeners)) {
    try {
      listener(payload);
    } catch {
      // Subscriber failures are isolated from projector state and lifecycle work.
    }
  }
};

const isSupportedMesh = (object) =>
  Boolean(
    object?.isMesh &&
    !object.isSkinnedMesh &&
    !object.isInstancedMesh &&
    object.geometry?.isBufferGeometry &&
    object.geometry.getAttribute?.("position") &&
    !object.userData?.[OVERLAY_FLAG],
  );

const normalizeObjectCollection = (value, predicate) => {
  const candidates = value?.isObject3D
    ? [value]
    : value && typeof value[Symbol.iterator] === "function"
      ? Array.from(value)
      : [];
  const normalized = [];
  const seen = new Set();

  for (const candidate of candidates) {
    if (!predicate(candidate) || seen.has(candidate)) continue;
    seen.add(candidate);
    normalized.push(candidate);
  }
  return normalized;
};

const normalizeReceiverFilter = (options) => {
  if (typeof options === "function") return options;
  return typeof options?.receiverFilter === "function"
    ? options.receiverFilter
    : null;
};

const receiverFilterAccepts = ({ receiverFilter, object, root }) => {
  if (!receiverFilter) return true;
  try {
    return Boolean(
      receiverFilter({
        object,
        root,
        material: object.material,
      }),
    );
  } catch {
    return false;
  }
};

const createOverlayMesh = (source, material) => {
  const overlay = new THREE.Mesh(source.geometry, material);
  overlay.name = "ProjectiveMediaOverlay";
  overlay.userData[OVERLAY_FLAG] = true;
  overlay.castShadow = false;
  overlay.receiveShadow = false;
  overlay.frustumCulled = source.frustumCulled;
  overlay.renderOrder = Number(source.renderOrder || 0) + 1;
  overlay.matrixAutoUpdate = false;
  overlay.matrix.identity();
  overlay.layers.mask = source.layers.mask;
  overlay.visible = false;
  overlay.raycast = () => {};
  return overlay;
};

const isBindingCurrent = (binding, material) =>
  Boolean(
    binding?.source &&
    binding.overlay?.parent === binding.source &&
    binding.overlay.geometry === binding.source.geometry &&
    binding.overlay.material === material,
  );

const isObjectLogicallyVisible = (object) => {
  for (let current = object; current; current = current.parent) {
    if (current.visible === false) return false;
  }

  const materials = Array.isArray(object?.material)
    ? object.material
    : object?.material
      ? [object.material]
      : [];
  return (
    materials.length === 0 ||
    materials.some((material) => material?.visible !== false)
  );
};

const hasUsableBoundingSphere = (geometry) => {
  const sphere = geometry?.boundingSphere;
  return Boolean(
    sphere?.isSphere &&
    Number.isFinite(sphere.radius) &&
    sphere.radius >= 0 &&
    Number.isFinite(sphere.center?.x) &&
    Number.isFinite(sphere.center?.y) &&
    Number.isFinite(sphere.center?.z),
  );
};

const isObjectOrDescendantOf = (object, ancestor) => {
  for (let current = object; current; current = current.parent) {
    if (current === ancestor) return true;
  }
  return false;
};

export function createProjectiveMediaProjector({
  mediaUrl = null,
  target = null,
  receiverRoots = [],
  receivers = [],
  receiverFilter = null,
  projector = {},
  appearance = {},
  media = {},
  mediaSource = null,
  mediaSourceFactory = createProjectiveMediaSource,
  disposeMediaSource = true,
} = {}) {
  const source =
    mediaSource ||
    mediaSourceFactory({
      url: mediaUrl,
      loop: media?.loop,
      muted: media?.muted,
      volume: media?.volume,
    });
  if (!source?.texture?.isTexture) {
    throw new TypeError("A media source with a texture is required");
  }

  const cameraParameters = applyProjectiveMediaCameraParameters(
    new THREE.PerspectiveCamera(),
    projector,
  );
  const camera = new THREE.PerspectiveCamera(
    cameraParameters.fovDeg,
    cameraParameters.aspectRatio,
    cameraParameters.near,
    cameraParameters.far,
  );
  camera.name = "ProjectiveMediaProjector";
  const initialPosition = readProjectiveMediaVector3(
    projector?.position,
    new THREE.Vector3(0, 0, 1),
  );
  let lookAtTarget = readProjectiveMediaVector3(
    projector?.target ?? projector?.lookAt,
    new THREE.Vector3(),
  );
  applyProjectiveMediaCameraPose(camera, {
    position: initialPosition,
    target: lookAtTarget,
    up: projector?.up,
  });

  const material = createProjectiveMediaMaterial({
    texture: source.texture,
    camera,
    opacity: appearance?.opacity,
    edgeFeather: appearance?.edgeFeather,
    blendMode: appearance?.blendMode,
  });
  const statusListeners = new Set();
  const receiverBindings = new Map();
  const explicitReceivers = new Set(
    normalizeObjectCollection(receivers, isSupportedMesh),
  );
  const projectorViewProjectionMatrix = new THREE.Matrix4();
  const projectorFrustum = new THREE.Frustum();
  const worldBoundingSphere = new THREE.Sphere();
  let configuredReceiverRoots = normalizeObjectCollection(
    receiverRoots,
    (object) => Boolean(object?.isObject3D),
  );
  let configuredReceiverFilter =
    typeof receiverFilter === "function" ? receiverFilter : null;
  let compatibilityTarget = null;
  let compatibilityTargetMode = false;
  let enabled = appearance?.enabled !== false;
  let disposed = false;

  if (target?.isObject3D) {
    configuredReceiverRoots = [target];
    configuredReceiverFilter = null;
    compatibilityTarget = target;
    compatibilityTargetMode = true;
  }

  const getVisibleReceiverCount = () => {
    let count = 0;
    for (const { overlay } of receiverBindings.values()) {
      if (overlay.visible) count += 1;
    }
    return count;
  };

  const getStatus = () =>
    Object.freeze({
      disposed,
      enabled,
      opacity: material.uniforms.opacity.value,
      edgeFeather: material.uniforms.edgeFeather.value,
      blendMode: material.userData.projectiveMediaBlendMode,
      targetBound: Boolean(compatibilityTargetMode && compatibilityTarget),
      receiverRootCount: configuredReceiverRoots.length,
      explicitReceiverCount: explicitReceivers.size,
      receiverMeshCount: receiverBindings.size,
      visibleReceiverCount: getVisibleReceiverCount(),
      overlayCount: receiverBindings.size,
      media: source.getSnapshot?.() || null,
    });

  const emitStatus = () => {
    const status = getStatus();
    notifyListeners(statusListeners, status);
  };

  const unsubscribeMediaStatus =
    source.subscribe?.(() => {
      if (!disposed) emitStatus();
    }) || null;

  const detachBinding = (sourceMesh) => {
    const binding = receiverBindings.get(sourceMesh);
    if (!binding) return false;
    binding.overlay.removeFromParent();
    receiverBindings.delete(sourceMesh);
    return true;
  };

  const detachAllBindings = () => {
    for (const sourceMesh of Array.from(receiverBindings.keys())) {
      detachBinding(sourceMesh);
    }
  };

  const collectDesiredReceivers = () => {
    const desiredReceivers = new Set();

    for (const root of configuredReceiverRoots) {
      root.traverse((object) => {
        if (
          !isSupportedMesh(object) ||
          desiredReceivers.has(object) ||
          !receiverFilterAccepts({
            receiverFilter: configuredReceiverFilter,
            object,
            root,
          })
        ) {
          return;
        }
        desiredReceivers.add(object);
      });
    }

    for (const receiver of explicitReceivers) {
      if (isSupportedMesh(receiver)) desiredReceivers.add(receiver);
    }
    return desiredReceivers;
  };

  const updateReceiverVisibility = () => {
    projectorViewProjectionMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    projectorFrustum.setFromProjectionMatrix(projectorViewProjectionMatrix);

    for (const { source: sourceMesh, overlay } of receiverBindings.values()) {
      let visible = enabled && isObjectLogicallyVisible(sourceMesh);

      if (visible && hasUsableBoundingSphere(sourceMesh.geometry)) {
        sourceMesh.updateWorldMatrix(true, false);
        worldBoundingSphere
          .copy(sourceMesh.geometry.boundingSphere)
          .applyMatrix4(sourceMesh.matrixWorld);
        visible = projectorFrustum.intersectsSphere(worldBoundingSphere);
      }

      overlay.visible = visible;
    }
  };

  const refreshReceivers = () => {
    if (disposed) return 0;
    const desiredReceivers = collectDesiredReceivers();

    for (const [sourceMesh, binding] of receiverBindings) {
      if (
        !desiredReceivers.has(sourceMesh) ||
        !isBindingCurrent(binding, material)
      ) {
        detachBinding(sourceMesh);
      }
    }

    for (const sourceMesh of desiredReceivers) {
      let binding = receiverBindings.get(sourceMesh);
      if (!binding) {
        const overlay = createOverlayMesh(sourceMesh, material);
        sourceMesh.add(overlay);
        binding = { source: sourceMesh, overlay };
        receiverBindings.set(sourceMesh, binding);
      }
      binding.overlay.frustumCulled = sourceMesh.frustumCulled;
      binding.overlay.renderOrder = Number(sourceMesh.renderOrder || 0) + 1;
      binding.overlay.layers.mask = sourceMesh.layers.mask;
    }

    updateReceiverVisibility();
    emitStatus();
    return receiverBindings.size;
  };

  const setReceiverRoots = (roots = [], options = {}) => {
    if (disposed) return 0;
    configuredReceiverRoots = normalizeObjectCollection(roots, (object) =>
      Boolean(object?.isObject3D),
    );
    configuredReceiverFilter = normalizeReceiverFilter(options);
    compatibilityTarget = null;
    compatibilityTargetMode = false;
    return refreshReceivers();
  };

  const addReceiverRoot = (root) => {
    if (disposed) return 0;
    compatibilityTarget = null;
    compatibilityTargetMode = false;
    if (root?.isObject3D && !configuredReceiverRoots.includes(root)) {
      configuredReceiverRoots.push(root);
    }
    return refreshReceivers();
  };

  const removeReceiverRoot = (root) => {
    if (disposed) return 0;
    compatibilityTarget = null;
    compatibilityTargetMode = false;
    configuredReceiverRoots = configuredReceiverRoots.filter(
      (candidate) => candidate !== root,
    );
    return refreshReceivers();
  };

  const clearReceiverRoots = () => {
    if (disposed) return 0;
    configuredReceiverRoots = [];
    compatibilityTarget = null;
    compatibilityTargetMode = false;
    return refreshReceivers();
  };

  const setReceivers = (meshes = []) => {
    if (disposed) return 0;
    explicitReceivers.clear();
    for (const mesh of normalizeObjectCollection(meshes, isSupportedMesh)) {
      explicitReceivers.add(mesh);
    }
    return refreshReceivers();
  };

  const addReceiver = (mesh) => {
    if (disposed) return 0;
    if (isSupportedMesh(mesh)) explicitReceivers.add(mesh);
    return refreshReceivers();
  };

  const removeReceiver = (mesh) => {
    if (disposed) return 0;
    explicitReceivers.delete(mesh);
    return refreshReceivers();
  };

  const clearReceivers = () => {
    if (disposed) return 0;
    explicitReceivers.clear();
    return refreshReceivers();
  };

  const detachReceiverObject = (object) => {
    if (disposed || !object?.isObject3D) return 0;
    let detachedCount = 0;
    for (const sourceMesh of Array.from(receiverBindings.keys())) {
      if (
        isObjectOrDescendantOf(sourceMesh, object) &&
        detachBinding(sourceMesh)
      ) {
        detachedCount += 1;
      }
    }
    if (detachedCount > 0) emitStatus();
    return detachedCount;
  };

  const setTarget = (nextTarget = null) => {
    if (disposed) return 0;
    const normalizedTarget = nextTarget?.isObject3D ? nextTarget : null;

    if (!normalizedTarget) {
      if (!compatibilityTargetMode) return receiverBindings.size;
      configuredReceiverRoots = [];
      compatibilityTarget = null;
      compatibilityTargetMode = false;
      return refreshReceivers();
    }

    if (compatibilityTargetMode && compatibilityTarget === normalizedTarget) {
      return receiverBindings.size;
    }

    configuredReceiverRoots = [normalizedTarget];
    configuredReceiverFilter = null;
    compatibilityTarget = normalizedTarget;
    compatibilityTargetMode = true;
    return refreshReceivers();
  };

  const setPose = (pose = {}) => {
    if (disposed) return null;
    const position = readProjectiveMediaVector3(
      pose?.position,
      camera.position,
    );
    lookAtTarget = readProjectiveMediaVector3(
      pose?.target ?? pose?.lookAt,
      lookAtTarget,
    );
    applyProjectiveMediaCameraPose(camera, {
      position,
      target: lookAtTarget,
      up: pose?.up ?? camera.up,
    });
    updateProjectiveMediaMaterial(material, camera);
    updateReceiverVisibility();
    return {
      position: camera.position.clone(),
      target: lookAtTarget.clone(),
      up: camera.up.clone(),
    };
  };

  const setProjectorParameters = (parameters = {}) => {
    if (disposed) return null;
    const normalized = applyProjectiveMediaCameraParameters(camera, parameters);
    updateProjectiveMediaMaterial(material, camera);
    updateReceiverVisibility();
    return normalized;
  };

  const update = () => {
    if (disposed) return false;
    updateProjectiveMediaCamera(camera);
    updateProjectiveMediaMaterial(material, camera);
    updateReceiverVisibility();
    return true;
  };

  const setEnabled = (nextEnabled) => {
    if (disposed) return false;
    enabled = Boolean(nextEnabled);
    updateReceiverVisibility();
    emitStatus();
    return enabled;
  };

  const setMuted = (muted) => {
    const value = source.setMuted?.(muted);
    if (!disposed) emitStatus();
    return value;
  };

  const setVolume = (volume) => {
    const value = source.setVolume?.(volume);
    if (!disposed) emitStatus();
    return value;
  };

  const setOpacity = (opacity) => {
    if (disposed) return material.uniforms.opacity.value;
    const value = setProjectiveMediaMaterialOpacity(material, opacity);
    emitStatus();
    return value;
  };

  const setEdgeFeather = (edgeFeather) => {
    if (disposed) return material.uniforms.edgeFeather.value;
    const value = setProjectiveMediaMaterialEdgeFeather(material, edgeFeather);
    emitStatus();
    return value;
  };

  const setBlendMode = (blendMode) => {
    if (disposed) return material.userData.projectiveMediaBlendMode;
    const value = setProjectiveMediaMaterialBlendMode(material, blendMode);
    emitStatus();
    return value;
  };

  const play = async () => {
    const result = await source.play?.();
    if (!disposed) emitStatus();
    return result;
  };

  const pause = () => {
    const result = source.pause?.();
    if (!disposed) emitStatus();
    return result;
  };

  const dispose = () => {
    if (disposed) return false;
    detachAllBindings();
    configuredReceiverRoots = [];
    explicitReceivers.clear();
    compatibilityTarget = null;
    compatibilityTargetMode = false;
    unsubscribeMediaStatus?.();
    material.dispose();
    if (disposeMediaSource) source.dispose?.();
    camera.removeFromParent();
    disposed = true;
    emitStatus();
    statusListeners.clear();
    return true;
  };

  const api = {
    object: camera,
    camera,
    material,
    mediaSource: source,
    getStatus,
    subscribeStatus(listener) {
      if (typeof listener !== "function" || disposed) return () => {};
      statusListeners.add(listener);
      return () => {
        statusListeners.delete(listener);
      };
    },
    getTarget() {
      return compatibilityTargetMode ? compatibilityTarget : null;
    },
    getReceiverRoots() {
      return [...configuredReceiverRoots];
    },
    getReceiverMeshes() {
      return Array.from(receiverBindings.keys());
    },
    getOverlayMeshes() {
      return Array.from(receiverBindings.values(), ({ overlay }) => overlay);
    },
    setTarget,
    setReceiverRoots,
    addReceiverRoot,
    removeReceiverRoot,
    clearReceiverRoots,
    setReceivers,
    addReceiver,
    removeReceiver,
    clearReceivers,
    refreshReceivers,
    detachReceiverObject,
    setPose,
    setProjectorParameters,
    update,
    setEnabled,
    setMuted,
    setVolume,
    setOpacity,
    setEdgeFeather,
    setBlendMode,
    play,
    pause,
    dispose,
  };

  update();
  refreshReceivers();
  return api;
}

export default createProjectiveMediaProjector;
