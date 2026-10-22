# Temporary native command output capture

Proposed: 2026-10-20

Status: Accepted

## Intended design

Extension commands finish only after the child exits and both output streams are drained. Cancellation stops the child before its caller removes build files. The same behavior applies to dependency installation and webview builds on every platform.

## External limitation

Bun 1.4.2 on Windows crashes in the Node-compatible child-process pipe implementation. CI run [39418418782](https://github.com/pufflyai/prompt-studio/actions/runs/39418418782) crashed while the webview build manager captured real child build output. The symbolicated stack enters `uv__queue_remove`, `uv_timer_stop`, `uv_timer_start`, and Windows `eof_timer_start` from `uv__process_pipe_read_req`. This is a native pipe lifecycle failure, so application exception handling cannot recover it.

## Decision

Temporarily use `Bun.spawn` with stdout and stderr directed to separate temporary files in the extension command runner. This removes output pipes entirely, including the Windows EOF timer that crashed. Await child exit before reading either file and remove both files before returning. Keep command resolution, Windows verbatim arguments, environment, diagnostics, and cancellation behavior. Do not retry failed commands or change test allowances.

The workaround stays in the command runner used by extension installation and builds. The real builder and build-manager tests keep exercising child processes on Windows.

## Limitations

This avoids the failing pipe path; it does not fix Bun's native implementation. Each command creates and removes two temporary output files, adding filesystem work. The runner depends on Bun, as the application already does.

## Removal

When Bun fixes this Windows pipe lifecycle crash, repeat the command capture and cancellation tests and the complete webview build-manager failure suite on Windows before returning to Node-compatible child-process streams.
