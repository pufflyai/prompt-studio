# Add tools

Tools come from extensions. Install an extension once, then turn it on in each project that should use it.

## Core extensions

Prompt Studio publishes these tools as extensions. Install the ones you want:

| Extension | What it adds | Install name |
| --- | --- | --- |
| [Planner](../../../extensions/pstdio-planner/README.md) | Tickets, agent attempts, and reviews | `pstdio-planner` |
| [Notes](../../../extensions/pstdio-notes/README.md) | Markdown notes saved in the project folder | `pstdio-notes` |
| [Reports](../../../extensions/pstdio-reports/README.md) | Reports that agents hand to each other | `pstdio-reports` |
| [Artifacts](../../../extensions/pstdio-artifacts/README.md) | Interactive HTML pages with saved revisions | `pstdio-artifacts` |

New projects already have the agent harnesses, the base themes, and Prompt Studio Skills.

## Install from the dashboard

1. Choose **Browse extensions** on the project's Start page. You can also open **Settings** and choose **Extensions** under **Project**.
2. Find the extension under **Available**.
3. Choose **Install**.

The extension is installed and turned on for this project. Its tools appear in the sidebar, in menus, or in the command palette.

## Install from the terminal

Run `pst extensions add` with the install name, from inside the project folder:

```sh
pst extensions add pstdio-planner
```

The command installs the release that matches your Prompt Studio version and turns the extension on for the project. Run it outside a project folder to install without turning it on anywhere.

To install an extension from a folder on your computer, pass a path that starts with `./`, `../`, or `~/`, or an absolute path:

```sh
pst extensions add ./my-extension
```

## Turn extensions on and off

Each project has its own list in **Settings → Extensions**. Use the switch next to an extension to turn it on or off for that project. An extension installed for your user appears in every project. Other existing projects list it as off until you turn it on there. A project you create later starts with every installed extension turned on.

Settings and saved data belong to each project, so two projects can use the same extension in different ways.

## Use extension commands

Extensions can add commands to `pst`. Run `pst --help` to see the command groups from your enabled extensions, then `pst <group> --help` for details. For example, Planner adds `pst tickets`.

## Keep extensions up to date

When an installed core extension has a newer release for your Prompt Studio version, its row in **Settings → Extensions** shows **Upgrade**. From the terminal, run:

```sh
pst extensions update
```

To build your own tool, read [Write an extension](../extensions/0001-authoring.md). To learn how extensions load and run, read [Extensions](../concepts/0002-extensions.md).

Next, [run agents](0004-run-agents.md).
