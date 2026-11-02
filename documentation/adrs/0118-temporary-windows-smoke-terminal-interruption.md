# Temporary Windows smoke terminal interruption

Proposed: 2026-10-31

Status: Accepted.

## Intended behavior

`pst extensions test` handles Ctrl+C through its existing abort controller, stops its browser and owned runtime, retains requested evidence, and exits with code 130. Normal process signals should provide this on every platform.

## External limitation

With pinned Bun 1.4.4, the compiled command launched through Bun's native Windows PTY does not observe the registered SIGINT handler. Both x64 and ARM64 instead run until dashboard readiness expires and exit 1. The precise console delivery failure remains unresolved. Evidence: [Windows x64](https://github.com/pufflyai/prompt-studio/actions/runs/41209288367/job/124564584165) and [Windows ARM64](https://github.com/pufflyai/prompt-studio/actions/runs/41209288367/job/124564584184). Earlier combined-head evidence records the same x64 failure. Force-terminating the process would bypass the cleanup contract.

## Temporary decision

Only this Windows command also reads Ctrl+C from its real terminal input. A small terminal adapter enables raw input, sends ETX to the existing abort handler, then restores the input mode and flow state. Existing SIGINT and SIGTERM handling remains in place. Piped input does not use this adapter. A real raw-PTY regression verifies input delivery and restoration; the packaged native checks still require exit 130, stopped processes and retained evidence.

## Limitations

This isolates the observed console delivery problem; it does not establish its cause inside the Windows/Bun transport. Native hosted validation remains required. It does not change readiness deadlines, test allowances or cleanup assertions.

## Removal

Remove the adapter from the command when ordinary SIGINT handling passes the existing compiled interruption case on Windows x64 and ARM64 with the pinned runtime. Keep the end-to-end cleanup assertions. Retain this record as superseded when the adapter is removed.
