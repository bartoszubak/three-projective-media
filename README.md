# three-projective-media

`three-projective-media` is a host-neutral Three.js package for projecting an
HTML video texture directly onto existing mesh geometry in projector space.

## Consumption and public API

The package exports source, material, projector, and projection-math helpers
from `src/index.js`, which is also the package root export. In-repository hosts
consume that source entry through a relative path. Linked or installed
consumers can import `three-projective-media`; the other files under `src/`
remain implementation details.

The projector factory accepts a target `Object3D` and discovers supported
meshes below it. It owns the video source, overlay meshes, shader material,
projector camera, and their lifecycle. Calling `setTarget()` refreshes overlays
without taking ownership of target geometry or materials.

The current source-consumption model deliberately has no package build,
workspace configuration, lockfile, or publish step. The package is intended to
move to a separate repository after this in-repository boundary has stabilized.

## Projection model

The shader maps each rendered world position through the projector camera's
view-projection matrix. Fragments outside the projected UV rectangle or camera
depth range are rejected. Surface-facing rejection keeps the image off
back-facing geometry, while edge feather softens the remaining projector
boundary. The material supports `alpha` and `additive` blending, participates
in Three.js tone mapping, keeps `depthTest` enabled and `depthWrite` disabled,
and uses polygon offset to avoid z-fighting with its source surface.

Overlay meshes share the source meshes' `BufferGeometry`; the package never
mutates source materials, patches them with `onBeforeCompile`, or disposes
source geometry. The overlays are owned by the projector and are detached
before a target is replaced or released.

## Media source and browser autoplay

`createProjectiveMediaSource` owns one inline `HTMLVideoElement` and one
`VideoTexture`. Audio stays embedded in that video element. The source exposes
play, pause, mute, volume, status and disposal controls. Muted autoplay is the
portable default; a rejected `play()` becomes a controlled status result so a
host can retry from a user gesture. Rebinding a target does not recreate the
video, texture, or playback position.

## Dependency boundary

The implementation depends only on `three` and browser media primitives. It
does not import application stores, persistence, UI, routing, localization, or
product-specific modules. It has no dependency on this repository's
application or on any host product. Hosts provide target meshes and media URLs
through public factory options.

## Lifecycle

Call `update()` from the host render loop. Use `setTarget(null)` before target
geometry is destroyed and `setTarget(nextObject)` after replacement; this
preserves the media source. Call `dispose()` when the projector is no longer
needed. Disposal is idempotent and releases owned textures, materials, overlay
meshes, listeners, camera and media resources.

## Version 0.1 limits

This version supports projective video overlays with alpha or additive
blending. It does not provide authoring UI, persistence, asset resolution,
cross-origin policy, host-specific target discovery, projector depth maps,
occlusion, keystone correction, edge blending between multiple projectors,
post-processing, or spatial audio.
