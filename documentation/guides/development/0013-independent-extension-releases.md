# Independent core extension releases

PSX stores immutable core extension packages. The host, SDK, UI, workbench and desktop keep their shared release policy.

## Release a fix

Add a changeset for the changed extension. An extension-only version PR bumps
only that extension and writes its changelog. It does not trigger a host release.
Do not edit package versions by hand.

After the version PR merges, release-extensions.yml finds unpublished extension
versions, checks them against published dependencies, packs them and publishes
them to PSX. Re-running the workflow skips existing versions. The registry
refuses a different package at an existing version, including withdrawn versions.

The compatibility check discovers releasable extension manifests outside the
host fixed group. It also typechecks against the first released SDK supported
by each term in engines.pstdio. Fetch stable host tags before running it:

~~~bash
bun run --cwd scripts verify:published-extensions
~~~

If code uses an API absent from that baseline, raise the manifest's minimum to the
first API that provides it. A declaration with no released compatible host cannot
publish yet. A range for which no host ever shipped adds no baseline.

## Deploy PSX

Build infra/psx/Dockerfile and publish it with the service container workflow.
Pin its released digest in the existing Terraform module alongside the manager
and relay. The module creates a private PSX bucket, database and runtime login,
routes the service under psx_path, and runs its migration before deployment.

Supply psx_secrets through secure operator configuration. The S3 credentials
must grant access to the package bucket. PSX_PUBLISH_TOKEN authorises core
publication and withdrawal. Runtime requests use the service login; only the
migration job receives the database owner login.

Configure the GitHub psx-production environment with the
PSTDIO_EXTENSION_REGISTRY variable and PSX_PUBLISH_TOKEN secret. The token
must match deployment configuration. Never put it in a manifest, image or URL.

Check the configured HTTPS address at /health and
/api/pstdio/pstdio-notes/versions. Stable hosts default to
https://base.prompt.studio/psx. PSTDIO_EXTENSION_REGISTRY overrides the
registry for a registry-backed host. Development source roots and pinned Git refs
continue selecting repository sources.

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

Before shipping, repeat the UI and CLI upgrade checks against deployed PSX.
Record the registry address, unchanged host version and changed extension version.
Deployment access, secure publishing configuration and historical catalog-source
conversion must be resolved before this delivery work is complete.
