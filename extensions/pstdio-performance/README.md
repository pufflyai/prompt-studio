# Prompt Studio Performance Monitoring

Prompt Studio Performance Monitoring shows how Prompt Studio runs on this device: the workbench frame rate, how fast the backend answers, and the CPU and memory of the backend and the workbench. Use it when the app feels slow, a fan spins up, or an extension seems to do too much work.

The host owns continuous sampling, recordings and `pst performance`. The extension displays these through the public performance capabilities. It also offers explicit, short backend diagnostic captures through public commands and durable automation; opening the panel never starts a profiler.

## Install

Prompt Studio Performance Monitoring is installed by default. Its install name is `performance`. To add it again:

```sh
pst extensions add pstdio-performance
```

## Turn it on

Monitoring runs while this extension is enabled. Disable the extension to stop it. There is no separate switch. Device measurements stay on this device. Backend diagnostics stay on the runtime machine and are never uploaded or synced to the project.

## What it shows

- **Status bar meter**: the last 12 seconds of frame rate, the current fps, and, in the desktop app, the backend's recent response times, CPU and memory. **Reconnecting** replaces the response time while the backend does not answer. The meter shows **Off** while monitoring is off; select it to find the switch.
- **Details**: select the meter to see the frame rate, aligned response-time, CPU and memory charts for the backend and the workbench, and the CPU of each extension process. Pause an extension's views from its row, and copy the current snapshot as JSON with the copy button.

Missing readings are shown as unavailable, never as zero. Memory uses the most precise measurement the platform reports; hover the memory values to see which one. See the [Developer tools guide](../../documentation/guides/0003-developer-tools.md) for every field and limit.

## React Scan

Open the Performance popover and enable **Highlight React renders**. Close the popover to use the workbench while React Scan highlights renders. Reopen it to turn highlighting off. The choice belongs to this window, starts off after reload, and stops when monitoring is disabled.

Only the workbench is scanned; extension frames and other windows are separate. Unsupported hosts show an unavailable control. Production names may be shortened. Scanning adds overhead, and its early hook and idle infrastructure remain after pausing. It does not diagnose backend work or add render details to copied snapshots.

## For agents

To investigate repeated workbench renders, enable **Highlight React renders** in the Performance popover, close it, and reproduce the interaction. Turn highlighting off when finished. The overlay is visual; the CLI snapshot and saved recordings contain device measurements, without component render counts or rankings.

Run these supported commands on the same device as the desktop app to read its measurements without this extension's views:

```sh
pst performance
pst performance recordings /absolute/path/to/performance-recordings
```

Backend diagnostics are available through the CLI. Use a linked project with this extension enabled:

```sh
pst pstdio.performance diagnostics start --kind cpu --seconds 15
pst pstdio.performance diagnostics start --kind coverage --seconds 10
pst pstdio.performance diagnostics list
pst pstdio.performance diagnostics read --id <capture-id>
pst pstdio.performance diagnostics cancel --id <capture-id>
pst pstdio.performance diagnostics export --id <capture-id> > capture.json
```

Start returns immediately with a capture ID and host-managed automation ID. Read/list return status, timing, errors, backend identity and summary. Export returns `{ capture, data }`, including before/after process memory in bytes and either `data.profile` (CPU profile) or `data.coverage` (function-call coverage). Extract `data.profile` into a `.cpuprofile` file to inspect it in a compatible profiler. Calls count function entries, not all branches; CPU summaries count sampled stacks, not exact calls.

To prepare for an intermittent spike, arm a recording before it happens. The default threshold is 60% of one CPU core and the default watch lasts 60 minutes.

```sh
pst pstdio.performance diagnostics arm --cpu-percent 60 --minutes 60
pst pstdio.performance diagnostics read --id <capture-id>
pst pstdio.performance diagnostics export --id <capture-id> > backend-spike.json
```

Arming records CPU continuously in 30-second windows and samples process CPU every two seconds. It retains the latest two profile windows and stops when a CPU reading crosses the threshold or the watch expires. Export reports `data.reason` as `threshold` or `expired`, the triggering reading when present, aligned CPU readings, process identity and memory, and `data.profiles[].profile`. Each profile can be extracted as a `.cpuprofile` file. Sampling and local checkpoint writes add overhead while the recording is armed.

Completed windows are atomically checkpointed on the runtime machine. Sampling continues while a checkpoint is awaiting I/O. One write is active at a time, and newer snapshots replace the pending snapshot under backpressure. `skippedCheckpoints` counts these replacements. An in-flight write can temporarily retain the preceding two profiles alongside the latest two profiles. If the backend hangs or is force-quit, export the same capture after restarting. Its last completed window remains available with `data.complete: false` and an unavailable, cancelled or failed capture status as appropriate. The current unfinished window can be lost. An in-process recorder cannot export while its event loop is blocked. A watch ends at runtime shutdown and must be armed again after restarting.

Short and armed captures also include `data.operations`. With the matching host and Sessions extension installed, it reports database statement hashes, statement kinds, rows, execution byte counts, caller stacks and asynchronous command/request origins, plus chat logical and wire sizes, fragment counts and encoding duration. Query parameter values, SQL text and conversation contents are excluded. Database query duration includes waiting in the engine queue. Child `database.execute` records identify engine work and its returned wire bytes. Chat encoding duration measures generator work independently of stream delivery waits. Cumulative progress is published before each fragment is delivered, so a capture includes encoding work still awaiting delivery. Each event has a stable `id` and a `complete` flag. The trace retains its latest progress. Request names use route patterns and exclude URL values and query strings.

Operation evidence retains at most 1,000 events, 512 KiB of encoded event data and the latest 60 seconds. `dropped` counts events removed by these limits. CPU readings retain at most 64 entries. `discardedProfileWindows` counts older windows replaced during the watch. Empty operation evidence can mean that no instrumented work ran or that the host or Sessions extension predates these instrumentation channels. Existing hosts can still supply CPU profiles.

Only one diagnostic profiler runs per backend process, across projects and extension reloads. Another simultaneous capture fails with an inspectable error. The host cancels work on cancellation or runtime shutdown. A lost/expired automation record is reported as unavailable unless saved evidence proves completion. Saved evidence remains exportable after job history expires.

Captures live under `$PSTDIO_HOME/extension-storage/pstdio.pstdio-performance/diagnostics/<project-id>/` (default `~/.pstdio`). This private store keeps its historical directory name across the extension rename so saved captures and exports remain available. Directories and files use owner-only access; Windows directories use a current-user ACL. Retention keeps the ten newest inactive captures, including interrupted or unavailable admissions, while preserving genuinely queued or running work. Known completion times come from the host; unavailable jobs never receive invented completion times. A result may be at most 16 MiB; an oversized checkpoint fails while preserving the last successfully saved checkpoint. Use a shorter capture if needed. Profiles include function names and source paths; export or copy them deliberately. Raw profiles never enter device snapshots or JSONL recordings.

These commands replace the repository's temporary `runtime-diagnostic` CPU and coverage commands. Existing diagnostic files are preserved. Its investigation-specific global byte-decoding hook and transcript heuristic are retired.

## Limits

- Extension rows are named by the views they host, because the public snapshot does not include extension display names.
- Runtime commands cannot read this device's measurements; use `pst performance` for those.
- A browser tab shows frame rate for its own window. Backend diagnostic commands can capture the connected runtime, but cannot profile the browser renderer.
