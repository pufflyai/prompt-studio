# Allocated extension files in API 0.2

Extension API 0.2 moves the documented `ctx.extensionFiles` root from
`.pstdio/ext/<publisher>.<name>/` to `.pstdio/extension-storage/<package-name>/`.
Artifact mounts already use this package-name root. The relative file methods stay
unchanged. This is a breaking filesystem layout change.

Update an extension's `engines.pstdio` declaration after checking its file paths.
An extension that works on both API lines can declare `^0.1.0 || ^0.2.0`.

## Move existing files

Stop commands that write extension files. Create the owning package's directory under
`.pstdio/extension-storage/`, then move the contents of its old
`.pstdio/ext/<publisher>.<name>/` directory there. If the destination already exists,
compare and merge files without overwriting either copy. Preserve unsaved data.

Update scripts and saved file links that use the old absolute location. The new host
reads and writes only the new root. Package source files stay in their source or
installation directories. Deliberate project outputs, such as icon fonts, stay at
their configured project paths.
