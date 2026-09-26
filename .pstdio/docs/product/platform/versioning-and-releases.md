---
status: "accepted"
created: "2026-03-10T20:12:05Z"
---

# Versioning and releases

Prompt Studio ships one version across pstdio, SDK, UI, workbench, desktop and every core extension. Changesets owns their versions through one fixed group in `.changeset/config.json`. See [ADR 0031](../../adrs/0031-release-all-core-packages-under-one-version.md).

## Contributor flow

1. Run `bun changeset`. Select the packages changed, choose a bump and write a one-line summary. Follow the package selection rules in `AGENTS.md`.
2. Commit the changeset with the change. The selected package decides where the summary appears in release notes.
3. Merge into `main`. CI opens or updates the Version Packages PR. The highest pending bump sets the next version for every member of the group.
4. Review and merge that PR. All group members should have the same version. Extension SDK and UI dependency ranges must remain unchanged unless an extension PR explicitly updates them.

Do not edit versions by hand. Add new released workspace packages to the fixed group, or list private helpers in `ignore`. `validate:changesets` enforces membership and requires repo-local `.pstdio` workspaces to be ignored. Third-party extensions keep their own versions and refs.

## Release pipeline

`.github/workflows/release-packages.yml` runs on `main` with Bun from the root `packageManager` field and Node 24. It validates and builds the monorepo, compiles platform binaries, verifies packaged output and generates checksums.

The workflow publishes generated `@pstdio/cli-*` platform packages at the host version. `changesets/action` then either opens the version PR or runs `changeset publish`. npm receives pstdio, SDK, UI and workbench at the shared version, including packages with no code changes.

`release:version` runs Changesets, stamps changelog dates, synchronizes generated platform metadata, installs dependencies and synchronizes the lockfile. Desktop is versioned directly by Changesets; it has no separate version sync script. Published extension SDK and UI ranges stay under extension ownership because dependency propagation applies only to `workspace:` ranges.

Publishing creates local npm package tags, but CI pushes only `pstdio@<version>`. It creates one draft GitHub release titled `v<version>` with:

- Combined package notes from `bun run --cwd scripts release:notes <version>`, in fixed-group order. Empty sections and date stamps are omitted.
- GitHub's generated PR list, contributor notes and comparison link.
- CLI binaries, checksums and `install.sh`.

The desktop workflow builds, signs and verifies native artifacts, attaches them to that draft and publishes it only after its checks pass. Desktop assets and updater URLs retain the `pstdio@` prefix. Core extension catalog entries use `{hostRelease}` to install from that same tag. No separate extension tags, tarballs or GitHub releases are produced.

## Validation

Run `bun run validate` and `bun run --cwd scripts verify:packages`. For changes to release logic, use a disposable Prompt Studio workspace to run `bun changeset status --verbose` and `bun run --cwd scripts release:version`. Check that all group versions agree, extension dependency ranges remain unchanged and `release:notes <version>` contains only actual entries. Do not publish from the disposable workspace.

The first combined release must be checked for the expected previous `pstdio@` tag in GitHub's generated comparison link and for the `pstdio` entry in Changesets' published package output.

## One-time historical cleanup

After PS-410 merges, inventory the obsolete extension and private-package tags and releases. Keep all `pstdio@*`, `@pstdio/sdk@*`, `@pstdio/ui@*` and `@pstdio/workbench@*` history. Show the exact deletion list and obtain explicit approval before deleting releases, their tarballs and tags. Immutable release tag names cannot be reused. The ticket's cookbook contains the operator procedure. This cleanup is separate from the release workflow.

## Errors

| Symptom | Check |
| --- | --- |
| No version PR | Confirm pending changesets reached main. |
| Version validation fails | Add the named released package to the fixed group or ignore a private helper. |
| Publish fails | Check registry trust, package metadata and build output. |
| Notes generation fails | Check that every existing changelog includes the release version. |
| Desktop release stays draft | Check native credentials, signatures, launch validation, checksums and version agreement. |
