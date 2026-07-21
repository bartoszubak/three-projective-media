import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createProjectiveMediaProjector } from "three-projective-media";

import {
  DEFAULT_DEMO_MEDIA_ID,
  DEMO_MEDIA_CATALOG,
  getDemoMediaOption,
} from "./demoMediaCatalog.js";
import "./styles.css";

const sceneContainer = document.querySelector("#scene");
const runtimeMessage = document.querySelector("#runtime-message");
const rebuildResult = document.querySelector("#rebuild-result");
const defaultMediaOption = getDemoMediaOption(DEFAULT_DEMO_MEDIA_ID);

if (!defaultMediaOption) {
  throw new Error("The default demo media option is missing");
}

const initialSettings = Object.freeze({
  enabled: true,
  muted: true,
  volume: 0.65,
  opacity: 0.82,
  edgeFeather: 0.08,
  blendMode: "additive",
  fovDeg: 43,
  position: Object.freeze({ x: 0, y: 2.4, z: 5.8 }),
  target: Object.freeze({ x: 0, y: 1.6, z: -1.8 }),
});

const settings = {
  ...initialSettings,
  mediaId: defaultMediaOption.id,
  position: { ...initialSettings.position },
  target: { ...initialSettings.target },
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080b0d);
scene.fog = new THREE.Fog(0x080b0d, 13, 28);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
sceneContainer.append(renderer.domElement);

const hostCamera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
hostCamera.position.set(8.6, 5.6, 10.4);

const orbitControls = new OrbitControls(hostCamera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.06;
orbitControls.minDistance = 4.5;
orbitControls.maxDistance = 24;
orbitControls.maxPolarAngle = Math.PI * 0.49;
orbitControls.target.set(0, 1.55, -1.2);
orbitControls.update();

scene.add(new THREE.AmbientLight(0x91a8b2, 1.15));
const keyLight = new THREE.DirectionalLight(0xdde9e7, 2.25);
keyLight.position.set(4, 8, 6);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x497d8e, 1.1);
rimLight.position.set(-6, 3, -5);
scene.add(rimLight);

const hostResources = new Set();
const receiverRoot = new THREE.Group();
receiverRoot.name = "ExplicitGalleryReceivers";
scene.add(receiverRoot);

const trackResource = (resource) => {
  hostResources.add(resource);
  return resource;
};

const createMaterial = (color, roughness = 0.78, metalness = 0.08) =>
  trackResource(
    new THREE.MeshStandardMaterial({ color, roughness, metalness }),
  );

const addReceiverMesh = ({ geometry, material, position, rotation, name }) => {
  const mesh = new THREE.Mesh(trackResource(geometry), material);
  mesh.name = name;
  mesh.position.copy(position);
  if (rotation) mesh.rotation.set(rotation.x, rotation.y, rotation.z);
  receiverRoot.add(mesh);
  return mesh;
};

const wallMaterial = createMaterial(0x263136, 0.92, 0.02);
const panelMaterial = createMaterial(0x4a3f46, 0.7, 0.12);
const sculptureMaterial = createMaterial(0x324e4c, 0.48, 0.28);
const pedestalMaterial = createMaterial(0x383e43, 0.86, 0.04);

const wall = addReceiverMesh({
  geometry: new THREE.BoxGeometry(11, 5.4, 0.22),
  material: wallMaterial,
  position: new THREE.Vector3(0, 2.7, -3.15),
  name: "GalleryWallReceiver",
});
const angledPanel = addReceiverMesh({
  geometry: new THREE.BoxGeometry(2.25, 3.25, 0.26),
  material: panelMaterial,
  position: new THREE.Vector3(-2.35, 1.8, -1.72),
  rotation: new THREE.Euler(0, 0.42, 0),
  name: "AngledPanelReceiver",
});
const sculpture = addReceiverMesh({
  geometry: new THREE.IcosahedronGeometry(1.05, 2),
  material: sculptureMaterial,
  position: new THREE.Vector3(1.25, 1.75, -1.55),
  rotation: new THREE.Euler(0.18, -0.38, 0.08),
  name: "SculptureReceiver",
});
const pedestal = addReceiverMesh({
  geometry: new THREE.BoxGeometry(1.65, 0.85, 1.4),
  material: pedestalMaterial,
  position: new THREE.Vector3(1.25, 0.43, -1.55),
  name: "PedestalReceiver",
});

