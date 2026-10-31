# Developer tools

Developer tools helps you find out which part of Prompt Studio is using your computer's CPU and memory, and whether the backend still answers. Use it when the app feels slow, a fan spins up, or an extension seems to do too much work.

The **Prompt Studio Performance Monitoring** extension (`pstdio.pstdio-performance`) provides the status bar meter and its details. It is installed by default and uses only the public extension API. The host keeps the measurements: process sampling, the frame counter, the slow-frame observer, recordings and `pst performance`. Monitoring runs while the extension is loaded, so enabling the extension turns it on and disabling or removing it turns it off. There is no separate switch.

## Reorder status bar items

When a side has several items, drag a widget directly, like a tab, to place it before or after another widget. You can also focus a widget or its control and press **Alt+Left** or **Alt+Right**. A normal click still opens the widget's controls. Items stay on their leading or trailing side.

The order is saved on this device. It survives reloads and connection recovery.

## Turn on performance monitoring

Enable **Prompt Studio Performance Monitoring** in **Settings → Project → Extensions**. It is enabled by default. A meter appears at the trailing end of the status bar and starts measuring. The status bar shows in modes that use it, such as the project view. A mode that draws its own status bar, or hides it, does not show the meter.

Monitoring belongs to this device. A remote runtime never turns it on, and measurements are never sent anywhere. If the host cannot measure yet, the meter shows **Off**.

Select the meter to open its details. The details keep their header in place while the measurements scroll.

## Read the meter

The meter shows a gauge icon, the last 12 seconds of frame rate as small bars, and the current frames per second (fps). The workbench window counts the frames it draws in each second. It keeps the last 30 seconds and pauses the count while the window is hidden. The meter updates every 2 seconds.

In the desktop app the meter also shows the backend: its last 12 seconds of response times as small bars, the latest response time, and the backend's CPU and memory. When the backend stops answering after it has answered before, the response time changes to an amber **Reconnecting** and the gauge icon becomes a warning icon. It returns to a response time when the backend answers again. A backend this host cannot measure, such as in a browser tab, shows no backend part.

The meter uses color only when something needs attention:

| Frame rate | Color |
| --- | --- |
| 50 fps or more | Quiet, no color |
| 30 to 49 fps | Amber |
| Under 30 fps | Red |

When a process averages 80% or more of one core over the last 30 seconds, the gauge icon becomes a warning icon and **CPU NN%** follows the frame rate. One short spike never raises the warning. It goes away when the average drops.

## Read the popover

Select the meter to open the popover. It has these parts, from top to bottom:

- **Frame rate**: the current value, the 30-second average and minimum, and one bar for each of the last 30 seconds.
- **Sustained high CPU**: a warning that names the busy process. It appears only while the warning above is active.
- **Backend** (desktop only): three charts over the last 30 seconds, one column per 2-second sample. **Response time** shows each reply, with the average, the maximum, and the number of missed replies. A missed reply is a full-height amber bar; it never counts as a response time. **CPU** and **Memory** show the backend and the workbench side by side, with their latest values. A backend restart is a full-height amber bar in both charts. Hover the memory values to see which measurement each one uses: macOS physical footprint including compressed memory, Windows private memory, or resident memory including shared pages. A missing reading draws a flat line and reads **Unavailable**, never zero. A remote backend is labeled **Remote backend**; local readings never stand in for it.
- **CPU**: the Workbench row first, then one row for each process that runs extension views.

The copy button beside the title copies the current snapshot as JSON.

### The CPU list

Each number is the 30-second average CPU of that row's process, as a share of one core. One busy core shows about 100%, so a process that uses two cores shows about 200%. A new process shows its latest sample until it has 30 seconds of history. A row turns amber at 25% or more.

The detail line under each name shows how many views are open and the process's working set. The working set is the RAM the process uses now. It includes memory shared with other processes, so the values do not add up to the app's total.

**Workbench** is the window you work in. It is listed because the workbench itself can be the busy part, for example while a long chat streams. Extensions are sorted by CPU, busiest first.

A row is named by the views its process hosts, such as `lab-page`, because the public snapshot identifies an extension only by its install id. Chromium usually runs all extension views in one process. That row names every view it hosts and shows the process total once, because the CPU of one process cannot be split between extensions.

Only the 5 busiest extensions are shown. The rest fold into one row, **N more extensions**, with their combined CPU. Select it to show every extension, and select it again to fold them.

An extension appears once its process has been sampled. A browser tab cannot measure processes, so it lists no extension rows.

The popover does not list Electron's main process, the GPU process, or other helper processes. The copied snapshot and `pst performance` include them.

## Pause an extension

A row with exactly one extension has a **Pause** button. Pausing an extension:

- unloads every webview of that extension in this window;
- shows **<Extension> is paused** with a **Resume** button in each place where a view was open. In a view less than 160 px tall, this is one line;
- lets Chromium end the extension's process soon after, when no other extension view uses it.

The paused row stays in the CPU list as **Paused extension** with a **Resume** button.

A pause does not stop the extension's runtime work. Its commands, hooks, and schedules keep running in the runtime. To stop those, disable the extension.

The pause lives only in this window's memory. It lasts until you select **Resume** or restart the app. Turning monitoring off does not resume paused extensions. Use **Resume** in the placeholder.

## Share a snapshot

