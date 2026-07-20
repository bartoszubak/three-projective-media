# three-projective-media

`three-projective-media` is a host-neutral Three.js package for projecting one
HTML video texture onto host-selected mesh geometry in projector space.

## Consumption and ownership

The public source entry is `src/index.js`, also exposed as the package root.
Repository hosts currently consume that source directly. There is deliberately
no workspace, package build, lockfile, publish step, external repository, or
standalone sandbox yet.

The package depends only on `three`, its own modules, and browser media
primitives. It does not import application or product modules, React, routing,
persistence, localization, asset resolution, or stores. Hosts own media URL
resolution, authored records, receiver policy, UI, and lifecycle coordination.

Package-owned tests are colocated under `tests/` and consume only the public
source entry. Run them either from this directory or through the repository
verification command:

```bash
npm test
npm run verify:projective-media
```

## Public API

The package root exports:

- `createProjectiveMediaSource()` for one owned video element and
  `VideoTexture`;
- `createProjectiveMediaMaterial()` plus the shader and blend-mode constants;
- `createProjectiveMediaProjector()` for camera pose, appearance, receiver
  bindings, playback, status, updates, and disposal;
- `projectWorldPositionToProjectiveMedia()`,
  `resolveProjectiveMediaEdgeFactor()`, and
  `updateProjectiveMediaCamera()` as projector-space math helpers.

The projector receiver surface is `setReceiverRoots`, `getReceiverRoots`,
`addReceiverRoot`, `removeReceiverRoot`, `clearReceiverRoots`, `setReceivers`,
`addReceiver`, `removeReceiver`, `clearReceivers`, `refreshReceivers`,
`detachReceiverObject`, `getReceiverMeshes`, and `getOverlayMeshes`. Projector
pose is supplied only through constructor projector parameters and `setPose()`;
its `target` value is a look-at coordinate, not a receiver object.

## Aim and receivers

Projector pose is independent from receiver selection. `setPose()` controls the
camera position and look-at target; `setProjectorParameters()` controls FOV,
aspect, near, and far without changing media or receivers.

Receivers are opt-in:

- `setReceiverRoots(roots, { receiverFilter })` traverses only the supplied
  `Object3D` roots;
- `addReceiverRoot`, `removeReceiverRoot`, and `clearReceiverRoots` mutate root
  configuration;
- `setReceivers`, `addReceiver`, `removeReceiver`, and `clearReceivers` manage
  explicit meshes;
- `refreshReceivers()` diffs current descendants;
- `detachReceiverObject(object)` detaches bindings in one subtree without
  removing configured roots;
- `getReceiverRoots`, `getReceiverMeshes`, and `getOverlayMeshes` expose
  read-only collection copies.

Overlapping roots and explicit receivers are deduplicated by source mesh
identity, so a mesh has at most one overlay per projector. Refresh preserves
valid bindings and the same media element, `VideoTexture`, audio state,
playback position, fade state, camera pose, and FOV.

The optional filter receives `{ object, root, material }` before overlay
creation. A filter exception is isolated and rejects that candidate. The
package never scans a global scene, observes mutations, or traverses roots in
`update()`. Hosts explicitly refresh after their runtime objects change.

## Projection and culling

The shader maps world positions through the projector camera view-projection
matrix. It rejects fragments outside projected UV/depth bounds and back-facing
geometry, supports edge feather plus alpha/additive blending, uses depth test
without depth writes, and applies polygon offset.

`update()` builds a projector frustum and tests only existing receiver
bindings. A valid source `boundingSphere` is copied and transformed to world
space; overlays outside the frustum are hidden. Missing spheres use a safe
visible fallback and are not computed or written by the package. This
broad-phase reduces draw calls; it is not occlusion or a projector depth map.

Supported receivers are ordinary `Mesh` objects with `BufferGeometry` and a
position attribute. `SkinnedMesh`, `InstancedMesh`, invalid geometry, and
projective overlay meshes are skipped. Source geometry and materials remain
host-owned and are never disposed.

There is no occlusion, depth map, keystone correction, multi-projector edge
blending, volumetric beam, post-processing, or visible frustum helper by
default.

## Media and lifecycle

`createProjectiveMediaSource` owns one inline `HTMLVideoElement` and one
`VideoTexture`; audio remains embedded in the video. Muted autoplay is the
portable default, and rejected playback becomes a controlled status result.

Construction is transactional. If media-texture creation fails or returns an
invalid texture, source creation removes installed DOM listeners, pauses and
clears the video, reloads it, and disposes any partial texture before
rethrowing the original error. If projector construction fails after acquiring
a source, it detaches partial overlays and camera ownership, disposes its
partial shader material, and disposes the source only when the projector owns
that source.

Call `update()` from the host render loop, refresh receivers only after
host-owned lifecycle changes, and call `dispose()` at teardown. Disposal is
idempotent: it removes overlays/listeners and releases the owned shader,
texture, camera, and media resources without disposing source geometry or
materials. Runtime disposal is best-effort across individual cleanup callbacks:
a failing host unsubscribe or owned media-source disposal does not prevent the
projector from entering its final disposed state or releasing the remaining
owned resources. Subscriber failures are isolated from state changes and
teardown.

## Extraction readiness

The package is source-consumable and self-contained around its manifest,
README, public `src/index.js` surface, source modules, and colocated tests. Its
tests resolve paths from `import.meta.url`, import the package only through the
public entry, and require no repository-level product fixtures. The package
remains private and intentionally has no nested lockfile, workspace wiring,
build output, publish automation, or standalone sandbox; those are deferred to
the external-repository extraction step.
