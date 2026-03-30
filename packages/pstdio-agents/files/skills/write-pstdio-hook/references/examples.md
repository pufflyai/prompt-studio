# Hook Examples

## Worktree Hooks

### Copy environment files into new worktrees

```sh
#!/bin/sh

# .pstdio/hooks/post-worktree-create
# Copies .env files from the main repo into the new worktree.

for f in .env .env.local .env.test; do
  if [ -f "$PSTDIO_REPO_PATH/$f" ]; then
    cp "$PSTDIO_REPO_PATH/$f" "$PSTDIO_WORKTREE_PATH/$f"
  fi
done
```

### Install dependencies after worktree creation

```sh
#!/bin/sh

# .pstdio/hooks/post-worktree-create
# Installs dependencies so the workspace is ready to use.

bun install
```

### Full worktree setup (copy config, agent dirs, pull ticket, install)

```sh
#!/bin/sh

# .pstdio/hooks/post-worktree-create
# Complete workspace bootstrap: config, agent skills, ticket context, deps.

# Copy .pstdio/config.json so the worktree is recognized as a pstdio project
if [ -f "$PSTDIO_REPO_PATH/.pstdio/config.json" ]; then
  mkdir -p "$PSTDIO_WORKTREE_PATH/.pstdio"
  cp "$PSTDIO_REPO_PATH/.pstdio/config.json" "$PSTDIO_WORKTREE_PATH/.pstdio/config.json"
fi

# Copy agent folders so workspace-local skills are available
for AGENT_DIR in ".claude" ".opencode"; do
  if [ -d "$PSTDIO_REPO_PATH/$AGENT_DIR" ]; then
    mkdir -p "$PSTDIO_WORKTREE_PATH/$AGENT_DIR"
    cp -R "$PSTDIO_REPO_PATH/$AGENT_DIR/." "$PSTDIO_WORKTREE_PATH/$AGENT_DIR/"
  fi
done

# Pull ticket into worktree so agents have full context
if [ -n "$PSTDIO_TICKET" ]; then
  pstdio tickets pull --id "$PSTDIO_TICKET" 2>/dev/null || true
fi

bun install
```

### Gate commits with validation

```sh
#!/bin/sh

# .pstdio/hooks/pre-commit
# Blocks the commit if validation fails.

bun run validate
```

### Run tests before merging

```sh
#!/bin/sh

# .pstdio/hooks/pre-merge
# Blocks the merge if tests fail.

bun run test
```

### Clean up build artifacts on worktree removal

```sh
#!/bin/sh

# .pstdio/hooks/pre-worktree-remove
# Cleans build caches before removing the worktree.

if [ -d "$PSTDIO_WORKTREE_PATH/node_modules" ]; then
  rm -rf "$PSTDIO_WORKTREE_PATH/node_modules"
fi
```

## Session Hooks

### Move ticket to "wip" when a session starts

```sh
#!/bin/sh

# .pstdio/hooks/post-session-start
# Moves the ticket to "wip" unless it's already in "review".

if [ -z "$PSTDIO_TICKET" ]; then
  exit 0
fi

CURRENT_STATUS=$(pstdio tickets view status --id "$PSTDIO_TICKET" 2>/dev/null)
if [ "$CURRENT_STATUS" = "review" ]; then
  exit 0
fi

if [ -n "$PSTDIO_WORKSPACE" ]; then
  pstdio workspaces set-status --workspace "$PSTDIO_WORKSPACE" --status wip
fi

pstdio tickets update --id "$PSTDIO_TICKET" --status "wip"
```

### Validate and review on session success

```sh
#!/bin/sh

# .pstdio/hooks/post-session-success
# When attempt is "review-ready":
#   1. Runs validation — on failure, resumes the session with the error
#   2. On success, launches a review session

if [ "$PSTDIO_ATTEMPT_STATUS" = "blocked" ] && [ -n "$PSTDIO_TICKET" ]; then
  pstdio tickets update --id "$PSTDIO_TICKET" --status "blocked"
  exit 0
fi

if [ "$PSTDIO_ATTEMPT_STATUS" != "review-ready" ]; then
  exit 0
fi

# Run validation
VALIDATE_OUTPUT=$(bun run validate 2>&1)

if [ $? -ne 0 ]; then
  # Validation failed — resume with the error
  if [ -n "$PSTDIO_WORKSPACE" ]; then
    pstdio workspaces set-status \
      --workspace "$PSTDIO_WORKSPACE" \
      --status "running"
  fi

  if [ -n "$PSTDIO_SESSION_ID" ]; then
    pstdio sessions follow-up --id "$PSTDIO_SESSION_ID" \
      --prompt "Validation failed. Fix the errors and mark review-ready again:

$VALIDATE_OUTPUT"
  fi
  exit 0
fi

# Validation passed — launch review session
if [ -n "$PSTDIO_WORKSPACE_ID" ]; then
  TICKET_LABEL="${PSTDIO_TICKET:-ticket}"
  pstdio sessions create \
    --workspace-id "$PSTDIO_WORKSPACE_ID" \
    --title "Code review: $TICKET_LABEL" \
    --prompt "Run a code review for ticket $TICKET_LABEL in this workspace." \
    >/dev/null 2>&1 || true
fi
```

### Notify on session failure

```sh
#!/bin/sh

# .pstdio/hooks/post-session-fail
# Marks the ticket as blocked when a session fails.

if [ -n "$PSTDIO_TICKET" ]; then
  pstdio tickets update --id "$PSTDIO_TICKET" --status "blocked"
fi
```

## Ticket Hooks

### Prevent archiving tickets that are in progress

```sh
#!/bin/sh

# .pstdio/hooks/pre-ticket-archive
# Blocks archival if the ticket is still "wip".

if [ "$PSTDIO_TO_STATUS" = "wip" ] || [ -z "$PSTDIO_TO_STATUS" ]; then
  CURRENT_STATUS=$(pstdio tickets view status --id "$PSTDIO_TICKET" 2>/dev/null)
  if [ "$CURRENT_STATUS" = "wip" ]; then
    echo "Cannot archive a ticket that is still in progress." >&2
    exit 1
  fi
fi
```

### Remove worktrees when a ticket is archived

```sh
#!/bin/sh

# .pstdio/hooks/post-ticket-archive
# Removes all worktrees associated with the archived ticket.

if [ -n "$PSTDIO_TICKET" ]; then
  pstdio workspaces list --ticket "$PSTDIO_TICKET" --format json 2>/dev/null \
    | jq -r '.[].shorthand' \
    | while read -r ws; do
        pstdio workspaces remove --workspace "$ws" 2>/dev/null || true
      done
fi
```

### Log ticket status transitions

```sh
#!/bin/sh

# .pstdio/hooks/post-ticket-status-change
# Appends a line to a status log file for auditing.

if [ -n "$PSTDIO_TICKET" ] && [ -n "$PSTDIO_FROM_STATUS" ] && [ -n "$PSTDIO_TO_STATUS" ]; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $PSTDIO_TICKET: $PSTDIO_FROM_STATUS -> $PSTDIO_TO_STATUS" \
    >> ".pstdio/tickets/status-changes.log"
fi
```

### Validate ticket content before creation

```sh
#!/bin/sh

# .pstdio/hooks/pre-ticket-creation
# Reads the ticket payload from stdin and checks for required fields.

PAYLOAD=$(cat)
TITLE=$(echo "$PAYLOAD" | jq -r '.title // empty')

if [ -z "$TITLE" ]; then
  echo "Ticket must have a title." >&2
  exit 1
fi
```
