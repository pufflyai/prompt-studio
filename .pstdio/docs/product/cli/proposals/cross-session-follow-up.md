---
status: "draft"
created: "2026-03-30T15:00:00Z"
---

# Proposal: Generalized Cross-Session Follow-Up

## Problem

The `post-session-success` TODO needs two capabilities that are currently missing in CLI primitives:

1. Follow up session A with context from session B.
2. Update ticket status only when all ticket attempts match a chosen attempt status.

Current proposals that add review-specific commands are too narrow and conflict with user-defined attempt statuses.

## Scope

This proposal adds general-purpose CLI/API primitives only.

## Explicit Non-Goals

- Do not add `pst sessions create-review`.
- Do not add `pst sessions review-result`.
- Do not hardcode status names like `reviewed` in command behavior.
- Do not add prompt-template support in this change.

## CLI Proposal

### 1) Extend `pst sessions follow-up`

New flags:

- `--summary-of <source-session-id>`
- `--summary-format <brief|detailed>` (default `brief`)
- `--summary-role <assistant|all>` (default `assistant`)

Rules:

- Require at least one of `--prompt` or `--summary-of`.
- If both are provided, send `--prompt` plus appended summary block.
- If only `--summary-of` is provided, send summary-only follow-up.
- Keep existing `--agent` and `--model` overrides.

Example:

```sh
pst sessions follow-up \
  --id s_impl_123 \
  --summary-of s_review_456 \
  --summary-format detailed
```

This is the generic replacement for review-only follow-up flows.

### 2) Add conditional ticket transition command

New command:

```sh
pst tickets update-when-attempt-status \
  --id <ticket-shorthand> \
  --all-attempts-status <attempt-status-name> \
  --set-status <ticket-status-name>
```

Behavior:

- Evaluate active workspaces linked to the ticket.
- Compare each workspace attempt status name against `--all-attempts-status`.
- If all match, update ticket to `--set-status`.
- If not all match, no-op and exit `0`.

Notes:

- Attempt statuses remain user-defined strings.
- Command has no review-specific semantics.

### 3) Add machine-readable ticket workspace output

Extend existing command:

- `pst tickets workspaces --id <ticket> --json`

JSON rows should include:

- `workspace_shorthand`
- `workspace_id`
- `attempt_status_id`
- `attempt_status_name`
- `branch`
- `worktree_path`

This enables hook scripts to inspect attempt status directly without text table parsing.

## API Proposal

### Sessions

Extend `POST /v1/sessions/{id}/follow-up` payload:

- `summary_from_session_id?: string`
- `summary_format?: "brief" | "detailed"`
- `summary_role?: "assistant" | "all"`

Server composes summary text from source session conversation and injects it into follow-up prompt.

### Tickets

Add atomic endpoint:

- `POST /v1/tickets/{id}/update-when-attempt-status`

Body:

- `all_attempts_status: string`
- `set_status: string`

Response:

- `{ updated: true }` when ticket status changed
- `{ updated: false }` when gate condition not met

Atomic server-side check avoids CLI race conditions between "read attempts" and "update ticket".

### Workspaces (optional but recommended)

Extend workspace list payload to include resolved `attempt_status_name` along with `attempt_status_id`.

## Hook Migration (post-session-success TODO)

After a review session finishes:

1. Follow up the original implementation session with summary of review session.
2. Try conditional ticket transition based on a caller-chosen attempt status name.

Example flow:

```sh
pst sessions follow-up \
  --id "$ORIGINAL_SESSION_ID" \
  --summary-of "$REVIEW_SESSION_ID"

pst tickets update-when-attempt-status \
  --id "$PSTDIO_TICKET" \
  --all-attempts-status "$PSTDIO_DONE_ATTEMPT_STATUS" \
  --set-status "$PSTDIO_TARGET_TICKET_STATUS"
```

No fixed status values are baked into CLI behavior.

## Test Plan

CLI:

- `sessions follow-up` accepts `--summary-of` with and without `--prompt`.
- `sessions follow-up` fails when neither `--prompt` nor `--summary-of` is provided.
- `tickets update-when-attempt-status` updates when all match.
- `tickets update-when-attempt-status` no-ops when at least one does not match.
- `tickets workspaces --json` outputs attempt status fields.

API:

- Follow-up endpoint composes summary from source session and resumes target session.
- Conditional ticket update endpoint returns both `{ updated: true }` and `{ updated: false }` paths.

## Rollout

1. Implement API additions.
2. Implement CLI flags/command.
3. Update bundled `post-session-success` hook to use new commands.
4. Update docs for sessions, tickets, and hooks.
