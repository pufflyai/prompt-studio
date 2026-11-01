---
status: "accepted"
created: "2026-03-10T20:12:05Z"
---

# PRD: Versioning and releases

Prompt Studio's host, SDK, UI, workbench, and desktop share one Changesets fixed version group in `.changeset/config.json`. Core extensions have independent versions and published SDK/UI ranges. Stable hosts switch from host-tag installs to PSX only after deployment qualification. See the [extension release decision](../../adrs/0106-independent-core-extension-delivery.md).

## Contributor flow

1. Run `bun changeset`. Select the packages changed, choose a bump and write a one-line summary. Follow the [changeset package rules](../../guidance/0007-contributing.md#5-changesets).
2. Commit the changeset with the change. The selected package decides where the summary appears in release notes.
3. Merge into `main`. CI opens or updates the Version Packages PR. The highest pending bump sets the next version for every member of the group.
4. Review and merge that PR. All group members should have the same version. Extension SDK and UI dependency ranges must remain unchanged unless an extension PR explicitly updates them.

Do not edit versions by hand. Add new released workspace packages to the fixed group, or list private helpers in `ignore`. `validate:changesets` enforces membership and requires repo-local `.pstdio` workspaces to be ignored. Third-party extensions keep their own versions and refs.

## Release pipeline

`.github/workflows/release-packages.yml` releases stable versions and nightlies with the same jobs, using Bun from the root `packageManager` field and Node 24. It builds and verifies every artifact from one commit, then publishes npm packages and desktop apps together. Nothing is published until every check passed. See [ADR 0072](../../adrs/0072-gate-merges-on-builds-and-publish-releases-all-or-nothing.md).

1. **plan.** A stable release is pending while the GitHub release `pstdio@<version>` is missing or still a draft. `scripts/release/plan-release.ts` decides this and fails early when a public package was never published, because npm trusted publishing cannot create a package. It then places the tag `pstdio@<version>` on the commit to release. Packaged apps include catalog extension sources from that checkout and record their source commit. A nightly instead versions, commits and tags `main` as described below.
2. **Verify.** Every job builds from the planned commit:
   - `verify-packaged-toolchain.yml` checks the compiled CLI on native Linux, Intel macOS and Windows.
   - `harness-cli-support.yml` checks the native harnesses against the minimum and latest supported CLI versions.
   - `release-desktop.yml` builds, signs, notarizes and tests every desktop target and uploads the artifacts. It publishes nothing.
   - `verify-windows-update.yml` (stable only) downloads the signed Windows baseline from the newest published release, installs those shipped files, applies the Squirrel update to the signed candidate, and checks installed signatures, launch behavior and project-data preservation.
3. **publish.** Runs only when every verify job passed and the tag still points at the planned commit. It runs the `build-release` action (build, compile, verify packaged output, checksums), checks the complete desktop release set and its checksums, runs `npm publish --dry-run` for every package npm does not have yet, publishes the `@pstdio/cli-*` platform packages, runs `changeset publish --no-git-tag`, creates the draft GitHub release with CLI assets, attaches the desktop assets and publishes the release.
4. **version_pr.** Every push to `main` runs `changesets/action` with only its version command, which opens or updates the version PR. It never publishes.

npm receives pstdio, SDK, UI and workbench at the shared version, including packages with no code changes. The GitHub release is titled `v<version>` and contains:

- Combined package notes from `bun run --cwd scripts release:notes <version>`, in fixed-group order. Empty sections and date stamps are omitted.
- GitHub's generated PR list, contributor notes and comparison link, starting at the previous published non-prerelease `pstdio@` tag.
- CLI binaries, checksums, `install.sh` and every desktop asset.

`release:version` runs Changesets, stamps changelog dates, synchronizes generated platform metadata, installs dependencies and synchronizes the lockfile. Desktop is versioned directly by Changesets; it has no separate version sync script. Published extension SDK and UI ranges stay under extension ownership because dependency propagation applies only to `workspace:` ranges.

CI pushes only the `pstdio@<version>` tag. Desktop assets and updater URLs keep the `pstdio@` prefix. Core extension catalog entries use `{hostRelease}` to install from that same tag. No separate extension tags, tarballs or GitHub releases are produced.

### Done marker and recovery

The publish job publishes the GitHub release last, so a published GitHub release is the only proof that a version shipped. npm alone is not: it can hold a version whose desktop apps never shipped. Every publish step skips work that an earlier attempt finished: platform packages and `changeset publish` skip versions npm already has, the release action refreshes an existing draft, and asset uploads replace existing files.

| Failure | Recovery |
| --- | --- |
| A verify job flakes | Re-run the failed jobs. Publish runs in the same run when they pass. |
| A verify job finds a bug | Fix it on `main` in a PR without a changeset. That push plans the same version again and moves the unpublished tag to the new commit. |
| Publish stops halfway | Re-run the publish job. It completes the remaining steps. |
| npm has part of the version and a newer commit is on `main` | The next run keeps the tag and releases from the commit that started publishing, so npm and the desktop apps never come from different commits. Platform packages count: they are published first. |
| Publishing started from a commit that can never finish | Release the next version instead: merge a changeset and the version PR. The unfinished version keeps no GitHub release. |
| An older run is re-run in full | Its plan job releases nothing while publishing has not started, because the newest commit on `main` owns the release. |
| An older run is re-run after a newer run moved the tag | Its publish job stops, because the tag no longer points at its commit. |

Runs of one channel never overlap, so two attempts cannot publish at the same time. A newer run replaces a run of the same channel that is still waiting. Never publish by hand or run the desktop workflow alone.

### Update public docs and skills after a release

The [public docs](https://prompt.studio/docs/) are built from `main`:
`.github/workflows/publish-containers.yml` builds the website image on every push
to `main` that changes published docs. Public pages therefore describe `main` and
label what the current stable release lacks. The step that serves a new image at
`prompt.studio` is outside this repository.

After the GitHub release `pstdio@<version>` is published, open one PR that updates
these together:

1. Version labels. In [API versioning](../../references/extensions/0014-api-versioning.md#versions-in-current-releases),
   set the new stable release and its `EXTENSION_API_VERSION`. Search
   `documentation/guides`, `documentation/references`, `extensions/*/README.md`,
   `extensions/*/docs`, and bundled skills in `extensions/*/skills` for
   "release after <previous>.x", "nightly", and the previous version. Replace each
   label with the released version. Remove entries from the SDK
   [release availability](../../references/sdk/0003-api.md#release-availability)
   list that the release now includes.
2. Examples. Update pinned versions such as `bun add @pstdio/sdk@<version>` and
   example `engines.pstdio` ranges. Type-check each maintained example, including
   `infra/local/extensions/bookmarks`, against the published SDK.
3. Screenshots and GIFs. Recapture images whose screens changed, following the
   [documentation guide](../../guides/0001-documentation.md#screenshots-and-gifs).
   Label captures that show an earlier release.
4. Public references. Check that new public SDK methods and CLI commands appear in
   the SDK and CLI references.
5. Shipped skill links. Check that every public URL and anchor linked from bundled
   skills exists on the deployed site.

After the docs deploy, open the changed pages on the public site and confirm that
the labels match the release.

## Patch releases

Only the current stable release can be patched. A patch contains selected fixes
from a branch based on that exact release tag; it does not publish main. All
members of the fixed version group move to the next patch version together.
Older release lines are unsupported.

1. Fix the bug on main first. Create a `bugfix/` branch from the tag reported by
   `gh release view --json tagName --jq .tagName`, cherry-pick the required fixes,
   review the diff against that tag, and run the affected tests and checks.
   Keep the branch's package versions unchanged. No contributor changeset is
   required on this branch.
2. Push the branch and record its full commit SHA. Keep normal version PRs
   unmerged during patch preparation and verification, until they are refreshed.
3. Dispatch **Release Packages** on **main**, with `channel: patch`, `base_tag`
   set to the current stable tag, `source_sha` set to that fix commit, and a
   one-line `summary`. Leave `publish_patch: false` to verify first.
4. The workflow generates a patch changeset, replacing pending changesets only
   in the candidate checkout. Changesets versions the fixed group; the existing
   stamp, platform sync and lockfile steps run before the version commit is
   tagged. The tag reserves that version and is never moved by patch runs.
5. Every existing release verification runs against the generated commit,
   including signing and the Windows update from `base_tag`. Verification alone
   publishes no npm packages, service images, or GitHub release. It does create
   the candidate tag and refresh the main version PR.
6. When publication is requested, dispatch with the same inputs and
   `publish_patch: true`. The workflow reuses the immutable candidate, verifies
   it again, then publishes with npm `latest` and the normal desktop channel.
   It checks the current stable tag again before publishing. A newer stable
   release makes an unfinished older patch ineligible.
7. Check the release assets and main version PR. Remove only changesets for fixes
   that the patch already shipped through a reviewed main PR, preserving unrelated
   changesets. Do not replace main's source or dependency choices with the patch
   checkout. Main versioning starts at least at the shipped or reserved patch
   version before applying its own pending changesets, so it skips that number.

The dispatch stays on main even though the build checkout uses the fix commit.
The existing Azure signing subject and npm trusted workflow therefore remain in
use. No release-branch signing identity or GitHub environment is added.
Patch and normal stable runs share the existing concurrency group.

A candidate already reserved by another source is rejected. Once any packages
are published, only the original candidate can complete that version. Retry
failed jobs or dispatch the same inputs. If the candidate must change before
publication, first verify that no package or GitHub release shipped, then obtain
approval to abandon the unused tag. Main pushes never take over a patch tag or
publish a verification-only candidate.

The repository-local [patch release skill](../../../.pstdio/extensions/pstdio-dev/skills/patch-release/SKILL.md)
contains the operator commands. Loading the skill does not authorize publication.
A native verification dispatch on main is required after deploying this workflow;
local tests cannot prove the external signing service accepts a run.

## Nightly builds

Maintainers use what `main` builds every day, packaged the way users get it. The nightly runs the compiled CLI, the bundled runtime, the updater and migrations on existing data, which a source checkout skips. Because it runs the same verify and publish jobs as a stable release, a red nightly predicts a red release.

The nightly runs every day at 03:00 UTC and from a manual dispatch on `main` with `channel: nightly`. It lives in the release workflow because npm trusted publishing allows one trusted publisher per package, and that publisher names the workflow file. The run skips when the parent of the newest published nightly's tag commit is the current `main` commit.

1. The plan job writes a temporary `patch` changeset for `pstdio`, then runs `release:version --nightly`. That runs `changeset version --snapshot nightly` with the `snapshot` settings in `.changeset/config.json`, followed by the same steps as a stable version. Every member of the fixed group gets the same version, such as `0.43.0-nightly.20261012030000`: the next stable version from the pending changesets, plus a date and time. It sorts after every earlier release and before the stable release it previews. Extension SDK and UI ranges stay unchanged.
2. It commits the version change on top of `main`, tags that commit `pstdio@<version>` and pushes only the tag. The commit is never pushed to `main`.
3. The verify jobs build that commit. Desktop builds cover macOS arm64, macOS x64 and Linux; nightlies build no Windows assets and skip the Windows update check. The `.deb` package version uses `~nightly` instead of `-nightly`, so dpkg sorts a nightly before the stable release it previews.
4. The publish job publishes npm packages with `--tag nightly` and publishes a prerelease that is never marked Latest, with an `install.sh` that installs that nightly. The npm `latest` tag never moves. The `nightly` tag always points at the newest nightly.
5. After the prerelease is published, `release:nightlies:prune` deletes every other nightly release and its tag, including drafts from failed runs, and nightly tags that a failed run left without a release. It never deletes a stable release or another prerelease.

Only one nightly release exists at a time. npm versions cannot be deleted, so old nightly versions stay on npm. Because older nightly tags disappear, a nightly build installs core extensions from its `main` commit SHA, not from its tag. When `PSTDIO_EXTENSION_RELEASE_REF` is set during `build:all`, the compiled CLI and desktop sidecar use it as their default extension ref; otherwise they use `pstdio@<version>`. The nightly sets it to the `main` SHA for the desktop builds and the publish job. `main` is never force-pushed, so that SHA stays fetchable.

Stable release notes start at the previous non-prerelease tag, so nightly tags never appear in them. Nightly host versions do not change extension compatibility: extensions match `EXTENSION_API_VERSION`, and semver caret ranges exclude prereleases.

The desktop side of the nightly channel is described in [Desktop distribution](0002-desktop-distribution.md#update-channels).

## Validation

The [nonfunctional requirements](../../guidance/0003-nonfunctional-requirements.md) set mandatory resource targets and describe nightly performance coverage and when local benchmarks are useful. The existing 200 MB compiled-binary check runs during local builds, cross-platform builds, and prebuilt verification. Aggregate download size and the M5 startup and average-memory targets do not have dedicated automated checks yet.

Run `bun run validate` and `bun run --cwd scripts verify:packages`. For changes to release logic, use a disposable Prompt Studio workspace to run `bun changeset status --verbose` and `bun run --cwd scripts release:version`. Check that all group versions agree, extension dependency ranges remain unchanged and `release:notes <version>` contains only actual entries. Do not publish from the disposable workspace.

## One-time historical cleanup

After PS-410 merges, inventory the obsolete extension and private-package tags and releases. Keep all `pstdio@*`, `@pstdio/sdk@*`, `@pstdio/ui@*` and `@pstdio/workbench@*` history. Show the exact deletion list and obtain explicit approval before deleting releases, their tarballs and tags. Immutable release tag names cannot be reused. The ticket's cookbook contains the operator procedure. This cleanup is separate from the release workflow.

## Errors

| Symptom | Check |
| --- | --- |
| No version PR | Confirm pending changesets reached main. |
| Version validation fails | Add the named released package to the fixed group or ignore a private helper. |
| Publish fails | Check registry trust, package metadata and build output, then re-run the publish job. |
| Notes generation fails | Check that every existing changelog includes the release version. |
| Release stays unpublished | Find the failed verify job. Check native credentials, signatures, launch validation, checksums and version agreement, then follow the recovery table. |
| No nightly today | Check whether `main` changed since the newest published nightly, then check the nightly run's failed job. |
| Nightly desktop job failed | Re-run the failed jobs of that run. |
| Two nightlies are listed | The newest nightly failed before pruning. Older nightlies are pruned after the next complete nightly. |

## Delivery record

Checked on 2026-10-18 against main commit `45580feb` and the GitHub releases of `pufflyai/prompt-studio`.

| Field | Record |
| --- | --- |
| Status | Released and in use. |
| Implementation | `.github/workflows/release-packages.yml`, `scripts/release/`, and the fixed group in `.changeset/config.json`. All-or-nothing publication came in #1031, the nightly channel in #1018, and post-publication pruning in #1066. See [ADR 0072](../../adrs/0072-gate-merges-on-builds-and-publish-releases-all-or-nothing.md). |
| Availability | The workflow published the stable `pstdio@0.43.1` on 2026-10-14 and the prerelease `pstdio@0.44.0-nightly.20261018030230` on 2026-10-18. Only one nightly release is listed. |
| Remaining work | None known. The one-time historical cleanup appears complete: the remote tags and GitHub releases now carry only `pstdio@`, `@pstdio/sdk@`, `@pstdio/ui@`, and `@pstdio/workbench@` names. That conclusion comes from the tag and release lists, not from a cleanup record. |
| Evidence | `gh release list` and `git ls-remote --tags origin` on 2026-10-18. The release run logs were not reviewed for this record. |
