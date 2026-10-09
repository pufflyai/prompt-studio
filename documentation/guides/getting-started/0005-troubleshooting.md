# Troubleshooting

Read the runtime log, stop a stuck runtime, and fix common problems with the `pst` command, agents, and extensions.

## Read the log

Prompt Studio runs in one background process called the runtime. It writes errors to a log file:

```sh
pst logs
pst logs --lines 500
pst logs --path
```

`pst logs` prints the last 100 lines. `--path` prints where the file is.

## Stop or restart the runtime

```sh
pst close
```

`pst close` refuses to stop while sessions, terminals, or jobs are still running, and lists them. Wait for them to finish, or cancel them and stop:

```sh
pst close --force
```

Run `pst` or open the desktop app to start the runtime again. When you quit the desktop app during active work, it asks before it cancels anything.

## The `pst` command is missing or out of date

Run `command -v pst` on macOS or Linux, or `where.exe pst` on Windows. If it points to an old installation, remove that installation. On macOS, then choose **Prompt Studio → Install pst Command…** in the desktop app.

On Windows, close and reopen your terminal after you install the app, so it sees the new `PATH`.

## Default extensions did not install

The first time you open a folder, Prompt Studio downloads the default extensions from GitHub with Git. They connect the agents. If this fails, no agent appears in the agent list.

- Check that Git is installed: run `git --version` in a terminal.
- Check that your computer can reach `github.com`.
- Open **Settings → Project folder** and choose **Retry setup**, or open the same folder again.

`pst logs` shows why the download failed. **Settings → Project folder** shows the same error.

## An agent shows as not installed

Prompt Studio looks for the agent's command, such as `claude`, `codex`, or `opencode`, on the `PATH` of the runtime. Check it with `pst agents list`.

- Make sure the command runs in a terminal.
- The runtime reads `PATH` when it starts. After you install an agent, restart the runtime: quit the desktop app, or run `pst close` and then `pst`.
- On macOS and Linux, the desktop app reads `PATH` from your login shell. Add the agent's folder to `PATH` in your shell's startup file, not only in one terminal window.
- On Windows, run `where.exe opencode` in PowerShell to check an npm installation. It should include `opencode.cmd` in your npm global folder, usually `%APPDATA%\npm`. Keep that folder on your Windows user `PATH` so the desktop app can find it.
- For Codex or Claude Code, use `where.exe codex` or `where.exe claude`. Custom npm prefixes are supported. If several installations appear, the first matching command on the runtime's `PATH` wins. Repair or remove a broken earlier installation; Prompt Studio does not silently skip it.
- A PowerShell alias or function is not an executable on `PATH`. An installation inside WSL is separate from a Windows installation. Install the CLI in the environment that runs Prompt Studio.
- A version probe must finish within three seconds and return a recognized version on stdout or stderr. An empty response, a version older than the supported one (Codex 0.157.0, Claude Code 2.1.203 and OpenCode 1.0.175 and newer), a failed command, or a timeout makes the harness unavailable. Other harnesses remain listed. Run `pst logs` for probe diagnostics.
- npm's Windows batch wrapper can fail when its installation prefix contains `&`. If the wrapper also fails when run directly, reinstall the CLI under a prefix without `&`.
- If the agent is absent from the list entirely, check that its extension is enabled and loaded for the project. See **An extension does not load** below.

## An extension does not load

Open **Settings → Extensions** in the project. An extension that failed shows a status such as **Failed to load** or **Incompatible versions**. Choose **Copy error** to copy the error code and message.

- For a core extension, choose **Upgrade** when it is offered. It installs the build that matches your Prompt Studio version.
- For an extension from a local folder, fix its source, then choose **Reload**.

`pst extensions check` checks every installed extension without opening the dashboard. It prints the Prompt Studio, extension API, and SDK versions, then any problems it found.

## The dashboard does not open

Run `pst --open-browser false` and open the exact `127.0.0.1` address it prints. Other names for your computer, such as `localhost`, do not work, and other machines on your network cannot connect.

## Report a problem

Open an issue on [GitHub](https://github.com/pufflyai/prompt-studio/issues) or ask on [Discord](https://discord.gg/3RxwUEk8fW). Include the output of `pst --version` and the end of `pst logs`.
