# Allocated extension files

Extension files belong to their full publisher and name. Use the context file methods so the host can preserve ownership during upgrades.

## Full extension IDs

Prompt Studio 0.46 moves allocated
files and artifact mounts under
`.pstdio/extension-storage/<publisher>.<name>/`.
For example, Planner tickets move from
`.pstdio/extension-storage/pstdio-planner/tickets/` to
`.pstdio/extension-storage/pstdio.pstdio-planner/tickets/`.

The host moves existing data without keeping a second copy. Deprecated
name-only paths and `.publishers/<publisher>/` paths resolve to the same owned
data until the next breaking extension API release. Use the full ID in new
scripts. An ambiguous name-only path cannot select either publisher.

Migration preserves publisher folders even when their extensions are disabled or
uninstalled. Read-only workspaces read the earlier layout without moving files or
writing ignore rules. Migration runs when the workspace permits writes.

Windows reserves device names even before a dot. A publisher such as
`con.notes` uses the portable directory `_con.notes`. Let the host return
paths instead of constructing them.

## Earlier API 0.2 migration

Extension API 0.2 moves the documented `ctx.extensionFiles` root from
`.pstdio/ext/<publisher>.<name>/` to
`.pstdio/extension-storage/<package-name>/.publishers/<publisher>/`.
Publishers with the same package name keep separate files and ignore rules, including
after disable, reload, and uninstall. The relative file methods stay unchanged.
This is a breaking filesystem layout change.

API 0.2 shipped in 0.44.0. Release 0.43.x provides API 0.1.6 and still uses `.pstdio/ext/<publisher>.<name>/`, so do not move files before the app you run provides API 0.2. See [App, SDK, and extension API versions](../../references/extensions/0014-api-versioning.md#app-sdk-and-extension-api-versions).

Declared artifact mounts keep their existing paths under the package-name root.
They cannot start with the reserved `.publishers` segment, including case variants.
Rename any existing mount that uses that segment before upgrading.

Update an extension's `engines.pstdio` declaration after checking its file paths.
An extension that works on both API lines can declare `^0.1.0 || ^0.2.0`.

## Move existing files

Stop commands that write extension files. Create
`.pstdio/extension-storage/<package-name>/.publishers/<publisher>/`, then move the contents of the old
`.pstdio/ext/<publisher>.<name>/` directory there. If the destination already exists,
compare and merge files without overwriting either copy. Preserve unsaved data.

Update scripts and saved file links that use the old absolute location. The new host
reads and writes only the new root. Package source files stay in their source or
installation directories. Deliberate project outputs, such as icon fonts, stay at
their configured project paths.
