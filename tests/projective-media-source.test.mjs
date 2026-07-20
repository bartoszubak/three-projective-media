import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { createProjectiveMediaSource } from "../src/index.js";

const TEST_MEDIA_URL = "/media/test-video.mp4";

const createVideoDouble = ({ playError = null, throwOn = null } = {}) => {
  const listeners = new Map();
  const assignments = [];
  let crossOrigin = null;
  let src = "";

  return {
    assignments,
    playCalls: 0,
    pauseCalls: 0,
    loadCalls: 0,
    removeAttributeCalls: 0,
    removedListenerCount: 0,
    playsInline: false,
    preload: "",
    controls: true,
    loop: false,
    muted: false,
    defaultMuted: false,
    volume: 1,
    currentTime: 7.5,
    error: null,

    get crossOrigin() {
      return crossOrigin;
    },
    set crossOrigin(value) {
      assignments.push(["crossOrigin", value]);
      crossOrigin = value;
    },

    get src() {
      return src;
    },
    set src(value) {
      assignments.push(["src", value]);
      src = value;
    },

    setAttribute(name, value) {
      assignments.push([`attribute:${name}`, value]);
    },

    removeAttribute(name) {
      this.removeAttributeCalls += 1;
      assignments.push([`remove:${name}`, null]);
      if (throwOn === "removeAttribute") {
        throw new Error("removeAttribute cleanup failed");
      }
      if (name === "src") src = "";
    },

    addEventListener(type, listener) {
      const bucket = listeners.get(type) || new Set();
      bucket.add(listener);
      listeners.set(type, bucket);
    },

    removeEventListener(type, listener) {
      if (listeners.get(type)?.delete(listener)) {
        this.removedListenerCount += 1;
      }
    },

    listenerCount() {
      return Array.from(listeners.values()).reduce(
        (count, bucket) => count + bucket.size,
        0,
      );
    },

    dispatch(type, event = {}) {
      for (const listener of Array.from(listeners.get(type) || [])) {
        listener({ type, ...event });
      }
    },

    play() {
      this.playCalls += 1;
      return playError ? Promise.reject(playError) : Promise.resolve();
    },

    pause() {
      this.pauseCalls += 1;
      if (throwOn === "pause") throw new Error("pause cleanup failed");
    },

    load() {
      this.loadCalls += 1;
      if (throwOn === "load") throw new Error("load cleanup failed");
    },
  };
};

const assertConstructionCleanup = (video) => {
  assert.equal(video.listenerCount(), 0);
  assert.equal(video.removedListenerCount, 6);
  assert.equal(video.pauseCalls, 1);
  assert.equal(video.removeAttributeCalls, 1);
  assert.equal(video.src, "");
  assert.equal(video.loadCalls, 1);
};

test("media source configures one inline VideoTexture and controls embedded media", async () => {
  const video = createVideoDouble();
  const source = createProjectiveMediaSource({
    url: TEST_MEDIA_URL,
    loop: false,
    muted: true,
    volume: 0.35,
    createVideoElement: () => video,
  });
  let disposeEvents = 0;
  source.texture.addEventListener("dispose", () => {
    disposeEvents += 1;
  });

  const crossOriginIndex = video.assignments.findIndex(
    ([key]) => key === "crossOrigin",
  );
  const srcIndex = video.assignments.findIndex(([key]) => key === "src");
  assert.ok(crossOriginIndex >= 0);
  assert.ok(srcIndex > crossOriginIndex);
  assert.equal(video.crossOrigin, "anonymous");
  assert.equal(video.playsInline, true);
  assert.equal(video.loop, false);
  assert.equal(video.muted, true);
  assert.equal(video.volume, 0.35);
  assert.equal(source.texture.isVideoTexture, true);
  assert.equal(source.texture.image, video);
  assert.equal(source.texture.colorSpace, THREE.SRGBColorSpace);
  assert.equal(source.texture.generateMipmaps, false);
  assert.equal(source.texture.minFilter, THREE.LinearFilter);
  assert.equal(source.texture.magFilter, THREE.LinearFilter);

  const currentTime = video.currentTime;
  assert.equal(source.setMuted(false), false);
  assert.equal(video.currentTime, currentTime);
  assert.equal(source.setVolume(4), 1);
  assert.equal(video.currentTime, currentTime);

  assert.deepEqual(await source.play(), {
    ok: true,
    status: "playing",
    error: null,
  });
  assert.equal(video.playCalls, 1);
  assert.equal(source.pause(), true);
  assert.equal(video.pauseCalls, 1);
  video.currentTime = 19;
  assert.equal((await source.restart()).ok, true);
  assert.equal(video.currentTime, 0);
  assert.equal(video.playCalls, 2);

  assert.equal(source.dispose(), true);
  assert.equal(source.dispose(), false);
  assert.equal(video.pauseCalls, 2);
  assert.equal(video.src, "");
  assert.equal(video.loadCalls, 1);
  assert.equal(video.listenerCount(), 0);
  assert.equal(video.removedListenerCount, 6);
  assert.equal(disposeEvents, 1);
  assert.equal(source.getSnapshot().status, "disposed");
});

