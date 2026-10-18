# Open a project

Open a folder to create a local project, or to return to one you already opened.

## Open a folder in the dashboard

1. Open the project menu from the arrow beside the project name at the top of the window. In the desktop app you can also choose **View → Open Project…**.
2. Choose **Create project**.
3. In **Open project folder**, browse to the folder, or type its path. Choose **New folder** to create an empty one.
4. Choose **Open folder**.

The folder does not need to be a Git repository, and you do not need a coding agent installed yet. You can add both later.

The first project does need the `git` command and an internet connection. Prompt Studio uses `git` to download the default extensions from GitHub when you open your first folder. It needs `git` for this download even when your folder is not a Git repository. Without these extensions, the agent list stays empty. If the download fails, see [Troubleshooting](0005-troubleshooting.md#default-extensions-did-not-install).

![Open project folder dialog with a folder path, a list of folders, and an Open folder button.](../../images/open-project-folder.png)

The picker shows folders on the machine running Prompt Studio. The path in this example is `/workspace`; choose the folder where you want your own tools and files to live.

## Open a folder from the terminal

Run `pst projects create` inside the folder:

```sh
cd ~/my-tools
pst projects create
```

You can also pass a path and a name:

```sh
pst projects create "My tools" --path ~/my-tools
```

Other `pst` commands find the project from the folder you run them in. See [CLI projects](../../references/cli/0004-projects.md) for every option.

## What happens when you open a folder

- The folder name becomes the project name. You can rename the project in its settings.
- Prompt Studio writes `.pstdio/config.json` in the folder. This file links the folder to its project, so the docs call such a folder a linked project. Commands such as `pst extensions add` only work inside a linked project. A `.pstdio/.gitignore` keeps the file out of Git.
- The project gets its default workspace: the folder itself. Agent sessions work in this folder and share its files.
- The default extensions are downloaded, installed, and turned on. They connect the Claude Code, Codex, and OpenCode agents, and add themes and skills.

Opening the same folder again reopens its project. A subfolder is a separate project, even inside a Git repository. Deleting a project keeps your chosen folder and your own files, but removes the project's matching `.pstdio/config.json` link and saved host data. Provider-created workspaces follow their provider's cleanup rules.

To learn how projects, workspaces, and Git worktrees fit together, read [Projects and workspaces](../concepts/0001-projects-and-workspaces.md).

## Find your way around the workbench

The workbench is the shared window where you use your tools and talk to agents. Start here after opening a project:

![Prompt Studio workbench showing the My tools project, the sidebar, and the Start page with New conversation, Open a tool, and Browse extensions.](../../images/workbench.png)

- The project name at the top takes you back to **Start**. Its arrow opens the project menu so you can switch projects.
- **New conversation** opens an agent conversation beside your current tool.
- **Open a tool** opens the command palette, where you can choose a tool or command. Enabled extensions can also add tools to the sidebar.
- **Browse extensions** opens the extension settings so you can add tools.
- **Settings** at the bottom of the sidebar holds runtime options, project options, and extension settings.

If none of the project's enabled harness extensions is available, Start shows **No agent available**. Choose **Browse extensions** to check the project's extensions, or **Check again** after changing setup. The warning shows any reasons supplied by the harness extensions. You can still use Prompt Studio from your own harness, but sessions within Prompt Studio are unavailable until a harness is available.

**Checking agent availability…** means the check is still running. **Could not check agent availability** means the check failed; it does not mean no agent is installed. Choose **Check again** to retry. If project setup failed, finish that setup with **Retry setup** first.

The example project has Notes and Planner enabled, so its sidebar includes **Notes** and **Tickets**. Those are extension tools. Your sidebar depends on the extensions you turn on.

Next, [add tools](0003-add-tools.md).
