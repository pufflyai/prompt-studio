# Deliver core extension releases independently through PSX

Proposed: 2026-10-22

Status: Accepted for PS-887. Consolidates ADR 0031's release-version policy; its host fixed group remains.

## Context

A host-tag catalog cannot deliver an extension fix between host releases, regardless of the extension's displayed version. Compatible API ranges now make independent delivery possible. Distribution remains a host responsibility.

## Decision

1. Keep host, SDK, UI, workbench, and desktop in one Changesets fixed group. Keep the `pstdio@X.Y.Z` host tag and one host release; existing installers and desktop updaters depend on that prefix.
2. Version core extensions independently from their current versions. Never reset versions or reuse withdrawn numbers. Third-party extensions retain their own releases.
3. Extensions own their published SDK/UI dependency ranges. A host version change must not rewrite those ranges.
4. PSX owns packages, metadata, immutable downloads, and withdrawal. Use existing Bun, PostgreSQL, S3, and Terraform patterns. Only authorized CI publishes core packages; reads require no publisher account. Marketplace and third-party publication remain PS-888.
5. Roll out in two steps: 0.46 adds independent versions, full ownership, and registry support for configured `psx:` refs. Stable hosts initially keep host-tag installs. A later host release enables PSX by default only after deployment, credentials, and a deployed-service smoke pass.
6. Resolve the newest non-withdrawn version compatible with the host API. Verify SHA-256, identity, and version before staging. Finish dependency preparation, source validation, and managed-webview builds before replacing working files; failure preserves the installed source. Installed sources load offline.
7. Development and nightly builds keep pinned repository sources. Publication uses a separate workflow checking published dependencies and the first released SDK supported by each API range.
8. Put the server-computed content hash in object keys. Concurrent writes to a key contain identical bytes; an immutable PostgreSQL version row selects the package. Do not depend on optional provider conditional-write headers.

## Ownership and storage

1. Use full publisher/name IDs for commands, setting records, resource kinds, allocated files, and artifact roots. Local resource types retain their explicit extension owner.
2. Store project files under `.pstdio/extension-storage/<publisher>.<name>/`. Release 0.46 starts fresh; earlier name-only folders remain untouched and unread. Users can move needed files manually.
3. Keep deprecated name-only CLI and resource-kind aliases until the next breaking extension API release; reject ambiguity.
4. Prefix Windows device names with an underscore for package filenames and staging, installed, and project-storage directories. Accepted publisher IDs cannot start with an underscore, so this mapping stays distinct.

## Consequences

- Until stable hosts switch, fixes still arrive with host releases. Afterwards, compatible fixes need no host tag or desktop build.
- Registry installs record registry, full ID, and version.
- On a registry host, a historical Git source matching both the bundled catalog repository URL and folder is host-managed and upgrades through PSX. Identity alone is insufficient; other Git and local sources stay unchanged.
