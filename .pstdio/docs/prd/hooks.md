# Hooks

Hooks are user-defined reactions to system events. The system emits events at key points in the session, worktree, ticket, and attempt lifecycle — users wire up whatever logic they need.

## Session Hooks

Fired during the lifecycle of an agent session.

| Hook                       | Fires when                          |
| -------------------------- | ----------------------------------- |
| `post-session-start`       | A session begins                    |
| `post-session-success`     | A session completes successfully    |
| `post-session-fail`        | A session ends with an error        |
| `post-session-resume`      | A paused or crashed session resumes |
| `post-session-await-input` | A session is waiting for user input |

## Worktree Hooks

Fired during the lifecycle of a worktree. `pre-*` hooks are blocking — a non-zero exit aborts the operation. `post-*` and `on-*` hooks are non-blocking. See [hooks.md](.pstdio/docs/product/cli/hooks.md) for full details.

| Hook                   | Fires when                            | Blocking |
| ---------------------- | ------------------------------------- | -------- |
| `pre-worktree-create`  | Before worktree is created            | Yes      |
| `post-worktree-create` | After worktree is created             | Yes      |
| `pre-commit`           | Before staging and committing changes | Yes      |
| `post-commit`          | After a commit is created             | No       |
| `pre-rebase`           | Before rebasing onto target           | Yes      |
| `post-rebase`          | After successful rebase               | No       |
| `pre-merge`            | Before squash-merging                 | Yes      |
| `post-merge`           | After successful merge                | No       |
| `pre-worktree-remove`  | Before worktree deletion              | Yes      |
| `post-worktree-remove` | After worktree is removed             | No       |
| `on-conflict`          | When a merge or rebase hits conflicts | No       |

## Ticket Hooks

Fired during the lifecycle of a ticket. `pre-*` hooks are blocking — a non-zero exit aborts the operation.

| Hook                        | Fires when                       | Blocking |
| --------------------------- | -------------------------------- | -------- |
| `pre-ticket-creation`       | Before a ticket is created       | Yes      |
| `post-ticket-creation`      | After a new ticket is created    | No       |
| `pre-ticket-status-change`  | Before a ticket's status changes | Yes      |
| `post-ticket-status-change` | After a ticket's status changes  | No       |
| `pre-ticket-archive`        | Before a ticket is archived      | Yes      |
| `post-ticket-archive`       | After a ticket is archived       | No       |
| `pre-ticket-deletion`       | Before a ticket is deleted       | Yes      |
| `post-ticket-deletion`      | After a ticket is deleted        | No       |

## Hook Interface

All hooks follow the same stdin/stdout JSON pipe interface.

- **Stdin**: the event payload as JSON
- **Stdout**: the modified payload as JSON (empty stdout = no changes)
- **Stderr**: error messages (shown to the user on failure)
- **Exit 0**: accept — the operation proceeds with the (optionally modified) payload
- **Exit non-zero**: reject — the operation is aborted (`pre-*` hooks only, `post-*` hooks log the error and continue)

This applies uniformly to all hooks. Every hook is a standard unix filter.

```sh
# accept as-is
cat

# modify the payload
jq '.priority = "medium"'

# reject
echo "Missing description" >&2
exit 1
```

### Environment Variables

Every hook receives environment variables alongside the JSON payload. Which variables are set depends on the hook type and the available context.

#### All hooks

| Variable            | Description                    | Always set |
| ------------------- | ------------------------------ | ---------- |
| `PSTDIO_HOOK`       | Name of the hook being run     | Yes        |
| `PSTDIO_REPO_PATH`  | Absolute path to the repo root | Yes        |
| `PSTDIO_PROJECT_ID` | Project ID                     | Yes        |

#### Worktree hooks

Set for all worktree lifecycle hooks (`pre-worktree-create`, `post-worktree-create`, `pre-commit`, `post-commit`, `pre-rebase`, `post-rebase`, `pre-merge`, `post-merge`, `pre-worktree-remove`, `post-worktree-remove`, `on-conflict`).