const floorGeometry = trackResource(new THREE.PlaneGeometry(30, 30));
const floorMaterial = createMaterial(0x111719, 0.96, 0.01);
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.name = "HostFloorNotAReceiver";
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.02;
scene.add(floor);

const dynamicPalette = [0x5c4141, 0x3d5161, 0x4c5940];
let dynamicGeneration = 0;
let dynamicSubtree = null;

const createDynamicReceiverSubtree = () => {
  const generation = dynamicGeneration;
  const group = new THREE.Group();
  group.name = `DynamicReceiverSubtree-${generation + 1}`;
  group.position.set(3.15, 0, -1.95);

  const geometry = trackResource(
    generation % 2 === 0
      ? new THREE.CylinderGeometry(0.58, 0.78, 2.85, 20)
      : new THREE.BoxGeometry(1.2, 2.65, 1.1, 2, 3, 2),
  );
  const material = createMaterial(
    dynamicPalette[generation % dynamicPalette.length],
    0.62,
    0.16,
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `DynamicReceiver-${generation + 1}`;
  mesh.position.y = 1.43;
  mesh.rotation.y = generation * 0.22;
  group.add(mesh);
  dynamicGeneration += 1;
  return group;
};

dynamicSubtree = createDynamicReceiverSubtree();
receiverRoot.add(dynamicSubtree);

const createProjectorSession = (
  mediaOption,
  { receiverRoots = [], autoplay = true } = {},
) => ({
  autoplay,
  projector: createProjectiveMediaProjector({
    mediaUrl: mediaOption.url,
    receiverRoots,
    projector: {
      position: settings.position,
      target: settings.target,
      up: { x: 0, y: 1, z: 0 },
      fovDeg: settings.fovDeg,
      aspectRatio: 16 / 9,
      near: 0.1,
      far: 22,
    },
    appearance: {
      enabled: settings.enabled,
      opacity: settings.opacity,
      edgeFeather: settings.edgeFeather,
      blendMode: settings.blendMode,
    },
    media: {
      loop: true,
      muted: settings.muted,
      volume: settings.volume,
    },
  }),
});

const initialSession = createProjectorSession(defaultMediaOption, {
  receiverRoots: [receiverRoot],
});
let projector = initialSession.projector;
let activeMediaId = defaultMediaOption.id;
let sessionGeneration = 1;
let latestMediaSwitchReport = null;
let mediaSwitchInFlight = false;

let projectorHelper = new THREE.CameraHelper(projector.camera);
projectorHelper.name = "HostOwnedProjectorHelper";
projectorHelper.visible = false;
scene.add(projectorHelper);

const controlsById = new Map(
  Array.from(document.querySelectorAll("input[id], select[id], button[id]"),
    (element) => [element.id, element],
  ),
);
const mediaSelect = controlsById.get("projection-video-source");
for (const option of DEMO_MEDIA_CATALOG) {
  const optionElement = document.createElement("option");
  optionElement.value = option.id;
  optionElement.textContent = option.label;
  mediaSelect.append(optionElement);
}
mediaSelect.value = activeMediaId;

const statusElements = {
  activeVideo: document.querySelector("#active-video"),
  sessionGeneration: document.querySelector("#session-generation"),
  media: document.querySelector("#media-status"),
  currentTime: document.querySelector("#current-time"),
  receiverRootCount: document.querySelector("#receiver-root-count"),
  receiverMeshCount: document.querySelector("#receiver-mesh-count"),
  visibleReceiverCount: document.querySelector("#visible-receiver-count"),
  overlayCount: document.querySelector("#overlay-count"),
};

const registeredListeners = [];
let animationFrameId = 0;
let disposed = false;
let lastStatusRender = 0;
let latestProjectorStatus = projector.getStatus();
let latestRebuildReport = null;

const listen = (target, type, listener, options) => {
  target.addEventListener(type, listener, options);
  registeredListeners.push(() => target.removeEventListener(type, listener, options));
};

const formatMediaStatus = (status) => {
  const labels = {
    loading: "Loading",
    ready: "Ready",
    playing: "Playing",
    paused: "Paused",
    blocked: "Autoplay blocked",
    ended: "Ended",
    error: "Media error",
    disposed: "Disposed",
  };
  return labels[status] || String(status || "Unknown");
};

const renderStatus = (status = projector.getStatus()) => {
  latestProjectorStatus = status;
  const media = status.media || {};
  statusElements.activeVideo.textContent =
    getDemoMediaOption(activeMediaId)?.label || activeMediaId;
  statusElements.sessionGeneration.textContent = String(sessionGeneration);
  statusElements.media.textContent = formatMediaStatus(media.status);
  statusElements.currentTime.textContent = `${Number(media.currentTime || 0).toFixed(2)} s`;
  statusElements.receiverRootCount.textContent = String(status.receiverRootCount);
  statusElements.receiverMeshCount.textContent = String(status.receiverMeshCount);
  statusElements.visibleReceiverCount.textContent = String(status.visibleReceiverCount);
  statusElements.overlayCount.textContent = String(status.overlayCount);
  controlsById.get("playback-toggle").textContent =
    media.status === "playing" ? "Pause" : "Play";
};

let unsubscribeStatus = projector.subscribeStatus(renderStatus);
renderStatus(latestProjectorStatus);

const setRuntimeMessage = (message) => {
  runtimeMessage.textContent = message;
};

const vectorMatches = (vector, coordinates, tolerance = 1e-6) =>
  ["x", "y", "z"].every(
    (axis) => Math.abs(vector[axis] - coordinates[axis]) <= tolerance,
  );

const projectorPoseMatchesSettings = (candidateProjector) => {
  const actualDirection = new THREE.Vector3();
  candidateProjector.camera.getWorldDirection(actualDirection);
  const expectedDirection = new THREE.Vector3(
    settings.target.x - settings.position.x,
    settings.target.y - settings.position.y,
    settings.target.z - settings.position.z,
  ).normalize();
  return (
    vectorMatches(candidateProjector.camera.position, settings.position) &&
    actualDirection.distanceTo(expectedDirection) <= 1e-6
  );
};

const projectorParametersMatchSettings = (candidateProjector) => {
  const status = candidateProjector.getStatus();
  const media = status.media || {};
  return (
    status.enabled === settings.enabled &&
    Math.abs(status.opacity - settings.opacity) <= 1e-6 &&
    Math.abs(status.edgeFeather - settings.edgeFeather) <= 1e-6 &&
    status.blendMode === settings.blendMode &&
    Math.abs(candidateProjector.camera.fov - settings.fovDeg) <= 1e-6 &&
    media.muted === settings.muted &&
    Math.abs(media.volume - settings.volume) <= 1e-6 &&
    media.loop === true
  );
};

const runSandboxCleanupStep = (cleanup, fallbackValue = false) => {
  try {
    return cleanup();
  } catch {
    return fallbackValue;
  }
};

const rollbackCandidateSession = ({
  candidateProjector,
  candidateHelper,
  candidateUnsubscribe,
}) => ({
  candidateUnsubscribed: runSandboxCleanupStep(() => {
    candidateUnsubscribe?.();
    return true;
  }),
  candidateHelperRemoved: runSandboxCleanupStep(() => {
    candidateHelper?.removeFromParent();
    return !candidateHelper?.parent;
  }, !candidateHelper),
  candidateHelperDisposed: runSandboxCleanupStep(() => {
    candidateHelper?.dispose();
    return true;
  }, !candidateHelper),
  candidateProjectorDisposed: runSandboxCleanupStep(
    () => candidateProjector?.dispose() ?? true,
    !candidateProjector,
  ),
});

const switchDemoMedia = async (nextMediaId) => {
  const nextMediaOption = getDemoMediaOption(nextMediaId);
  if (!nextMediaOption || disposed || mediaSwitchInFlight) {
    mediaSelect.value = activeMediaId;
    return null;
  }

  const currentMediaOption = getDemoMediaOption(activeMediaId);
  const previousTime = projector.mediaSource.video.currentTime;
  if (nextMediaId === activeMediaId) {
    latestMediaSwitchReport = Object.freeze({
      fromMediaId: activeMediaId,
      toMediaId: nextMediaId,
      replaced: false,
      oldProjectorDisposed: false,
      oldMediaSourceDisposed: false,
      oldVideoSourceCleared: false,
      projectorReplaced: false,
      mediaSourceReplaced: false,
      videoElementReplaced: false,
      textureReplaced: false,
      receiverRootPreserved: true,
      receiverMeshCountPreserved: true,
      overlayCountPreserved: true,
      posePreserved: true,
      parametersPreserved: true,
      helperVisibilityPreserved: true,
      previousTime,
      nextTime: previousTime,
      timelineTransferred: false,
    });
    mediaSelect.value = activeMediaId;
    setRuntimeMessage(`${currentMediaOption.label} is already active.`);
    return latestMediaSwitchReport;
  }

  mediaSwitchInFlight = true;
  mediaSelect.disabled = true;
  const oldProjector = projector;
  const oldMediaSource = oldProjector.mediaSource;
  const oldVideoElement = oldMediaSource.video;
  const oldTexture = oldMediaSource.texture;
  const oldReceiverMeshes = oldProjector.getReceiverMeshes();
  const oldReceiverCount = oldProjector.getStatus().receiverMeshCount;
  const oldOverlayCount = oldProjector.getStatus().overlayCount;
  const helperWasVisible = projectorHelper.visible;
  const oldProjectorHelper = projectorHelper;
  const oldUnsubscribeStatus = unsubscribeStatus;
  const oldSessionGeneration = sessionGeneration;
  const oldSettingsMediaId = settings.mediaId;
  let candidateProjector = null;
  let candidateHelper = null;
  let candidateUnsubscribe = null;
  let candidateStatus = null;
  let candidateReceiverMeshes = [];
  let candidatePlayResult = null;

  // PREPARE: the current session remains active until every candidate resource
  // and invariant required by the host has been prepared successfully.
  try {
    const candidateSession = createProjectorSession(nextMediaOption, {
      receiverRoots: [],
      autoplay: true,
    });
    candidateProjector = candidateSession.projector;
    candidatePlayResult = candidateSession.autoplay
      ? await candidateProjector.play()
      : { ok: true, status: "paused" };

    if (disposed) {
      rollbackCandidateSession({
        candidateProjector,
        candidateHelper,
        candidateUnsubscribe,
      });
      mediaSwitchInFlight = false;
      mediaSelect.disabled = false;
      return null;
    }

    candidateProjector.setReceiverRoots([receiverRoot]);
    candidateHelper = new THREE.CameraHelper(candidateProjector.camera);
    candidateHelper.name = "HostOwnedProjectorHelper";
    candidateHelper.visible = helperWasVisible;
    candidateHelper.update();
    candidateUnsubscribe = candidateProjector.subscribeStatus((status) => {
      if (!disposed && projector === candidateProjector) renderStatus(status);
    });
    candidateStatus = candidateProjector.getStatus();
    candidateReceiverMeshes = candidateProjector.getReceiverMeshes();

    const candidateIsValid =
      projectorPoseMatchesSettings(candidateProjector) &&
      projectorParametersMatchSettings(candidateProjector) &&
      candidateProjector.getReceiverRoots()[0] === receiverRoot &&
      candidateStatus.receiverRootCount === 1 &&
      candidateStatus.receiverMeshCount === oldReceiverCount &&
      candidateStatus.overlayCount === oldOverlayCount &&
      oldReceiverMeshes.every((mesh) => candidateReceiverMeshes.includes(mesh)) &&
      candidateHelper.visible === helperWasVisible;
    if (!candidateIsValid) {
      throw new Error("Candidate media session failed host validation");
    }
  } catch (error) {
    const rollback = rollbackCandidateSession({
      candidateProjector,
      candidateHelper,
      candidateUnsubscribe,
    });
    mediaSelect.value = activeMediaId;
    setRuntimeMessage(
      `Could not switch to ${nextMediaOption.label}. The current media session remains active.`,
    );
    latestMediaSwitchReport = Object.freeze({
      fromMediaId: activeMediaId,
      toMediaId: nextMediaId,
      replaced: false,
      oldProjectorDisposed: false,
      oldMediaSourceDisposed: false,
      oldVideoSourceCleared: false,
      projectorReplaced: false,
      mediaSourceReplaced: false,
      videoElementReplaced: false,
      textureReplaced: false,
      receiverRootPreserved: true,
      receiverMeshCountPreserved: true,
      overlayCountPreserved: true,
      posePreserved: true,
      parametersPreserved: true,
      helperVisibilityPreserved: true,
      previousTime,
      nextTime: projector.mediaSource.video.currentTime,
      timelineTransferred: false,
      candidateRolledBack: true,
      oldProjectorActive: !oldProjector.getStatus().disposed,
      sessionGenerationPreserved: sessionGeneration === oldSessionGeneration,
      ...rollback,
      error: error instanceof Error ? error.message : String(error),
    });
    mediaSwitchInFlight = false;
    mediaSelect.disabled = false;
    return latestMediaSwitchReport;
  }

  // COMMIT: publish the fully prepared candidate as the single active host
  // session before attempting any best-effort cleanup of the old session.
  try {
    projector = candidateProjector;
    projectorHelper = candidateHelper;
    unsubscribeStatus = candidateUnsubscribe;
    activeMediaId = nextMediaOption.id;
    settings.mediaId = activeMediaId;
    sessionGeneration = oldSessionGeneration + 1;

    scene.add(projectorHelper);
    projectorHelper.update();
    mediaSelect.value = activeMediaId;
    controlsById.get("projector-helper").checked = projectorHelper.visible;
    renderStatus(candidateStatus);
  } catch (error) {
    projector = oldProjector;
    projectorHelper = oldProjectorHelper;
    unsubscribeStatus = oldUnsubscribeStatus;
    activeMediaId = currentMediaOption.id;
    settings.mediaId = oldSettingsMediaId;
    sessionGeneration = oldSessionGeneration;
    const rollback = rollbackCandidateSession({
      candidateProjector,
      candidateHelper,
      candidateUnsubscribe,
    });
    mediaSelect.value = activeMediaId;
    controlsById.get("projector-helper").checked = projectorHelper.visible;
    runSandboxCleanupStep(() => renderStatus(oldProjector.getStatus()));
    setRuntimeMessage(
      `Could not switch to ${nextMediaOption.label}. The current media session remains active.`,
    );
    latestMediaSwitchReport = Object.freeze({
      fromMediaId: activeMediaId,
      toMediaId: nextMediaId,
      replaced: false,
      oldProjectorDisposed: false,
      oldMediaSourceDisposed: false,
      oldVideoSourceCleared: false,
      projectorReplaced: false,
      mediaSourceReplaced: false,
      videoElementReplaced: false,
      textureReplaced: false,
      receiverRootPreserved: true,
      receiverMeshCountPreserved: true,
      overlayCountPreserved: true,
      posePreserved: true,
      parametersPreserved: true,
      helperVisibilityPreserved: true,
      previousTime,
      nextTime: projector.mediaSource.video.currentTime,
      timelineTransferred: false,
      candidateRolledBack: true,
      oldProjectorActive: !oldProjector.getStatus().disposed,
      sessionGenerationPreserved: sessionGeneration === oldSessionGeneration,
      ...rollback,
      error: error instanceof Error ? error.message : String(error),
    });
    return latestMediaSwitchReport;
  } finally {
    if (projector !== candidateProjector) {
      mediaSwitchInFlight = false;
      mediaSelect.disabled = false;
    }
  }

  // CLEANUP: the new session is already active, so individual failures while
  // retiring the old host-owned resources cannot invalidate the commit.
  const oldStatusUnsubscribed = runSandboxCleanupStep(() => {
    oldUnsubscribeStatus();
    return true;
  });
  const oldHelperRemoved = runSandboxCleanupStep(() => {
    oldProjectorHelper.removeFromParent();
    return oldProjectorHelper.parent === null;
  });
  const oldHelperDisposed = runSandboxCleanupStep(() => {
    oldProjectorHelper.dispose();
    return true;
  });
  const oldProjectorDisposed = runSandboxCleanupStep(
    () => oldProjector.dispose(),
    false,
  );
  const oldMediaSourceDisposed = Boolean(
    runSandboxCleanupStep(() => oldMediaSource.getSnapshot?.().disposed),
  );
  const oldVideoSourceAttribute = runSandboxCleanupStep(
    () => oldVideoElement.getAttribute("src"),
    null,
  );
  const oldVideoSourceCleared =
    oldVideoSourceAttribute === null || oldVideoSourceAttribute === "";
  const nextTime = projector.mediaSource.video.currentTime;
  latestMediaSwitchReport = Object.freeze({
    fromMediaId: currentMediaOption.id,
    toMediaId: nextMediaOption.id,
    replaced: true,
    oldProjectorDisposed,
    oldMediaSourceDisposed,
    oldVideoSourceCleared,
    oldStatusUnsubscribed,
    oldHelperRemoved,
    oldHelperDisposed,
    projectorReplaced: projector !== oldProjector,
    mediaSourceReplaced: projector.mediaSource !== oldMediaSource,
    videoElementReplaced: projector.mediaSource.video !== oldVideoElement,
    textureReplaced: projector.mediaSource.texture !== oldTexture,
    receiverRootPreserved: projector.getReceiverRoots()[0] === receiverRoot,
    receiverMeshCountPreserved:
      candidateStatus.receiverMeshCount === oldReceiverCount &&
      oldReceiverMeshes.every((mesh) => candidateReceiverMeshes.includes(mesh)),
    overlayCountPreserved: candidateStatus.overlayCount === oldOverlayCount,
    posePreserved: projectorPoseMatchesSettings(projector),
    parametersPreserved: projectorParametersMatchSettings(projector),
    helperVisibilityPreserved: projectorHelper.visible === helperWasVisible,
    previousTime,
    nextTime,
    timelineTransferred: false,
    playbackStatus: candidatePlayResult?.status || "unknown",
  });

  setRuntimeMessage(
    candidatePlayResult?.status === "blocked"
      ? `Switched to ${nextMediaOption.label}. Autoplay was blocked; use Play to start the new media session.`
      : `Switched to ${nextMediaOption.label}. A new media session was created while pose and receivers were preserved.`,
  );
  mediaSwitchInFlight = false;
  mediaSelect.disabled = false;
  return latestMediaSwitchReport;
};

const updatePose = () => {
  projector.setPose({ position: settings.position, target: settings.target });
  projectorHelper.update();
};

const syncRangeOutput = (id, value, suffix = "") => {
  const output = document.querySelector(`#${id}-output`);
  if (output) output.value = `${value}${suffix}`;
};

const bindRange = (id, onValue, format = (value) => value.toFixed(2)) => {
  const control = controlsById.get(id);
  listen(control, "input", () => {
    const value = Number(control.value);
    onValue(value);
    syncRangeOutput(id, format(value));
  });
};

listen(controlsById.get("playback-toggle"), "click", async () => {
  const status = projector.getStatus().media?.status;
  if (status === "playing") {
    projector.pause();
    setRuntimeMessage("Playback paused without replacing the media session.");
    return;
  }
  const result = await projector.play();
  setRuntimeMessage(
    result?.ok
      ? `${getDemoMediaOption(activeMediaId)?.label || "Video"} is playing.`
      : "Autoplay was blocked; use Play after a browser gesture.",
  );
});

listen(mediaSelect, "change", (event) => {
  void switchDemoMedia(event.currentTarget.value);
});

listen(controlsById.get("projection-enabled"), "change", (event) => {
  settings.enabled = event.currentTarget.checked;
  projector.setEnabled(settings.enabled);
});

listen(controlsById.get("projection-muted"), "change", (event) => {
  settings.muted = event.currentTarget.checked;
  projector.setMuted(settings.muted);
  setRuntimeMessage(settings.muted ? "Media muted." : "Media unmuted by user gesture.");
});

bindRange("projection-volume", (value) => {
  settings.volume = value;
  projector.setVolume(value);
});
bindRange("projection-opacity", (value) => {
  settings.opacity = value;
  projector.setOpacity(value);
});
bindRange("projection-edge-feather", (value) => {
  settings.edgeFeather = value;
  projector.setEdgeFeather(value);
});
bindRange(
  "projection-fov",
  (value) => {
    settings.fovDeg = value;
    projector.setProjectorParameters({ fovDeg: value });
    projectorHelper.update();
  },
  (value) => `${Math.round(value)}°`,
);

listen(controlsById.get("projection-blend-mode"), "change", (event) => {
  settings.blendMode = event.currentTarget.value;
  projector.setBlendMode(settings.blendMode);
});

for (const [coordinate, axis, object] of [
  ["projector-x", "x", settings.position],
  ["projector-y", "y", settings.position],
  ["projector-z", "z", settings.position],
  ["target-x", "x", settings.target],
  ["target-y", "y", settings.target],
  ["target-z", "z", settings.target],
]) {
  listen(controlsById.get(coordinate), "change", (event) => {
    const value = Number(event.currentTarget.value);
    if (!Number.isFinite(value)) return;
    object[axis] = value;
    updatePose();
  });
}

listen(controlsById.get("projector-helper"), "change", (event) => {
  projectorHelper.visible = event.currentTarget.checked;
  projectorHelper.update();
});

const collectOverlayMap = () =>
  new Map(
    projector.getReceiverMeshes().map((mesh, index) => [
      mesh,
      projector.getOverlayMeshes()[index],
    ]),
  );

const disposeSubtreeResources = (subtree) => {
  let geometryCount = 0;
  let materialCount = 0;
  subtree.traverse((object) => {
    if (!object.isMesh) return;
    if (object.geometry) {
      hostResources.delete(object.geometry);
      object.geometry.dispose();
      geometryCount += 1;
    }
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) {
      hostResources.delete(material);
      material.dispose();
      materialCount += 1;
    }
  });
  return { geometryCount, materialCount };
};

