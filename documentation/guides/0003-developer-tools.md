# Developer tools

Developer tools helps you find out which part of Prompt Studio is using your computer's CPU. Use it when the app feels slow, a fan spins up, or an extension seems to do too much work.

## Show connection status

Open **Settings → Developer tools → Connection** and turn on **Show connection status**. A badge with a green dot appears at the trailing end of the status bar while connected. When the app loses contact with the backend, the badge shows a red dot and **Backend unavailable**. Hover or focus the indicator for an explanation, including automatic reconnection. Loaded navigation stays visible, and the indicator returns to a green dot when the connection recovers.

The switch is off by default and is saved on this device. Turning it off hides the indicator. Live sync, retained navigation, and automatic recovery stay active.

## Reorder status bar items

When a side has several items, drag a widget directly, like a tab, to place it before or after another widget. You can also focus a widget or its control and press **Alt+Left** or **Alt+Right**. A normal click still opens the widget's controls. Items stay on their leading or trailing side.

The order is saved on this device. It survives reloads, connection recovery, and turning an indicator off and on.

## Turn on performance monitoring

1. Open **Settings** and select **Developer tools → Performance**.
2. Turn on **Enable performance monitoring**.

A frame-rate meter appears at the trailing end of the status bar. The status bar shows in modes that use it, such as the project view. A mode that draws its own status bar, or hides it, does not show the meter.

The switch is off by default. It belongs to this device: Prompt Studio desktop saves it in its own user data, and a browser saves it in that browser. A remote runtime never turns it on, and turning it on never sends measurements anywhere.

The command palette has two commands. **Show performance** opens the meter's popover. While monitoring is off, or the current mode hides the meter, it opens the setting instead. **Copy performance snapshot** copies the current snapshot as JSON.

## Read the meter

The meter shows a gauge icon, the last 12 seconds of frame rate as small bars, and the current frames per second (fps). The workbench window counts the frames it draws in each second. It keeps the last 30 seconds and pauses the count while the window is hidden.

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
- **CPU**: the Workbench row first, then one row for each process that runs extension views.

### The CPU list

Each number is the 30-second average CPU of that row's process, as a share of one core. One busy core shows about 100%, so a process that uses two cores shows about 200%. A new process shows its latest sample until it has 30 seconds of history. A row turns amber at 25% or more.

The detail line under each name shows how many views are open and the process's working set. The working set is the RAM the process uses now. It includes memory shared with other processes, so the values do not add up to the app's total.

**Workbench** is the window you work in. It is listed because the workbench itself can be the busy part, for example while a long chat streams. Extensions are sorted by CPU, busiest first.

Chromium usually runs all extension views in one process. That row names every extension it hosts and shows the process total once, because the CPU of one process cannot be split between extensions.

Only the 5 busiest extensions are shown. The rest fold into one row, **N more extensions**, with their combined CPU. Select it to show every extension, and select it again to fold them.

An extension with an open view but no measured process is listed without a number. This happens in a browser tab and before the first sample of a new process.

The popover does not list Electron's main process, the GPU process, or other helper processes. The copied snapshot and `pst performance` include them.

## Pause an extension

A row with exactly one extension has a **Pause** button. Pausing an extension:

- unloads every webview of that extension in this window;
- shows **<Extension> is paused** with a **Resume** button in each place where a view was open. In a view less than 160 px tall, this is one line;
- lets Chromium end the extension's process soon after, when no other extension view uses it.

The paused row stays in the CPU list with a **Resume** button.

A pause does not stop the extension's runtime work. Its commands, hooks, and schedules keep running in the runtime. To stop those, disable the extension.

The pause lives only in this window's memory. It lasts until you select **Resume** or restart the app. Turning monitoring off does not resume paused extensions. Use **Resume** in the placeholder.

## Share a snapshot

Run **Copy performance snapshot** to copy the current snapshot as JSON. The snapshot contains process roles, CPU, memory, slow frames (frames of 50 ms or longer in the workbench window, with only script file names; addresses, query strings, and capability links are removed), the workbench frame rate for each of the last 30 seconds (`frameRate`), the ids of paused extensions (`pausedExtensionIds`), and what this device can measure. It never contains chat content, tokens, workspace paths, or full script addresses.

An agent on the same computer reads the same snapshot with:

```bash
pst performance
```

The command talks to the desktop app directly. It does not start or call a runtime. When monitoring is off, nothing serves a snapshot and the command explains how to turn it on.

## Turn it off

Turn off the switch. The meter and its popover disappear. Sampling, the frame counter, the slow-frame observer, and the `pst performance` endpoint stop at once, and every kept sample is cleared. Nothing runs while the switch is off, including after a restart.

## Limits

- **Browser tabs** cannot read process CPU or memory. The popover shows **CPU is measured in the desktop app**, lists open extensions without numbers, and still shows frame rate. Pause still works. `pst performance` reads only the desktop app.
- **GPU work** stays in Chromium's shared GPU process. An extension's number does not include the drawing work it causes there. GPU utilization and paint cost are not measured.
- **Shared processes:** when several extensions share one process, their row names all of them and shows the process total once. That row has no Pause button, and its number cannot tell which extension is busy.
- **Frame names are not proof.** Extension names come from the addresses of the frames each process hosts. An extension that navigates its own frame can change the name shown for it.
- **Windows** reports no idle wakeups; the snapshot marks them unavailable. Private memory is reported only on Windows.
- **Long tasks only:** a renderer without long-animation-frame support reports long tasks without script names.
- **Agents cannot turn monitoring on.** The switch stays a person's choice on their own device.
- The runtime is a separate program and is not listed. Use your operating system's activity monitor for it.

## Cost

Monitoring samples Electron's process metrics every 2 seconds. It keeps at most 30 seconds of CPU history per live process and the latest 50 slow frames. The workbench counts frames with `requestAnimationFrame` and reports its frame rate and paused extensions to the desktop app about once per second. Renderers send slow frames at most once per second. The meter reads a new snapshot every 2 seconds.

The packaged desktop tests measure the idle workbench with monitoring off and on; see [Tests](development/0002-testing.md#desktop-performance-budgets).
