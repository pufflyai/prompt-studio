# Semantic versioning for the extension API

Proposed: 2026-09-29

## Status

Accepted and implemented in PS-443. Supersedes the exact-match rule from PS-278 and the "explicit version enumeration can remain" note in the Removal section of [ADR 0030](0030-temporary-workspace-contract-release-bridge.md). The rules are in the [API versioning reference](../references/extensions/0014-api-versioning.md).

## Context

The extension API used `1.0.0-alpha.N` and moved N on every contract change. The host accepted an extension only when `engines.pstdio` listed the host version exactly. PS-278 chose exact matching because npm caret ranges over prerelease versions match every later alpha. A range such as `^1.0.0-alpha.1` looked protective but let every breaking change through.

The result was 14 API versions in 40 days. Only 5 of them shipped in a release, because the version moved once per PR. Each one forced an edit to all 19 tracked manifests. Additive changes, such as the alpha.12 `getMessages()` method, rejected extensions that still worked. Extensions that a person or an agent built outside this repo broke on every host update.

The API is also not settled. Breaking changes will keep coming for a while, and the version number should not grow with every one of them.

## Decision

- The extension API version is a plain semver number with no prerelease tag, starting at `0.1.0`.
- The version stays on `0.x` until the maintainers declare the API settled. That release sets it to `1.0.0`.
- On `0.x`, breaking changes move the minor, and additive changes and fixes move the patch. From `1.0.0`, breaking changes move the major, additive changes the minor, and fixes the patch.
- The version moves at most one step per release. The highest change level merged since the last release sets the step.
- New APIs are added next to old ones, and the old ones are deprecated. Deprecated APIs are removed together in one breaking release. `AGENTS.md` states this rule.
- `engines.pstdio` is one or more `^MAJOR.MINOR.PATCH` terms joined by `||`. Other forms are refused.
- The host accepts an extension when its version satisfies the declaration.
- CI keeps a checked-in report of the public `@pstdio/sdk/extensions` types. It fails when the report is out of date, when the report changed since the last release without a version bump, and when the version moved more than one step.
- The alpha status of the product lives in the `pstdio` package version, not in the API version.

The report bundles `tsc` declarations instead of the SDK's published type bundle. The published bundle splits shared types into chunks with hashed names, and generating types while bundling prints some inferred unions in a different order on each run. A report must be stable, or every build would look like an API change.

## Consequences

- Additive host releases no longer touch extension manifests.
- The version grows by at most one step per release. The alpha history would have produced about 5 steps instead of 14.
- An extension that needs a newer API raises its minimum, and an older host tells the user to update Prompt Studio.
- Breaking changes are still refused up front with one diagnostic.
- Someone has to classify each change. The report check makes sure a type change is not missed, but it cannot tell additive from breaking. A wrong "additive" is the main risk, so the rule is "if in doubt, breaking".
- The report covers types only. A new validation rule or a changed event payload still depends on review.
- On `0.x` the patch number carries both additive changes and fixes. Extensions only need to know whether a change breaks them, so this loses nothing they use.
- Contributors keep deprecated APIs working until a breaking release removes them. This is a deliberate exception to the repo rule against backward compatibility, and it applies only to the extension API.
- Alpha hosts refuse `^0.1.0` and the new host refuses alpha lists. Local extensions must edit `engines.pstdio` once. Installed catalog extensions still declare alpha lists after the host update, so the diagnostic offers Upgrade to their build for this host. New catalog installs follow the host release tag and are not affected.
- Removed alpha.3 contribution keys, such as `panels`, are now reported as unknown contributions. The version gate already refuses every extension built for alpha.3.

## Alternatives considered

- Keep exact lists. Correct but costly. Every release rejects working extensions.
- Start at `1.0.0`. Every breaking change during the unsettled period would move the major, and `1.0.0` would claim a stability the API does not have yet.
- Bump once per PR. This is what grew the alpha counter to 14 while only 5 values shipped.
- Keep an `-alpha` tag on the API version, such as `1.2.0-alpha`. npm range rules only let a prerelease host match a term with the same `MAJOR.MINOR.PATCH`, so `^1.2.0-alpha` refuses a `1.3.0-alpha` host. It would need our own comparison instead of standard semver.
- Accept any npm range. Open ranges such as `>=0.1.0` or `*` claim support for breaking versions that do not exist yet.
- Use API Extractor for the report. It gives a cleaner report, but it adds a dependency and a second types pipeline next to the [ADR 0040](0040-temporary-dts-export-marker.md) workaround.