test("media source turns autoplay rejection into a controlled result", async () => {
  const rejection = new Error("autoplay denied");
  const video = createVideoDouble({ playError: rejection });
  const source = createProjectiveMediaSource({
    url: TEST_MEDIA_URL,
    createVideoElement: () => video,
  });

  const result = await source.play();
  assert.equal(result.ok, false);
  assert.equal(result.status, "blocked");
  assert.equal(result.error, rejection);
  assert.equal(source.getSnapshot().status, "blocked");
  source.dispose();
});

test("media source publishes readiness and removes all event listeners", () => {
  const video = createVideoDouble();
  const source = createProjectiveMediaSource({
    url: TEST_MEDIA_URL,
    createVideoElement: () => video,
  });
  const statuses = [];
  source.subscribe((snapshot) => statuses.push(snapshot.status));

  video.dispatch("loadeddata");
  video.dispatch("playing");
  video.dispatch("pause");
  assert.deepEqual(statuses, ["ready", "playing", "paused"]);

  source.dispose();
  const countAfterDispose = statuses.length;
  video.dispatch("playing");
  assert.equal(statuses.length, countAfterDispose);
});

test("texture factory failure releases every configured video resource and preserves the error", () => {
  const video = createVideoDouble();
  const constructionError = new Error("texture factory failed");

  assert.throws(
    () =>
      createProjectiveMediaSource({
        url: TEST_MEDIA_URL,
        createVideoElement: () => video,
        createTexture() {
          throw constructionError;
        },
      }),
    (error) => error === constructionError,
  );
  assertConstructionCleanup(video);
});

test("invalid texture result is disposed and fails with a controlled TypeError", () => {
  const video = createVideoDouble();
  let invalidTextureDisposeCalls = 0;

  assert.throws(
    () =>
      createProjectiveMediaSource({
        url: TEST_MEDIA_URL,
        createVideoElement: () => video,
        createTexture: () => ({
          dispose() {
            invalidTextureDisposeCalls += 1;
          },
        }),
      }),
    (error) =>
      error instanceof TypeError &&
      error.message === "The texture factory must return a texture",
  );
  assert.equal(invalidTextureDisposeCalls, 1);
  assertConstructionCleanup(video);
});

for (const failingCleanupStep of ["pause", "removeAttribute", "load"]) {
  test(`source construction cleanup continues when ${failingCleanupStep} throws`, () => {
    const video = createVideoDouble({ throwOn: failingCleanupStep });
    const constructionError = new Error("controlled construction failure");

    assert.throws(
      () =>
        createProjectiveMediaSource({
          url: TEST_MEDIA_URL,
          createVideoElement: () => video,
          createTexture() {
            throw constructionError;
          },
        }),
      (error) => error === constructionError,
    );
    assertConstructionCleanup(video);
  });
}
