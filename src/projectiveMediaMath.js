// Host-neutral Three.js projection math utilities.
import * as THREE from "three";

export const PROJECTIVE_MEDIA_CAMERA_DEFAULTS = Object.freeze({
  fovDeg: 45,
  aspectRatio: 16 / 9,
  near: 0.1,
  far: 1_000,
});

const MIN_NEAR = 0.0001;
const MAX_FOV_DEG = 179;
const MIN_FOV_DEG = 1;
const MIN_ASPECT_RATIO = 0.0001;

export const clampProjectiveMediaNumber = (value, min, max, fallback) => {
  const parsed = Number(value);
  const finite = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(Math.max(finite, min), max);
};

export const clampProjectiveMediaUnitInterval = (value, fallback = 0) =>
  clampProjectiveMediaNumber(value, 0, 1, fallback);

export function readProjectiveMediaVector3(
  value,
  fallback = new THREE.Vector3(),
) {
  if (value?.isVector3) return value.clone();
  if (Array.isArray(value)) {
    return new THREE.Vector3(
      Number.isFinite(Number(value[0])) ? Number(value[0]) : fallback.x,
      Number.isFinite(Number(value[1])) ? Number(value[1]) : fallback.y,
      Number.isFinite(Number(value[2])) ? Number(value[2]) : fallback.z,
    );
  }

  if (value && typeof value === "object") {
    return new THREE.Vector3(
      Number.isFinite(Number(value.x)) ? Number(value.x) : fallback.x,
      Number.isFinite(Number(value.y)) ? Number(value.y) : fallback.y,
      Number.isFinite(Number(value.z)) ? Number(value.z) : fallback.z,
    );
  }

  return fallback.clone();
}

export function normalizeProjectiveMediaCameraParameters(
  parameters = {},
  fallback = PROJECTIVE_MEDIA_CAMERA_DEFAULTS,
) {
  const fallbackFov =
    Number(fallback?.fovDeg ?? fallback?.fov) ||
    PROJECTIVE_MEDIA_CAMERA_DEFAULTS.fovDeg;
  const fallbackAspect =
    Number(fallback?.aspectRatio ?? fallback?.aspect) ||
    PROJECTIVE_MEDIA_CAMERA_DEFAULTS.aspectRatio;
  const fallbackNear =
    Number(fallback?.near) || PROJECTIVE_MEDIA_CAMERA_DEFAULTS.near;
  const fallbackFar =
    Number(fallback?.far) || PROJECTIVE_MEDIA_CAMERA_DEFAULTS.far;
  const near = Math.max(
    MIN_NEAR,
    Number.isFinite(Number(parameters?.near))
      ? Number(parameters.near)
      : fallbackNear,
  );
  const requestedFar = Number.isFinite(Number(parameters?.far))
    ? Number(parameters.far)
    : fallbackFar;

  return {
    fovDeg: clampProjectiveMediaNumber(
      parameters?.fovDeg ?? parameters?.fov,
      MIN_FOV_DEG,
      MAX_FOV_DEG,
      fallbackFov,
    ),
    aspectRatio: Math.max(
      MIN_ASPECT_RATIO,
      Number.isFinite(Number(parameters?.aspectRatio ?? parameters?.aspect))
        ? Number(parameters.aspectRatio ?? parameters.aspect)
        : fallbackAspect,
    ),
    near,
    far: Math.max(requestedFar, near + Math.max(MIN_NEAR, near * 0.001)),
  };
}

export function applyProjectiveMediaCameraParameters(camera, parameters = {}) {
  if (!camera?.isPerspectiveCamera) {
    throw new TypeError("A perspective camera is required");
  }

  const normalized = normalizeProjectiveMediaCameraParameters(parameters, {
    fovDeg: camera.fov,
    aspectRatio: camera.aspect,
    near: camera.near,
    far: camera.far,
  });
  camera.fov = normalized.fovDeg;
  camera.aspect = normalized.aspectRatio;
  camera.near = normalized.near;
  camera.far = normalized.far;
  camera.updateProjectionMatrix();
  return normalized;
}

