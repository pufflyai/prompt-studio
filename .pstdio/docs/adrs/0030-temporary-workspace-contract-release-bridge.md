# Temporary workspace contract release bridge

Status: accepted for PS-391; remove the bridge at the alpha.11 host cutover.

## Intended design

The SDK describes the public host interfaces. Extensions install a published SDK and declare the host API versions they support. A project owns settings and data, and workspaces own execution locations. Repository context is not part of that model.

## Release constraint

The SDK, extensions, and host are published separately. An extension cannot install an SDK version that has not reached the package registry. Existing alpha.10 hosts require one exact API version, so a manifest cannot currently certify both alpha.10 and alpha.11. The SDK also bundles shared contract declarations that the host imports directly. Replacing those declarations before updating their consumers breaks the intermediate release.

A single breaking cutover cannot meet the required SDK-first, extension-next publication order. Copying the whole contract tree would create another contract owner and would not solve runtime compatibility.

## Temporary bridge

1. Keep the host on alpha.10. Publish additive workspace interfaces and host implementations while retaining repository interfaces and aliases. Resolve the new workspace fields from existing records; do not add a second schema migration or another stored project path.
2. Allow a manifest to enumerate exact API versions with `||`, for example `1.0.0-alpha.10 || 1.0.0-alpha.11`. One shared parser enforces this declaration in runtime loading, contribution validation, and repository verification. Ranges, wildcards, and implicit support for another alpha remain invalid.
3. Publish compatible extensions in separate PRs after the bridge SDK is available. Pin their SDK dependency minimum to that published version. Verify installed packages against the bridge host and the alpha.11 host.
4. Cut the host over to alpha.11 with the single workspace migration. Remove repository interfaces and bridge projections. Already compatible extensions retain their explicit declarations.

This is a temporary release workaround, not a second workspace model. The host owns the compatibility projections. Extensions use the new public interfaces instead of keeping their own repository fallback code. An alpha.10-only extension remains rejected by alpha.11. Unmodified alpha.10 hosts reject dual-version manifests, so the bridge host must ship before compatible extension updates.

## Trade-offs and removal

Alpha.10 pathless root workspaces can select or provision any linked repository. The bridge resolves working files, file sync, processes, and terminals from the explicit repository context by registered ID, including trusted `workspace.provision` and `workspace.ready` events. It rechecks project membership on each access and never redirects a recorded worktree or remote target. The default workspace and `projectFiles` still use the first linked folder. This temporary selection projection has one resolver and is removed with repository linking at the alpha.11 cutover.

Migration 0026 gave older Git worktrees the root provider identity. The bridge projects their Git provider identity and reference when extensions read workspaces. It requires a local, nondefault row, the canonical managed worktree path, the recorded `workspace/<shorthand>` branch registered by Git at that path, and a Git common directory matching a linked source. Registered user folders remain root workspaces. This projection does not change stored rows; lifecycle cleanup still uses the original record. Remove it when the alpha.11 migration materializes each workspace's provider identity and reference.

The bridge briefly exposes old and new interfaces and needs compatibility tests for both.

Changesets propagates dependency releases only through `workspace:` dependencies. Core packages use those dependencies and ship together. Extensions keep published SDK version ranges, so a core release cannot silently update those ranges. Core extensions now share the host version through the Changesets fixed group (ADR 0031). Their separate PRs still update SDK and UI ranges after publication. This dependency ownership rule remains after the bridge is removed.

The PS-391 host cutover PR owns removal of repository aliases and projections once the bridge SDK and compatible extension releases are available. It must preserve IDs and history through the one migration. A following extension-only cleanup removes alpha.10 from declarations when bridge-host support ends. Explicit version enumeration can remain as the public declaration format; it grants no compatibility beyond the versions listed by the author.
