# Runtime commands

These commands start, stop, and inspect the local Prompt Studio runtime: `pst`, `pst serve`, `pst close`, and `pst logs`.

The runtime is one background process that serves the API and the dashboard on the same address. Other `pst` commands talk to it.

## Command summary

| Command | Purpose |
| ------- | ------- |
| `pst` | Make sure the runtime is running, then open the dashboard in a browser. |
| `pst serve` | Start the runtime in the background, or keep an existing one running. |
| `pst close` | Stop the runtime. It refuses while work is still running. |
| `pst logs` | Print the end of the runtime log file, or its path. |

## First-launch setup (0.46)

The first launch opens a setup dialog for choosing harnesses and default extensions,
before you select or create a project. Finishing or skipping setup opens Projects
when no project is selected.
You can choose several harnesses, continue without one, or choose **Skip setup**.
**Settings → Customizations → Don’t show onboarding** hides the flow on this host.
Extension installation continues in the background after setup closes.

The unreleased 0.46 CLI exposes the same choices:

~~~bash
pst onboarding status
pst onboarding harnesses --harness codex --harness claude-code
pst onboarding complete --work coding --work planning
pst onboarding skip
pst onboarding hide
pst onboarding show
~~~

`harnesses` with no `--harness` saves an empty selection. `complete` with no `--work`
keeps only Base Themes and Prompt Studio Skills. `show` clears the visibility
preference; it does not reset completed setup. Skipping does not install choices
that have not been submitted. Jobs already accepted by the runtime continue.

## Automatic start

Most commands need the runtime. Before they run, the CLI looks for a running runtime and starts one when none is found. `pst close`, `pst logs`, `pst serve`, `pst extensions install-browser`, and `pst extensions test` skip this step. `extensions add` first looks for a linked project: a folder with `.pstdio/config.json`, in the current folder or a parent folder. Without one, it fails before it starts or contacts the API. From the release after 0.43.x, that error prints the command to run from your project folder, with the source as an absolute path. Installed-scope `extensions check` does the same. `extensions check <path>` stays local and checks the source with the extension API version built into this CLI.

The CLI finds the runtime through `$PSTDIO_HOME/runtime.json`. This file records the runtime's process ID, address, and access token. The CLI checks that the process is alive and answers authenticated requests before it uses that address. Set `PSTDIO_API_URL` or pass `--api-port` to use a specific address instead. The CLI starts a runtime for a specific address only when it is on this machine (`127.0.0.1`, `localhost`, or `[::1]`). When an address on another machine does not answer, the command fails with "Cannot reach the Prompt Studio API" and starts nothing.

A started runtime runs on its own and does not keep the terminal that started it. The CLI waits until the runtime answers. It replaces a recorded runtime only when its process is gone and it does not answer. The database also allows only one owner, so two commands that start at the same time cannot both run a runtime.

If the new runtime exits before it is ready, the CLI reports its exit code or signal. If it is still not ready after 15 seconds, the CLI stops it and prints the startup errors and the log path.

## Environment variables

### Runtime state

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `PSTDIO_HOME` | `~/.pstdio` | Root folder for Prompt Studio state. The database, storage, workspaces, extensions, caches, and logs live here unless overridden. |
| `PSTDIO_DB_PATH` | `$PSTDIO_HOME/pstdio.db` | Move only the database. To keep a fully separate set of state, set `PSTDIO_HOME` instead. |
| `PSTDIO_STORAGE_PATH` | `$PSTDIO_HOME/storage` | Move only file storage. |

Workspaces always live in `$PSTDIO_HOME/workspaces`.

### Runtime startup

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `PSTDIO_API_URL` | address of the running runtime | Use this API address instead of the one in `runtime.json`. |
| `PSTDIO_API_PORT` | unset | Port for an automatically started runtime. When unset, the operating system picks a free port. |
| `PSTDIO_DISABLE_API_AUTO_START` | unset | Set to `1` when another process manager already runs the API. Commands then fail instead of starting a runtime. |

### Runtime behavior

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `PSTDIO_API_TOKEN` | token from `runtime.json` | Bearer token for authenticated requests to the runtime. |
| `PSTDIO_ACCOUNT_MANAGER_ORIGIN` | `https://base.prompt.studio/accounts` | HTTPS account service address used by `pst login`. Set it before starting the host. `--manager` overrides it for one login. |
| `PSTDIO_EXTENSION_CATALOG` | packaged extension catalog | Local JSON path or HTTPS URL. Remote catalogs are cached under `$PSTDIO_HOME`. |
| `PSTDIO_DEFAULT_EXTENSIONS` | catalog entries marked as defaults | JSON array, or `{ "defaultExtensions": [...] }`. Extensions to install and enable for new projects. Each one installs in the scope its `pstdio.scope` declares. `[]` installs none. |
| `PSTDIO_AUTOMATION_RUNS_PER_MINUTE` | `60` | New automation runs accepted per minute, for each caller and project. |
| `PSTDIO_EVENT_BUS_BUFFER_SIZE` | service default | Optional positive integer. How many recent sync events the runtime keeps for replay. |
| `PSTDIO_LOG_LEVEL` | `error` | Runtime log level. |
| `PSTDIO_LOG_PATH` | derived from `PSTDIO_HOME` | Log file path. |
| `PSTDIO_LOG_TARGETS` | log file | Comma-separated log targets, for example `file,stdout`. |

## `pst`

```sh
pst [--api-port <port>] [--open-browser <boolean>]
```

Finds or starts the runtime and opens the dashboard in a browser. The API and the dashboard share one address. Pass `--open-browser false` to skip the browser. `--api-port` sets the port for a runtime that this command starts.

The command prints the dashboard and API URLs.

## `pst serve`

```sh
pst serve [--port <port>] [--host <host>]
```

| Flag | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `--port` | `number` | `0` | Port for the runtime. `0` lets the operating system pick a free port. |
| `--host` | `string` | `127.0.0.1` | Address to bind to. The background runtime accepts only `127.0.0.1`. |

The command returns once the runtime is ready and prints its address. If a runtime is already running, `pst serve` keeps it. A runtime started by the desktop app stays running after the app quits, without a restart.

## `pst close`

```sh
pst close [--force]
```

- If no runtime is running, prints `Runtime is not running.` and exits successfully.
- Without `--force`, lists active sessions, terminals, and jobs, then refuses to stop and exits with an error.
- With `--force`, cancels active work, then waits for the runtime to exit and clean up. There is no time limit.

## `pst logs`

```sh
pst logs [--lines <count>] [--path]
```

- Prints the last `--lines` (or `-n`) lines of the log file. The default is `100`.
- `--path` prints the log file path without reading the file.
- If the log file does not exist, the command fails and prints the path it checked.
