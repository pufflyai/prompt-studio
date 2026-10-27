# Temporary Darwin exiting process group cleanup

Proposed: 2026-10-26

This is a temporary workaround, not the intended design.

## Ideal behavior

An owned process-group signal should reach the group or report `ESRCH` once
the group is gone. Cleanup should use the same ownership rule while the group
leader is running and while it exits.

## External limitation

On macOS with Bun 1.4.4, a private Pi account worker can write its completion
frame and begin exiting before the parent's child-process close event. During
that interval, signalling its detached process group can return `EPERM` even
though its PID and user ownership remain valid. A local reproduction showed
the process in the exiting state. Treating this as a failed account action
causes successful native sign-in and status probes to fail intermittently.

A clean fix requires the runtime or operating system to distinguish this
exiting-group race from a permission failure. The parent cannot infer that
distinction from `EPERM`; the owned child handle is the available alternative.

## Decision

Continue signalling the owned group first. On Darwin only, if that signal
returns `EPERM`, signal the owned ChildProcess handle instead. Its native
handle accounts for a child that has already exited. A denied child signal
still fails. Preserve the existing two-second forced-cleanup deadline and
wait for close.

The fallback signals only the leader. Descendants that retain the stdio pipes
may therefore wait until the forced group signal at the existing deadline.
The child handle alone does not prove descendant cleanup; waiting for close
and retaining the later group signal are necessary.

## Limitations

The fallback is restricted to the observed platform and error. It does not
hide arbitrary permission errors or change Linux and Windows termination.
The regression injects the group refusal while using a real owned child.
Native account worker tests also cover completion and cancellation.

## Removal

Remove the fallback once the supported Bun/macOS combination consistently
reports an already exiting group without this race. Keep completion and
cancellation tests when removing it.
