# Cookbook

## Set Up a Worktree for Development

`post-worktree-create` — copy config, agent folders, env files, pull ticket context, and install dependencies.

```sh
#!/bin/sh

WORKTREE="$PSTDIO_WORKTREE_PATH"
REPO="$PSTDIO_REPO_PATH"
TICKET="${PSTDIO_TICKET}"

mkdir -p "$WORKTREE/.pstdio"
cp "$REPO/.pstdio/config.json" "$WORKTREE/.pstdio/config.json"

for dir in ".claude" ".opencode"; do
  if [ -d "$REPO/$dir" ]; then
    mkdir -p "$WORKTREE/$dir"
    cp -R "$REPO/$dir/." "$WORKTREE/$dir/"
  fi
done

for f in .env .env.local .env.test; do
  [ -f "$REPO/$f" ] && cp "$REPO/$f" "$WORKTREE/$f"
done

[ -n "$TICKET" ] && pstdio tickets pull --id "$TICKET" 2>/dev/null || true

bun install
bun run build
```

## Validate Before Committing

`pre-commit` — run full validation before allowing a commit.

```sh
#!/bin/sh
bun run validate
```

## Run Tests Before Merging

`pre-merge` — gate merges on tests.

```sh
#!/bin/sh
bun run test
```

## Auto-Assign Default Fields on Ticket Creation

`pre-ticket-creation` — enrich tickets before persistence.

```sh
#!/bin/sh
NEXT=$(jq '.priority //= "medium" | .labels += ["needs-triage"]')
echo "PSTDIO_PAYLOAD=$NEXT"
```

## Branch on Completion Status

`post-session-success` — branch automation by `attempt_status`.

```sh
#!/bin/sh
STATUS="${PSTDIO_ATTEMPT_STATUS:-}"
TICKET="${PSTDIO_TICKET:-}"
WORKSPACE="${PSTDIO_WORKSPACE:-}"

if [ "$STATUS" = "blocked" ] && [ -n "$TICKET" ]; then
  pstdio tickets update --id "$TICKET" --status blocked
  exit 0
fi

if [ "$STATUS" = "review-ready" ] && [ -n "$WORKSPACE" ]; then
  pstdio sessions create \
    --workspace-id "$WORKSPACE" \
    --agent reviewer \
    --prompt "Run a code review for ticket $TICKET"
fi
```

`--workspace-id` accepts workspace shorthand or workspace ID.

## Move Ticket to WIP When Work Starts

`post-session-start` — move ticket to WIP when session begins in a workspace.

```sh
#!/bin/sh
TICKET="${PSTDIO_TICKET:-}"
if [ -n "$TICKET" ]; then
  pstdio tickets update --id "$TICKET" --status wip
fi
```

## Notify on Ticket Status Change

`post-ticket-status-change` — send a Slack message when a ticket changes status.

```sh
#!/bin/sh
TICKET="${PSTDIO_TICKET:-}"
STATUS="${PSTDIO_TO_STATUS:-}"
[ -z "$TICKET" ] && exit 0
[ -z "$STATUS" ] && exit 0

curl -X POST "$SLACK_WEBHOOK" \
  -H 'Content-Type: application/json' \
  -d "{\"text\": \"Ticket $TICKET moved to $STATUS\"}"
```

## Cleanup Worktrees on Archive

`post-ticket-archive` — remove worktrees associated with the archived ticket.

```sh
#!/bin/sh
TICKET="${PSTDIO_TICKET:-}"
[ -z "$TICKET" ] && exit 0
pstdio tickets worktrees remove-all --id "$TICKET"
```
