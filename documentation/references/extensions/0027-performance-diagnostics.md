# Device performance diagnostics

Status: Published in `@pstdio/sdk` 0.46 previews. The first-party Prompt Studio Performance Monitoring extension (`extensions/pstdio-performance`) is the reference consumer.

The device host owns monitoring state and collection. An extension uses `createWebviewClient(host).performance` from `@pstdio/sdk/extensions`. It does not access Electron, start process probes, or keep another enabled preference.

Declare `performance.read` to read state, a snapshot, or subscribe to snapshots. Declare `performance.control` to change monitoring or pause and resume an installed extension's views. The host additionally requires a local user interaction for controls. A runtime command cannot enable monitoring on another device.

`state()` returns the host kind and enabled state. `snapshot()` returns `null` while disabled. `subscribe(listener)` returns an asynchronous disposer. Concurrent consumers share the host's collector and polling; the bridge releases its listener on disconnect. Call the disposer when the view unmounts.

Use `await client.performance.retain()` to hold capture ownership while your monitoring view is loaded. It returns a disposer. In the Prompt Studio dashboard, the first retained capture also turns monitoring on and releasing the last one turns it off, so a loaded monitoring extension is the device opt-in. The host shares one capture across owners, releases ownership on disconnect, and stops collection when the last owner leaves. The saved preference stays unchanged. The host's own renderer observers also hold an owner for the window's lifetime.

`recordings()` explicitly exports the protected recording directory and bounded saved JSONL files, including after disable. Browser hosts return `null`. Read access never starts a recorder.

`setEnabled(boolean)` controls the existing device preference. `pauseExtension(installedExtensionId)` and `resumeExtension(installedExtensionId)` use the host's paused-view state, which the snapshot reports as `pausedExtensionIds`. They do not stop backend commands or sessions.

## Developer settings

Register a normal `defineSettingsPanel` contribution with `slot: workbenchSlots.developerSettings`. Its referenced view appears within the host's Developer tools panel. Removing one contribution removes only that control. The host resolves this target explicitly and preserves existing global and project settings targets.

A webview settings control receives intrinsic content height. Its contribution does not own the surrounding settings panel's scrolling or geometry. Use the exported UI components and tokens for its content.

The released UI package includes the source example under `examples/performance`. The example uses public SDK/UI imports, declares permissions, and contributes a toggle without creating a second widget.

## Snapshot data

Version 2 extends the existing version-1 snapshot fields with `capture`. A capture identifies the host version, platform, start time, nominal interval, and bounded sample history. Each sample has a sequence number, timestamp, monotonic elapsed time, and actual interval. Missing coverage remains visible; it is not filled with zero values.

Process identity is PID plus process start identity. CPU is measured as a percentage of one core, and cumulative CPU time uses milliseconds. All new memory fields use bytes. Resident memory, macOS physical footprint (including compressed memory), Windows private commitment, JavaScript heap, and external memory have distinct meanings. Unsupported readings are `null`; shared resident memory must not be summed into an exact app total.

New hosts also supply an optional UTC process creation timestamp, `startedAt`. Older hosts omit it. The opaque `processStartId` remains the identity; do not replace it with a timestamp. A verified creation time within the capture allows cumulative CPU and native lifetime memory peaks to include startup before the first reading. Without that coverage, report CPU between readings and observed memory peaks explicitly.

The host measures backend response time outside the backend. A `reply` has a finite response time. A `timeout` reports its observed waiting interval and a null response time. Disconnected and unsupported readings are `unavailable`. Local process measurements describe only the local runtime. These fields report symptoms and do not infer their cause.

See the [Developer tools guide](../../guides/0003-developer-tools.md) for recording bounds and lifecycle behavior.

## Current limits

These are gaps in the published API, not choices of the Performance Monitoring extension:

- A status bar item cannot follow the monitoring state. Keep a status webview's content non-empty: a zero-width cross-origin frame is never laid out again, so it cannot report a new width. The Performance Monitoring meter shows an **Off** state instead of disappearing.
- An extension cannot open its own status popover from a command, and its commands run in the runtime, which cannot read device measurements. Device actions such as copying a snapshot belong in the extension's views.
- `extensionFrames` identify an extension only by its install id and webview id. Consumers cannot show the extension's display name.
- Extension contributions load with a project. With no project open, no extension control or meter exists, although the device switch may still be on.
