# Extension API versioning

Part of the [extension API reference](0001-api.md). The decision is recorded in [ADR 0047](../../adrs/0047-semantic-versioning-for-the-extension-api.md).

## Host version

`EXTENSION_API_VERSION` is a plain semver number with no prerelease or build tag. `@pstdio/sdk/extensions` exports it, and `pst extensions check` prints it.

The version stays on `0.x` until the maintainers declare the API settled. That release sets it to `1.0.0`. Semver defines major version zero as initial development, so the leading `0` tells authors that the API may still break.

## `engines.pstdio` declaration

An extension declares one or more caret ranges joined by `||`:

```txt
declaration = term *( "||" term )
term        = "^" MAJOR "." MINOR "." PATCH
```

Whitespace around `||` is allowed. Numbers follow semver rules, so leading zeros are refused.

| Declaration | Result |
| --- | --- |
| `^0.1.0` | Valid. |
| `^0.4.2` | Valid. Needs API 0.4.2 or newer, below 0.5.0. |
| `^0.4.2 \|\| ^0.5.0` | Valid. One build for two breaking lines. |
| `^1.2.0` | Valid after `1.0.0`. Needs API 1.2.0 or newer, below 2.0.0. |
| `0.4.0` | Refused. An exact version pins one host release. |
| `~0.4.0`, `0.x`, `*`, `>=0.4.0` | Refused. |
| `1.0.0-alpha.14`, `^1.0.0-alpha.1` | Refused. Prerelease tags are not accepted. |

Only caret ranges are accepted because each one stops below the next breaking version. On `0.x` that is the next minor. From `1.0.0` it is the next major. A declaration can never claim support for a breaking version that did not exist when it was written. Exact versions and tilde ranges would force an edit after each additive release.

The host accepts an extension when `Bun.semver.satisfies(EXTENSION_API_VERSION, declaration)` is true. The parser lives in [`api-versions.ts`](../../../packages/pstdio-api-contracts/src/extension-kernel/api-versions.ts). The runtime, `pst extensions check`, and `verify:extension-api-version` all use it.

## Diagnostic

A refused extension gets one `extension_manifest_unsupported_api_version` diagnostic. The message names the extension, its declaration, and the host version, then gives one repair:

| Case | Repair |
| --- | --- |
| The declaration is not caret ranges | Shows the accepted form, with `^<host>` as the example. |
| Every term's minimum is below the host, catalog source | Upgrade the extension to its build for this host. |
| Every term's minimum is below the host, other source | Make it work with API `<host>`, then add `^<host>` to `engines.pstdio`. |
| Otherwise, the extension needs a newer API | Update Prompt Studio, or use an extension build for this host. |

## What counts as the extension API

Anything an extension author writes code or manifest content against:

- Public types exported from `@pstdio/sdk/extensions` and `@pstdio/sdk/extensions/react`.
- Manifest fields: `package.json` identity fields, `engines.pstdio`, and the `pstdio` metadata block.
- Contribution validation rules in `pstdio-extensions` and `pst extensions check`.
- Webview bridge capabilities and payloads.
- Command, middleware, hook, and event payloads that the host sends or accepts.
- Documented runtime behavior that extensions rely on, such as what the host does with a command result.

## Change levels

Direction matters. The host provides some types, such as `ctx` and `HarnessEventSink`, and extensions call them. Extensions provide other types, such as contributions, handlers, and harness adapters, and the host calls or validates them.

Breaking:

- Remove or rename an export, member, contribution key, capability, or event.
- Change a type so that old code no longer compiles or old values no longer validate.
- Add a required field to anything extensions provide.
- Add a validation rule that refuses a manifest or contribution that loaded before.
- Change documented runtime behavior that extensions rely on.
- Remove APIs that were deprecated in an earlier release.

Additive:

- Add an export, a `ctx` method, a capability, an event, or a contribution kind.
- Add a member to an object the host provides.
- Add an optional field to anything extensions provide.
- Mark an API as deprecated. The old API keeps working until a breaking release removes it.

Fix:

- Fix host behavior so it matches the documented contract, with no type change.

No change:

- Documentation, comments, and internal changes that change neither the API report nor behavior.

If in doubt, it is breaking. A breaking change released as additive lets broken extensions load and then fail one contribution at a time.

| Level | On `0.x` | From `1.0.0` |
| --- | --- | --- |
| Breaking | Minor, `0.4.2` to `0.5.0` | Major, `1.4.2` to `2.0.0` |
| Additive | Patch, `0.4.2` to `0.4.3` | Minor, `1.4.2` to `1.5.0` |
| Fix | Patch, `0.4.2` to `0.4.3` | Patch, `1.4.2` to `1.4.3` |

## One step per release

The version moves at most one step between two releases. The highest change level merged since the last release sets the step. The number of PRs does not matter.

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

## Deprecate first, remove together

Extensions outside this repo depend on the API, so an API is never removed in the release that replaces it:

1. Add the new API next to the old one. That is an additive change.
2. Mark the old API `@deprecated` and name the replacement.
3. Remove deprecated APIs together in one breaking release, either one that already breaks the API or one planned for the removals. List each removal and its replacement in the release notes.

## Checks

- `bun run verify:extension-api-version` checks that every tracked manifest parses and accepts the host version. A breaking bump lists every manifest the new host would refuse.
- `bun run verify:extension-api-report` rebuilds the public extension API report and compares it with [`packages/sdk/api-report`](../../../packages/sdk/api-report). It fails when the report is out of date, when the report changed since the last release but the version did not move, and when the version moved more than one step. Run it with `--write` to update the report after an intended API change, and commit the result.
- The report is built by `bun run --cwd packages/sdk build:api-report`, which bundles `tsc` declarations without comments. Comment-only changes therefore do not change the report.
- The report covers types only. Review must catch the other API changes, such as a new validation rule or a changed event payload.
- The report also ignores `@deprecated` tags, because it drops comments. Deprecating an API is still an additive change, so move the version yourself.
- A dependency update, such as a new `zod` version, can change the report because inferred types come from it. Those types are what extensions see, so treat the change like any other: classify it and move the version if needed.

## Changing the API

1. Decide the direction and the change level. If in doubt, it is breaking.
2. Prefer additive: deprecate first, remove together.
3. Move `EXTENSION_API_VERSION` one step from `R` if the current value does not already cover your level.
4. Run `bun run verify:extension-api-report --write` and commit the report in the same PR.
5. For an additive change, leave manifests alone unless a first-party extension uses the new API. In that case, raise its minimum.
6. For a breaking change, update every first-party extension and its manifest before the release.
