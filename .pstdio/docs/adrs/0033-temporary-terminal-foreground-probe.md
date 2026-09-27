# Temporary terminal foreground probe

Proposed: 2026-09-26 (first recorded in Git)

## Status

Accepted as a temporary workaround.

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

Bun 1.4.2 exposes neither the PTY descriptor nor a foreground-group method. Its documented
Terminal API cannot call `tcgetpgrp`. Adding a native module only for this query would add
platform builds and packaging work that the host does not otherwise need.

## Temporary workaround

As a temporary workaround, a small host helper reads Linux process metadata from `/proc`
and queries `ps` on macOS. The helper supplies terminal titles and checks foreground
ownership alongside the shell's prompt state. Unknown process state remains active so failed probes
cannot hide running work. Windows retains that conservative behavior.

The macOS probe starts a short process, which costs more than a direct system call.
Keep it isolated in `terminal-foreground.ts`.

## Removal

Replace this helper with Bun's foreground
process API when one is available, then remove this ADR's workaround. Shell lifecycle
markers remain necessary even with that API. Background and
stopped jobs do not count as foreground activity.

Reference: https://bun.sh/docs/runtime/child-process#terminal-pty-support
