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

Middleware runs before a command. It can let the command continue, change its parameters, or reject it with a reason. Hooks run after an event, such as a session starting or a workspace being created. They react to the change but cannot undo it.

## Install, turn on, and load

An extension's `package.json` sets its scope:

- A user extension installs into `~/.pstdio/extensions/` and can be turned on in any project.
- A repo extension installs into `.pstdio/extensions/` inside one project folder. Use it for behavior that belongs to that repository.

Installing makes the extension available. Turning it on is a choice per project, and each project keeps its own settings and data for it.

A project keeps running the version of an extension it loaded. Editing the installed files does not change what the project runs. The new version is used after you choose **Reload** or **Upgrade** in the extension settings, reinstall it, or run the `pst extensions dev` watcher. Prompt Studio checks the new version first. If the check fails, the previous version keeps running.

Each project runs one copy of an extension ID. If two folders provide the same ID, you choose which one is turned on.

## Trust

Extension commands run inside the Prompt Studio runtime on your computer, with the access your user account has. Install extensions from sources you trust.

Some limits still apply. A webview, which is a custom web page inside the dashboard, can only call the host features it declares. Through a host-managed connection, a tool can request allowed methods and paths without receiving the credential. This connection policy is not a sandbox for extension code running inside the host process.

## Learn more

- [Add tools](../getting-started/0003-add-tools.md)
- [Write an extension](../extensions/0001-authoring.md)
- [Extension API reference](../../references/extensions/0001-api.md)
