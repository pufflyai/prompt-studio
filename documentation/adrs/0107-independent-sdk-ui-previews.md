# ADR 0107: Publish SDK and UI previews without a host release

Proposed: 2026-10-25

## Status

Accepted. Adds a packages-only preview channel to the release policy in
[ADR 0072](0072-gate-merges-on-builds-and-publish-releases-all-or-nothing.md).
Stable versions keep the fixed group from
[ADR 0106](0106-independent-core-extension-delivery.md).

## Context

An extension can need SDK types or UI components already merged into `main`
before the next host release. Publishing those dependencies should not require
publishing the CLI, desktop, workbench, or service images. Compatibility checks
currently discover an SDK's extension API through host release tags. That makes
a packages-only release invisible to the check.

## Decision

Add a manual `packages` channel to `release-packages.yml`, restricted to `main`.
It reuses the existing npm trusted publisher. Changesets generates SDK and UI
snapshot versions in the runner checkout, using the calculated next version and
the full source commit: `<version>-preview.sha-<commit>`. Do not commit generated
versions or create Git tags. The stable fixed group remains unchanged.

Build and verify both packages before publishing. Pack both artifacts before the
first publication. Publish only the staged SDK and UI archives, in that order,
with the npm `preview` tag. UI must depend on that exact SDK version. A rerun
skips immutable versions already present on npm. Only a registry 404 means a
version is unpublished; registry failures stop publication.

The channel does not run the host release plan or version PR. It creates no host
tag, desktop build, CLI package, service image, or GitHub release, and does not
change npm `latest`. Extension authors pin the exact published previews.

The SDK build writes `pstdio.extensionApiVersion` into its staged package
manifest from `EXTENSION_API_VERSION`. Published SDK metadata becomes the source
of available API baselines. Older packages without that field retain their
historical host-tag lookup. Invalid metadata is an error.

For each declared API range, extension verification still uses the first
supporting stable SDK. If none exists, it prefers a supporting preview inside the
extension's SDK dependency range, then the first supporting published preview.
This preserves the existing nightly baseline when an extension's dependency
range still selects an older stable SDK. A preview cannot bypass an existing stable
minimum. Publishing types does not add APIs to installed hosts; manifests must
still declare the API they need.

## Consequences

- SDK and UI dependencies can unblock extension development without a host release.
- Preview publication is deliberate and available to people and agents through
  the same workflow dispatch.
- A failed UI publication can leave its SDK published. Rerunning the same source
  version finishes the pair without replacing either archive.
- Stable host releases still verify and publish their complete artifact set.
- Stable API minima remain enforced. Preview API changes can be tested before
  the first stable SDK for that API exists.
