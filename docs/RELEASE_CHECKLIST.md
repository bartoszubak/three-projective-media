# Release checklist

## Review and commits

- [ ] Review all unstaged changes.
- [x] Commit the validation timeline and strategy updates.
- [x] Commit the standalone sandbox and procedural demo media.
- [x] Commit CI and GitHub Pages workflows.
- [x] Commit the Build Week and release-readiness documentation.
- [x] Push `main` after reviewing the initial commit groups.
- [ ] Review and commit the multi-video sandbox showcase.
- [ ] Push the reviewed multi-video sandbox commit to `main`.

## Hosted validation

- [x] Configure GitHub Pages to use GitHub Actions.
- [x] Confirm the initial GitHub Pages deployment succeeds.
- [x] Replace expected-URL wording with the confirmed live URL.
- [ ] Confirm CI is green for the multi-video sandbox commit.
- [ ] Confirm GitHub Pages deploys the multi-video sandbox commit.
- [ ] Run the complete browser smoke against the updated live sandbox.
- [ ] Switch through all four sandbox videos and confirm each request succeeds
      without a 404.
- [ ] Confirm exactly one media element remains active after every switch.
- [ ] Confirm selecting the current video is a no-op and selecting another
      video creates a new media session.
- [ ] Confirm projector pose and receiver registration survive every switch.

## Submission and release

- [ ] Run `/feedback` in the primary Codex implementation thread.
- [ ] Retain the returned Session ID and add it to the Devpost form.
- [ ] Prepare a narrated public YouTube demo shorter than three minutes.
- [ ] Create tag `v0.1.0` only after CI and Pages are green.
- [ ] Do not publish to npm unless that distribution step is explicitly
      approved.
- [ ] Perform the Garden Planner dependency cutover only after verifying the
      external release.