| Variable                | Description                          | When set                                                              |
| ----------------------- | ------------------------------------ | --------------------------------------------------------------------- |
| `PSTDIO_BRANCH`         | Workspace branch name                | Always                                                                |
| `PSTDIO_WORKTREE_PATH`  | Absolute path to the worktree        | After worktree exists                                                 |
| `PSTDIO_WORKSPACE`      | Workspace shorthand (e.g. `PS-1_A1`) | Always                                                                |
| `PSTDIO_TARGET`         | Target branch for merge/rebase       | `pre-merge`, `post-merge`, `pre-rebase`, `post-rebase`, `on-conflict` |
| `PSTDIO_COMMIT_SHA`     | Commit hash                          | `post-commit`, `post-merge`                                           |
| `PSTDIO_COMMIT_MESSAGE` | Commit message                       | `pre-commit`, `post-commit`                                           |

#### Session hooks

Set for all session lifecycle hooks (`post-session-start`, `post-session-success`, `post-session-fail`, `post-session-resume`, `post-session-await-input`). When the session is linked to a workspace, the workspace variables are also available.

| Variable               | Description                   | When set                                      |
| ---------------------- | ----------------------------- | --------------------------------------------- |
| `PSTDIO_WORKSPACE`     | Workspace shorthand           | Session linked to a workspace                 |
| `PSTDIO_WORKTREE_PATH` | Absolute path to the worktree | Session linked to a workspace with a worktree |
| `PSTDIO_BRANCH`        | Workspace branch name         | Session linked to a workspace                 |

#### Ticket hooks

Set for all ticket lifecycle hooks (`pre-ticket-creation`, `post-ticket-creation`, `pre-ticket-status-change`, `post-ticket-status-change`, `pre-ticket-archive`, `post-ticket-archive`, `pre-ticket-deletion`, `post-ticket-deletion`). Ticket hooks do not receive workspace variables — use the JSON payload for ticket data.

### Payload Modification

Any hook can modify the event payload by writing JSON to stdout. The output replaces the payload for downstream processing:

- `pre-*` hooks: modifications are applied before the operation executes (e.g. `pre-ticket-creation` can add default fields)
- `post-*` hooks: modifications are passed to subsequent hooks in the chain but do not alter the already-completed operation

```sh
# .pstdio/hooks/pre-ticket-creation
# Auto-assign priority and labels before the ticket is persisted
jq '.priority //= "medium" | .labels += ["needs-triage"]'
```

```sh
# .pstdio/hooks/post-session-success
# Enrich the event payload for downstream hooks
jq '. + {"notified": true}'
```

## Attempt Status

An attempt is a unit of work on a ticket — typically an agent session running in a worktree. Each attempt has a **status** that tracks where it is in its lifecycle.

### How it works

1. The user defines the set of valid attempt statuses in their project config. Statuses are freeform strings — the system doesn't enforce semantics, only that the value is in the configured set.
2. Agents update the attempt status during their session via a tool call (e.g. `mark-attempt-status`). The agent decides when a status transition makes sense based on its progress.
3. When the status changes, the system includes it in the event payload of subsequent session hooks. Hooks react to the status — the agent doesn't need to know what happens downstream.

This decouples agent behavior from workflow automation. Agents signal intent ("I'm done, this is ready for review"), hooks decide what to do with it ("start the review agent", "move the ticket").

### Configuration

```json
{
  "attemptStatuses": [
    "running",
    "blocked",
    "review-ready",
    "reviewed",
    "changes-requested"
  ]
}
```

Users define statuses that match their workflow. A team doing code review might use `review-ready` → `reviewed` → `changes-requested`. A team doing QA might use `dev-complete` → `qa-ready` → `qa-passed`.

### Event Payload

Session hooks receive the current attempt status and the status of all sibling attempts on the same ticket. This allows hooks to make decisions that span multiple attempts.

