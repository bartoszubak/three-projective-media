// Host-neutral Three.js projective-media material primitives.
import * as THREE from "three";

import {
  clampProjectiveMediaUnitInterval,
  updateProjectiveMediaMatrixUniforms,
} from "./projectiveMediaMath.js";

export const PROJECTIVE_MEDIA_BLEND_MODES = Object.freeze({
  ALPHA: "alpha",
  ADDITIVE: "additive",
});

export const PROJECTIVE_MEDIA_VERTEX_SHADER = `
  #include <common>

  varying vec4 vProjectorClipPosition;
  varying float vProjectorViewDepth;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  uniform mat4 projectorViewMatrix;
  uniform mat4 projectorProjectionMatrix;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vec4 projectorViewPosition = projectorViewMatrix * worldPosition;

    vProjectorClipPosition =
      projectorProjectionMatrix * projectorViewPosition;
    vProjectorViewDepth = -projectorViewPosition.z;
    vec3 viewNormal = normalize(normalMatrix * normal);
    vWorldNormal = transformNormalByInverseViewMatrix(
      viewNormal,
      viewMatrix
    );
    vWorldPosition = worldPosition.xyz;

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const PROJECTIVE_MEDIA_FRAGMENT_SHADER = `
  #include <common>

  varying vec4 vProjectorClipPosition;
  varying float vProjectorViewDepth;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  uniform sampler2D mediaTexture;
  uniform vec3 projectorWorldPosition;
  uniform float projectorNear;
  uniform float projectorFar;
  uniform float opacity;
  uniform float edgeFeather;

  void main() {
    if (vProjectorClipPosition.w <= 0.0) discard;
    if (
      vProjectorViewDepth < projectorNear ||
      vProjectorViewDepth > projectorFar
    ) discard;

    vec3 projectorNdc =
      vProjectorClipPosition.xyz / vProjectorClipPosition.w;
    if (projectorNdc.z < -1.0 || projectorNdc.z > 1.0) discard;

    vec2 projectiveUv = projectorNdc.xy * 0.5 + 0.5;
    if (
      projectiveUv.x < 0.0 || projectiveUv.x > 1.0 ||
      projectiveUv.y < 0.0 || projectiveUv.y > 1.0
    ) discard;

    vec3 directionToProjector =
      normalize(projectorWorldPosition - vWorldPosition);
    float surfaceFacing = dot(normalize(vWorldNormal), directionToProjector);
    if (surfaceFacing <= 0.0) discard;

    float edgeDistance = min(
      min(projectiveUv.x, 1.0 - projectiveUv.x),
      min(projectiveUv.y, 1.0 - projectiveUv.y)
    );
    float featherWidth = max(edgeFeather * 0.5, EPSILON);
    float edgeFactor = edgeFeather <= 0.0
      ? 1.0
      : smoothstep(0.0, featherWidth, edgeDistance);
    float facingFactor = smoothstep(0.0, 0.18, surfaceFacing);

    vec4 mediaColor = sRGBTransferEOTF(
      texture2D(mediaTexture, projectiveUv)
    );
    float outputAlpha =
      mediaColor.a * opacity * edgeFactor * facingFactor;
    if (outputAlpha <= EPSILON) discard;

    gl_FragColor = vec4(mediaColor.rgb, outputAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function normalizeProjectiveMediaBlendMode(value) {
  return String(value || "")
    .trim()
    .toLowerCase() === PROJECTIVE_MEDIA_BLEND_MODES.ADDITIVE
    ? PROJECTIVE_MEDIA_BLEND_MODES.ADDITIVE
    : PROJECTIVE_MEDIA_BLEND_MODES.ALPHA;
}

export function setProjectiveMediaMaterialBlendMode(material, blendMode) {
  if (!material) return PROJECTIVE_MEDIA_BLEND_MODES.ALPHA;
  const normalized = normalizeProjectiveMediaBlendMode(blendMode);
  const blending =
    normalized === PROJECTIVE_MEDIA_BLEND_MODES.ADDITIVE
      ? THREE.AdditiveBlending
      : THREE.NormalBlending;

  if (material.blending !== blending) {
    material.blending = blending;
    material.needsUpdate = true;
  }
  material.userData.projectiveMediaBlendMode = normalized;
  return normalized;
}

export function setProjectiveMediaMaterialOpacity(material, opacity) {
  if (!material?.uniforms?.opacity) return 0;
  const normalized = clampProjectiveMediaUnitInterval(opacity, 1);
  material.uniforms.opacity.value = normalized;
  return normalized;
}

export function setProjectiveMediaMaterialEdgeFeather(material, edgeFeather) {
  if (!material?.uniforms?.edgeFeather) return 0;
  const normalized = clampProjectiveMediaUnitInterval(edgeFeather, 0);
  material.uniforms.edgeFeather.value = normalized;
  return normalized;
}

export function updateProjectiveMediaMaterial(material, camera) {
  return updateProjectiveMediaMatrixUniforms(material?.uniforms, camera);
}

export function createProjectiveMediaMaterial({
  texture,
  camera = null,
  opacity = 1,
  edgeFeather = 0,
  blendMode = PROJECTIVE_MEDIA_BLEND_MODES.ALPHA,
  side = THREE.FrontSide,
  polygonOffsetFactor = -1,
  polygonOffsetUnits = -1,
} = {}) {
  if (!texture?.isTexture) {
    throw new TypeError("A media texture is required");
  }

  const material = new THREE.ShaderMaterial({
    name: "ProjectiveMediaMaterial",
    uniforms: {
      mediaTexture: { value: texture },
      projectorViewMatrix: { value: new THREE.Matrix4() },
      projectorProjectionMatrix: { value: new THREE.Matrix4() },
      projectorWorldPosition: { value: new THREE.Vector3() },
      projectorNear: { value: 0.1 },
      projectorFar: { value: 1_000 },
      opacity: {
        value: clampProjectiveMediaUnitInterval(opacity, 1),
      },
      edgeFeather: {
        value: clampProjectiveMediaUnitInterval(edgeFeather, 0),
      },
    },
    vertexShader: PROJECTIVE_MEDIA_VERTEX_SHADER,
    fragmentShader: PROJECTIVE_MEDIA_FRAGMENT_SHADER,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side,
    polygonOffset: true,
    polygonOffsetFactor,
    polygonOffsetUnits,
    toneMapped: true,
  });
  material.userData.projectiveMediaMaterial = true;
  setProjectiveMediaMaterialBlendMode(material, blendMode);
  if (camera) updateProjectiveMediaMaterial(material, camera);
  return material;
}

export default createProjectiveMediaMaterial;
