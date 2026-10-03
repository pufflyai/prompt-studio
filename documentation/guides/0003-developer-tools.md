# Developer tools

Developer tools helps you find out which part of Prompt Studio is using your computer's CPU and memory. Use it when the app feels slow, a fan spins up, or an extension seems to do too much work.

## Turn on performance monitoring

1. Open **Settings** and select **Developer tools → Performance**.
2. Turn on **Enable performance monitoring**.
3. Select **Open performance view**. The view opens in the Secondary Panel, so chat and extensions stay visible while you watch it. While monitoring is on, the Secondary Panel's **Add panel** menu also offers it.

The switch is off by default. It belongs to this device: Prompt Studio desktop saves it in its own user data, and a browser saves it in that browser. A remote runtime never turns it on, and turning it on never sends measurements anywhere.

You can also run **Open performance view** and **Copy performance snapshot** from the command palette. While monitoring is off, **Open performance view** opens this setting instead.

## Read the view

**Processes** lists each process of the desktop app, busiest first:

| Row | What it is |
| --- | --- |
| App | Electron's main process. It owns windows and starts the runtime. |
| Workbench | The dashboard window you work in. |
| Extension frames | The process that runs extension pages. It names every extension it hosts. |
| Startup window | The startup and recovery screen. It stays loaded while hidden. |
| GPU, Network Service, other utilities | Chromium helper processes. |
| Renderer | A page process Prompt Studio cannot link to a window or extension. |

CPU is a share of one core. One busy core shows about 100%, so a process using two cores shows about 200%. The value covers the time since the previous sample, shown at the top of the view. Memory is each process's working set: the RAM it uses now. The copied snapshot also contains peak working set and, on Windows, private memory.

Chromium runs all sandboxed extension pages from the runtime in one shared process. Prompt Studio therefore names every extension in that process and shows the process total once. It never splits that CPU between extensions or counts it twice. Close the other extension pages to measure one extension alone. The names come from the addresses the runtime gives each extension page. They show which pages a process hosts; an extension that navigates its own page can change the name shown for it.

**Sustained high CPU** appears when a process averages 80% or more over the last 30 seconds. One short spike never raises it. The warning disappears when the average drops.

**Slow frames** lists recent frames that took 50 ms or longer, newest first. Each row names the script work that took the longest. Prompt Studio keeps only the script's file name. Addresses, query strings, and extension capability links are removed.

## Share a snapshot

Select the copy button in the view, or run **Copy performance snapshot**, to copy the current snapshot as JSON. The snapshot contains process roles, CPU, memory, slow frames, and what this device can measure. It never contains chat content, tokens, workspace paths, or full script addresses.

An agent on the same computer reads the same snapshot with:

```bash
pst performance
```

The command talks to the desktop app directly. It does not start or call a runtime. When monitoring is off, nothing serves a snapshot and the command explains how to turn it on.

## Turn it off

Turn off the switch. Sampling, frame observers, and the `pst performance` endpoint stop at once, the view closes, and every kept sample is cleared. Nothing runs while the switch is off, including after a restart.

## Limits

- **Browser tabs** cannot read process CPU or memory. The view says so and shows slow frames only. `pst performance` reads only the desktop app.
- **Windows** reports no idle wakeups; the snapshot marks them unavailable. Private memory is reported only on Windows.
- **Long tasks only:** a renderer without long-animation-frame support reports long tasks without script names.
- **Agents cannot turn monitoring on.** The switch stays a person's choice on their own device.
- The GPU process row shows that process's CPU and memory. GPU utilization and paint cost are not measured. The runtime is a separate program and is not listed; use your operating system's activity monitor for it.
- On macOS and Linux the endpoint is a socket file in `PSTDIO_HOME`. A very long `PSTDIO_HOME` path (over about 100 characters) prevents it from starting; the view still works and the app log records the failure.

## Cost

Monitoring samples Electron's process metrics every 2 seconds and keeps at most 30 seconds of CPU history per live process and the latest 50 slow frames. Renderers send slow frames at most once per second. The packaged desktop tests measure the idle workbench with monitoring off and on; see [Tests](development/0002-testing.md#desktop-performance-budgets).
