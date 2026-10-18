# Extension file storage

All extension-owned project files belong in `.pstdio/extension-storage/<package-name>/`.
This includes configuration, caches, drafts, prototypes, screenshots, ticket checkouts,
report checkouts, and migration backups. Keep this directory out of Git unless the
project deliberately tracks a specific extension's files.

Use `ctx.extensionFiles` for allocated extension files. Use declared artifact mounts
for view access and change events. Both stay inside the package-name directory.
Allocated files use its reserved `.publishers/<publisher>/` child so publishers with
the same package name keep separate data. Read the
[API 0.2 migration guide](0009-allocated-extension-files.md) before upgrading.
Use `ctx.storage.records` for shared structured project data. Keep the revision a
caller read and save related records with one grouped commit. Use
`ctx.storage.assets` for immutable referenced bytes. Read the
[save workflow](../sdk/0003-storage.md) and
[storage API](../../references/sdk/0004-storage.md) for details.

Implementation agents must preserve the caller's original revisions. Return the
save outcome to the command caller and retain conflicts for an explicit decision.
Retry only the identical storage request after an uncertain result. Never replay a
whole command that may have started work or changed an external service. Keep local
files, conversations, process state, and caches with their environment owner.

Extension source stays in `.pstdio/extensions/` for repo extensions or in the installed
extension package. Files an extension deliberately edits as project source, such as
icon fonts under `packages/ui/public/font/`, stay at their configured project paths.
The extension's settings and temporary files still belong in extension storage.

## Availability

This page describes `main`, which ships in the release after 0.43.x. Release 0.43.x differs:

- `ctx.extensionFiles` writes to `.pstdio/ext/<publisher>.<name>/`. The `.publishers/<publisher>/` root comes with extension API 0.2; see [Allocated extension files in API 0.2](0009-allocated-extension-files.md).
- `ctx.storage.records` and `ctx.storage.assets` do not exist. Use `ctx.storage.get`, `set`, `delete`, and `collection`. See [storage availability](../../references/sdk/0004-storage.md#availability).
- Planner and Reports keep their files in `.pstdio/tickets/` and `.pstdio/reports/`. The moves in [Move existing local files](#move-existing-local-files) apply only after you update to a release with the updated extensions.
- Declared artifact mounts already live under `.pstdio/extension-storage/<package-name>/`.

## Drafts, prototypes, and published artifacts

A prototype is a working draft, often an HTML page with TypeScript build sources and
screenshots. It has no separate storage system. Keep artifact drafts and prototypes in
`.pstdio/extension-storage/pstdio-artifacts/drafts/<name>/`.

Publishing through `pst pstdio-artifacts publish` saves a snapshot under the Artifacts
extension's storage. The source draft can stay beside it for later edits. Keep the
published URL and pass it when publishing a new revision.

Use the absolute `path` and `filesPath` returned by ticket and report commands. Put
implementation and review evidence in report files. Do not invent another top-level
`.pstdio/artifacts/`, `.pstdio/prototypes/`, or extension-specific data folder.

## Move existing local files

Stop commands that write these files before moving them. Preserve unsaved drafts and
evidence. Move each old directory into its owner's directory, creating the destination
parent first. If a destination already exists, compare and merge its files without
overwriting either copy.

| Old project path | New project path |
| --- | --- |
| `.pstdio/font-editor/config.json` | `.pstdio/extension-storage/font-editor/config.json` |
| `.pstdio/tickets/` | `.pstdio/extension-storage/pstdio-planner/tickets/` |
| `.pstdio/reports/` | `.pstdio/extension-storage/pstdio-reports/reports/` |
| `.pstdio/ticket-identity-migration/` | `.pstdio/extension-storage/pstdio-planner/ticket-identity-migration/` |
| `.pstdio/artifacts/` | `.pstdio/extension-storage/pstdio-artifacts/drafts/` |
| `.pstdio/prototypes/` | `.pstdio/extension-storage/pstdio-artifacts/prototypes/` |

The updated extensions read and write only the new paths. Update local scripts and saved file
links that use an old path. Refresh installed agent skills from their updated sources.
Published artifact URLs and saved ticket and report identities stay valid.
