# ADR 0088: Deliver core extension releases independently through PSX

Proposed: 2026-10-22

## Status

Accepted for PS-887. Supersedes the core extension release policy in [ADR 0031](0031-release-all-core-packages-under-one-version.md).

## Context

The host catalog installs core extensions from the host release tag. Independent
version numbers cannot deliver a fix while that tag still selects the source.
The extension API now supports compatibility ranges. Core extensions need to
publish fixes between host releases.

Distribution belongs to the extension platform. An extension cannot replace the
host's installer or choose which other extensions the host can safely load.

## Decision

Keep the host, SDK, UI, workbench and desktop in the existing Changesets fixed
group. Release core extensions independently, starting at their current versions.
Do not reset versions or reuse withdrawn version numbers.

PSX owns released packages, metadata, immutable downloads and withdrawal.
Use the existing Bun service, PostgreSQL, S3 and Terraform deployment patterns.
Only authorised CI publishes core packages. Reads require no publisher account.
Publisher accounts, marketplace search and third-party publication remain in PS-888.

The stable host resolves the newest non-withdrawn version that supports its
extension API. It verifies SHA-256, extension identity and version before staging
the install. Dependency preparation and source validation finish before the
working files are replaced. Installed sources load without registry access.
Replacement validation also builds managed webviews before replacing the working
source, so a failed view build leaves the installed extension intact.
Development and nightly builds keep their pinned repository sources.

Object keys include the server-computed content hash. Concurrent writes to one
key contain identical bytes. The immutable PostgreSQL version row selects the
winning package, so delivery does not depend on optional conditional-write
headers in a storage provider.

Use the full publisher and name as the extension owner. Commands, setting record
IDs, resource-kind record IDs, allocated files and artifact roots must not collide
when two publishers choose the same name. A resource's local type still belongs
to its explicit extension owner.

Move project storage to the full ID. Keep deprecated name-only routes and the
allocated-file publisher layout as aliases to the same data until the next
breaking extension API release. Refuse ambiguous aliases. Encode Windows device
names with a leading underscore in the storage directory; an underscore cannot
start an accepted publisher ID, so this mapping stays distinct.
Apply this mapping to package filenames and both staging and installed folders.
Discover persisted publisher ownership before moving legacy folders, including
disabled and uninstalled owners. Read-only workspaces keep reading the legacy
layout until an authorised write can migrate it.

## Consequences

- One host release introduces registry support. Later compatible extension fixes
  need no host release, desktop build or host tag.
- Extension publication has its own workflow. It checks published dependencies.
- A package contains one extension and identifies it by full ID and version.
- New registry sources record the registry, full ID and installed version.
- Historical Git records do not record whether a catalog or explicit branch
  selected their commit. Their conversion requires a provenance policy before
  rollout; manifest identity alone is not sufficient evidence.
- Production deployment, publishing credentials and a smoke against the deployed
  service are release gates. Source code and isolated tests alone do not deliver
  independent updates to users.