const rebuildDynamicReceiver = () => {
  const projectorIdentity = projector;
  const mediaSourceIdentity = projector.mediaSource;
  const textureIdentity = projector.mediaSource.texture;
  const timeBefore = projector.mediaSource.video.currentTime;
  const oldSubtree = dynamicSubtree;
  const oldSubtreeMeshes = [];
  oldSubtree.traverse((object) => {
    if (object.isMesh) oldSubtreeMeshes.push(object);
  });
  const overlayMapBefore = collectOverlayMap();
  const stableSources = projector
    .getReceiverMeshes()
    .filter((mesh) => !oldSubtreeMeshes.includes(mesh));

  const detachedCount = projector.detachReceiverObject(oldSubtree);
  oldSubtree.removeFromParent();
  const disposedResources = disposeSubtreeResources(oldSubtree);

  dynamicSubtree = createDynamicReceiverSubtree();
  receiverRoot.add(dynamicSubtree);
  const receiverCount = projector.refreshReceivers();
  const overlayMapAfter = collectOverlayMap();
  const timeAfter = projector.mediaSource.video.currentTime;

  latestRebuildReport = Object.freeze({
    detachedCount,
    receiverCount,
    oldSubtreeDetached: oldSubtree.parent === null,
    hostGeometryDisposed: disposedResources.geometryCount,
    hostMaterialsDisposed: disposedResources.materialCount,
    projectorPreserved: projector === projectorIdentity,
    mediaSourcePreserved: projector.mediaSource === mediaSourceIdentity,
    texturePreserved: projector.mediaSource.texture === textureIdentity,
    timelinePreserved: timeAfter + 0.05 >= timeBefore,
    stableOverlaysPreserved: stableSources.every(
      (mesh) => overlayMapAfter.get(mesh) === overlayMapBefore.get(mesh),
    ),
    timeBefore,
    timeAfter,
  });

  rebuildResult.textContent = latestRebuildReport.stableOverlaysPreserved
    ? "Rebuilt: media, texture, timeline, and stable overlays preserved."
    : "Receiver rebuilt; inspect lifecycle diagnostics.";
  renderStatus(projector.getStatus());
  return latestRebuildReport;
};

