# Release checklist

## Review and commits

- [ ] Review the unstaged Nocturne Garden documentation and English reference
      screenshot.
- [ ] Commit the Nocturne Garden reference documentation after review.
- [x] Commit the validation timeline and strategy updates.
- [x] Commit the standalone sandbox and procedural demo media.
- [x] Commit CI and GitHub Pages workflows.
- [x] Commit the Build Week and release-readiness documentation.
- [x] Push `main` after reviewing the initial commit groups.
- [x] Review and commit the multi-video sandbox showcase.
- [x] Push the reviewed multi-video sandbox commit to `main`.

## Hosted validation

- [x] Configure GitHub Pages to use GitHub Actions.
- [x] Confirm the initial GitHub Pages deployment succeeds.
- [x] Replace expected-URL wording with the confirmed live URL.
- [x] Confirm the published [Nocturne Garden](https://playzafiro.com/garden-planner/p/nocturne-garden)
      reference integration opens successfully and displays projective media.
- [x] Capture and review the Nocturne Garden reference screenshot used in the
      public README.
- [x] Confirm CI is green for the multi-video sandbox commit.
- [x] Confirm GitHub Pages deploys the multi-video sandbox commit.
- [x] Run the complete browser smoke against the updated live sandbox.
- [x] Switch through all four sandbox videos and confirm each request succeeds
      without an application 404.
- [x] Confirm exactly one media element remains active after every switch.
- [x] Confirm selecting the current video is a no-op and selecting another
      video creates a new media session.
- [x] Confirm projector pose and receiver registration survive every switch.

## Submission and release

- [ ] Run `/feedback` in the primary Codex implementation thread.
- [ ] Retain the returned Session ID and add it to the Devpost form.
- [ ] Prepare a narrated public YouTube demo shorter than three minutes.
- [ ] Resolve the existing `v0.1.0` tag, which does not point to the current
      reviewed `main`, before release finalization.
- [ ] Publish to npm only after a separate explicit distribution approval.
- [x] Pin Garden Planner to the reviewed external package commit.
- [x] Remove the internal package copy and verify the external dependency
      guard.
- [x] Validate the external-package integration in the published Nocturne
      Garden scene.
