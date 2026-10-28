# Independent core extension releases

Core extensions have their own versions and changelogs. The host, SDK, UI,
workbench and desktop keep their shared stable release policy. SDK and UI can
also publish [packages-only previews](0014-sdk-ui-previews.md).

PSX is not deployed yet. Until it is, stable hosts include their catalog extension
sources and lockfiles as bundled packages, built from the host release checkout.
Installing them does not require Git. Users receive extension changes with
the next host release. PSX support is in the host but only runs when
`PSTDIO_EXTENSION_RELEASE_REF` is set to `psx:<registry URL>`.

## Release a fix

Add a changeset for the changed extension. An extension-only version PR bumps
only that extension and writes its changelog. It does not trigger a host release.
Do not edit package versions by hand. The next host release notes include each
extension whose version changed since the previous host release.

The compatibility check discovers releasable extension manifests outside the
host fixed group. It also typechecks against the first stable SDK supported
by each term in engines.pstdio. If that API has no stable SDK, it uses a
supporting published preview, preferring one within the extension's SDK dependency
range and otherwise using the first supporting preview.
It reads API versions from SDK registry metadata and uses host tags only for
older SDKs without that metadata. Fetch stable host tags before running it:

~~~bash
bun run --cwd scripts verify:published-extensions
~~~

If code uses an API absent from that baseline, raise the manifest's minimum to the
first API that provides it. A declaration with no published supporting SDK cannot
publish yet. A range for which no SDK shipped adds no baseline. Publishing an SDK
preview does not add that API to existing hosts.

## Publish to PSX

release-extensions.yml finds unpublished extension versions, checks them against
published dependencies, packs them and publishes them to PSX. It runs only by
hand from main until PSX is deployed. Re-running it skips existing versions. The
registry refuses a different package at an existing version, including withdrawn
versions.

PSX publishes only stable `major.minor.patch` versions. Nightly archives retain
their snapshot versions for host bundling and local installation; PSX rejects
prerelease and build-metadata versions before storing them.

## Deploy PSX

The service container workflow builds infra/psx/Dockerfile. Add psx to the
service image push in release-packages.yml for the release that deploys it, and
make its GHCR package public. Pin its released digest in the existing Terraform module alongside the manager
and relay. The module creates a private PSX bucket, database and runtime login,
routes the service under psx_path, and runs its migration before deployment.

Add psx to the module's services and supply psx_secrets through secure
operator configuration. Without psx in services, the module creates no PSX
bucket, database or app service. The S3 credentials
must grant access to the package bucket. PSX_PUBLISH_TOKEN authorises core
publication and withdrawal. Runtime requests use the service login; only the
migration job receives the database owner login.

Add PSX_PUBLISH_TOKEN as a repository secret. Only release-extensions.yml
reads it, and that workflow runs only on main. The token must match deployment
configuration. Never put it in a manifest, image or URL.

Check the configured HTTPS address at /health and
/api/pstdio/pstdio-notes/versions. A host uses the registry when
`PSTDIO_EXTENSION_RELEASE_REF` is `psx:<registry URL>`. Stable hosts switch to
https://base.prompt.studio/psx in the first host release after deployment.
Development source roots and pinned Git refs keep selecting repository sources.

## Move existing installs

On a registry host, a Git install whose repository URL and folder match the
bundled catalog entry is host-managed. Its next Upgrade installs the newest
compatible PSX release and keeps its files and settings. Git installs from any
other repository or folder, and local folder installs, keep their own source.

Project files do not move. 0.46 starts every device with an empty database, and
each extension starts fresh under `.pstdio/extension-storage/<publisher>.<name>/`.

## Withdraw a release

Send an authenticated POST to /api/<publisher>/<name>/<version>/withdraw.
The version stays in metadata and its package remains immutable. New installs and
upgrades skip it. Installed copies keep running. Publish a new version to replace
a broken release.

## Validate delivery

~~~bash
bun run --cwd services/psx test:integration
bun run --cwd scripts verify:packages
~~~

The packaged smoke packs a Notes fixture with the compiled CLI, installs it,
publishes a newer version, upgrades it and runs its full-ID command. The host
binary and version stay unchanged. Its portable HTTP fixture checks the host
contract; PSTDIO_PSX_REAL_SERVICE=1 runs that scenario against the production
PSX image with isolated PostgreSQL and S3.

Before stable hosts switch to PSX, repeat the UI and CLI upgrade checks against
deployed PSX. Record the registry address, unchanged host version and changed
extension version.
