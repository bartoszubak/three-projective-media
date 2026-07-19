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

const collectSupportedMeshes = (target) => {
  const meshes = [];
  if (!target?.isObject3D) return meshes;
  target.traverse((object) => {
    if (isSupportedMesh(object)) meshes.push(object);
  });
  return meshes;
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
  overlay.raycast = () => {};
  return overlay;
};

export function createProjectiveMediaProjector({
  mediaUrl = null,
  target = null,
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
  const overlayBindings = [];
  let currentTarget = null;
  let enabled = appearance?.enabled !== false;
  let disposed = false;

  const getStatus = () =>
    Object.freeze({
      disposed,
      enabled,
      opacity: material.uniforms.opacity.value,
      edgeFeather: material.uniforms.edgeFeather.value,
      blendMode: material.userData.projectiveMediaBlendMode,
      targetBound: Boolean(currentTarget),
      overlayCount: overlayBindings.length,
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

  const detachOverlays = () => {
    for (const binding of overlayBindings.splice(0)) {
      binding.overlay.removeFromParent();
    }
  };

  const setTarget = (nextTarget = null) => {
    if (disposed) return 0;
    const normalizedTarget = nextTarget?.isObject3D ? nextTarget : null;
    if (normalizedTarget === currentTarget) return overlayBindings.length;

    detachOverlays();
    currentTarget = normalizedTarget;

    if (currentTarget) {
      const supportedMeshes = collectSupportedMeshes(currentTarget);
      for (const sourceMesh of supportedMeshes) {
        const overlay = createOverlayMesh(sourceMesh, material);
        overlay.visible = enabled;
        sourceMesh.add(overlay);
        overlayBindings.push({ source: sourceMesh, overlay });
      }
    }

    emitStatus();
    return overlayBindings.length;
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
    return normalized;
  };

  const update = () => {
    if (disposed) return false;
    updateProjectiveMediaCamera(camera);
    updateProjectiveMediaMaterial(material, camera);
    return true;
  };

  const setEnabled = (nextEnabled) => {
    if (disposed) return false;
    enabled = Boolean(nextEnabled);
    for (const { overlay } of overlayBindings) {
      overlay.visible = enabled;
    }
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
    detachOverlays();
    currentTarget = null;
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
      return currentTarget;
    },
    getOverlayMeshes() {
      return overlayBindings.map(({ overlay }) => overlay);
    },
    setTarget,
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
  setTarget(target);
  return api;
}

export default createProjectiveMediaProjector;
