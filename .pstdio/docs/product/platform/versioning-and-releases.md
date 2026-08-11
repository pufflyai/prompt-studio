---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: Versioning and Releases

## Summary

Publishable Prompt Studio packages are versioned with Changesets and released from `main` through the `Release Packages` GitHub Actions workflow.

## Problem

Release behavior needs one current source of truth that matches the repo scripts and CI workflow instead of a standalone PRD page.

## Goals

- Document the current release flow and contributor responsibilities.
- Keep the workflow aligned with Changesets and the repo's published packages.

## Non-Goals

- Manual version editing in package manifests.
- A release flow that bypasses Changesets.

## Overview

The release path is:

1. Contributors add a changeset for publishable package changes.
2. The PR merges into `main`.
3. The `Release Packages` workflow opens or updates the Changesets version PR.
4. When version bumps are ready, the workflow publishes packages to npm and creates GitHub releases for published tags.

## Requirements

### Functional Requirements

1. Package versioning must use Changesets.
2. Release automation must run from `main`.
3. Published packages must go through the repo `release` script.

### UX Requirements

- Contributors should only need to declare intent with `bun changeset`.
- Release notes should come from generated Changesets and GitHub release notes.

### Operational Requirements

- The workflow reads Bun 1.3.14 from the root `packageManager` field and uses Node.js 22.14+ (npm upgraded to the latest CLI for trusted publishing).
- The workflow requires write permissions for contents and pull requests.
- npm trusted publisher entries must point to `.github/workflows/release-packages.yml` for `pstdio`, `@pstdio/ui`, and `@pstdio/sdk`.

## Behavior

1. Run `bun changeset` when a publishable workspace package changes.
2. Commit the generated `.changeset/*.md` file with the PR.
3. On push to `main`, `.github/workflows/release-packages.yml` runs `changesets/action`.
4. The action either opens or updates the version PR, or publishes packages through `bun run release`.
5. When packages publish successfully, the workflow creates GitHub releases for each published `<name>@<version>` tag.
6. A published `pstdio` package holds its GitHub release in draft while the native
   desktop workflow builds, signs, notarizes, launches, and verifies the complete
   target matrix. The release becomes public only after desktop checks pass.

## Interface

### Contributor Commands

| Command           | Purpose                                              |
| ----------------- | ---------------------------------------------------- |
| `bun changeset`   | Declare package bumps and changelog summary.         |
| `bun run release` | Build and publish through Changesets when run by CI. |

### Workflow

| File                                     | Purpose                                    |
| ---------------------------------------- | ------------------------------------------ |
| `.github/workflows/release-packages.yml` | Automates version PR creation and publish. |
| `.changeset/config.json`                 | Changesets repo configuration.             |
| `.github/workflows/release-desktop.yml`  | Builds and verifies native desktop assets. |

## Rules & Constraints

- Do not edit package versions manually.
- Private packages are not meant to be published, even if the monorepo still builds and tests them.
- Release behavior should stay aligned with the root `release` script and the Changesets action.
- `clients/desktop/package.json` is private but must carry the same version as
  `pstdio`; `scripts/release/version.sh` synchronizes it during the version PR.
- Desktop assets are attached to the matching `pstdio@<version>` release.

## Errors

| Error                 | Cause                                                         |
| --------------------- | ------------------------------------------------------------- |
| No version PR appears | No pending changesets were merged to `main`.                  |
| Publish step fails    | Registry auth, package metadata, or build output was invalid. |
| Desktop release stays draft | A native build, credential, signature, notarization, launch, fuse, checksum, or version check failed. |