listen(controlsById.get("rebuild-receiver"), "click", rebuildDynamicReceiver);

const writeSettingsToControls = () => {
  mediaSelect.value = activeMediaId;
  controlsById.get("projection-enabled").checked = settings.enabled;
  controlsById.get("projection-muted").checked = settings.muted;
  controlsById.get("projection-volume").value = String(settings.volume);
  controlsById.get("projection-opacity").value = String(settings.opacity);
  controlsById.get("projection-edge-feather").value = String(settings.edgeFeather);
  controlsById.get("projection-blend-mode").value = settings.blendMode;
  controlsById.get("projection-fov").value = String(settings.fovDeg);
  controlsById.get("projector-x").value = String(settings.position.x);
  controlsById.get("projector-y").value = String(settings.position.y);
  controlsById.get("projector-z").value = String(settings.position.z);
  controlsById.get("target-x").value = String(settings.target.x);
  controlsById.get("target-y").value = String(settings.target.y);
  controlsById.get("target-z").value = String(settings.target.z);
  syncRangeOutput("projection-volume", settings.volume.toFixed(2));
  syncRangeOutput("projection-opacity", settings.opacity.toFixed(2));
  syncRangeOutput("projection-edge-feather", settings.edgeFeather.toFixed(2));
  syncRangeOutput("projection-fov", `${settings.fovDeg}°`);
};

