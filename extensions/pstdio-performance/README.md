# Prompt Studio Performance Monitoring

Prompt Studio Performance Monitoring shows how Prompt Studio runs on this device: the workbench frame rate, how fast the backend answers, and the CPU and memory of the backend and the workbench. Use it when the app feels slow, a fan spins up, or an extension seems to do too much work.

The extension only displays what the host measures. It uses the public `performance.read` and `performance.control` webview capabilities from `@pstdio/sdk/extensions`. Sampling, recordings and `pst performance` stay in the host, so the extension never starts its own collector.

## Install

Prompt Studio Performance Monitoring is installed by default. Its install name is `pstdio-performance`. To add it again:

```sh
pst extensions add pstdio-performance
```

## Turn it on

Monitoring runs while this extension is enabled. Disable the extension to stop it. There is no separate switch. Measurements stay on this device and are never uploaded.

## What it shows

- **Status bar meter**: the last 12 seconds of frame rate, the current fps, and, in the desktop app, the backend's recent response times, CPU and memory. **Reconnecting** replaces the response time while the backend does not answer. The meter shows **Off** while monitoring is off; select it to find the switch.
- **Details**: select the meter to see the frame rate, aligned response-time, CPU and memory charts for the backend and the workbench, and the CPU of each extension process. Pause an extension's views from its row, and copy the current snapshot as JSON with the copy button.

Missing readings are shown as unavailable, never as zero. Memory uses the most precise measurement the platform reports; hover the memory values to see which one. See the [Developer tools guide](../../documentation/guides/0003-developer-tools.md) for every field and limit.

## For agents

Agents read the same measurements without this extension's views:

```sh
pst performance
pst performance recordings /absolute/path/to/performance-recordings
```

## Limits

- Extension rows are named by the views they host, because the public snapshot does not include extension display names.
- There are no command palette commands. Extension commands run in the runtime, which cannot read this device's measurements.
- A browser tab cannot measure processes or the backend. It shows frame rate only.
