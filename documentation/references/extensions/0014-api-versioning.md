# API versioning

The extension API has its own semver version. This page explains version ranges, breaking changes, and how old APIs are retired.

The decision is recorded in [ADR 0047](../../adrs/0047-semantic-versioning-for-the-extension-api.md).

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

The host accepts an extension when `Bun.semver.satisfies(EXTENSION_API_VERSION, declaration)` is true. The parser lives in [`api-versions.ts`](../../../packages/pstdio-api-contracts/src/extension-kernel/api-versions.ts). The runtime and `pst extensions check` both use it.

## Diagnostic

A refused extension gets one `extension_manifest_unsupported_api_version` diagnostic. The message names the extension, its declaration, and the host version, then gives one repair:

| Case | Repair |
| --- | --- |
| The declaration is not caret ranges | Shows the accepted form, with `^<host>` as the example. |
| Every term's minimum is below the host, catalog source | Upgrade the extension to its build for this host. |
| Every term's minimum is below the host, other source | Make it work with API `<host>`, then add `^<host>` to `engines.pstdio`. |
| Otherwise, the extension needs a newer API | Update Prompt Studio, or use an extension build for this host. |

## Keep an extension compatible

Declare a caret range that starts at the lowest API version your extension needs, such as `^0.1.0`. The extension then keeps loading across additive and fix releases. Raise the minimum only when the extension starts using a newer API.

On `0.x`, a new minor version is a breaking release. When one arrives, update the extension's code for the new API. Then declare `^0.1.0 || ^0.2.0` if one build supports both versions, or `^0.2.0` if it supports only the new one.

## What counts as the extension API

Anything an extension author writes code or manifest content against:

- Types and runtime contracts of the public SDK subpaths listed below.
- Manifest fields: `package.json` identity fields, `engines.pstdio`, and the `pstdio` metadata block.
- Contribution validation rules that the host and `pst extensions check` apply.
- Webview bridge capabilities and payloads.
- Command, middleware, hook, and event payloads that the host sends or accepts.
- Documented runtime behavior that extensions rely on, such as what the host does with a command result.

## Public SDK subpaths

Every public subpath follows the same change levels and deprecation window. The API report covers
all of them. Public means a supported consumer outside this repository may import it; usage by an
extension is not the only test. In particular, Granite uses `/client`, and published UI and
workbench packages use `/api` and `/resources`.

| Subpath | Status | Purpose |
| --- | --- | --- |
| `/extensions` | Public, reported | Extension definitions, contexts and typed webview clients. |
| `/extensions/react` | Public, reported | React helpers for extensions. |
| `/testing` | Public, reported | Test contexts and in-memory service implementations. |
| `/data` | Public, reported | Pure frontmatter, draft-layout and name helpers. |
| `/prompts` | Public, reported | Prompt rendering helpers. |
| `/client` | Public, reported | Typed HTTP clients for agents, scripts and hosts. |
| `/api` | Public, reported | HTTP request/response and terminal transport contracts. |
| `/resources` | Public, reported | Shared resource records, including assets and notifications. |
| `/hooks` | Host-only, deprecated in 0.44 | Old filesystem-hook contexts. Use typed hooks from `/extensions`; removal is planned for 0.45. |

The report entry inventory is `packages/sdk/api-report-entries.json`. Adding a public subpath also
adds it there. `/testing`, `/data`, `/prompts` and `/client` are versioned APIs even when a change
has no manifest or bridge effect. A missing in-repo caller does not permit removal of a published
method. Deprecate it first, then remove it in the next breaking release.

`/resources` owns shared asset and notification type names. The older `/client`, `/api` and
`/extensions` paths keep deprecated aliases through 0.44. `/api` owns the renderer terminal
adapter; the separate extension terminal bridge is deprecated with the typed webview cleanup.

Host routing, event resolution, capability tables and artifact mount normalization belong to
`pstdio-api-contracts`. Hosts import them there. Their old `/extensions` exports are deprecated
aliases through 0.44. Keyboard forwarding is a private guest operation; an extension cannot
declare it or invoke it through the public typed capability union.

The dashboard uses the typed HTTP client. Only transport URL resolution (such as its terminal
WebSocket) remains outside that client; dashboard code does not build paths for JSON requests.

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

- Documentation, comments, and internal changes that change neither the public types nor behavior.

If in doubt, it is breaking. A breaking change released as additive lets broken extensions load and then fail one contribution at a time.

| Level | On `0.x` | From `1.0.0` |
| --- | --- | --- |
| Breaking | Minor, `0.4.2` to `0.5.0` | Major, `1.4.2` to `2.0.0` |
| Additive | Patch, `0.4.2` to `0.4.3` | Minor, `1.4.2` to `1.5.0` |
| Fix | Patch, `0.4.2` to `0.4.3` | Patch, `1.4.2` to `1.4.3` |

## One step per release

The version moves at most one step between two releases. The highest change level merged since the last release sets the step. The number of changes does not matter. For example, a release with several additive changes and one breaking change moves the API one breaking step, from `0.4.2` to `0.5.0`.

The only exception is the release that declares the API settled. It moves any `0.x` version to `1.0.0`.

## Deprecate first, remove together

Extensions depend on the API, so an API is never removed in the release that replaces it:

1. Add the new API next to the old one. That is an additive change.
2. Mark the old API `@deprecated` and name the replacement.
3. Remove deprecated APIs together in one breaking release, either one that already breaks the API or one planned for the removals. List each removal and its replacement in the release notes.

Prompt Studio maintainers follow the release checks in [Extension API version checks](../architecture/0024-extension-api-version-checks.md).

## Optional queued-input capability

The optional `HarnessSession.steer` capability and host-provided `ctx.sessions` queue methods are additive. Existing adapters keep loading without steering. These additions shipped in API 0.1.2. Publish the SDK contract before adopting it in harness extensions.

## Extension file storage in API 0.2

API 0.2 moves `ctx.extensionFiles` from `.pstdio/ext/<publisher>.<name>/` to `.pstdio/extension-storage/<package-name>/.publishers/<publisher>/`. Publishers with the same package name keep separate files. Artifact mount paths cannot start with the reserved `.publishers` segment, including case variants. This is a breaking filesystem layout change; relative file operations stay the same. Move existing allocated files using the [storage migration guide](../../guides/extensions/0009-allocated-extension-files.md). Extensions that work with both layouts can declare `^0.1.0 || ^0.2.0`.
