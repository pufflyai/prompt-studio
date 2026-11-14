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
- **Backend diagnostics**: choose 1–60 seconds (default 15), then **Record CPU** for a sampled CPU profile or **Count calls** for precise function-call coverage. Read status, backend hostname/PID, elapsed time and frequent functions. Cancel active work or copy a completed result as JSON. These captures describe the backend, including a remote backend, rather than the desktop renderer.

Missing readings are shown as unavailable, never as zero. Memory uses the most precise measurement the platform reports; hover the memory values to see which one. See the [Developer tools guide](../../documentation/guides/0003-developer-tools.md) for every field and limit.

## For agents

Agents read the same measurements without this extension's views:

```sh
pst performance
pst performance recordings /absolute/path/to/performance-recordings
```

Backend diagnostics have the same actions and capture IDs in the panel and CLI. Use a linked project with this extension enabled:

```sh
pst pstdio.performance diagnostics start --kind cpu --seconds 15
pst pstdio.performance diagnostics start --kind coverage --seconds 10
pst pstdio.performance diagnostics list
pst pstdio.performance diagnostics read --id <capture-id>
pst pstdio.performance diagnostics cancel --id <capture-id>
pst pstdio.performance diagnostics export --id <capture-id> > capture.json
```

Start returns immediately with a capture ID and host-managed automation ID. Read/list return status, timing, errors, backend identity and summary. Export returns `{ capture, data }`, including before/after process memory in bytes and either `data.profile` (CPU profile) or `data.coverage` (function-call coverage). Extract `data.profile` into a `.cpuprofile` file to inspect it in a compatible profiler. Calls count function entries, not all branches; CPU summaries count sampled stacks, not exact calls.

Only one diagnostic profiler runs per backend process, across projects and extension reloads. Another simultaneous capture fails with an inspectable error. The host cancels work on cancellation or runtime shutdown. A lost/expired automation record is reported as unavailable unless saved evidence proves completion. Saved evidence remains exportable after job history expires.

Captures live under `$PSTDIO_HOME/extension-storage/pstdio.pstdio-performance/diagnostics/<project-id>/` (default `~/.pstdio`). This private store keeps its historical directory name across the extension rename so saved captures and exports remain available. Directories and files use owner-only access; Windows directories use a current-user ACL. Retention keeps the ten newest inactive captures, including interrupted or unavailable admissions, while preserving genuinely queued or running work. Known completion times come from the host; unavailable jobs never receive invented completion times. A result may be at most 16 MiB; an oversized capture fails without publishing partial evidence. Use a shorter capture if needed. Profiles include function names and source paths; export or copy them deliberately. Raw profiles never enter device snapshots or JSONL recordings.

These commands replace the repository's temporary `runtime-diagnostic` CPU and coverage commands. Existing diagnostic files are preserved. Its investigation-specific global byte-decoding hook and transcript heuristic are retired.

## Limits

- Extension rows are named by the views they host, because the public snapshot does not include extension display names.
- Runtime commands cannot read this device's measurements; use `pst performance` for those.
- A browser tab shows frame rate for its own window. Backend diagnostic commands can capture the connected runtime, but cannot profile the browser renderer.
