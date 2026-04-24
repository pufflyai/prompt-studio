---
layout: ../../../layouts/docs-layout.astro
title: Install Prompt Studio
description: Install the Prompt Studio CLI and check your environment is ready.
htmlTitle: Install pstdio CLI
htmlDescription: Install the pstdio command-line tool with bun or npm and verify your environment is ready for Prompt Studio.
section: Guide
category: Start
categoryOrder: 1
order: 1
---

## Requirements

Prompt Studio runs locally and expects:

- **Bun** or **Node.js 20+**. The CLI is distributed as `pstdio` on npm.
- A **git** checkout. Projects are bound to git repositories.
- Optional: an installed coding agent such as **Claude Code** or **OpenCode** that you can drive from tickets.

## Install the CLI

Install `pstdio` globally with Bun or npm:

```bash
bun add -g pstdio
```

```bash
npm i -g pstdio
```

## Verify the install

```bash
pstdio --version
pstdio --help
```

`pstdio --help` lists the top-level command groups: `projects`, `tickets`, `sessions`, `workspaces`, `agents`, `statuses`, `tags`, `templates`, `plugins`, plus the default `pstdio`, `serve`, and `close` commands.

## Alpha-state expectations

Prompt Studio is in active alpha. Surfaces, commands, and config files may change between minor versions. Pin your dashboard and CLI to the same version and re-read the release notes when you upgrade.

## Where things live

- The CLI itself runs from your shell.
- The **local API** listens on `http://localhost:19840` by default.
- The **dashboard** serves on `http://localhost:5555` by default.
- Project state, tickets, and sessions live in a local SQLite database under your OS-level Prompt Studio storage directory; per-project files live under `.pstdio/` inside each repo.

See [Ports and environment variables](/docs/operations/ports-and-env/) for overrides.
