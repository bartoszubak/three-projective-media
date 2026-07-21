# Validation timeline

This timeline documents the application-scale validation that preceded the
standalone extraction. It does not reproduce private source code, patches, or
product data. Instead, it records the relationship that shaped the public
library:

```text
validation environment
→ failure exposed
→ architectural consequence
→ public evidence
```

## July 18, 2026 — first application integration

### Validation environment

- a mature Three.js scene with an existing building renderer and camera;
- runtime-resolved public assets;
- HTML video with embedded audio;
- an application lifecycle spanning editor and presentation modes.

### Problems exposed

- A visually working shader was not enough to define an integration contract.
- A separate showcase route could drift away from the real runtime lifecycle.
- Ownership of the video element, `VideoTexture`, material, and overlays had to
  be explicit.
- Autoplay and audio needed controlled state transitions and failure handling.
- Editor-only presentation could not leak into walk or public experiences.

### Architectural consequences

- a neutral media source and shader material;
- host-resolved media URLs;
- explicit resource ownership;
- no product UI or asset semantics in the package.

### Public evidence

- [media-source tests](../tests/projective-media-source.test.mjs);
- [material and projection-math tests](../tests/projective-media-material-math.test.mjs);
- [projector tests](../tests/projective-media-projector.test.mjs).

## July 19, 2026 — dynamic receivers and persistent authored state

### Validation environment

- buildings and scene objects created, rebuilt, and removed at runtime;
- project save and load;
- publishing and a read-only public runtime.

### Problems exposed

- A single receiver target was too restrictive.
- A renderer rebuild changed receiver object identity.
- Pose changes and receiver refreshes could not restart the media session.
- Selecting unrelated media required a new session rather than timeline reuse.
- Public autoplay policy had to remain separate from authored state.

### Architectural consequences

- receiver roots and explicit receiver meshes;
- identity-based deduplication;
- diff-based `refreshReceivers()`;
- subtree-level `detachReceiverObject()`;
- projector pose independent from receiver policy;
- host-owned media-session replacement.

### Public evidence

- [receiver lifecycle tests](../tests/projective-media-receivers.test.mjs);
- [projector lifecycle tests](../tests/projective-media-projector.test.mjs).

## July 20, 2026 — free world-space authoring

### Validation environment

- a scene editor with selection, pointer, and keyboard interaction;
- camera controls and a walk mode;
- persistence and a separate public presentation.

### Problems exposed

- Building-face placement constrained the projector unnaturally.
- A receiver could not also be the source of truth for projector pose.
- Pointer and keyboard authoring could compete with camera input.
- Persistent helpers could interfere with the intended scene experience.
- Gizmos and authoring UI were host concerns, not neutral runtime behavior.

### Architectural consequences

- world-space projector position and look-at target;
- pose independent from receiver registration;
- no building, facade, or compass semantics in the package;
- host-owned markers, handles, selection, and interaction policy;
- a neutral `setPose()` contract.

### Public evidence

- the [public export surface](../src/index.js);
- the [validation strategy](./VALIDATION_STRATEGY.md);
- [receiver tests](../tests/projective-media-receivers.test.mjs) and
  [projector tests](../tests/projective-media-projector.test.mjs) covering
  pose and media continuity.

## July 21, 2026 — extraction hardening

### Validation environment

- the package reviewed as a future external dependency with its own artifact
  and lifecycle boundary.

### Problems exposed

- Unreleased compatibility APIs weakened the receiver contract.
- Some neutral tests still lived on the product side of the boundary.
- Failed construction could leak partially acquired resources.
- A single throwing teardown callback could interrupt disposal.
- A public package required deterministic artifact contents.

### Architectural consequences

- one receiver API model;
- a package-owned test suite;
- transactional construction rollback;
- idempotent, best-effort disposal;
- a public manifest and `npm pack --dry-run` verification;
- history-preserving extraction with `git subtree split`.

### Public evidence

- [media-source tests](../tests/projective-media-source.test.mjs),
  [projector tests](../tests/projective-media-projector.test.mjs), and
  [receiver tests](../tests/projective-media-receivers.test.mjs);
- [extraction provenance](./EXTRACTION_PROVENANCE.md);
- the package manifest and dry-run artifact verification.

## Outcome

Garden Planner was used as a validation host, not as the architectural boundary
of the library.

The standalone sandbox added after extraction proves that the public boundary
can be consumed by a second, small host and provides focused API documentation.
It is portability evidence, not a synthetic substitute for the application
environment in which the ownership, lifecycle, and interaction requirements
were discovered.
