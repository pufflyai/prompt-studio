# Open a project

A project is one folder on your computer. Open a folder to create its project, or to return to the project it already has.

## Open a folder in the dashboard

1. Open the project menu from the project name at the top of the window. In the desktop app you can also choose **View → Open Project…**.
2. Choose **Create project**.
3. In **Open project folder**, browse to the folder, or type its path. Choose **New folder** to create an empty one.
4. Choose **Open folder**.

The folder does not need Git, and you do not need a coding agent installed yet. You can add both later.

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
- Prompt Studio writes `.pstdio/config.json` in the folder. This file links the folder to its project. A `.pstdio/.gitignore` keeps it out of Git.
- The project gets its default workspace: the folder itself. Agent sessions work in this folder and share its files.
- The default extensions are installed and turned on. They connect the Claude Code, Codex, and OpenCode agents, and add themes and skills.

Opening the same folder again reopens its project. A subfolder is a separate project, even inside a Git repository. Deleting a project keeps your chosen folder and your own files, but removes the project's matching `.pstdio/config.json` link and saved host data. Provider-created workspaces follow their provider's cleanup rules.

To learn how projects, workspaces, and Git worktrees fit together, read [Projects and workspaces](../concepts/0001-projects-and-workspaces.md).

Next, [add tools](0003-add-tools.md).
