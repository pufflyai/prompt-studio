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

`pst logs` shows the error for each extension that did not install.

## An agent shows as not installed

Prompt Studio looks for the agent's command, such as `claude`, `codex`, or `opencode`, on the `PATH` of the runtime. Check it with `pst agents list`.

- Make sure the command runs in a terminal.
- The runtime reads `PATH` when it starts. After you install an agent, restart the runtime: quit the desktop app, or run `pst close` and then `pst`.
- On macOS and Linux, the desktop app reads `PATH` from your login shell. Add the agent's folder to `PATH` in your shell's startup file, not only in one terminal window.

## An extension does not load

Open **Settings → Extensions** in the project. An extension that failed shows a status such as **Failed to load** or **Incompatible versions**. Choose **Copy error** to copy the error code and message.

- For a core extension, choose **Upgrade** when it is offered. It installs the build that matches your Prompt Studio version.
- For an extension from a local folder, fix its source, then choose **Reload**.

`pst extensions check` checks every installed extension without opening the dashboard. It prints the Prompt Studio, extension API, and SDK versions, then any problems it found.

## The dashboard does not open

Run `pst --open-browser false` and open the exact `127.0.0.1` address it prints. Other names for your computer, such as `localhost`, do not work, and other machines on your network cannot connect.

## Report a problem

Open an issue on [GitHub](https://github.com/pufflyai/prompt-studio/issues) or ask on [Discord](https://discord.gg/3RxwUEk8fW). Include the output of `pst --version` and the end of `pst logs`.
