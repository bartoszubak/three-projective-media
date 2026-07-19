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
source entry:

```bash
node --test \
  packages/projective-media/tests/projective-media-package.test.mjs \
  packages/projective-media/tests/projective-media-receivers.test.mjs
```

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

`target`, `setTarget()`, and `getTarget()` remain compatibility APIs.
`setTarget(object)` replaces receiver roots with one compatibility root;
`setTarget(null)` clears that mode. `getTarget()` returns a root only while
single-target compatibility mode is active. New integrations should use the
receiver APIs.

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

Call `update()` from the host render loop, refresh receivers only after
host-owned lifecycle changes, and call `dispose()` at teardown. Disposal is
idempotent: it removes overlays/listeners and releases the owned shader,
texture, camera, and media resources without disposing source geometry or
materials. Subscriber failures are isolated from state changes and teardown.
