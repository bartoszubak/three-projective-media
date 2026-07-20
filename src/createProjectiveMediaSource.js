// Host-neutral HTML video source and texture lifecycle primitives.
import * as THREE from "three";

import { clampProjectiveMediaUnitInterval } from "./projectiveMediaMath.js";

const MEDIA_EVENT_TYPES = Object.freeze([
  "loadeddata",
  "canplay",
  "playing",
  "pause",
  "ended",
  "error",
]);

const normalizeUrl = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const notifyListeners = (listeners, payload) => {
  for (const listener of Array.from(listeners)) {
    try {
      listener(payload);
    } catch {
      // Subscriber failures are isolated from media state and lifecycle work.
    }
  }
};

const runCleanupStep = (cleanup) => {
  try {
    cleanup();
  } catch {
    // Cleanup is best-effort and later release steps must still run.
  }
};

const releaseConfiguredVideo = ({
  video,
  domListeners,
  texture = null,
  releaseState,
}) => {
  if (releaseState.released) return false;
  releaseState.released = true;

  for (const [type, handler] of domListeners) {
    runCleanupStep(() => video.removeEventListener?.(type, handler));
  }
  domListeners.clear();

  runCleanupStep(() => video.pause?.());
  runCleanupStep(() => video.removeAttribute?.("src"));
  runCleanupStep(() => {
    video.src = "";
  });
  runCleanupStep(() => video.load?.());
  runCleanupStep(() => texture?.dispose?.());
  return true;
};

const resolveVideoElement = ({ createVideoElement, documentRef }) => {
  if (typeof createVideoElement === "function") {
    return createVideoElement();
  }
  if (typeof documentRef?.createElement === "function") {
    return documentRef.createElement("video");
  }
  throw new Error("A document or video element factory is required");
};

export function createProjectiveMediaSource({
  url = null,
  mediaUrl = null,
  loop = true,
  muted = true,
  volume = 1,
  createVideoElement = null,
  createTexture = (video) => new THREE.VideoTexture(video),
  documentRef = globalThis.document,
} = {}) {
  const resolvedUrl = normalizeUrl(url ?? mediaUrl);
  if (!resolvedUrl) throw new TypeError("A resolved media URL is required");

  const video = resolveVideoElement({ createVideoElement, documentRef });
  if (!video) throw new Error("The video element factory returned no element");

  const listeners = new Set();
  const domListeners = new Map();
  const releaseState = { released: false };
  let disposed = false;
  let status = "loading";
  let lastError = null;

  const getCurrentTime = () => {
    const value = Number(video.currentTime);
    return Number.isFinite(value) ? value : 0;
  };

  const getSnapshot = () =>
    Object.freeze({
      status,
      disposed,
      muted: Boolean(video.muted),
      volume: clampProjectiveMediaUnitInterval(video.volume, 1),
      loop: Boolean(video.loop),
      currentTime: getCurrentTime(),
      error: lastError,
    });

  const notify = () => {
    const snapshot = getSnapshot();
    notifyListeners(listeners, snapshot);
  };

  const setStatus = (nextStatus, error = lastError) => {
    if (disposed) return;
    const changed = status !== nextStatus || lastError !== error;
    status = nextStatus;
    lastError = error;
    if (changed) notify();
  };

  const eventHandlers = {
    loadeddata: () => setStatus("ready", null),
    canplay: () => setStatus("ready", null),
    playing: () => setStatus("playing", null),
    pause: () => setStatus("paused", null),
    ended: () => setStatus(video.loop ? "ready" : "ended", null),
    error: (event) => setStatus("error", video.error || event?.error || event),
  };

  let texture = null;
  try {
    for (const type of MEDIA_EVENT_TYPES) {
      const handler = eventHandlers[type];
      domListeners.set(type, handler);
      video.addEventListener?.(type, handler);
    }

    video.crossOrigin = "anonymous";
    video.playsInline = true;
    video.setAttribute?.("playsinline", "");
    video.preload = "auto";
    video.controls = false;
    video.loop = Boolean(loop);
    video.muted = Boolean(muted);
    video.defaultMuted = Boolean(muted);
    video.volume = clampProjectiveMediaUnitInterval(volume, 1);
    video.src = resolvedUrl;

    texture = createTexture(video);
    if (!texture?.isTexture) {
      throw new TypeError("The texture factory must return a texture");
    }
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
  } catch (error) {
    releaseConfiguredVideo({ video, domListeners, texture, releaseState });
    throw error;
  }

  const play = async () => {
    if (disposed) {
      return {
        ok: false,
        status: "disposed",
        error: null,
      };
    }

    try {
      await Promise.resolve(video.play?.());
      setStatus("playing", null);
      return {
        ok: true,
        status: "playing",
        error: null,
      };
    } catch (error) {
      setStatus("blocked", error);
      return {
        ok: false,
        status: "blocked",
        error,
      };
    }
  };

  const pause = () => {
    if (disposed) return false;
    try {
      video.pause?.();
      setStatus("paused", null);
      return true;
    } catch (error) {
      setStatus("error", error);
      return false;
    }
  };

  const restart = async () => {
    if (disposed) {
      return {
        ok: false,
        status: "disposed",
        error: null,
      };
    }

    try {
      video.currentTime = 0;
    } catch (error) {
      setStatus("error", error);
      return {
        ok: false,
        status: "error",
        error,
      };
    }
    return play();
  };

  const setMuted = (nextMuted) => {
    if (disposed) return Boolean(video.muted);
    const normalized = Boolean(nextMuted);
    if (video.muted === normalized) return normalized;
    video.muted = normalized;
    video.defaultMuted = normalized;
    notify();
    return normalized;
  };

  const setVolume = (nextVolume) => {
    if (disposed) {
      return clampProjectiveMediaUnitInterval(video.volume, 1);
    }
    const normalized = clampProjectiveMediaUnitInterval(
      nextVolume,
      clampProjectiveMediaUnitInterval(video.volume, 1),
    );
    if (video.volume === normalized) return normalized;
    video.volume = normalized;
    notify();
    return normalized;
  };

  const dispose = () => {
    if (disposed) return false;
    disposed = true;

    releaseConfiguredVideo({ video, domListeners, texture, releaseState });
    status = "disposed";
    lastError = null;
    notify();
    listeners.clear();
    return true;
  };

  return {
    video,
    texture,
    getSnapshot,
    subscribe(listener) {
      if (typeof listener !== "function" || disposed) return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    play,
    pause,
    restart,
    setMuted,
    setVolume,
    dispose,
  };
}

export default createProjectiveMediaSource;
