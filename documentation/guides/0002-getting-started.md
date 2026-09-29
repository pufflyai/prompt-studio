# Start using Prompt Studio

Prompt Studio is in alpha. Use a disposable project when evaluating a new build or extension.

## Install and launch

Install the CLI with Bun:

```sh
bun add --global pstdio@latest
pst --version
pst --help
pst
```

`pst` starts or attaches to the shared runtime and opens the dashboard. Use the exact loopback URL printed by the CLI. To run without automatically opening a browser, use `pst --open-browser false`.

Desktop installation and updates are described in the [desktop distribution requirements](../requirements/platform/0002-desktop-distribution.md). Repository contributors should use [development setup](development/0001-setup.md) and the Docker-isolated runtime.

## Open a project

Use the dashboard's folder picker to open an existing folder or create a new one. Git is optional for opening a folder; Git worktrees require a repository. The host creates or reuses the project's default workspace. Opening a folder does not require an installed coding agent.

For the equivalent CLI commands, see [projects](../references/cli/0004-projects.md). The linked folder's `.pstdio/config.json` records its project and workspace identity. Runtime state normally lives under `PSTDIO_HOME`, not inside the documentation folder.

## Add a tool

Open the project's Extensions settings or use `pst extensions --help` to discover install commands. Extensions declare user or repository scope. Install a source, enable its project instance, and open one of its contributed tools. Use [extension authoring](extensions/0001-authoring.md) to build your own.

Installing a package does not prove every tool works. Try a real action, close and reopen its view, and confirm the expected saved result. For validation of a change, follow the [manual walkthrough](../lessons-learned/0013-manually-check-installed-user-flows.md).

## Start agent work

Use `pst agents list` to see available harnesses and executable availability. Install the chosen provider's executable before starting its sessions, then run `pst agents setup --help` for skill setup. The [sessions reference](../references/cli/0006-sessions.md) explains prompts, follow-ups, and cancellation.

Planner, Notes, and Reports are extensions. Their commands and storage belong to those extensions rather than the core CLI. Discover enabled commands with `pst --help` and each extension's help.

## Stop and troubleshoot

Use `pst logs` for runtime diagnostics. `pst close` requests a graceful stop; active work may prevent shutdown until it finishes or you explicitly choose cancellation.

When stuck, check the [lessons learned](../lessons-learned) for relevant failures and fixes. For CLI details, see [runtime commands](../references/cli/0003-setup.md). Keep logs and the installed version when reporting a failure.
