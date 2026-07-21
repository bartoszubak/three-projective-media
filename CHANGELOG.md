# Changelog

## 0.1.0 — Unreleased

### Added

- Source-ESM projective video runtime for Three.js.
- Explicit receiver meshes and filtered receiver roots with identity
  deduplication, refresh, and subtree detach.
- Projector-space mapping, broad-phase frustum visibility, media controls, and
  status diagnostics.
- Transactional construction rollback and idempotent, best-effort disposal.
- Package-owned public tests and deterministic package-artifact verification.
- Standalone laboratory sandbox with procedural demo media and a dynamic
  receiver lifecycle.
- Public validation timeline, extraction provenance, Build Week notes, CI, and
  GitHub Pages deployment preparation.

### Changed

- Extracted the neutral package from its validation host with path-scoped Git
  history preserved by `git subtree split`.
- Separated world-space projector pose from receiver registration and host-owned
  authoring semantics.
- Prepared the manifest and repository for a public pre-release while retaining
  the existing public source entrypoint.

### Validated

- Resource ownership, construction failure, and teardown failure paths.
- Dynamic receiver creation, rebuild, detach, deduplication, and culling.
- Stable media source, `VideoTexture`, audio state, and playback timeline across
  pose and receiver lifecycle changes.
- Public-root consumption in a second, standalone host.
- Node 24.18.0, npm 11.16.0, Three.js 0.185.x, and current Chrome on macOS.

### Known limitations

- Pre-release: no npm publication or stability guarantee yet.
- No projector depth map, scene occlusion, keystone correction, volumetric
  beam, or multi-projector edge blending.
- No `SkinnedMesh` or `InstancedMesh` receivers and no alpha-card mask
  inheritance.
- No media catalog, upload UI, authoring gizmos, or global scene discovery in
  the neutral package.
- GitHub Pages remains inactive until the workflow is committed, pushed, and
  selected as the repository's Pages source.
