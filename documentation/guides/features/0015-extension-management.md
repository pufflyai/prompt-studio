# Extension management

Install, enable, and manage the tools in your workbench.

## What extension management gives you

Every tool in Prompt Studio is an extension, including the first-party ones such as Planner, Notes, Reports, and Artifacts. You choose which tools each project uses. Installing makes an extension available. Turning it on is a choice per project, and each project keeps its own settings and data for it.

An extension has a scope. A user extension is installed once for your user and can be turned on in any project. A repo extension lives in one project folder, under `.pstdio/extensions/`, and belongs to that repository.

New projects start with a few default extensions: Home, Onboarding, Workspaces, the session browser, the terminal, the base themes, and Prompt Studio Skills. Onboarding offers agent harnesses and optional tools.

## Manage extensions in Prompt Studio

Open **Extensions** from the footer of the sidebar, press **Alt+Shift+O** (Option+Shift+O on macOS), or choose **Browse extensions** on the project's **Home** page.

- **Installed** lists the extensions installed for this project or your user. Use the switch next to one to turn it on or off for this project. Turning it off removes its tools from this project; it does not uninstall it.
- **Available** lists catalog extensions you can install. Choose **Install** to install one and turn it on for this project.
- **Upgrade** appears on a row when a newer compatible release exists. **Upgrade all** upgrades every eligible row.
- **Reload** appears when the source folder of a local extension changed. It checks the new version and uses it. If the check fails, the previous version keeps running.
- Drop an extension folder onto the page to install it in the scope its manifest declares.

Choose an extension to open its page. The **Settings** tab holds its settings and connections, and **Contributions** lists what it adds, such as commands, views, and skills. **Delete extension** removes its files.

From the terminal, run these inside a linked project folder:

```sh
pst extensions add planner
pst extensions add ~/extensions/my-extension
pst extensions update
pst extensions check
```

`add` installs from the catalog or from a folder path and turns the extension on for the project. `update` installs the newest compatible release of managed extensions. `check` validates a local source or the installed extensions. `pst extensions dev <path>` watches a local folder and reloads the extension when it changes.

## Manage extensions from your tool

A tool can read and change the project's extensions through `ctx.extensions`. `ctx.extensions.list()` returns the project's installed extensions, including disabled ones, and the catalog. `ctx.extensions.install(installNames)` queues catalog extensions for this project and returns without waiting for the installation. Onboarding uses this to install the tools a person picks.

Each extension declares the extension API versions it supports in `engines.pstdio` in its `package.json`. Prompt Studio loads it only when its own extension API version is in that range.

## Learn more

- [Add tools](../getting-started/0003-add-tools.md) installs and tries a first-party tool.
- [Extensions](../concepts/0002-extensions.md) explains scopes, loading, and trust.
- [CLI extensions](../../references/cli/0011-extensions.md) covers install, update, and packaging commands.
- [Manifest and installation](../../references/extensions/0002-manifest-and-installation.md#installing-and-updating) describes upgrade, reload, and dependency installs.
- [Project extension management](../../references/extensions/0003-command-and-process-api.md#project-extension-management-api-031-on-main) describes `ctx.extensions`.

*Updated at: 2026-11-22*
