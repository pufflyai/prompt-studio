# Planner

Planner adds tickets to Prompt Studio. Plan work on a board, hand tickets to coding agents, and review what they deliver.

## Install

Planner is not installed by default. Open **Settings → Project → Extensions**, find **Project Planner** under **Available**, and select **Install**. You can also run this inside a project folder:

```sh
pst extensions add pstdio-planner
```

Agents hand in their work as reports, so managed attempts also need the [Reports](../pstdio-reports/README.md) extension:

```sh
pst extensions add pstdio-reports
```

## What Planner adds

- A **Project Timeline** for milestones, tracks, dependencies, and review gates. See [Timeline](docs/0005-timeline.md).
- **Auto Build** to let a supervisor assign valid project tickets using your prompt and eligibility filters. See [Auto Build](docs/0007-auto-build.md).
- A **Tickets** board in the project sidebar, and a page for each ticket. See [Dashboard](docs/0003-dashboard.md).
- Statuses and tags for each project. See [Tags and statuses](docs/0001-tags-and-statuses.md).
- Managed attempts: an agent works on a ticket in its own Git worktree, keeps the ticket status current, and reuses that workspace for corrections. An extra review is optional. See [Attempts](docs/0002-attempts.md).
- Review requests: tasks and decisions that ask a person for input and set Review Needed until they are answered. See [Review requests](docs/0006-review-requests.md).
- The `pst tickets`, `pst statuses`, and `pst tags` commands. See [CLI](docs/0004-cli.md).
- Skills that teach agents to work with tickets: `create-ticket`, `create-proposal`, `create-sub-tickets`, `refine-ticket`, and `implement-ticket`.
- Ticket, prompt, and document templates. Edit them in **Settings → Project → Templates**.

Use **Open tickets** in the dashboard command palette to open the current project's Tickets board.

## Refinement options

Open Settings → Project → Extensions → Project Planner, then the Settings tab. **Generate an artifact prototype for UX features** is enabled by default. It applies when refining a new feature with UX changes and Artifacts is installed and enabled for the project.

The refine-ticket skill reads the project option with `pst pstdio-planner refinement-policy`. The result contains `generateArtifactPrototype`. When enabled, the agent publishes an interactive prototype and links it in the ticket before completing refinement. If the option is off or Artifacts is unavailable, the agent records why it skipped the prototype. Tickets without a new UX feature do not require one.

Install the optional **Artifacts** extension from Extensions to use prototypes. Its package name is `pstdio-artifacts`. Refinement does not install it automatically. Shared ticket workflow options belong to Planner alongside its refinement and implementation skills.

## Implementation options

Open Settings → Project → Extensions → Project Planner, then the Settings tab, to configure the `implement-ticket` workflow:

- **Adversarial review** runs a review automatically before the final commit and handoff.
- **Open PR** opens a draft pull request after validation and links it to the ticket.
- **Default target branch** selects a remote branch from the project's Git folder. Clear the selection to use the repository's default branch.
- **Maximum in-progress tickets** limits how many tickets run an implementation at once. Run attempt does not start another ticket at this limit, whether automation or a person runs it.

Choose **Auto Build** in Project Timeline to open its modal. Enter a prompt, choose the supervisor harness, model and run options, set **Eligible tickets**, and confirm with **Auto Build**. All options stay in the same modal. The information icon next to the title explains how it works. A supervisor uses your prompt to assign valid, unassigned tickets as dependencies and capacity allow. Completed tickets are excluded using your workflow settings. Each implementation uses the default agent and target branch.

The supervisor ends its turn between checks and resumes when more work can run. The mode keeps running when the timeline is closed and resumes its checks after restarting Prompt Studio. Click the active **Auto Build** button to inspect sessions or choose **Stop Auto Build**. Work already dispatched continues. The selected view, filters, and search only affect the display. A supervisor wakeup failure turns the mode off and shows the error so you can resolve it before re-enabling.

Auto build leaves gates, blocked work, open human requests, and existing attempts for review. Agents that get stuck use Planner's **Request human input** action so the timeline shows Review Needed.

The options apply only to the current project. Adversarial review and Open PR are on by default. Projects without a local Git folder can still set the review and pull request options. Turning off Adversarial review does not change the optional managed reviews described in [Attempts](docs/0002-attempts.md).

The skill reads these options with `pst pstdio-planner implementation-policy` and follows them without asking. Instructions you give for a specific task take precedence.

Ticket tags have their own panel in **Settings → Project**.

From a terminal, list the branch choices with `pst pstdio-planner implementation-targets`. Set one with `pst pstdio-planner set-implementation-target --branch origin/main`. Leave out `--branch` to clear it.