Select the copy button in the details to copy the current snapshot as JSON. The snapshot contains process roles, CPU, memory, slow frames (frames of 50 ms or longer in the workbench window, with only script file names; addresses, query strings, and capability links are removed), the workbench frame rate for each of the last 30 seconds (`frameRate`), the ids of paused extensions (`pausedExtensionIds`), and what this device can measure. It never contains chat content, tokens, workspace paths, or full script addresses.

An agent on the same computer reads the same snapshot with:

```bash
pst performance
```

The command talks to the desktop app directly. It does not start or call a runtime. When monitoring is off, nothing serves a snapshot and the command explains how to turn it on.

## Turn it off

Disable the extension. The meter and its details disappear. Sampling, the frame counter, the slow-frame observer, and the `pst performance` endpoint stop at once, and every kept sample is cleared. Nothing runs while no monitoring extension is loaded.

## Limits

- **Browser tabs** cannot read process CPU or memory. The details show **CPU is measured in the desktop app**, still show frame rate, and list no extension rows. A paused extension can still be resumed. `pst performance` reads only the desktop app.
- **GPU work** stays in Chromium's shared GPU process. An extension's number does not include the drawing work it causes there. GPU utilization and paint cost are not measured.
- **Shared processes:** when several extensions share one process, their row names all of them and shows the process total once. That row has no Pause button, and its number cannot tell which extension is busy.
- **Frame names are not proof.** Row names come from the addresses of the frames each process hosts. An extension that navigates its own frame can change the name shown for it.
- **Needs an open project.** Extension controls load with a project. With no project open, or in a project where the extension is disabled, the status bar shows no meter, even while monitoring is on. Open a project with the extension to see or change it.
- **No palette commands.** Extension commands run in the runtime, which cannot read this device's measurements. Open the details from the meter instead.
- **Windows** reports no idle wakeups; the snapshot marks them unavailable. Private memory is reported only on Windows.
- **Long tasks only:** a renderer without long-animation-frame support reports long tasks without script names.
- **Agents cannot turn monitoring on.** Only a loaded monitoring extension on this device turns it on.

## Cost

Monitoring samples Electron's process metrics every 2 seconds. It keeps at most 30 seconds of CPU history per live process and the latest 50 slow frames. The workbench counts frames with `requestAnimationFrame` and reports its frame rate and paused extensions to the desktop app about once per second. Renderers send slow frames at most once per second. The meter and its details share the host's snapshot polling every 2 seconds; they add listeners and never start their own sampling.

The packaged desktop benchmarks measure the idle workbench with monitoring off and on; see [Tests](development/0002-testing.md#desktop-benchmarks).

## Runtime capture

Desktop snapshots use schema version 2 and keep the version-1 fields used by the existing meter. The `capture` field adds a capture id, host version, platform, timestamps, actual sample gaps, and a rolling history of at most 150 samples and 512 KiB. `pst performance` prints this same capture.

The desktop observes its local Bun runtime from a separate process. A busy runtime therefore cannot prevent its CPU and memory readings. Native CPU counters are converted to milliseconds before calculating CPU as a percentage of one logical core; a process using several cores can exceed 100%. On macOS this conversion uses the machine's clock tick duration. A new process or PID reuse starts a new CPU baseline. The first CPU percentage is unavailable, not zero.

Memory fields use bytes. `residentBytes` is current resident memory. macOS also supplies `physicalFootprintBytes`, which includes compressed memory, and `peakPhysicalFootprintBytes` for its lifetime peak. Windows supplies `privateCommittedBytes` separately from resident working set. Linux supplies resident and peak resident memory from procfs. Missing optional measurements are `null`. Shared working sets overlap, so adding process memory is not an exact application total.

The host also times an authenticated backend response. `reply` records a finite response time. `timeout` records how long the host waited and leaves response time unavailable; it must not enter a successful-response percentile. A missing or disconnected backend is `unavailable`. This measurement includes transport time and does not identify the cause of a delay.

While enabled, the capture writes sanitized JSONL records under the desktop user-data directory's `performance-recordings` folder. Four files of at most 1 MiB each rotate by whole record. Live history clears on disable; saved recordings survive. Capture records contain measurements and process identities, not conversation content, credentials, raw output, or private source paths. The directory uses owner-only access on Unix and a current-user ACL on Windows.

Export saved files after turning monitoring off or closing the app:

```bash
pst performance recordings /absolute/path/to/performance-recordings
```

This reads the named directory without starting monitoring or contacting a runtime. The output contains the directory and each saved file's name and JSONL content. Rotation can remove early records; saved files are bounded evidence, not an unlimited archive.

Native process readings include `startedAt` when the host supports it. Benchmarks use this timestamp to include CPU consumed before the first reading of a process born during the capture. For an older process, CPU totals cover only the interval between readings. Native lifetime memory peaks apply to the capture only when the process was born during it; other peaks cover observed samples. The summary labels these coverage limits and keeps process lifetimes separate across restarts.

Benchmark settling memory is observed after the workload ends and at least one sampling interval passes. Its exported boundary states that interval. This is a post-workload idle observation, not a claim that the heap is stable or that garbage collection ran. Other exports label the final value `lastObserved`; they leave settling values unavailable without this observation. An immediate crash is preserved and cannot supply a post-crash memory reading.
