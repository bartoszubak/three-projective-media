# Validation strategy

## Integration-driven boundary discovery

A minimal shader sandbox can verify projector-space coordinate mapping and
fragment rejection. It cannot establish whether the surrounding runtime owns
resources correctly when receivers, media, editor state, and application
lifecycle change independently.

The first integration therefore used Garden Planner, a mature Three.js editor,
as a validation host. Garden Planner was used as a validation host, not as the
architectural boundary of the library. This application-scale validation made
the reusable boundary observable under real application constraints before the
package was extracted.

## Failure classes exercised by the reference integration

The reference integration exercised behavior that a static scene would not:

- receiver objects are created asynchronously, rebuilt, detached, and removed;
- overlapping receiver roots and explicit meshes must not duplicate overlays;
- pose, FOV, receiver refresh, and renderer rebuild must preserve one media
  element, `VideoTexture`, audio state, and playback time;
- replacing a media asset must replace the media session without corrupting the
  authored projector pose or receiver policy;
- video autoplay may be allowed, blocked, retried, muted, or paused as receiver
  availability changes;
- construction can fail after only some resources have been acquired;
- normal teardown must be idempotent and continue after individual host or
  resource callbacks throw;
- editor camera, pointer, keyboard, selection, and projector authoring flows can
  compete for the same interaction surface;
- authored data must survive autosave, project save/load, publishing, and a
  muted public read-only runtime without leaking editor presentation.

These cases shaped explicit receiver registration, diff-based refresh,
resource-ownership options, isolated subscribers, controlled media status,
transactional construction, best-effort disposal, and the separation between
projector pose and receiver selection.

## Responsibilities that remain with Garden Planner

The reference host continues to own:

- world-unit and product-coordinate conversion;
- canonical authored records, persistence, dirty signatures, save/load, and
  publishing;
- public asset keys, media catalog configuration, and URL resolution;
- building and placeable receiver policy and renderer lifecycle adaptation;
- projector markers, selection, commands, inspectors, drag handles, and other
  editor UI;
- autoplay timing based on product-level receiver readiness;
- public-read presentation and product error reporting.

None of those concepts belong in the neutral dependency graph.

## Responsibilities extracted into the package

The package owns only reusable Three.js and browser-media mechanics:

- an inline video element and `VideoTexture` source;
- the projective shader material and projector camera;
- world-space camera pose and camera parameters;
- explicit receiver meshes and bounded receiver-root traversal;
- receiver filtering, identity deduplication, diff-based refresh, and subtree
  detach;
- overlay creation and broad-phase projector-frustum visibility;
- playback controls, status subscriptions, transactional construction, and
  idempotent best-effort disposal.

The package imports only `three` and its own sibling modules. It has no product
domain, UI framework, router, persistence, localization, store, or asset
resolver dependency.

## Why a standalone sandbox comes later

A standalone sandbox is still valuable. It will demonstrate that a second,
small host can integrate the public entrypoint without Garden Planner code and
will make the projection model easier to inspect visually.

Its role is portability evidence, documentation, and experimentation—not the
primary environment for discovering ownership and lifecycle requirements. The
reference integration remains useful for application-scale regression while
the sandbox stays intentionally small.
