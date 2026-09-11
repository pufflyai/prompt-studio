# Research

## Repository findings

- `MISSION.md` identifies extension execution, UI contracts, state and storage, live sync, and security as shared platform responsibilities. Labels help direct review toward those responsibilities.
- `.github/` currently contains workflows and no labeler configuration or CODEOWNERS file.
- `.github/workflows/test-and-build.yml` runs on pushes, PRs, and merge groups. It checks boundaries, changesets, builds, and tests. Risk labels can be a separate small workflow without changing those checks.
- `.github/workflows/release-packages.yml` already filters paths for release verification. Its paths provide evidence for build and release review areas.
- `packages/sdk/src/extensions/` and `packages/pstdio-api-contracts/` contain shared extension contracts.
- `packages/pstdio-db/src/db/schemas/` and `packages/pstdio-db/drizzle/` hold schema source and generated migrations. `packages/pstdio-storage/` owns file persistence.
- `packages/pstdio-api/src/app.ts` composes database, storage, extension, and sync services. Runtime behavior spans packages, so labeling only the SDK and DB would miss other shared failure points.
- Concrete security locations include runtime authentication, connection secret storage, and extension webview access. Sync lives in both the API and SDK.
- Remote GitHub labels and repository settings were not inspected. Local findings do not prove the remote repository has no manual labels or external automation.

## External findings

The official [actions/labeler documentation](https://github.com/actions/labeler) supports path rules, fetching configuration without checkout, and removing stale managed labels with `sync-labels`. Labels outside its configuration are preserved. Applying existing labels needs PR write permission; creating missing labels also needs issue write permission. The current README describes v7. Select and verify a full release commit SHA during implementation.

GitHub documents [`pull_request_target`](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target) as running in the base repository context. It warns against running untrusted PR code with that event. The proposal therefore uses it only for metadata labeling, with no checkout, builds, or dependency installation.

## Recommendation

Use the maintained action instead of introducing a custom classifier. Path rules provide an understandable starting point. Manual consequence labels cover judgments paths cannot make. Most classification is advisory; the SDK/extensions pair has a required separation policy. No severity score or application state is needed.

## Required policy follow-up

The user requires a block for PRs labeled both `extensions` and `sdk`. The `extensions/` directory contains implementations such as `pstdio-planner`, `pstdio-artifacts`, and harness extensions. Map that whole directory independently of the existing extension-runtime packages.

GitHub documents that [events generated with GITHUB_TOKEN](https://docs.github.com/en/actions/concepts/security/github_token) generally do not start another workflow; label events are not an exception. Evaluate the policy immediately after synchronization in the same run.

The [commit status API](https://docs.github.com/en/rest/commits/statuses) can attach pending, failure, error, or success to an explicit commit SHA and named context. Use the PR head SHA for `sdk-extension-separation`, since a target-context workflow is based on the base branch. Configure that status as required and verify actual merge blocking. The existing `merge_group` trigger in CI makes queue compatibility a rollout check, not proof that a queue is enabled.
