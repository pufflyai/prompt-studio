# Extension API version checks

This page is for Prompt Studio maintainers. It explains how a pull request moves `EXTENSION_API_VERSION` and which repository checks enforce the rules in [API versioning](../extensions/0014-api-versioning.md). The decision is recorded in [ADR 0047](../../adrs/0047-semantic-versioning-for-the-extension-api.md).

## The version between releases

Let `R` be `EXTENSION_API_VERSION` at the newest `pstdio@*` tag reachable from `HEAD`. Until the next release, the version must be one of:

- `R`, when the public API has not changed since that release.
- The next patch after `R`.
- The next minor after `R`.
- The next major after `R`, from `1.0.0` only.
- `1.0.0`, from any `0.x`, in the release that declares the API settled.

A PR that changes the API compares the current value with `R`. If the version already moved by the same or a higher level, the PR leaves it alone. If it moved by a lower level, the PR raises it to the higher step. For example, with `R = 0.4.0` and the version at `0.4.1`, a breaking PR sets `0.5.0`. With the version already at `0.5.0`, another breaking PR keeps `0.5.0`.

Find `R` with:

```sh
git show "$(git describe --tags --match 'pstdio@*' --abbrev=0):packages/pstdio-api-contracts/src/extension-kernel/types/extension.ts" | grep EXTENSION_API_VERSION
```

## Checks

- `bun run verify:extension-api-version` checks that every tracked manifest parses and accepts the host version. It uses the same parser as the host. A breaking bump lists every manifest the new host would refuse.
- `bun run verify:extension-api-report` rebuilds the public extension API report and compares it with [`packages/sdk/api-report`](../../../packages/sdk/api-report). It fails when the report is out of date, when the report changed since the last release but the version did not move, when the version moved more than one step, and when the version is lower than the one on `main`, which catches a merge conflict resolved to an older value. Run it with `--write` to update the report after an intended API change, and commit the result.
- The report is built by `bun run --cwd packages/sdk build:api-report`, which bundles `tsc` declarations. The check drops documentation comments and keeps each `@deprecated` tag as a bare marker. Editing docs therefore does not change the report, but deprecating an API does, so the check asks for the additive bump.
- The report covers types only. Review must catch the other API changes, such as a new validation rule or a changed event payload.
- A dependency update, such as a new `zod` version, can change the report because inferred types come from it. Those types are what extensions see, so treat the change like any other: classify it and move the version if needed.

## Changing the API

1. Decide the direction and the change level. If in doubt, it is breaking.
2. Prefer additive: deprecate first, remove together.
3. Move `EXTENSION_API_VERSION` one step from `R` if the current value does not already cover your level.
4. Run `bun run verify:extension-api-report --write` and commit the report in the same PR.
5. For an additive change, leave manifests alone unless a first-party extension uses the new API. In that case, raise its minimum.
6. For a breaking change, update every first-party extension and its manifest before the release. See [release versioning](../../requirements/platform/0005-versioning-and-releases.md) and [PR separation](../../guides/development/0004-pull-request-labels.md).
