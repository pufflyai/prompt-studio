# Planner CLI

The Planner extension adds global aliases for common ticket work and namespaced commands for attempt and review workflows.

Run `pst <command> --help` for the parameters available in your installed version.

## Global command groups

- [`pst tickets`](./tickets.md)
- [`pst statuses`](./statuses.md)
- [`pst tags`](./tags.md)

## Namespaced commands

Every CLI-enabled Planner command is available under `pst pstdio-planner`. Global aliases in the table are shorter paths to the same command.

| Namespaced command | Global alias |
| --- | --- |
| `pst pstdio-planner proposal-refined` | `pst tickets proposal-refined` |
| `pst pstdio-planner list-tickets` | `pst tickets list` |
| `pst pstdio-planner create-ticket` | `pst tickets create`, `pst tickets add` |
| `pst pstdio-planner get-ticket` | `pst tickets panel` |
| `pst pstdio-planner update-ticket` | `pst tickets update` |
| `pst pstdio-planner link-review` | `pst tickets link-review` |
| `pst pstdio-planner archive-ticket` | `pst tickets archive` |
| `pst pstdio-planner delete-ticket` | `pst tickets delete` |
| `pst pstdio-planner write-ticket` | `pst tickets write` |
| `pst pstdio-planner save-ticket` | `pst tickets save` |
| `pst pstdio-planner pull-ticket` | `pst tickets pull` |
| `pst pstdio-planner list-ticket-files` | `pst tickets files` |
| `pst pstdio-planner implement-ticket` | `pst tickets implement` |
| `pst pstdio-planner ticket-workspaces` | `pst tickets workspaces` |
| `pst pstdio-planner ticket-worktrees-list` | `pst tickets worktrees list` |
| `pst pstdio-planner ticket-worktrees-remove-all` | `pst tickets worktrees remove-all` |
| `pst pstdio-planner ticketStatus read` | `pst statuses list` |
| `pst pstdio-planner ticketStatus create` | `pst statuses create` |
| `pst pstdio-planner ticketStatus update` | `pst statuses update` |
| `pst pstdio-planner ticketStatus reorder` | `pst statuses reorder` |
| `pst pstdio-planner ticketStatus delete` | `pst statuses delete` |
| `pst pstdio-planner ticketStatus setDefault` | `pst statuses set-default` |
| `pst pstdio-planner ticketTag read` | `pst tags list` |
| `pst pstdio-planner ticketTag create` | `pst tags create` |
| `pst pstdio-planner ticketTag update` | `pst tags update` |
| `pst pstdio-planner ticketTag createOption` | `pst tags options create` |
| `pst pstdio-planner ticketTag updateOption` | `pst tags options update` |
| `pst pstdio-planner ticketTag deleteOption` | `pst tags options delete` |
| `pst pstdio-planner ticketTag applyDraft` | `pst tags apply-draft` |
| `pst pstdio-planner ticketTag delete` | `pst tags delete` |

The following workflow commands only use the Planner namespace:

```sh
pst pstdio-planner attempt-readiness
pst pstdio-planner submit-change-request
pst pstdio-planner submit-review
pst pstdio-planner add-review-comment
pst pstdio-planner resolve-review-thread
pst pstdio-planner dismiss-review
pst pstdio-planner read-review-thread
pst pstdio-planner read-attempt-history
pst pstdio-planner select-attempt
pst pstdio-planner request-human
pst pstdio-planner resolve-human-request
pst pstdio-planner list-attempts
pst pstdio-planner reconcile-attempt
pst pstdio-planner run-attempt
pst pstdio-planner runReview
```

Use `--help` on any path before calling workflow commands directly. Their parameters are meant for agent and automation flows and can include revision IDs, report IDs, and expected state versions.
