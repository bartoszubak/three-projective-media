import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import {
  PROJECTIVE_MEDIA_FRAGMENT_SHADER,
  PROJECTIVE_MEDIA_VERTEX_SHADER,
  createProjectiveMediaMaterial,
  projectWorldPositionToProjectiveMedia,
  resolveProjectiveMediaEdgeFactor,
} from "../src/index.js";

test("projective shader and material encode the projection pipeline", () => {
  const texture = new THREE.Texture();
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  const material = createProjectiveMediaMaterial({
    texture,
    camera,
    opacity: 0.7,
    edgeFeather: 0.2,
    blendMode: "additive",
  });

  assert.match(PROJECTIVE_MEDIA_VERTEX_SHADER, /modelMatrix/);
  assert.match(PROJECTIVE_MEDIA_VERTEX_SHADER, /projectorViewMatrix/);
  assert.match(PROJECTIVE_MEDIA_VERTEX_SHADER, /projectorProjectionMatrix/);
  assert.match(PROJECTIVE_MEDIA_FRAGMENT_SHADER, /projectorNdc/);
  assert.match(PROJECTIVE_MEDIA_FRAGMENT_SHADER, /projectiveUv/);
  assert.match(PROJECTIVE_MEDIA_FRAGMENT_SHADER, /texture2D/);
  assert.match(PROJECTIVE_MEDIA_FRAGMENT_SHADER, /surfaceFacing/);
  assert.match(PROJECTIVE_MEDIA_FRAGMENT_SHADER, /discard/);
  assert.match(PROJECTIVE_MEDIA_FRAGMENT_SHADER, /sRGBTransferEOTF/);
  assert.doesNotMatch(
    PROJECTIVE_MEDIA_FRAGMENT_SHADER,
    /#include\s+<colorspace_pars_fragment>/,
  );
  assert.match(PROJECTIVE_MEDIA_FRAGMENT_SHADER, /tonemapping_fragment/);
  assert.match(PROJECTIVE_MEDIA_FRAGMENT_SHADER, /colorspace_fragment/);
  assert.equal(material.depthTest, true);
  assert.equal(material.depthWrite, false);
  assert.equal(material.transparent, true);
  assert.equal(material.polygonOffset, true);
  assert.ok(material.polygonOffsetFactor < 0);
  assert.equal(material.blending, THREE.AdditiveBlending);
  assert.equal(material.uniforms.mediaTexture.value, texture);
  assert.equal(material.uniforms.opacity.value, 0.7);
  assert.equal(material.uniforms.edgeFeather.value, 0.2);

  const alphaMaterial = createProjectiveMediaMaterial({
    texture,
    camera,
    blendMode: "alpha",
  });
  assert.equal(alphaMaterial.blending, THREE.NormalBlending);
  assert.equal(alphaMaterial.userData.projectiveMediaBlendMode, "alpha");

  alphaMaterial.dispose();
  material.dispose();
  texture.dispose();
});

test("projective math resolves center, bounds, depth, and edge feather", () => {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 10);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);
  camera.updateMatrixWorld(true);

  const center = projectWorldPositionToProjectiveMedia(
    new THREE.Vector3(0, 0, -2),
    camera,
  );
  assert.equal(center.visible, true);
  assert.ok(Math.abs(center.uv.x - 0.5) < 1e-8);
  assert.ok(Math.abs(center.uv.y - 0.5) < 1e-8);

  assert.equal(
    projectWorldPositionToProjectiveMedia(new THREE.Vector3(0, 0, 2), camera)
      .visible,
    false,
  );
  assert.equal(
    projectWorldPositionToProjectiveMedia(new THREE.Vector3(20, 0, -2), camera)
      .visible,
    false,
  );
  assert.equal(
    projectWorldPositionToProjectiveMedia(new THREE.Vector3(0, 0, -20), camera)
      .visible,
    false,
  );
  assert.equal(
    resolveProjectiveMediaEdgeFactor(new THREE.Vector2(0, 0.5), 0.2),
    0,
  );
  assert.equal(
    resolveProjectiveMediaEdgeFactor(new THREE.Vector2(0.5, 0.5), 0.2),
    1,
  );
  assert.equal(
    resolveProjectiveMediaEdgeFactor(new THREE.Vector2(2, 0.5), 0.2),
    0,
  );
});
