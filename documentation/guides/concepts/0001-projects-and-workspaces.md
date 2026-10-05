# Projects and workspaces

A project holds your tools, settings, and saved data. A workspace is a place where work happens. Every agent session runs in one workspace.

## Projects

Open a folder to create a local project. Opening it again returns to the same project. Each folder belongs to at most one project. A subfolder is its own project, even inside a Git repository. A provider can instead create a project in a remote environment.

A project owns:

- the extensions turned on for it, with their settings
- the data those extensions save
- its workspaces and the sessions that ran in them

Prompt Studio writes `.pstdio/config.json` in the folder to link it to the project. `pst` commands look for this file in the current folder and its parent folders, so they act on the right project.

Deleting a project removes its saved host data and its matching `.pstdio/config.json` link. Your chosen folder and your own files stay where they are. Workspaces that a provider created follow that provider's cleanup rules.

## Workspaces

Every project has a default workspace. For a project opened from a local folder, it is that folder. Sessions in it share the same files. When one agent changes a file, the others see the change. A folder workspace has no separate branch and no diff or merge actions. It also does not sandbox the agent: the agent can reach anything its own process can reach.

A provider can also create a project whose default workspace is remote. That project has no local project folder. Its file access and other actions depend on the provider. See [Local and remote work](0004-local-and-remote.md).

Other workspaces come from workspace providers. A provider creates the workspace and owns its files.

| Workspace | Where the files are | Who owns them |
| --- | --- | --- |
| Project folder | Your folder | You. All sessions share it. |
| Git worktree | A separate folder on its own branch | The Git provider, which removes it when you delete the workspace |
| Remote environment | Another machine | The extension that provides it |

A Git worktree gives a session its own copy of the repository on a new branch. Work there does not touch your folder until you merge it with `pst workspaces merge`. Git worktrees need a repository with at least one commit. If the project is a subfolder of a repository, the session works in the same subfolder of the worktree.

Workspaces get short names. A new workspace is named `WS-1`, `WS-2`, and so on. A tool can ask for a name based on its own item, so a Planner ticket `PS-7` gets workspaces such as `PS-7_A1`.

Remote environments are covered in [Local and remote work](0004-local-and-remote.md).

## Where Prompt Studio keeps data

Prompt Studio keeps its own state in `~/.pstdio`. This includes the database, logs, extensions installed for your user, and Git worktree workspaces. Set the `PSTDIO_HOME` environment variable to use another folder.

The project folder holds only what belongs to the project: `.pstdio/config.json`, extensions installed for that folder in `.pstdio/extensions/`, and files that extensions choose to store with the project.

## Learn more

- [Open a project](../getting-started/0002-open-a-project.md)
- [CLI projects](../../references/cli/0004-projects.md)
- [CLI workspaces](../../references/cli/0005-workspaces.md)