```json
{
  "session": { "id": "sess_abc" },
  "attempt": { "id": "att_1", "status": "review-ready" },
  "ticket": {
    "id": "TK-42",
    "attempts": [
      { "id": "att_1", "status": "review-ready" },
      { "id": "att_2", "status": "reviewed" }
    ]
  }
}
```

A `post-session-success` hook can check if all attempts are `reviewed` before moving the ticket — without the agent needing to know about the ticket's overall state.

## Cookbook

### Set up a worktree for development

`post-worktree-create` — copy config, agent folders, env files, pull ticket context, and install dependencies.

```sh
#!/bin/sh

# Copy project config so the worktree is recognized
WORKTREE="$PSTDIO_WORKTREE_PATH"
REPO="$PSTDIO_REPO_PATH"

mkdir -p "$WORKTREE/.pstdio"
cp "$REPO/.pstdio/config.json" "$WORKTREE/.pstdio/config.json"

# Copy agent folders so skills are available
for dir in ".claude" ".opencode"; do
  if [ -d "$REPO/$dir" ]; then
    cp -R "$REPO/$dir" "$WORKTREE/$dir"
  fi
done

# Copy env files
for f in .env .env.local .env.test; do
  [ -f "$REPO/$f" ] && cp "$REPO/$f" "$WORKTREE/$f"
done

# Pull the ticket into the worktree so agents have context
TICKET=$(printf '%s\n' "$PSTDIO_WORKSPACE" | sed 's/_A[0-9]*$//')
[ -n "$TICKET" ] && pstdio tickets pull --id "$TICKET" 2>/dev/null || true

bun install
bun run build
```

### Validate before committing

`pre-commit` — run the full validation suite before allowing a commit.

```sh
#!/bin/sh
bun run validate
```

### Run tests before merging

`pre-merge` — gate merges on a passing test suite.

```sh
#!/bin/sh
bun run test
```

### Auto-assign default fields on ticket creation

`pre-ticket-creation` — enrich tickets with defaults before they're persisted.

```sh
#!/bin/sh
jq '.priority //= "medium" | .labels += ["needs-triage"]'
```

### Auto-start review on completion

`post-session-success` — if the agent marked the attempt as `review-ready`, kick off a review session.

```sh
#!/bin/sh
STATUS=$(jq -r '.attemptStatus' )
if [ "$STATUS" = "review-ready" ]; then
  pstdio sessions start --agent reviewer --workspace "$PSTDIO_WORKSPACE" &
fi
```

### Move ticket to WIP when work starts

`post-session-start` — move the ticket to the WIP column when a session begins in a workspace.

```sh
#!/bin/sh
TICKET=$(jq -r '.ticket // empty')
if [ -n "$TICKET" ]; then
  pstdio tickets status --id "$TICKET" --status wip
fi
```

### Notify on ticket status change

`post-ticket-status-change` — send a Slack message when a ticket moves columns.

```sh
#!/bin/sh
PAYLOAD=$(cat)
TICKET=$(echo "$PAYLOAD" | jq -r '.id')
STATUS=$(echo "$PAYLOAD" | jq -r '.status')
curl -X POST "$SLACK_WEBHOOK" \
  -H 'Content-Type: application/json' \
  -d "{\"text\": \"Ticket $TICKET moved to $STATUS\"}"
```

### Cleanup worktrees on archive

`post-ticket-archive` — remove all worktrees associated with the archived ticket.

```sh
#!/bin/sh
TICKET=$(jq -r '.id')
pstdio workspaces list --ticket "$TICKET" --format json \
  | jq -r '.[].name' \
  | xargs -I{} pstdio workspaces remove {}
```

### Block ticket on stuck attempt

`post-session-success` — if the agent flagged the attempt as blocked, update the ticket status.

```sh
#!/bin/sh
PAYLOAD=$(cat)
STATUS=$(echo "$PAYLOAD" | jq -r '.attemptStatus // empty')
TICKET=$(echo "$PAYLOAD" | jq -r '.ticket // empty')
if [ "$STATUS" = "blocked" ] && [ -n "$TICKET" ]; then
  pstdio tickets status --id "$TICKET" --status blocked
fi
```
