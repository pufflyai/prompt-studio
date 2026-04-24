---
layout: ../../../layouts/docs-layout.astro
title: Common issues
description: Symptoms, causes, and fixes for the problems you're most likely to hit.
htmlTitle: Troubleshooting common issues
htmlDescription: Symptoms, root causes, and fixes for the most common problems users hit with Prompt Studio.
section: Guide
category: Troubleshooting
categoryOrder: 8
order: 1
---

## Agent not found

**Symptom:** `pstdio tickets implement` or the dashboard's "Implement" button fails with an "agent not installed" or "agent not configured" message.

**Fix:**

1. Check availability: `curl http://localhost:19840/v1/agents/availability`. Look for the agent's `type`.
2. If `UNAVAILABLE`, install the agent binary manually.
3. If `AVAILABLE`, run `pstdio agents setup <agent-id>`.
4. Override the binary path if the agent is installed outside `PATH`:
   ```bash
   pstdio agents update <agent-id> --binary /opt/homebrew/bin/<agent>
   ```

## API will not start

**Symptom:** `pstdio` hangs or exits immediately, or `pstdio close` says nothing is running.

**Fix:**

1. Another process may hold the port. See "Port already in use" below.
2. Check logs — run `pstdio serve` in the foreground to see startup errors.
3. Check database path — if `PSTDIO_DB_PATH` is unwritable, the API refuses to start.
4. Verify your version with `pstdio --version`. Upgrade with `bun add -g pstdio@latest`.

## Dashboard cannot connect

**Symptom:** The dashboard loads the shell but shows "disconnected" or empty lists.

**Fix:**

1. Confirm the API is up: `curl http://localhost:19840/healthz`.
2. If the API runs on a non-default port, start the dashboard with the matching `--api-port` value.
3. If `PSTDIO_API_TOKEN` is set, the dashboard needs the same token in its URL: `http://localhost:5555/?token=...` (or run `pstdio` on the same machine, which forwards it for you).
4. Browser devtools → Network: look for `/sync/stream`. A stuck `pending` with recurring retries means the API is unreachable.

## Port already in use

**Symptom:** `listen EADDRINUSE` on startup.

**Fix:**

1. Check who owns the port: `lsof -iTCP:19840 -sTCP:LISTEN`.
2. If it is a stale `pstdio`, run `pstdio close`.
3. Otherwise, pick a different port: `pstdio --api-port 19841 --dashboard-port 5556`.

## Worktree cleanup failed

**Symptom:** `pstdio workspaces delete` or `tickets worktrees remove-all` errors out.

**Fix:**

1. Run `git worktree list` from the source repo — find the worktree path.
2. Check for uncommitted changes: `cd <worktree-path> && git status`. Commit or discard.
3. Retry the cleanup command. If it still fails, fall back to `git worktree remove --force <path>` and then rerun `pstdio workspaces delete`.

## Hook rejected a transition

**Symptom:** Changing a ticket status or attempt status fails with a `reject` reason shown in the UI or CLI.

**Fix:**

1. The `reason` is from your hook — follow what it asks.
2. To bypass the hook temporarily, disable the plugin: remove or rename the file under `.pstdio/plugins/` and run `pstdio plugins register`.
3. If the hook is buggy, check its logs (stdout of the API process).

## Plugin failed to load

**Symptom:** `pstdio plugins register` reports a file didn't load, or it's missing from `pstdio plugins list`.

**Fix:**

1. Syntax errors: run `bun check .pstdio/plugins/<file>.ts` to surface them.
2. Missing dependency: install `@pstdio/sdk` in the nearest `package.json`.
3. Duplicate keys: two plugins can't export the same `key`. Rename one.

## Session disconnected

**Symptom:** The session view shows "disconnected"; CLI `pstdio sessions stream` exits.

**Fix:**

1. If the agent process crashed, the session is marked `failed`. Start a follow-up against it (if useful) or create a new attempt.
2. If the API restarted, reconnect — the session may resume if the agent has a resumable state.

## Local ticket save failed

**Symptom:** `pstdio tickets save` reports an error about missing frontmatter or an unknown status.

**Fix:**

1. `ticket.md` must start with `---` and close its frontmatter with `---`.
2. `status_name` must match a status that exists in the project (`pstdio statuses list`).
3. `tag_names` must reference tags that exist (`pstdio tags list`).
4. Re-pull to align with server state: `pstdio tickets pull --id <shorthand> --force`.
