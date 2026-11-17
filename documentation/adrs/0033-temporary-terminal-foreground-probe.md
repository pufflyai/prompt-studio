# Temporary terminal foreground probe

Proposed: 2026-09-26

Status: Accepted as a temporary workaround.

## Intended design

The terminal supervisor should read the PTY foreground process group directly from Bun
for process titles and foreground ownership. This cannot identify an idle prompt: shell
builtins such as `read` run in the shell's own process group.

Shell lifecycle markers establish whether a supported interactive shell is at its prompt.
The terminal supervisor owns that transient state, marks submitted input as active immediately, and
clears it only when a prompt marker arrives. Startup files install shell hooks without
changing user files. Unsupported shell invocations and unavailable hooks remain active.
Ordinary editing at the prompt stays idle. Bash uses a DEBUG hook only when the user has
not installed one. It emits one busy marker per command, including commands made only
of shell builtins. Zsh uses its preexec and precmd hooks. Windows and other shells remain
active until the host can obtain reliable prompt state for them.

## External limitation

Bun 1.4.4 exposes neither the PTY descriptor nor a foreground-group method. Its documented
Terminal API cannot call `tcgetpgrp`. Adding a native module only for this query would add
platform builds and packaging work that the host does not otherwise need.

## Temporary workaround

As a temporary workaround, a small host helper reads Linux process metadata from `/proc`
and native process metadata on macOS. The helper supplies terminal titles and checks foreground
ownership alongside the shell's prompt state. Unknown process state remains active so failed probes
cannot hide running work. Windows retains that conservative behavior.

The probe runs every second for each open terminal. macOS reads `proc_bsdinfo.e_tpgid`
and the foreground command's `argv[0]` through the system library, using Bun's existing FFI
support without a separately built native module. This replaces two short `ps` children per
probe: those children could exit between whole-app process enumeration and memory sampling.
The native command read preserves aliases used for terminal titles. Failed reads remain unknown.
Linux uses `fs/promises`; the title poll waits for one probe to settle before scheduling the next.
Keep the platform boundary isolated in `terminal-foreground.ts` and its Darwin adapter.

## Removal

Replace this helper with Bun's foreground
process API when one is available, then remove this ADR's workaround. Shell lifecycle
markers remain necessary even with that API. Background and
stopped jobs do not count as foreground activity.

Reference: https://bun.sh/docs/runtime/child-process#terminal-pty-support
