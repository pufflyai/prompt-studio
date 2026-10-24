---
name: patch-release
description: Prepare, verify, or publish a patch of Prompt Studio's current stable release without releasing unrelated changes on main. Use for stable hotfixes, not normal version PRs, nightlies, or older release lines.
---

# Patch the current stable release

Use `.github/workflows/release-packages.yml` on `main` with `channel=patch`.
The workflow keeps the main signing identity and builds the selected fix commit.
Loading this skill authorizes no publication. Publish only when the user has asked
for that release; existing explicit authorization remains valid.

## Prepare the fixes

1. Read `AGENTS.md` and `documentation/requirements/platform/0005-versioning-and-releases.md`.
2. Read the current stable tag with `gh release view --json tagName --jq .tagName`.
   Only that exact release can be patched. Check for an unfinished candidate at
   the next patch tag before preparing another one.
3. Fix the bug on `main` through a normal reviewed PR. Create a `bugfix/` branch
   from the current stable tag and cherry-pick only the fixes. If a fix depends on
   unreleased features, adapt the fix to the stable code rather than bringing
   those features into the patch. Keep the fix on main too.
4. Keep all fixed-group package versions unchanged on the fix branch. Contributor
   changesets are optional: the workflow generates a patch changeset and replaces
   pending changeset files only in its generated version commit. Review the full
   source diff from the stable tag, run the affected checks, and push the branch.
5. Record the full 40-character fix commit SHA. Keep normal version PRs unmerged
   while preparing and running the patch, until the workflow refreshes them.

## Verify

Run on `main`, using the reviewed fix SHA, the current stable tag and an actual
one-line description of the fix:

```sh
gh workflow run release-packages.yml --ref main \
  -f channel=patch \
  -f base_tag=pstdio@0.43.1 \
  -f source_sha=<full-fix-commit-sha> \
  -f summary='Fix startup on Windows.' \
  -f publish_patch=false
```

Watch that specific run and inspect every applicable check. Verification reserves
an immutable `pstdio@<next-patch>` tag and signs the candidate, but publishes no
npm packages, service images, or GitHub release. The Windows upgrade baseline is
the selected current stable release. Confirm the version PR refresh passed too.

## Publish

When publication is authorized, dispatch again with the same base tag and fix SHA,
and `publish_patch=true`. The workflow reuses the reserved candidate and verifies
it again before publishing. The summary in the existing candidate stays unchanged.
If the current stable release advanced, prepare fixes from the new stable tag.

Wait until every applicable check passes. Confirm the GitHub release has the CLI
and desktop assets, npm `latest` points to the patch, and the main version PR has
been refreshed. Verify a desktop upgrade from the previous stable release.
Never publish packages by hand or run only the desktop release workflow.

## Recover

- A failed verification can be retried with the same inputs.
- A partial publication must resume from the same immutable candidate. Use
  **Re-run failed jobs** or dispatch the same patch inputs with publication enabled.
- A tag reserved by another source commit is rejected. Do not move it or mix
  artifacts. If fixes must change before publication, first confirm that none of
  the version reached npm or a published GitHub release, then obtain authorization
  to abandon the unused candidate tag. Once publishing started, finish that
  candidate or prepare a later release.
- After publication, remove only changesets for the fixes already shipped from
  main through a reviewed PR. Keep unrelated changesets. Do not merge the patch's
  package manifests over main. The version command automatically skips shipped
  and reserved patch versions while retaining main's source and dependencies.
