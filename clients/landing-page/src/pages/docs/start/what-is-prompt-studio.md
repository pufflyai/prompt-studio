---
layout: ../../../layouts/docs-layout.astro
title: What is Prompt Studio
description: Who Prompt Studio is for, what it actually does, and the mental model behind tickets, workspaces, and sessions.
htmlTitle: Prompt Studio overview
htmlDescription: A local control plane for coding agents. Turn work into tickets, run agents in isolated git worktrees, then review and merge — all on your machine.
section: Guide
category: Start
categoryOrder: 1
order: 0
---

Prompt Studio is a **local control plane for coding agents**. You point it at a git repository, capture work as tickets, and hand each ticket to a real agent CLI (Claude Code, OpenCode) running in an isolated git worktree. Review, iterate, and merge happen on the same board — without losing what was tried, why, or how.

## Who it is for

You will get the most out of Prompt Studio if you:

- Already run a coding agent locally and want a cleaner wrapper than ad-hoc terminals.
- Juggle **multiple** agent attempts in parallel — different models, different branches, or different approaches to the same ticket.
- Want durable review context: the prompt, the conversation, the diff, the status, all tied back to a ticket.
- Prefer local-first tools: your tickets and sessions live on disk and in SQLite, not in someone else's cloud.

## What it is not

- **Not another LLM chat app.** Prompt Studio does not ship a model or an agent. It drives agent CLIs you install and authenticate separately.
- **Not a cloud issue tracker.** There is no server-side board, no team sync out of the box. Tickets live in your local database and, optionally, as markdown in `.pstdio/tickets/`.
- **Not a git UI.** It uses git worktrees to isolate attempts; it does not replace branching, pushing, or reviewing on your git host.

## The core loop

```
ticket  →  workspace (git worktree)  →  session (agent run)  →  review  →  merge
```

Four concepts do most of the work:

- **Project** — one Prompt Studio project wraps one or more git repos.
- **Ticket** — a unit of work. Has a status (`backlog`, `wip`, …), tags, and a markdown body.
- **Workspace (attempt)** — an attempt at a ticket. Each workspace owns a git worktree on a fresh branch so attempts don't collide with your current checkout.
- **Session** — a running conversation with an agent, scoped to a workspace. A ticket can have many sessions across many attempts.

Everything else — hooks, plugins, schedules, templates, the SDK — extends that loop.

## What stays local

- The **API** (`http://localhost:19840`) and **dashboard** (`http://localhost:5555`) run on your machine.
- The database is SQLite under your OS storage directory.
- Ticket files, uploaded artifacts, and your plugins live under `.pstdio/` in each repo.
- Nothing leaves your machine unless the agent you run does.

## What changes in your repo

Prompt Studio only writes two things to your project directory:

- `.pstdio/config.json` — binds a checkout to a project id.
- `.pstdio/tickets/<shorthand>/` — ticket markdown plus uploaded files, on demand.

Workspaces (attempt worktrees) are created **outside** your checkout under `$HOME/.pstdio/workspaces/` by default. Your main working tree is untouched while agents work.

## Where to go next

- [Install Prompt Studio](/docs/start/install/) — CLI requirements.
- [Quickstart](/docs/start/quickstart/) — five minutes from install to first merged attempt.
- [Workspaces and worktrees](/docs/concepts/workspaces-and-worktrees/) — how attempts are isolated with git worktrees.