const resetDemo = () => {
  Object.assign(settings, {
    enabled: initialSettings.enabled,
    muted: initialSettings.muted,
    volume: initialSettings.volume,
    opacity: initialSettings.opacity,
    edgeFeather: initialSettings.edgeFeather,
    blendMode: initialSettings.blendMode,
    fovDeg: initialSettings.fovDeg,
  });
  Object.assign(settings.position, initialSettings.position);
  Object.assign(settings.target, initialSettings.target);
  projector.setEnabled(settings.enabled);
  projector.setMuted(settings.muted);
  projector.setVolume(settings.volume);
  projector.setOpacity(settings.opacity);
  projector.setEdgeFeather(settings.edgeFeather);
  projector.setBlendMode(settings.blendMode);
  projector.setProjectorParameters({ fovDeg: settings.fovDeg });
  updatePose();
  projectorHelper.visible = false;
  controlsById.get("projector-helper").checked = false;
  writeSettingsToControls();
  setRuntimeMessage("Projection controls reset without replacing the media session.");
};

listen(controlsById.get("reset-demo"), "click", resetDemo);
writeSettingsToControls();

const resize = () => {
  const width = Math.max(sceneContainer.clientWidth, 1);
  const height = Math.max(sceneContainer.clientHeight, 1);
  renderer.setSize(width, height, false);
  hostCamera.aspect = width / height;
  hostCamera.updateProjectionMatrix();
};
listen(window, "resize", resize);
resize();

