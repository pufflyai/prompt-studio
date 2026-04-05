# Payload Schemas

> **Plugin hooks vs shell hooks**: For hooks dispatched through the plugin system (session, ticket, attempt-status, worktree-create), the payload is passed as a typed context object with camelCase fields (e.g. `ctx.repoPath`, `ctx.worktreePath`, `ctx.sessionId`). See [SDK Plugins — Hook Contexts](../sdk/plugins.md#hook-contexts) for the typed context definitions. The flat JSON / env var schemas below apply to shell hooks (commit, rebase, merge, conflict, worktree-remove).

Payloads are flat JSON objects.

Each shell hook receives exactly one payload object on stdin.

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

## Attempt Status Payloads

Attempt-status hooks receive workspace context plus transition metadata.

Base fields for `pre-attempt-status-*` and `post-attempt-status-*`:

- `workspace_id`
- `workspace`
- `ticket`
- `project_id`
- `worktree_path`
- `branch`
- `attempt_status_from`
- `attempt_status_to`
- `session_id` (when provided by caller)

Additional field for `post-attempt-status-*`:

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

## Querying Related Data (Shell Hooks)

If a shell hook needs related workspaces or sessions, query via CLI commands inside the script. For plugin hooks, use `ctx.client` instead.

Example:

- `pstdio tickets workspaces --id "$PSTDIO_TICKET"`
- `pstdio sessions list --workspace-id "<workspace-or-id>"` where `--workspace-id` accepts either workspace shorthand or workspace ID.

## SDK Plugin Context Mapping

SDK plugins are the primary hook mechanism for session, ticket, attempt-status, and worktree-create hooks. Plugin hook handlers receive typed `ctx` objects with camelCase fields rather than raw stdin JSON or env vars.

Examples:

- Ticket hooks: `ctx.id`, `ctx.shorthand`, `ctx.status`, `ctx.tagIds`, ...
- Session hooks: `ctx.sessionId`, `ctx.sessionStatus`, `ctx.workspace` (rich workspace object), `ctx.ticket` (rich ticket object), ...
- Attempt hooks: `ctx.workspace` (rich workspace object), `ctx.ticket` (rich ticket object), `ctx.fromStatus`, `ctx.toStatus`, ...
- Worktree-create hooks: `ctx.repoPath`, `ctx.worktreePath`, `ctx.branch`, `ctx.workspace`, ...

Import context types from `@pstdio/sdk/hooks`:

```ts
import type { TicketStatusChangeContext, SessionHookContext } from "@pstdio/sdk/hooks";
```

To preserve compatibility with filesystem-hook payload access patterns, SDK hook contexts also include:

- `ctx.payload?: Record<string, unknown>`

Use `ctx.payload` only as a fallback for fields not yet modeled in typed context fields.
