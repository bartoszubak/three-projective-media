# Release checklist

## Review and commits

- [ ] Review all unstaged changes.
- [ ] Commit the validation timeline and strategy updates.
- [ ] Commit the standalone sandbox and procedural demo media.
- [ ] Commit CI and GitHub Pages workflows.
- [ ] Commit the Build Week and release-readiness documentation.
- [ ] Push `main` after reviewing the commit groups.

## Hosted validation

- [ ] Confirm CI is green.
- [ ] In GitHub, select **Settings → Pages → Build and deployment → Source: GitHub Actions**.
- [ ] Confirm the GitHub Pages deployment succeeds.
- [ ] Run the complete browser smoke against the live sandbox.
- [ ] Replace expected-URL wording with the confirmed live URL.

## Submission and release

- [ ] Run `/feedback` in the primary Codex implementation thread.
- [ ] Retain the returned Session ID and add it to the Devpost form.
- [ ] Prepare a narrated public YouTube demo shorter than three minutes.
- [ ] Create tag `v0.1.0` only after CI and Pages are green.
- [ ] Do not publish to npm unless that distribution step is explicitly
      approved.
- [ ] Perform the Garden Planner dependency cutover only after verifying the
      external release.