const renderFrame = (time) => {
  if (disposed) return;
  animationFrameId = requestAnimationFrame(renderFrame);
  orbitControls.update();
  projector.update();
  if (time - lastStatusRender > 120) {
    renderStatus(projector.getStatus());
    lastStatusRender = time;
  }
  renderer.render(scene, hostCamera);
};
animationFrameId = requestAnimationFrame(renderFrame);

const initialPlay = await projector.play();
setRuntimeMessage(
  initialPlay?.ok
    ? `Muted ${defaultMediaOption.label} video is playing across explicit receivers.`
    : "Muted autoplay was blocked. Use Play to start the video.",
);

const disposeHostScene = () => {
  for (const resource of Array.from(hostResources)) resource.dispose?.();
  hostResources.clear();
};

const teardown = () => {
  if (disposed) return false;
  disposed = true;
  cancelAnimationFrame(animationFrameId);
  animationFrameId = 0;
  unsubscribeStatus();
  for (const removeListener of registeredListeners.splice(0)) removeListener();
  projectorHelper.removeFromParent();
  projectorHelper.dispose();
  projector.dispose();
  orbitControls.dispose();
  disposeHostScene();
  renderer.dispose();
  renderer.domElement.remove();
  return true;
};

listen(window, "pagehide", teardown, { once: true });

globalThis.__projectorSpaceDemo = {
  get projector() {
    return projector;
  },
  get mediaSource() {
    return projector.mediaSource;
  },
  get videoTexture() {
    return projector.mediaSource.texture;
  },
  get helper() {
    return projectorHelper;
  },
  get latestRebuildReport() {
    return latestRebuildReport;
  },
  get activeMediaId() {
    return activeMediaId;
  },
  get sessionGeneration() {
    return sessionGeneration;
  },
  get latestMediaSwitchReport() {
    return latestMediaSwitchReport;
  },
  get settings() {
    return structuredClone(settings);
  },
  get diagnostics() {
    return {
      disposed,
      activeAnimationFrame: animationFrameId,
      registeredListenerCount: registeredListeners.length,
      status: projector.getStatus(),
      receiverNames: projector.getReceiverMeshes().map((mesh) => mesh.name),
      overlayIdentities: projector.getOverlayMeshes(),
    };
  },
  rebuildDynamicReceiver,
  resetDemo,
  switchMedia: switchDemoMedia,
  teardown,
};
