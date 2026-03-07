# Real-time Updates

All database changes propagate to connected clients in real time. The dashboard always shows current state without polling or manual refresh.

---

## Why

- **Multiple clients edit concurrently.** The CLI and dashboard can both modify data. Without real-time sync, clients show stale state.
- **No polling overhead.** SSE pushes changes the moment they happen. Clients don't waste requests checking for updates.
- **Consistent mental model.** Users see the same data everywhere, instantly.

---

## What gets synced

15 tables are included in the sync stream:

| Table                    | Description                                        |
| ------------------------ | -------------------------------------------------- |
| `projects`               | Top-level projects                                 |
| `repos`                  | Git repositories                                   |
| `project_repos`          | Project ↔ repo associations                        |
| `agent_configs`          | Configured coding agents                           |
| `ticket_statuses`        | Status definitions per project                     |
| `tickets`                | Work items                                         |
| `ticket_tags`            | Tag definitions per project                        |
| `ticket_tag_assignments` | Tag ↔ ticket associations                          |
| `sessions`               | Coding sessions (content stored as file reference) |
| `workspaces`             | Workspace definitions                              |
| `ticket_workspaces`      | Ticket ↔ workspace associations                    |
| `files`                  | File metadata (content on disk)                    |
| `ticket_files`           | Ticket ↔ file associations                         |
| `workspace_artifacts`    | Artifacts produced in workspaces                   |
| `templates`              | Project templates                                  |

### Excluded

Y.js tables (`ydoc_updates`, `ydoc_awareness`, `ydoc_resume_state`) are excluded. Y.js uses its own binary sync protocol — mixing it into the SSE stream would add complexity without benefit.

---

## Design decisions

- **Session content is excluded.** The `sessions` table stores a `session_file_id` foreign key pointing to the `files` table. Content can be arbitrarily large and is only needed by the client actively editing it — fetched separately on demand.
- **Y.js tables are excluded.** Y.js uses its own binary sync protocol. Mixing it into the SSE stream would add complexity without benefit.

See [Streaming architecture](/architecture/stream) for the event protocol, reconnection strategy, and implementation details.
