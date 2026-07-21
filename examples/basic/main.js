import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createProjectiveMediaProjector } from "three-projective-media";

import "./styles.css";

const sceneContainer = document.querySelector("#scene");
const runtimeMessage = document.querySelector("#runtime-message");
const rebuildResult = document.querySelector("#rebuild-result");

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

const projector = createProjectiveMediaProjector({
  mediaUrl: "./media/projector-space-demo.mp4",
  receiverRoots: [receiverRoot],
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
});

const projectorHelper = new THREE.CameraHelper(projector.camera);
projectorHelper.name = "HostOwnedProjectorHelper";
projectorHelper.visible = false;
scene.add(projectorHelper);

const controlsById = new Map(
  Array.from(document.querySelectorAll("input[id], select[id], button[id]"),
    (element) => [element.id, element],
  ),
);
const statusElements = {
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
  statusElements.media.textContent = formatMediaStatus(media.status);
  statusElements.currentTime.textContent = `${Number(media.currentTime || 0).toFixed(2)} s`;
  statusElements.receiverRootCount.textContent = String(status.receiverRootCount);
  statusElements.receiverMeshCount.textContent = String(status.receiverMeshCount);
  statusElements.visibleReceiverCount.textContent = String(status.visibleReceiverCount);
  statusElements.overlayCount.textContent = String(status.overlayCount);
  controlsById.get("playback-toggle").textContent =
    media.status === "playing" ? "Pause" : "Play";
};

const unsubscribeStatus = projector.subscribeStatus(renderStatus);
renderStatus(latestProjectorStatus);

const setRuntimeMessage = (message) => {
  runtimeMessage.textContent = message;
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
      ? "Procedural video is playing."
      : "Autoplay was blocked; use Play after a browser gesture.",
  );
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
    ? "Muted procedural video is playing across explicit receivers."
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
  teardown,
};
