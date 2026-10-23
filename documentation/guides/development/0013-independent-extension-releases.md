# Independent core extension releases

Core extensions have their own versions and changelogs. The host, SDK, UI,
workbench and desktop keep their shared release policy.

PSX is not deployed yet. Until it is, stable hosts install core extensions from
their own `pstdio@<version>` release tag, so users receive extension changes with
the next host release. PSX support is in the host but only runs when
`PSTDIO_EXTENSION_RELEASE_REF` is set to `psx:<registry URL>`.

## Release a fix

Add a changeset for the changed extension. An extension-only version PR bumps
only that extension and writes its changelog. It does not trigger a host release.
Do not edit package versions by hand. The next host release notes include each
extension whose version changed since the previous host release.

The compatibility check discovers releasable extension manifests outside the
host fixed group and checks their declared published SDK and UI dependencies:

~~~bash
bun run --cwd scripts verify:published-extensions
~~~

## Publish to PSX

release-extensions.yml finds unpublished extension versions, checks them against
published dependencies, packs them and publishes them to PSX. It runs only by
hand from main until PSX is deployed. Re-running it skips existing versions. The
registry refuses a different package at an existing version, including withdrawn
versions.

## Deploy PSX

The service container workflow builds infra/psx/Dockerfile. Add psx to the
service image push in release-packages.yml for the release that deploys it, and
make its GHCR package public. Pin its released digest in the existing Terraform module alongside the manager
and relay. The module creates a private PSX bucket, database and runtime login,
routes the service under psx_path, and runs its migration before deployment.

Supply psx_secrets through secure operator configuration. The S3 credentials
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

## Withdraw a release

Send an authenticated POST to /api/<publisher>/<name>/<version>/withdraw.
The version stays in metadata and its package remains immutable. New installs and
upgrades skip it. Installed copies keep running. Publish a new version to replace
a broken release.

## Validate delivery

~~~bash
bun run --cwd services/psx test:isolated
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
