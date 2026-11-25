# Temporary Bun process rejection assertions

Proposed: 2026-11-04

Status: Accepted as a temporary workaround; verified on Windows x64 and ARM.

## Intended design

A test can await `expect(operation()).rejects.toThrow(...)` while a child process handles the operation. Process output continues to reach the parent during the assertion.

## External limitation

With pinned Bun 1.4.4, the relay fixture on both Windows architectures receives three successful responses, then hangs in the rejection assertion. Native diagnostic [41921163277](https://github.com/pufflyai/prompt-studio/actions/runs/41921163277) shows the child writes the expected missing-snapshot error, while the parent does not handle that response before the unchanged 30-second deadline. Child teardown finally rejects the pending operation.

Awaiting the operation with ordinary promise handlers before asserting the error passes on both Windows architectures in [41922769159](https://github.com/pufflyai/prompt-studio/actions/runs/41922769159), with the same process protocol and workload. This isolates the observed failure to the asynchronous assertion boundary; Bun's internal cause is not established.

The extension backend worker test also hangs while asserting the failure returned by a worker command. The [scheduled nightly](https://github.com/pufflyai/prompt-studio/actions/runs/45537048760/job/138951129087) and [manual nightly](https://github.com/pufflyai/prompt-studio/actions/runs/45581787680/job/139100404900) both reach the existing 15-second test deadline. A [focused Windows run with IPC tracing](https://github.com/pufflyai/prompt-studio/actions/runs/45618695298) shows the worker sends the failure and the parent handles neither the notification nor the failure before teardown.

## Temporary decision

The relay fixture and extension backend worker tests await the rejection first, then check its type and message synchronously. The worker test also checks that the host strips the reserved error code from the worker's response. No timeout, process behavior, negative control, or cancellation check changes. Other rejection assertions remain unchanged unless they reproduce the same problem.

## Removal

When the minimum Bun version changes, check the original asynchronous rejection assertions on both Windows architectures. Remove this record and restore those assertions once process output is handled before the original deadlines. PS-1018 tracks the original release qualification evidence.
