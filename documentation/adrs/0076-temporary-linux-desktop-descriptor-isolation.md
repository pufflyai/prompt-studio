# Temporary Linux desktop descriptor isolation

Proposed: 2026-10-16

Status: Accepted

## Intended behavior

The desktop starts the Bun runtime with its chosen standard input and launch log only. Browser storage locks, Chromium resource files, graphics buffers, and audio handles belong to Electron. The runtime must release independently when the desktop closes or detaches. Its PID must stay stable for runtime ownership and cancellation.

## External limitation

Electron 43.6.0 on Linux opens native descriptors after Node initializes. Some do not have the close-on-exec flag. Node's `child_process.spawn` configures the specified standard streams but does not close every other descriptor that native code opened. Setting `stdio` entries above 2 to `ignore` does not close these inherited descriptors either.

The [libuv process implementation](https://github.com/libuv/libuv/blob/v1.x/src/unix/process.c) handles specified descriptors and leaves other descriptors to their existing close-on-exec flags. Node's public spawn API has no option to close all other Linux descriptors. A clean fix belongs in the upstream launch boundary. It cannot currently be expressed through that public API without an upstream change or shipping native application code.

A real Electron regression test reproduced 32 inherited Chromium resource, profile, and shared-memory descriptors in a Bun child. The original machine audit also found inherited browser storage locks and audio handles in the installed runtime.

## Decision

Use a temporary workaround only for the desktop's Linux runtime launch. Start the bundled Bun executable in its existing `BUN_BE_BUN` mode with a small bootstrap. The bootstrap uses Bun's FFI support and the system C library to mark descriptors above standard error as close-on-exec, then replaces itself with the normal runtime command using `process.execve`.

The replacement closes those descriptors and preserves the PID, chosen standard streams, original arguments, and runtime environment. Remove the bootstrap's `BUN_BE_BUN` setting before replacement. There is no shell, permanent helper process, new public command, or user setting. macOS and Windows keep their existing launch path.

Keep the workaround in `clients/desktop/src/runtime/runtime-exec.ts`. The runtime and extensions do not inspect Electron paths or repair inherited desktop resources themselves.

## Limitations

This adds one Bun initialization and process replacement to Linux startup. Measure it with the same cold startup workload and existing limits. The supported Linux builds use glibc and `/proc`; the bootstrap uses their existing `fcntl` interface. A failure must be visible in the launch log rather than silently starting with leaked handles.

This does not fix descriptor inheritance for arbitrary programs launched elsewhere. It applies only to the demonstrated Electron-to-runtime boundary.

## Removal

Remove the bootstrap when a supported Electron and Node/libuv release provides correct descriptor isolation for the normal spawn call. Keep the real Electron regression test and first prove it passes without the workaround. Also verify runtime promotion, desktop detach, cancellation, launch logs, and unchanged cold startup workloads before removal.
