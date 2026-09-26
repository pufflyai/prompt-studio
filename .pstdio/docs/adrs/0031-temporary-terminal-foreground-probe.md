# Temporary terminal foreground probe

The terminal supervisor should read the PTY foreground process group directly from Bun.
An interactive shell at its prompt is idle. A different foreground group is active work.

Bun 1.4.2 exposes neither the PTY descriptor nor a foreground-group method. Its documented
Terminal API cannot call `tcgetpgrp`. Adding a native module only for this query would add
platform builds and packaging work that the host does not otherwise need.

As a temporary workaround, a small host helper reads Linux process metadata from `/proc`
and queries `ps` on macOS. Activity is derived when requested; it is not stored. The same
helper supplies terminal titles. Unknown process state remains active so failed probes
cannot hide running work. Windows retains that conservative behavior.

The macOS probe starts a short process, which costs more than a direct system call.
Keep it isolated in `terminal-foreground.ts`. Replace this helper with Bun's foreground
process API when one is available, then remove this ADR's workaround. Background and
stopped jobs do not count as foreground activity.

Reference: https://bun.sh/docs/runtime/child-process#terminal-pty-support
