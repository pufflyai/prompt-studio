---
layout: ../../../../layouts/docs-layout.astro
title: pstdio sessions
description: Reference for the pstdio sessions command group.
htmlTitle: pstdio sessions CLI
htmlDescription: Create, list, follow up on, and stream Prompt Studio agent sessions from the CLI.
section: References
category: CLI
categoryOrder: 1
order: 4
---

## pstdio sessions create

Create a new session and launch an agent.

**Options:**

- `--prompt <string>` — initial prompt. Mutually exclusive with `--template`.
- `--template <name>` — prompt template name.
- `--var key=value` (repeatable) — template variable.
- `--title <string>` — session title. Defaults to a prompt excerpt.
- `--workspace-id <id-or-shorthand>` — workspace to scope to.
- `--project-id <id>`.
- `--agent <id>` — `claude-code`, `opencode`, …
- `--model <id>` — model override.
- `--original-session-id <id>` — id of the session that triggered this one (follow-ups).

**SDK equivalent:** `client.sessions.create(input)` → `POST /v1/sessions`.

## pstdio sessions list

List sessions for the current project.

**Options:**

- `--project-id <id>`.
- `--status <name>` — filter by status.
- `--agent <id>` — filter by agent.
- `--workspace-id <id>` — filter by workspace.
- `--archived` — include archived sessions.

## pstdio sessions view

View session details.

**Options:**

- `--id <session-id>` (required).

## pstdio sessions stream

Tail live session output in the terminal (SSE).

**Options:**

- `--id <session-id>` (required).

## pstdio sessions follow-up

Send a follow-up prompt to an existing session.

**Options:**

- `--id <session-id>` (required).
- `--prompt <string>` — free-form prompt.
- `--template <name>` — prompt template name.
- `--var key=value` (repeatable) — template variable.
- `--summary-of <session-id>` — summarize another session into the prompt.
- `--summary-format brief | detailed` — default `brief`.
- `--summary-role assistant | all` — default `assistant`.
- `--agent <id>` — switch agent for this follow-up.
- `--model <id>` — model override.

**SDK equivalent:** `client.sessions.followUp(sessionId, input)`.

## pstdio sessions approve

Approve a pending tool permission request.

**Options:**

- `--id <session-id>` (required).
- `--approval-id <id>` (required).

## pstdio sessions deny

Deny a pending tool permission request.

**Options:**

- `--id <session-id>` (required).
- `--approval-id <id>` (required).

## pstdio sessions stop

Gracefully stop a running session.

**Options:**

- `--id <session-id>` (required).

## pstdio sessions archive

Archive a session.

**Options:**

- `--id <session-id>` (required).

## pstdio sessions resolve-session-id

Resolve a Prompt Studio session id from an external agent session id.

**Options:**

- `--agent <id>` (required).
- `--agent-session-id <external-id>` (required).
- `--cwd <path>` — optional working directory used to break ties.
- `--json` — machine-readable output.

**SDK equivalent:** `client.sessions.resolveSessionId(input)`.

## Related pages

- [Follow up on a session](/docs/workflows/follow-up-session/).
- [`client.sessions` reference](/docs/reference/sdk/client/#clientsessions).
