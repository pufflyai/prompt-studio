# Allocated extension files in API 0.2

Extension API 0.2 moves the documented `ctx.extensionFiles` root from
`.pstdio/ext/<publisher>.<name>/` to
`.pstdio/extension-storage/<package-name>/.publishers/<publisher>/`.
Publishers with the same package name keep separate files and ignore rules, including
after disable, reload, and uninstall. The relative file methods stay unchanged.
This is a breaking filesystem layout change.

API 0.2 is on `main` and in `0.44.0-nightly` builds. It ships in the release after 0.43.x. Release 0.43.x provides API 0.1.6 and still uses `.pstdio/ext/<publisher>.<name>/`, so do not move files before the app you run provides API 0.2. See [App, SDK, and extension API versions](../../references/extensions/0014-api-versioning.md#app-sdk-and-extension-api-versions).

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
