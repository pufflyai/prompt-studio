# Temporary Git subprocess pipe ownership

## Intended behavior

The Git adapter must consume stdout and stderr completely and keep their readers alive until the command finishes. Text commands and binary file previews must use the same subprocess owner. A Git error must fail the caller without a retry.

## External limit

Bun 1.3.14's direct spawn/readable-stream path failed in two independent Linux CI runs. `git symbolic-ref --short HEAD` and `git worktree list --porcelain` exited with SIGPIPE while their output was being consumed through `new Response(proc.stdout)`.

The second run captured system calls. Git PID 7507 failed its first stdout write with EPIPE and died from SIGPIPE. The parent also closed descriptor 98 twice, with the second close returning EBADF. The first run failed a different command in the same adapter. Both commands pass when run alone; repeated local probes did not reproduce the fault. The evidence establishes a subprocess pipe lifetime failure, but does not identify the exact Bun native code responsible.

The adapter already awaits both output streams and process exit. There is no supported application-level way to repair a native descriptor after another close has invalidated it. Retrying Git would hide the defect and could repeat a mutation.

## Temporary workaround

Use `node:child_process.execFile` for Git commands. Its callback owns the process and both output streams through completion. Request Buffer output for binary previews and decode only text results. Keep the prior unbounded output capacity, argument-array execution, native Windows Git resolution, and hidden Windows console behavior.

The change stays inside the Git adapter and its binary preview caller. It avoids direct Bun ReadableStream-to-Response ownership. It still runs on Bun, so the supported Node-compatible path must be verified on the real CI runners. There are no retries or Git-command fallbacks.

## Removal

Reconsider the adapter when a supported Bun version passes repeated full CLI and worktree suites without premature pipe closure. Keep the captured CI logs and syscall excerpt with the PS-74 report. Remove this ADR's workaround only after both text and binary output, failure propagation, and Windows behavior have been checked.
