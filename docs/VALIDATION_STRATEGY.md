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

The dated progression from integration failures to public contracts is recorded
in the [validation timeline](./VALIDATION_TIMELINE.md).

## Live application-scale reference integration

[Nocturne Garden](https://playzafiro.com/garden-planner/p/nocturne-garden)
is the published Garden Planner reference scene for `three-projective-media`.

It demonstrates the same neutral runtime inside product-owned persistence,
publishing, asset resolution, authored projector controls, receiver policy, and
a read-only public presentation. The scene is not a second package sandbox: it
is evidence that the extracted boundary remains usable inside the larger
application workflow that originally exposed its lifecycle and ownership
requirements.

The standalone Projector Space sandbox remains the smaller portability host and
executable API documentation. A screenshot of the live reference scene is
included in the main repository README.

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

## Failure-to-contract evidence

| Failure class | Public API consequence | Public evidence |
|---|---|---|
| texture construction failure | transactional source cleanup | [source tests](../tests/projective-media-source.test.mjs) |
| partial projector creation | ownership-aware rollback | [projector tests](../tests/projective-media-projector.test.mjs) |
| receiver rebuild | refresh and detach without media replacement | [receiver tests](../tests/projective-media-receivers.test.mjs) |
| overlapping roots | identity deduplication | [receiver tests](../tests/projective-media-receivers.test.mjs) |
| throwing teardown callback | best-effort, idempotent disposal | [projector tests](../tests/projective-media-projector.test.mjs) |
| pose changes | stable media source, texture, and timeline | [receiver tests](../tests/projective-media-receivers.test.mjs) and [projector tests](../tests/projective-media-projector.test.mjs) |

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

## Why the standalone sandbox follows application-scale validation

The standalone sandbox is a second, deliberately small host. It imports the
`three-projective-media` package root rather than internal source modules, so it
exercises the same public `exports` contract available to other consumers. It
also makes the projection model and dynamic receiver lifecycle easier to
inspect visually without importing Garden Planner code.

Its role is portability evidence, documentation, and experimentation—not the
primary environment for discovering ownership and lifecycle requirements. The
reference integration remains useful for application-scale regression while
the sandbox stays intentionally small.
