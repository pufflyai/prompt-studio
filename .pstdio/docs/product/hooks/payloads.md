# Payload Schemas

All hooks are SDK plugins. The payload is passed as a typed context object with camelCase fields (e.g. `ctx.repoPath`, `ctx.worktreePath`, `ctx.sessionId`). See [SDK Plugins — Hook Contexts](../sdk/plugins.md#hook-contexts) for the typed context definitions.

The flat JSON schemas below document the underlying payload structure.

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
| `preWorktreeCreate`    | `base` |
| `postWorktreeCreate`   | none |
| `preCommit`            | `commit_message`, `stage_policy` |
| `postCommit`           | preCommit fields + `commit_sha` |
| `preMerge`             | `target`, `squash`, `commit_message` |
| `postMerge`            | preMerge fields + `commit_sha` |
| `preRebase`            | `target` |
| `postRebase`           | `target` |
| `onConflict`           | `target`, `operation`, `squash`, `commit_message` |
| `preWorktreeRemove`    | none |
| `postWorktreeRemove`   | none |

`onConflict` notes:

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

## Attempt Status Payloads

Attempt-status hooks receive workspace context plus transition metadata.

Base fields for `preAttemptStatusChange` and `postAttemptStatusChange`:

- `workspace_id`
- `workspace`
- `ticket`
- `project_id`
- `worktree_path`
- `branch`
- `attempt_status_from`
- `attempt_status_to`
- `session_id` (when provided by caller)

Additional field for `postAttemptStatusChange`:

- `status_change_id`

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

### `preTicketCreation`

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

### `postTicketCreation`, `preTicketArchive`, `postTicketArchive`, `preTicketDeletion`, `postTicketDeletion`

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

### `preTicketStatusChange`

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

### `postTicketStatusChange`

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

Use `ctx.client` to query related workspaces or sessions inside a plugin hook.

## SDK Plugin Context

Plugin hook handlers receive typed `ctx` objects with camelCase fields. Import context types from `@pstdio/sdk/hooks`:

```ts
import type { TicketStatusChangeContext, SessionHookContext } from "@pstdio/sdk/hooks";
```

Examples:

- Ticket hooks: `ctx.id`, `ctx.shorthand`, `ctx.status`, `ctx.tagIds`, ...
- Session hooks: `ctx.sessionId`, `ctx.sessionStatus`, `ctx.workspace`, `ctx.ticket`, ...
- Attempt hooks: `ctx.workspace`, `ctx.ticket`, `ctx.fromStatus`, `ctx.toStatus`, ...
- Worktree hooks: `ctx.repoPath`, `ctx.worktreePath`, `ctx.branch`, `ctx.workspace`, ...
