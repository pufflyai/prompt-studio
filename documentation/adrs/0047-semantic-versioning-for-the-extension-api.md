# Semantic versioning for the extension API

Proposed: 2026-09-29

Status: Accepted and implemented in PS-443. Consolidates the compatibility history from ADR 0030's temporary workspace release bridge.

## Context

- Exact alpha-version matching rejected working extensions after additive changes. Fourteen API versions produced only five releases and repeatedly changed 19 manifests.
- Prerelease range behavior could not express the intended compatibility contract. The API is still evolving.
- The retired workspace bridge demonstrated that SDK, extension, and host releases need a compatible intermediate state.

## Decision

1. Use plain semver without prerelease tags, beginning at `0.1.0`. Keep the API on `0.x` until maintainers declare it settled.
2. On `0.x`, breaking changes bump minor; additions and fixes bump patch. From `1.0.0`, use major for breaking changes, minor for additions, and patch for fixes.
3. Bump at most one step per release, using the highest merged change level.
4. Add replacements beside deprecated APIs. Name the replacement with `@deprecated`; remove deprecated APIs together in one breaking release. See [extension API guidance](../guidance/0006-engineering.md#7-public-extension-api).
5. Accept only one or more `^MAJOR.MINOR.PATCH` terms joined by `||` in `engines.pstdio`. Load an extension only when the host satisfies its declaration.
6. Publish additive SDK support first, compatible extension releases next, and a breaking host cutover last. Extensions own their published SDK/UI dependency ranges; host releases must not rewrite them.
7. Generate public API reports during verification. Reject changed types without a version bump, multiple version steps, or a version below `main`. Deprecation tags count as API changes.
8. Build baseline and candidate reports with one current generator and toolchain, each revision's public entrypoints and type dependencies, and stable type ordering. Install historical locked dependencies without lifecycle scripts.
9. Keep reports and diffs as ignored local output or CI artifacts, including failures. Do not commit generated declarations. A failed baseline build stops verification.

## Consequences and alternatives

- Compatible additions no longer require manifest edits. Extensions needing newer APIs raise their minimum; incompatible hosts show an update diagnostic.
- Contributors classify changes; uncertain classifications are breaking. Reports cover types, so validation and event-payload changes still require review.
- Exact alpha lists were costly; open ranges promise compatibility with unknown breaking versions. Starting at `1.0.0` would claim premature stability. Per-PR bumps inflated the version without releases.
- Alpha hosts and plain-semver hosts do not accept each other's declarations. This was a one-time transition, not a permanent compatibility bridge.
- SDK bundle chunks are unsuitable comparison inputs. One self-contained report per public entry avoids hashed bundle names; TypeScript's `stableTypeOrdering` prevents ordering noise. A separate API Extractor pipeline was rejected.
- Product alpha status stays in the `pstdio` version. The complete compatibility rules live in [API versioning](../references/extensions/0014-api-versioning.md).
