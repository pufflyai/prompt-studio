---
layout: ../../../layouts/docs-layout.astro
title: Quickstart
description: Create a project, configure an agent, and run your first ticket attempt.
htmlTitle: Quickstart
htmlDescription: "Five-minute walkthrough: create a project, set up an agent, launch a ticket attempt, and merge the result."
section: Guide
category: Start
categoryOrder: 1
order: 2
---

## 1. Create a project

From inside a git repository:

```bash
pstdio projects create my-project --repo .
```

This creates a project record and writes `.pstdio/config.json` pointing back to it. See [Create your first project](/docs/start/create-first-project/) for the full options.

## 2. Set up an agent

Prompt Studio launches real coding agents — it does not embed one. Before running `agents setup`, make sure the agent CLI is installed **and** signed in:

- Claude Code: `claude --version`, then `claude` once to sign in.
- OpenCode: `opencode --version`, then `opencode` once to sign in.

Then:

```bash
pstdio agents setup claude-code
# or
pstdio agents setup opencode
```

This installs the skills and plugins Prompt Studio needs to drive the agent from tickets. See [Configure agents](/docs/customization/configure-agents/) for the longer version.

## 3. Open the dashboard

```bash
pstdio
```

The dashboard opens at `http://localhost:5555`. The local HTTP API runs at `http://localhost:19840`.

![Project list in the dashboard](/images/docs/project-list.png)

## 4. Create a ticket

```bash
pstdio tickets create --content "# Add onboarding empty states"
```

The command prints the ticket shorthand (e.g. `Created ticket PS-1`). Take note of it — you'll pass it back in as `--id` below. You can also use the `+` button on the ticket board:

![Ticket board](/images/docs/ticket-board.png)

List existing tickets at any time:

```bash
pstdio tickets list
```

## 5. Launch an agent attempt

Two ways to hand the ticket to an agent — pick one.

### Option A: from the dashboard (recommended first time)

Open the ticket detail page, click **Implement**, confirm the agent, model, and base branch. Prompt Studio creates a new workspace backed by a git worktree (branch `pstdio/PS-1_A1`), starts the session against it, and streams the output in the sessions panel.

### Option B: from the CLI

One command, against the current checkout (no new worktree):

```bash
pstdio tickets implement --id PS-1
```

This moves the ticket to `wip` and launches an agent session with the repo root as its working directory. Good for quickly trying Prompt Studio; changes land on your current branch.

For an isolated worktree from the CLI, do it in two steps:

```bash
# Create a worktree-backed workspace on a fresh branch.
pstdio workspaces create --id PS-1 --base main

# Start a session scoped to that workspace.
pstdio sessions create \
  --workspace-id PS-1_A1 \
  --agent claude-code \
  --prompt "Implement the approach in the ticket."
```

`sessions create` prints the session id. Follow the stream live:

```bash
pstdio sessions list          # if you need to find the id later
pstdio sessions stream --id <session-id>
```

## 6. Review and merge

When the agent finishes, open the workspace in the dashboard. Review the diff, set the attempt status, and either merge:

```bash
pstdio workspaces merge --id PS-1_A1
```

…or iterate with a follow-up:

```bash
pstdio sessions follow-up --id <session-id> --prompt "Tighten the copy on the empty state."
```

## Next steps

- [Create your first project](/docs/start/create-first-project/) — details about repos and configuration.
- [Local ticket files](/docs/workflows/local-ticket-files/) — how tickets are stored on disk.
- [Workspaces and worktrees](/docs/concepts/workspaces-and-worktrees/) — what happens when you launch an attempt.
