# Extensions

Extensions add tools to Prompt Studio. First-party extensions use the same public API as your own extensions.

## What an extension is

An extension is a TypeScript package: a folder with a `package.json` and an entry file, usually `extension.ts`. The entry file declares contributions, which are the things the extension adds:

- commands that people, agents, schedules, and other extensions can run
- views, pages, navigation items, and settings panels in the dashboard
- middleware that checks or changes a command before it runs, and hooks that react after something happens
- schedules that run a command on a timer
- templates, skills, and themes
- agent harnesses and workspace providers

The package's `publisher` and `name` form the extension ID, such as `pstdio.pstdio-notes`. The entry file never repeats them.

## Who does what

| Part | Owner | Job |
| --- | --- | --- |
| Package | The extension author | Declares contributions and ships its files, such as webviews, templates, and skills |
| Runtime | Prompt Studio | Loads the package, checks its declarations, runs commands, delivers events, and stores data per project |
| Dashboard | Prompt Studio | Places the extension's views in pages, panels, menus, and the command palette |

The extension owns its data and its domain. Prompt Studio owns the shared plumbing: storage, sync between clients, permissions, and the workbench layout.

## Commands do the work

A command is the unit of work. The same command can run from the `pst` command line, a dashboard menu, the command palette, a schedule, or another extension. Put a tool's operations in commands so people and agents can use the same interface. A button implemented only inside a custom webview is not automatically available to an agent.

## CLI-ready tools

A CLI-ready action is an operation you can run from a terminal with explicit inputs and a useful result. An agent can discover it with `--help`, call it without finding a button, and use the result in its next step.

For example, with Notes installed and enabled, run these commands from your project folder:

```sh
pst pstdio-notes --help
pst pstdio-notes notes create --help
pst pstdio-notes notes create --title "Meeting notes"
```

The last line runs Notes' **New note** command. The sidebar action and CLI command use the same handler; you can open the resulting note in the workbench.

Extension authors opt commands into the CLI with `cli: true`. Prompt Studio derives their command paths, option names, and help from the declarations. Installing and enabling a tool adds its CLI commands to that project's available commands. Run `pst --help` inside the project to discover them.

This makes the command a shared interface for a person, an agent, and another tool. A custom button still needs to call that command, and a tool needs read or list commands if an agent must inspect its state. See [Make actions CLI-ready](../extensions/0007-cli-ready-actions.md) for a complete pattern.

## React to commands and events

Middleware runs before a command. It can let the command continue, change its parameters, or reject it with a reason. Hooks run after an event, such as a session starting or a workspace being created. They react to the change but cannot undo it.

## Install, turn on, and load

An extension's `package.json` sets its scope:

- A user extension installs into `~/.pstdio/extensions/` and can be turned on in any project.
- A repo extension installs into `.pstdio/extensions/` inside one project folder. Use it for behavior that belongs to that repository.

Installing makes the extension available. Turning it on is a choice per project, and each project keeps its own settings and data for it.

A project keeps running the version of an extension it loaded. Editing the installed files does not change what the project runs. The new version is used after you choose **Reload** or **Upgrade** in the extension settings, reinstall it, or run the `pst extensions dev` watcher. Prompt Studio checks the new version first. If the check fails, the previous version keeps running.

Each project runs one copy of an extension ID. If two folders provide the same ID, you choose which one is turned on.

## Trust

Installing an extension gives it the access of your user account. Its code runs inside the Prompt Studio runtime on your computer. It can read your files, the API keys in the environment that started Prompt Studio, and the connection secrets Prompt Studio stores. Install extensions only from sources you trust.

A repo extension in a project folder runs as soon as you open that folder in Prompt Studio. Open folders from people you trust, or check `.pstdio/extensions` first. A trust step that asks before running this code is planned in [ADR 0059](../../adrs/0059-trust-step-for-repo-extensions.md). Running each extension in its own process is planned in [ADR 0058](../../adrs/0058-isolate-extension-backends.md).

Some limits still apply. A webview, which is a custom web page inside the dashboard, can only call the host features it declares. Through a host-managed connection, a tool can request allowed methods and paths without receiving the credential. This connection policy is not a sandbox for extension code running inside the host process.

## Learn more

- [Add tools](../getting-started/0003-add-tools.md)
- [Write an extension](../extensions/0001-authoring.md)
- [Make actions CLI-ready](../extensions/0007-cli-ready-actions.md)
- [Extension API reference](../../references/extensions/0001-api.md)
