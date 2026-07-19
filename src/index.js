// Public host-neutral projective-media API.
export { createProjectiveMediaSource } from "./createProjectiveMediaSource.js";
export {
  PROJECTIVE_MEDIA_BLEND_MODES,
  PROJECTIVE_MEDIA_FRAGMENT_SHADER,
  PROJECTIVE_MEDIA_VERTEX_SHADER,
  createProjectiveMediaMaterial,
  normalizeProjectiveMediaBlendMode,
  setProjectiveMediaMaterialBlendMode,
  setProjectiveMediaMaterialEdgeFeather,
  setProjectiveMediaMaterialOpacity,
  updateProjectiveMediaMaterial,
} from "./createProjectiveMediaMaterial.js";
export { createProjectiveMediaProjector } from "./createProjectiveMediaProjector.js";
export {
  PROJECTIVE_MEDIA_CAMERA_DEFAULTS,
  applyProjectiveMediaCameraParameters,
  applyProjectiveMediaCameraPose,
  clampProjectiveMediaNumber,
  clampProjectiveMediaUnitInterval,
  isProjectiveMediaUvInBounds,
  normalizeProjectiveMediaCameraParameters,
  projectWorldPositionToProjectiveMedia,
  readProjectiveMediaVector3,
  resolveProjectiveMediaEdgeFactor,
  updateProjectiveMediaCamera,
  updateProjectiveMediaMatrixUniforms,
} from "./projectiveMediaMath.js";
