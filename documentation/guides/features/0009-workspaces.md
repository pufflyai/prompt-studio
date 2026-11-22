# Workspaces

Agents can work in their own copy of your project, so your files stay untouched while they try things.

## What workspaces give you

A workspace is the place where an agent session runs. Every project has a default workspace: for a local project, that is your project folder. Sessions there share its files, so one agent's change is visible to the others right away.

A Git worktree workspace gives a session its own copy of the repository, in a separate folder on a new branch. Work there does not touch your folder until you merge it.

Workspace providers create the other kinds of workspace. The installed Workspaces extension provides Git worktrees, and the Remote Workspaces extension runs sessions on another computer.

A folder workspace is not a sandbox. The agent can reach anything its own process can reach.

## Use workspaces in Prompt Studio

The Workspaces extension adds a **Project Workspaces** group to the sidebar. **Files** opens the project folder. **Workspaces** lists your workspaces, grouped by device. Choose **Create workspace** from the **Workspaces** title dropdown, pick a **Workspace type**, and fill in its fields. For **Git worktree**, choose the **Base branch**.

When you start a session, the workspace selector above the message field chooses where the agent works. A Git worktree workspace also has a Changes panel for the changes made in it.

From the terminal, run these inside the project folder:

```sh
pst workspaces create --provider pstdio.worktree --params '{"base":"main"}'
pst sessions create --prompt "Try the refactor" --workspace-id WS-1
pst workspaces merge --id WS-1 --delete-workspace
```

`create` prints the new workspace's short name, such as `WS-1`. `merge` squash-merges its branch into your current branch, and `--delete-workspace` removes the workspace afterwards. `pst workspaces list` shows every workspace with its short name, branch, and folder.

Git worktrees need a repository with at least one commit. Each device can also limit how many workspaces run sessions at once; extra sessions wait as **Queued** until a slot opens.

## Use workspaces from your tool

A command can create a workspace with `ctx.workspaces.create({ providerId: "pstdio.worktree", shorthandBase: "WS", params: { base: "main" } })` and pass its ID to `ctx.sessions.create`. Planner uses the same API to create a workspace for an attempt at a ticket, named like `PS-7_A1`.

To let people choose a workspace type in a command's form, declare a parameter with `params.workspace()`. Hooks can react to `workspaceEvents.created`, `workspaceEvents.ready`, and `worktreeEvents.removed`.

To offer a new kind of workspace, such as a remote machine, declare a provider with `defineWorkspaceType` in the `workspaceTypes` contribution.

## Learn more

- [Projects and workspaces](../concepts/0001-projects-and-workspaces.md#workspaces) explains each workspace kind.
- [CLI workspaces](../../references/cli/0005-workspaces.md) lists every workspace command.
- [Local and remote work](../concepts/0004-local-and-remote.md) covers remote workspaces.
- [Commands and processes](../../references/extensions/0003-command-and-process-api.md#workspace-cleanup) describes `ctx.workspaces`.

*Updated at: 2026-11-22*
