# `readdirSync` ordering differs between macOS and Linux

## What went wrong

A CLI test for `tickets pull` pre-created a directory `PS-1_pulled-ticket/` with existing files, then called the handler which computed a different directory name (`PS-1_new-content/`) from the pulled content. The test relied on `resolveTicketDir` scanning for `PS-1_*` and finding the pre-created directory first, so the `existsSync` check in `writeTicketAttachment` would throw.

The test passed on macOS but failed in CI (Linux).

## Why

`readdirSync` returns entries in different order depending on the OS and filesystem:

- **macOS (APFS):** creation order — `PS-1_pulled-ticket` appeared first because it was created before `PS-1_new-content`.
- **Linux (ext4 with `dir_index`):** effectively alphabetical — `PS-1_new-content` appeared first because `n` < `p`.

Since `resolveTicketDir` takes the first match from the scan, on Linux it found the newly created (empty) directory instead of the pre-created one, so no conflict was detected and the test's `rejects.toThrow` assertion failed.

## How it was solved

Changed the mock's `getTicketFileContent` to return content with a heading matching the pre-created directory name (`# Pulled ticket`). This way `ticketDirName` computes `PS-1_pulled-ticket`, matching the pre-existing path exactly. The conflict is detected deterministically by `writeTicketFile` itself, independent of directory scan order.

## Key takeaway

Never rely on `readdirSync` ordering in tests or application logic. When a test pre-creates files that a handler should collide with, ensure the computed paths match exactly rather than depending on which entry a directory scan finds first.
