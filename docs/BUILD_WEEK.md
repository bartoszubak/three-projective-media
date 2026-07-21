# OpenAI Build Week development notes

## Project

- Project: **Projector Space**
- Package: `three-projective-media`
- Track: **Developer Tools**
- Goal: a host-neutral projective-media runtime for Three.js.

## How Codex was used

Codex supported the implementation process through static repository audits,
implementation of the neutral package and host adapters, test generation, and
hardening of construction and teardown failure paths. It was also used to run
browser smoke checks, analyze lifecycle and resource ownership, clean up the
extraction boundary, perform the history-preserving subtree extraction, and
verify the public manifest and package artifact.

For this public-validation checkpoint, Codex also supported implementation and
verification of the standalone sandbox and preparation of CI and GitHub Pages
workflows. Its outputs remained subject to acceptance criteria, automated
checks, browser validation, and human review; Codex did not independently make
the product decisions described below.

## How GPT-5.6 was used

GPT-5.6 supported architecture and boundary analysis, failure-mode review, and
evaluation of Codex outputs. It helped formulate acceptance criteria, identify
that an unreleased legacy model should be removed rather than preserved, and
separate projector pose from receiver policy. It also supported review of
resource ownership and disposal, checkpoint planning, and communication of the
validation-host methodology.

GPT-5.6 is a development and review tool for this project, not a runtime
dependency of `three-projective-media`.

## Human decisions and review

The human author made and reviewed the product and architecture decisions,
including:

- beginning in a demanding application host instead of an isolated sandbox;
- rejecting a separate showcase route that could diverge from the real runtime;
- using immediate muted playback rather than a required **Start Experience**
  step;
- treating audio as part of the media source;
- choosing free world-space pose over building-face placement;
- treating registered receivers as peers rather than assigning a primary one;
- removing a persistent building target from the projector model;
- keeping markers and authoring gizmos host-owned;
- removing unreleased compatibility APIs;
- keeping the video catalog product-owned;
- using a three-stage extraction plan;
- manually reviewing the visual result of each iteration.

## Evidence

- [Validation strategy](./VALIDATION_STRATEGY.md)
- [Validation timeline](./VALIDATION_TIMELINE.md)
- [Extraction provenance](./EXTRACTION_PROVENANCE.md)
- [Package-owned tests](../tests/)
- [Standalone sandbox source](../examples/basic/)
- [Nocturne Garden — live Garden Planner reference integration](https://playzafiro.com/garden-planner/p/nocturne-garden)
- [Nocturne Garden reference screenshot](./media/nocturne-garden-reference.webp)

## Submission checklist

- [ ] Run `/feedback` in the primary Codex implementation thread.
- [ ] Retain the returned Session ID for the Devpost form.
- [ ] Explain Codex usage in the narrated demo.
- [ ] Explain GPT-5.6 usage in the narrated demo.
- [ ] Keep the public YouTube demo under three minutes.
- [ ] Keep the public repository and sandbox accessible throughout judging.
