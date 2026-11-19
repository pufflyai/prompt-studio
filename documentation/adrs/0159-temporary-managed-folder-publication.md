# Temporary native publication for managed folder creation

Proposed: 2026-11-19
Status: Proposed; implementation and platform qualification tracked by PS-44.

## Decision

Record a private staging directory and its filesystem identity before publishing a managed project folder. Keep that creation receipt until the ordinary ownership marker is durably saved. Retry can finish the same publication after a process interruption or failed marker write, without depending on rollback.

An existing destination is retained and never claimed. An identity mismatch is not ownership. Creation cleanup removes only an empty private staging directory; it never recursively deletes an unverified directory. The existing project lease serializes cooperating processes.

## External limitation

Node's portable rename API does not offer an exclusive-directory-rename flag. A pathname check followed by ordinary POSIX rename can replace an empty destination created in between. The ideal implementation uses a portable, directory-relative, exclusive rename API.

Use the existing held-parent native publisher on macOS and glibc Linux. On musl Linux use the same kernel renameat2 operation through libc syscall. On Windows use MoveFileExW without replacement or cross-volume-copy flags. Verify the parent and published directory identities. These adapters are private to owned folder publication; they do not expand the separately qualified folder-restoration platforms in ADR0138.

The Windows pathname operation assumes the application's private staging parent remains under its control. A changed published identity is retained and rejected, never marked as owned. Filesystem refusal fails the operation; there is no ordinary rename fallback.

## Durability and recovery

Publish small receipt/marker files atomically after syncing their bytes. Sync the metadata directory on POSIX and the published file on Windows. A pending staging receipt can remove and recreate only an empty reserved staging entry. Nonempty or replaced staging entries are retained for recovery. Removal consumes the same verified creation proof when the final marker is absent.

## Evidence

The owning regression reproduces marker-write and rollback failure on the previous implementation. Qualification covers successful publication, pre-existing empty directories/files, pending receipt recovery, changed identities and actual native platforms. Original failures remain in RP822.

The native size approval is request01a1f15f-f5bb-7d92-9cd3-34916c09a43b; the review conversation records the user's explicit approval of both repairs.

## Removal

Replace these private adapters when the supported runtime exposes equivalent atomic no-replace publication on every supported platform. Preserve receipt recovery and all destination/identity tests. Remove this ADR with the temporary native adapters.

## Sources

- [MoveFileExW flags](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw)
- [Linux renameat2 contract](https://www.kernel.org/pub/linux/docs/man-pages/book/man-pages-6.17.pdf)
- [musl syscall implementation](https://git.musl-libc.org/cgit/musl/tree/src/unistd/syscall.c)