export function applyProjectiveMediaCameraPose(
  camera,
  {
    position = camera?.position,
    target = new THREE.Vector3(),
    up = camera?.up,
  } = {},
) {
  if (!camera?.isPerspectiveCamera) {
    throw new TypeError("A perspective camera is required");
  }

  camera.position.copy(readProjectiveMediaVector3(position, camera.position));
  camera.up.copy(readProjectiveMediaVector3(up, camera.up));
  const normalizedTarget = readProjectiveMediaVector3(target);
  camera.lookAt(normalizedTarget);
  camera.updateMatrixWorld(true);
  return normalizedTarget;
}

export function updateProjectiveMediaCamera(camera) {
  if (!camera?.isPerspectiveCamera) return false;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  return true;
}

export function updateProjectiveMediaMatrixUniforms(uniforms, camera) {
  if (!uniforms || !updateProjectiveMediaCamera(camera)) return false;

  uniforms.projectorViewMatrix?.value?.copy(camera.matrixWorldInverse);
  uniforms.projectorProjectionMatrix?.value?.copy(camera.projectionMatrix);
  if (uniforms.projectorWorldPosition?.value) {
    camera.getWorldPosition(uniforms.projectorWorldPosition.value);
  }
  if (uniforms.projectorNear) uniforms.projectorNear.value = camera.near;
  if (uniforms.projectorFar) uniforms.projectorFar.value = camera.far;
  return true;
}

export function isProjectiveMediaUvInBounds(uv) {
  return Boolean(
    uv &&
    Number.isFinite(uv.x) &&
    Number.isFinite(uv.y) &&
    uv.x >= 0 &&
    uv.x <= 1 &&
    uv.y >= 0 &&
    uv.y <= 1,
  );
}

export function resolveProjectiveMediaEdgeFactor(uv, edgeFeather = 0) {
  if (!isProjectiveMediaUvInBounds(uv)) return 0;
  const normalizedFeather = clampProjectiveMediaUnitInterval(edgeFeather, 0);
  if (normalizedFeather <= 0) return 1;

  const edgeDistance = Math.min(uv.x, uv.y, 1 - uv.x, 1 - uv.y);
  const featherWidth = normalizedFeather * 0.5;
  const t = Math.min(Math.max(edgeDistance / featherWidth, 0), 1);
  return t * t * (3 - 2 * t);
}

export function projectWorldPositionToProjectiveMedia(worldPosition, camera) {
  if (!camera?.isPerspectiveCamera) {
    return {
      visible: false,
      inFront: false,
      inBounds: false,
      viewDepth: Number.NaN,
      clip: null,
      ndc: null,
      uv: null,
    };
  }

  updateProjectiveMediaCamera(camera);
  const world = readProjectiveMediaVector3(worldPosition);
  const view = world.clone().applyMatrix4(camera.matrixWorldInverse);
  const clip = new THREE.Vector4(world.x, world.y, world.z, 1)
    .applyMatrix4(camera.matrixWorldInverse)
    .applyMatrix4(camera.projectionMatrix);
  const inFront = clip.w > 0;
  const inverseW = inFront ? 1 / clip.w : 0;
  const ndc = new THREE.Vector3(
    clip.x * inverseW,
    clip.y * inverseW,
    clip.z * inverseW,
  );
  const uv = new THREE.Vector2(ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5);
  const viewDepth = -view.z;
  const inBounds = isProjectiveMediaUvInBounds(uv) && ndc.z >= -1 && ndc.z <= 1;
  const inDepthRange = viewDepth >= camera.near && viewDepth <= camera.far;

  return {
    visible: inFront && inBounds && inDepthRange,
    inFront,
    inBounds,
    viewDepth,
    clip,
    ndc,
    uv,
  };
}
