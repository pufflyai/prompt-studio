# Prompt Studio Planner

The Planner extension provides tickets, managed attempts, reviews, and ticket workflow settings.

Use **Open tickets** in the dashboard command palette to open the current project's Tickets board.

## Refinement options

Open Settings → Project → Extensions → Prompt Studio Planner, then the Settings tab. **Generate an artifact prototype for UX features** is enabled by default. It applies when refining a new feature with UX changes and Artifacts is installed and enabled for the project.

The refine-ticket skill reads the project option with `pst pstdio-planner refinement-policy`. The result contains `generateArtifactPrototype`. When enabled, the agent publishes an interactive prototype and links it in the ticket before completing refinement. If the option is off or Artifacts is unavailable, the agent records why it skipped the prototype. Tickets without a new UX feature do not require one.

Install the optional **Artifacts** extension from Extensions to use prototypes. Its package name is `pstdio-artifacts`. Refinement does not install it automatically. Shared ticket workflow options belong to Planner alongside its refinement and implementation skills.

## Implementation options

Open Settings → Project → Extensions → Prompt Studio Planner, then the Settings tab, to configure the `implement-ticket` workflow:

- **Adversarial review** runs a review automatically before the final commit and handoff.
- **Open PR** opens a draft pull request after validation and links it to the ticket.
- **Default target branch** selects a remote branch from the project's Git folder. Clear the selection to use the repository's default branch.
- **Maximum in-progress tickets** limits how many tickets run an implementation at once. Run attempt does not start another ticket at this limit, whether automation or a person runs it.

All options apply only to the current project. Adversarial review and Open PR are enabled by default. The dropdown lists fetched remote branches from the project's default workspace. Non-Git and remote projects can still configure the review and PR options. The skill reads these options with `pst pstdio-planner implementation-policy` and follows them without asking for confirmation. Explicit instructions for a task take precedence. Disabling adversarial review does not change managed review schedules.

Use `pst pstdio-planner implementation-targets` to list remote branch choices. Set one with `pst pstdio-planner set-implementation-target --branch origin/main`. Omit `--branch` to clear the choice.

Ticket tags have their own panel in Settings → Project.

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
