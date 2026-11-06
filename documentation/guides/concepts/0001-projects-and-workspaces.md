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

Workspaces get short names that you can pass to `pst` commands instead of their IDs:

| Short name | Workspace |
| --- | --- |
| `default` | The project's default workspace |
| `WS-1`, `WS-2`, ... | Standalone workspaces, such as the ones `pst workspaces create` makes. Numbers count up within each project. |
| `PS-7_A1`, `PS-7_A2`, ... | Workspaces a tool creates for one of its items. Planner names each attempt at ticket `PS-7` after the ticket, with `_A` and the attempt number. |

`pst workspaces list` shows each workspace's short name, ID, branch, and folder.

Remote environments are covered in [Local and remote work](0004-local-and-remote.md).

## Files and Workspaces in the sidebar

The bundled Workspaces extension adds a **Project Workspaces** group. **Files** opens the project folder directly. It has no Changes tab. **Workspaces** groups workspace rows by device: this device first, online devices by name, then offline devices by last seen. Expand a workspace to see its sessions, or choose Compact for an ungrouped list without sessions.

Each row shows its kind, short name, title, related ticket, type and creation date. Local workspaces offer Open, Open session, Rename and Delete when the provider supports them. Workspaces on another device open synced session history. Their files and execution actions remain on the owning device.

Files uses the shared searchable tree and editor. Create files or folders from the tree, rename inline, drag entries between folders, and confirm deletion before removing them. Save text with the editor's Save action or shortcut. Copy paths and Reveal in Finder use the host's supported actions. Git worktrees also have a Changes panel; file bodies load as you open them.

Right-click a device header to open its menu. Choose **This device** or **Device details** to see presence and capacity in a modal. **Create workspace** is available on this device and opens a creation modal, keeping the current page in place until creation succeeds. The forms use the standard dialog header and Cancel/primary actions. Online counts come from that device. Offline details show last seen and the last observed limit, with capacity marked unavailable. Settings → Workspaces changes the serving device's limit. Turn on **Limit workspaces** to enable the count, then apply the change. Turn it off to remove the limit. Edit another device's limit on that device.

## Active workspace limits

Each device can limit how many workspaces run sessions at once. The default is unlimited. The limit belongs to that device, applies across its projects, and never syncs to another device. Creating a workspace does not use a slot.

A workspace is active while at least one session is running or waiting for your input. Several running sessions in the same workspace use one workspace slot. When the limit is full, a session in another workspace waits as **Queued**. It starts automatically in submission order when a slot opens. Raising or removing the limit also starts waiting sessions. Lowering it lets current work finish.

On `main` after 0.46.0, tools can read the current device's live count and limit with `ctx.workspaces.getCapacity()` and set it with `ctx.workspaces.updateCapacity({ limit: 6 })`. Use `limit: null` for unlimited. The SDK client exposes the same methods. Counts cover the device serving the request; another device's last synced history is not a live capacity reading. The existing session concurrency setting also applies.

## Where Prompt Studio keeps data

Prompt Studio keeps its own state in `~/.pstdio`. This includes the database, logs, extensions installed for your user, and Git worktree workspaces. Set the `PSTDIO_HOME` environment variable to use another folder.

The project folder holds only what belongs to the project: `.pstdio/config.json`, extensions installed for that folder in `.pstdio/extensions/`, and files that extensions choose to store with the project.

## Learn more

- [Open a project](../getting-started/0002-open-a-project.md)
- [CLI projects](../../references/cli/0004-projects.md)
- [CLI workspaces](../../references/cli/0005-workspaces.md)
