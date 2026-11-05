# Temporary native filesystem operations for folder recovery

Proposed: 2026-11-05
Status: Proposed. Implementation and platform qualification are in progress.

## Decision

Keep recovery traversal and publication in a small core filesystem adapter. Open each child relative to a held directory handle, inspect links without following them, and enumerate that same directory object. Recheck identities and content metadata before publishing a capture. Restore writes stay inside its owned staging directory, then publish beside it with an atomic operation that refuses an existing destination.

Use POSIX directory descriptors and Windows directory handles. Keep native declarations and structure layouts in separate platform files. These functions own and close their handles; no native pointer, descriptor or project path crosses the public SDK. Ordinary file bytes use bounded asynchronous reads.

## External limitation

The ideal interface is a supported Bun filesystem API for directory-relative access and atomic publication without replacement. The current Node-compatible filesystem API does not expose that complete contract. A path check followed by a path-based operation does not hold the checked object through a concurrent rename or link change. Ordinary rename can replace an existing empty destination.

TypeScript-only core code therefore uses the existing repository's Bun FFI mechanism for the missing operating-system calls. It does not add a compiler toolchain or shell-command fallback. [Bun documents FFI's experimental status](https://bun.com/docs/runtime/ffi), so platform and packaged qualification are required before recovery is advertised.

## Platform contracts

POSIX traversal opens children relative to a directory descriptor and refuses link traversal. Directory enumeration consumes a duplicated readable descriptor, preserving the original handle's owner. Link text is read without opening its target.

Apple ARM64 passes the variadic creation mode of `openat` on the stack, while Bun FFI exposes fixed C signatures. The adapter must explicitly place that argument after the eight integer-register slots on this platform; using the ordinary four-argument declaration produced an unreadable starter policy in the real capture test. Keep this calling-convention shim isolated and verify exact created permissions. Other platforms use their ordinary calling convention. See [Apple's ARM64 variadic calling rules](https://developer.apple.com/documentation/xcode/writing-arm64-code-for-apple-platforms) and [Bun's fixed FFI signature](https://bun.com/reference/bun/ffi/FFIFunction).

On Windows, [NtCreateFile](https://learn.microsoft.com/windows/win32/api/winternl/nf-winternl-ntcreatefile) supplies directory-relative opens and reparse-point access. [NtQueryDirectoryFile](https://learn.microsoft.com/windows-hardware/drivers/ddi/ntifs/nf-ntifs-ntquerydirectoryfile) enumerates a held handle. [FILE_RENAME_INFORMATION](https://learn.microsoft.com/windows-hardware/drivers/ddi/ntifs/ns-ntifs-_file_rename_information) supplies the refusal-to-replace publication contract. Native errors leave the operation incomplete; no weaker fallback is allowed.

## Limitations

Unsupported native calls, filesystems, entry types or metadata block completion with an actionable error. They never become exclusions. Qualification must include actual macOS, Linux and Windows behavior, directory/link replacement, destination races, cancellation and packaged binaries. It must also prove that a large file does not block record sync or another account. A local pass does not complete those gates.

## Removal

Replace the adapter when supported Bun or Node APIs provide held-directory traversal, link-safe access and atomic no-replace publication on every supported platform. Run the same adversarial filesystem and packaged tests before removing the native calls. Do not replace them with separate checks and ordinary rename.
