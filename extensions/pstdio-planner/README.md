# Planner

Planner adds tickets to Prompt Studio. Plan work on a board, hand tickets to coding agents, and review what they deliver.

## Install

Planner is not installed by default. Open **Settings → Project → Extensions**, find **Prompt Studio Planner** under **Available**, and select **Install**. You can also run this inside a project folder:

```sh
pst extensions add pstdio-planner
```

Agents hand in their work as reports, so managed attempts also need the [Reports](../pstdio-reports/README.md) extension:

```sh
pst extensions add pstdio-reports
```

## What Planner adds

- A **Ticket timeline** for milestones, tracks, dependencies, and review gates. See [Timeline](docs/0005-timeline.md).
- A **Tickets** board in the project sidebar, and a page for each ticket. See [Dashboard](docs/0003-dashboard.md).
- Statuses and tags for each project. See [Tags and statuses](docs/0001-tags-and-statuses.md).
- Managed attempts: an agent works on a ticket in its own Git worktree, and a second agent reviews the result. See [Attempts](docs/0002-attempts.md).
- Review requests: tasks and decisions that ask a person for input and set Review Needed until they are answered. See [Review requests](docs/0006-review-requests.md).
- The `pst tickets`, `pst statuses`, and `pst tags` commands. See [CLI](docs/0004-cli.md).
- Skills that teach agents to work with tickets: `create-ticket`, `create-proposal`, `create-sub-tickets`, `refine-ticket`, and `implement-ticket`.
- Ticket, prompt, and document templates. Edit them in **Settings → Project → Templates**.

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

The options apply only to the current project. Adversarial review and Open PR are on by default. Projects without a local Git folder can still set the review and pull request options. Turning off Adversarial review does not change the managed reviews described in [Attempts](docs/0002-attempts.md).

The skill reads these options with `pst pstdio-planner implementation-policy` and follows them without asking. Instructions you give for a specific task take precedence.

Ticket tags have their own panel in **Settings → Project**.

From a terminal, list the branch choices with `pst pstdio-planner implementation-targets`. Set one with `pst pstdio-planner set-implementation-target --branch origin/main`. Leave out `--branch` to clear it.
