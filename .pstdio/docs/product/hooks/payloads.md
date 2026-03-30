# Payload Schemas

Payloads are flat JSON objects.

Each hook receives exactly one payload object on stdin.

## Worktree Payloads

All worktree payloads include workspace context:

- `workspace`
- `ticket`
- `attempt_status`
- `branch`
- `worktree_path`

### Base Worktree Payload

```json
{
  "repo_path": "<abs repo path>",
  "worktree_path": "<abs worktree path>",
  "branch": "workspace/PS-1_A1",
  "workspace": "PS-1_A1",
  "ticket": "PS-1",
  "attempt_status": "review-ready"
}
```

### Hook-specific Fields

| Hook                     | Additional fields |
| ------------------------ | ----------------- |
| `pre-worktree-create`    | `base` |
| `post-worktree-create`   | none |
| `pre-commit`             | `commit_message`, `stage_policy` |
| `post-commit`            | pre-commit fields + `commit_sha` |
| `pre-merge`              | `target`, `squash`, `commit_message` |
| `post-merge`             | pre-merge fields + `commit_sha` |
| `pre-rebase`             | `target` |
| `post-rebase`            | `target` |
| `on-conflict`            | `target`, `operation`, `squash`, `commit_message` |
| `pre-worktree-remove`    | none |
| `post-worktree-remove`   | none |

`on-conflict` notes:

- `operation` is `merge` or `rebase`
- For `operation = "rebase"`, `squash` and `commit_message` are `null`

## Session Payloads

### Base Session Payload (all session hooks)

```json
{
  "session_id": "sess_1",
  "session_status": "in_progress|awaiting_input|completed|failed|cancelled"
}
```

### Workspace Session Enrichment

When the session is linked to a ticket workspace, payload also includes:

```json
{
  "workspace": "PS-1_A1",
  "attempt_status": "review-ready",
  "worktree_path": "<abs worktree path>",
  "branch": "workspace/PS-1_A1",
  "ticket": "PS-1"
}
```

## Ticket Payloads

Ticket hook payloads contain ticket-level data only.

### Ticket Snapshot Fields

All ticket hooks include:

- `id`
- `ticket`
- `display_title`
- `user_prompt`
- `parent_id`
- `draft`
- `archived`
- `status`
- `tag_ids`
- `tag_names`
- `file_ids` (includes `ticket.md` plus additional attached files)

Status transition hooks also include:

- `from_status`
- `to_status`

### `pre-ticket-creation`

```json
{
  "id": null,
  "ticket": null,
  "display_title": "Ticket title",
  "user_prompt": "Implement feature",
  "content": "# Ticket title",
  "parent_id": null,
  "draft": false,
  "archived": false,
  "status": "backlog",
  "tag_ids": ["tag_bug", "tag_backend"],
  "tag_names": ["bug", "backend"],
  "file_ids": ["file_ticket_md", "file_spec"]
}
```

`id` and `ticket` are `null` because the ticket is not yet persisted.

### `post-ticket-creation`, `pre-ticket-archive`, `post-ticket-archive`, `pre-ticket-deletion`, `post-ticket-deletion`

```json
{
  "id": "ticket_id",
  "ticket": "PS-1",
  "display_title": "Ticket title",
  "user_prompt": "Implement feature",
  "parent_id": null,
  "draft": false,
  "archived": false,
  "status": "backlog",
  "tag_ids": ["tag_bug", "tag_backend"],
  "tag_names": ["bug", "backend"],
  "file_ids": ["file_ticket_md", "file_spec"]
}
```

### `pre-ticket-status-change`

```json
{
  "id": "ticket_id",
  "ticket": "PS-1",
  "display_title": "Ticket title",
  "user_prompt": "Implement feature",
  "parent_id": null,
  "draft": false,
  "archived": false,
  "status": "backlog",
  "tag_ids": ["tag_bug", "tag_backend"],
  "tag_names": ["bug", "backend"],
  "file_ids": ["file_ticket_md", "file_spec"],
  "from_status": "backlog",
  "to_status": "review"
}
```

### `post-ticket-status-change`

```json
{
  "id": "ticket_id",
  "ticket": "PS-1",
  "display_title": "Ticket title",
  "user_prompt": "Implement feature",
  "parent_id": null,
  "draft": false,
  "archived": false,
  "status": "review",
  "tag_ids": ["tag_bug", "tag_backend"],
  "tag_names": ["bug", "backend"],
  "file_ids": ["file_ticket_md", "file_spec"],
  "from_status": "wip",
  "to_status": "review"
}
```

## Querying Related Data

If a hook needs related workspaces or sessions, query via CLI commands inside the script.

Example:

- `pstdio tickets workspaces --id "$PSTDIO_TICKET"`
- `pstdio sessions list --workspace-id "<workspace-or-id>"` where `--workspace-id` accepts either workspace shorthand or workspace ID.
