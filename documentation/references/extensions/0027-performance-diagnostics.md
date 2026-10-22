# Device performance diagnostics

Status: Added by PS-724; release publication and platform validation are pending. Do not claim support in an extension's published dependencies until that release exists.

The device host owns monitoring state and collection. An extension uses `createWebviewClient(host).performance` from `@pstdio/sdk/extensions`. It does not access Electron, start process probes, or keep another enabled preference.

Declare `performance.read` to read state, a snapshot, or subscribe to snapshots. Declare `performance.control` to change monitoring or pause and resume an installed extension's views. The host additionally requires a local user interaction for controls. A runtime command cannot enable monitoring on another device.

`state()` returns the host kind and enabled state. `snapshot()` returns `null` while disabled. `subscribe(listener)` returns an asynchronous disposer. Concurrent consumers share the host's collector and polling; the bridge releases its listener on disconnect. Call the disposer when the view unmounts.

Use `await client.performance.retain()` to hold capture ownership while your monitoring view is loaded. It returns a disposer and does not enable monitoring. The host shares one capture across owners, releases ownership on disconnect, and stops collection when the last owner leaves. The saved preference stays unchanged. The legacy host module retains its own owner during the migration.

`recordings()` explicitly exports the protected recording directory and bounded saved JSONL files, including after disable. Browser hosts return `null`. Read access never starts a recorder.

`setEnabled(boolean)` controls the existing device preference. `pauseExtension(installedExtensionId)` and `resumeExtension(installedExtensionId)` use the same paused-view state as the legacy widget. They do not stop backend commands or sessions.

## Developer settings

Register a normal `defineSettingsPanel` contribution with `slot: workbenchSlots.developerSettings`. Its referenced view appears within the host's Developer tools panel. Removing one contribution removes only that control. The host resolves this target explicitly and preserves existing global and project settings targets.

A webview settings control receives intrinsic content height. Its contribution does not own the surrounding settings panel's scrolling or geometry. Use the exported UI components and tokens for its content.

The released SDK includes the source example under `examples/performance`. The example uses public SDK/UI imports, declares permissions, and contributes a toggle without creating a second widget.

## Snapshot data

Version 2 extends the existing version-1 snapshot fields with `capture`. A capture identifies the host version, platform, start time, nominal interval, and bounded sample history. Each sample has a sequence number, timestamp, monotonic elapsed time, and actual interval. Missing coverage remains visible; it is not filled with zero values.

Process identity is PID plus process start identity. CPU is measured as a percentage of one core, and cumulative CPU time uses milliseconds. All new memory fields use bytes. Resident memory, macOS physical footprint (including compressed memory), Windows private commitment, JavaScript heap, and external memory have distinct meanings. Unsupported readings are `null`; shared resident memory must not be summed into an exact app total.

The host measures backend response time outside the backend. A `reply` has a finite response time. A `timeout` reports its observed waiting interval and a null response time. Disconnected and unsupported readings are `unavailable`. Local process measurements describe only the local runtime. These fields report symptoms and do not infer their cause.

See the [Developer tools guide](../../guides/0003-developer-tools.md) for recording bounds and lifecycle behavior.
