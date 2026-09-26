# Prompt Studio Planner

The Planner extension provides tickets, managed attempts, reviews, and ticket workflow settings.

## Implementation options

Open Settings → Planner → Implementation to configure the `implement-ticket` workflow:

- **Adversarial review** runs a review automatically before the final commit and handoff.
- **Open PR** opens a draft pull request after validation and links it to the ticket.
- **Default target branch** selects a remote branch from the project's Git folder. Clear the selection to use the repository's default branch.

All options apply only to the current project. Adversarial review and Open PR are enabled by default. The dropdown lists fetched remote branches from the project's default workspace. Non-Git and remote projects can still configure the review and PR options. The skill reads these options with `pst pstdio-planner implementation-policy` and follows them without asking for confirmation. Explicit instructions for a task take precedence. Disabling adversarial review does not change managed review schedules.

Use `pst pstdio-planner implementation-targets` to list remote branch choices. Set one with `pst pstdio-planner set-implementation-target --branch origin/main`. Omit `--branch` to clear the choice.

## Documentation

- [CLI command index](./docs/cli/index.md)
- [Ticket CLI](./docs/cli/tickets.md)
- [Status CLI](./docs/cli/statuses.md)
- [Tag CLI](./docs/cli/tags.md)
- [Ticket board](./docs/dashboard/tickets.md)
- [Ticket detail](./docs/dashboard/ticket-detail.md)
- [Ticket cards](./docs/dashboard/ticket-cards.md)
- [Managed attempts](./docs/attempts.md)
- [Tags and statuses](./docs/tags-and-statuses.md)
