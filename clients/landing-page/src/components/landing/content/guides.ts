import type { DocPage } from "../doc-view";

export const gettingStartedGuide: DocPage = {
  title: "Set up Prompt Studio",
  intro: "Connect a repository, install its workflow skills for your coding agent, and open the workbench.",
  blocks: [
    { type: "heading", text: "Install the CLI" },
    { type: "code", code: "bun add -g pstdio@latest" },
    { type: "heading", text: "Create or link a project" },
    {
      type: "code",
      code: `cd my-repo
pst projects create my-repo

# Or connect this repository to a project that already exists
pst projects link --project-id PROJECT_ID`,
    },
    {
      type: "paragraph",
      text: "Creating a project links the current git repository by default and writes its project ID to `.pstdio/config.json`. Use repeated `--repo` flags when one project spans several repositories.",
    },
    { type: "heading", text: "Set up an agent" },
    {
      type: "code",
      code: `pst agents list
pst agents setup pstdio.harness-codex.codex`,
    },
    {
      type: "paragraph",
      text: "Choose an installed harness ID from `agents list`. Setup installs the project's enabled skills into that agent's project directory. Existing skill directories are left untouched, so your edits are preserved.",
    },
    {
      type: "paragraph",
      text: "Use `--global-skills` only when those skills should be available to the agent outside this project.",
    },
    { type: "heading", text: "Verify and launch" },
    {
      type: "code",
      code: `pst projects list
pst agents list
pst`,
    },
    {
      type: "paragraph",
      text: "Running `pst` starts the API and dashboard, opens the workbench, and uses the project linked to your current repository.",
    },
  ],
};

export const createTicketGuide: DocPage = {
  title: "Create a ticket",
  intro: "Turn a request into a concrete, testable plan using the project's real statuses, tags, and templates.",
  blocks: [
    { type: "heading", text: "Survey the project catalogs" },
    {
      type: "code",
      code: `pst statuses list
pst tags list
pst templates list
pst tickets list`,
    },
    {
      type: "paragraph",
      text: "Statuses, tag options, and templates are project-configurable. Inspect them before writing, and scan existing tickets so you do not create a duplicate.",
    },
    { type: "heading", text: "Write a local draft" },
    {
      type: "code",
      code: `pst tickets write \\
  --title "Add upload retry" \\
  --status Backlog \\
  --tags Medium \\
  --tags Feature`,
    },
    {
      type: "paragraph",
      text: "The command prints a shorthand such as `PS-42` and creates `.pstdio/tickets/PS-42/ticket.md`. If a project template fits, apply it before editing:",
    },
    { type: "code", code: "pst templates write --name ticket --ticket PS-42" },
    { type: "heading", text: "Make the work implementable" },
    {
      type: "list",
      items: [
        "Record the code and documentation references you relied on.",
        "Define in-scope and out-of-scope behavior, implementation touch points, and assumptions.",
        "Name the focused tests and repository validation commands that prove completion.",
        "Set `parallelizable` and `depends_on` in frontmatter; keep priority and type in tags.",
        "Mark unresolved facts inline as `[MISSING INFORMATION]` instead of guessing.",
      ],
    },
    { type: "heading", text: "Save the canonical ticket" },
    { type: "code", code: "pst tickets save --id PS-42" },
    {
      type: "paragraph",
      text: "Saving persists the edited body, attachments, tags, parent, and dependencies, then clears the draft flag.",
    },
  ],
};

export const implementTicketGuide: DocPage = {
  title: "Implement a ticket",
  intro: "Launch the planned work in an isolated workspace, prove the result, and hand it off for review.",
  blocks: [
    { type: "heading", text: "Read before running" },
    {
      type: "code",
      code: `pst tickets view --id PS-42
pst agents list`,
    },
    {
      type: "paragraph",
      text: "Confirm the full ticket scope and choose an installed harness. If the ticket is missing or ambiguous, resolve that before launching an agent.",
    },
    { type: "heading", text: "Delegate into a workspace" },
    {
      type: "code",
      code: `pst tickets implement --id PS-42 --agent pstdio.harness-codex.codex
pst tickets workspaces --id PS-42`,
    },
    {
      type: "paragraph",
      text: "Implementation creates an agent session in a ticket workspace and moves the workflow from live session state. During implementation, do not force the ticket status with `tickets update`.",
    },
    { type: "heading", text: "Capture validation evidence" },
    {
      type: "code",
      code: `pst reports write --kind validation --name implementation
# Add test logs, screenshots, or traces under:
# .pstdio/reports/implementation/files/
pst reports save --name implementation`,
    },
    {
      type: "paragraph",
      text: "The report should summarize what changed, list reproducible commands and results, link concrete artifacts, and include a confidence score.",
    },
    { type: "heading", text: "Merge or link the review" },
    {
      type: "code",
      code: `pst workspaces merge --id PS-42_A1 --delete-workspace

# If the result is reviewed in a pull request
pst tickets link-review --id PS-42 --url https://github.com/org/repo/pull/456`,
    },
    {
      type: "paragraph",
      text: "Use the workspace shorthand printed by `tickets workspaces`, not the ticket shorthand, when merging.",
    },
  ],
};

export const createProposalGuide: DocPage = {
  title: "Write a proposal",
  intro: "Use a proposal ticket for features, architectural changes, breaking contracts, or security decisions.",
  blocks: [
    { type: "heading", text: "Start from the proposal template" },
    {
      type: "code",
      code: `pst templates list
pst tickets write --title "Add remote workspaces" --tags Feature
pst templates write --name proposal --ticket PS-42`,
    },
    { type: "heading", text: "Research the decision" },
    {
      type: "paragraph",
      text: "Fill every template section with concrete goals, non-goals, acceptance scenarios, implementation touch points, assumptions, and risks. Keep unknowns visible as `[MISSING INFORMATION]`.",
    },
    {
      type: "list",
      items: [
        "Add `research.md` when the decision depends on external systems, prior art, logs, or non-obvious repository findings.",
        "Add `contracts.md` or `schemas.md` when public interfaces or persisted data change.",
        "Add an architecture overview or ADR when ownership boundaries or lasting tradeoffs change.",
        "Add a usage guide when users will need a repeatable workflow for the new capability.",
      ],
    },
    { type: "heading", text: "Save for review" },
    { type: "code", code: "pst tickets save --id PS-42" },
    {
      type: "paragraph",
      text: "A proposal stops at a reviewable decision record. Do not start implementation until the proposal is accepted and implementation work is planned.",
    },
  ],
};

export const createSubTicketsGuide: DocPage = {
  title: "Create sub-tickets",
  intro: "Break a broad parent ticket into small, independently testable units with explicit dependencies.",
  blocks: [
    { type: "heading", text: "Read the parent as a whole" },
    { type: "code", code: "pst tickets view --id PS-42" },
    {
      type: "paragraph",
      text: "Split work by system boundary. Each child should fit one implementation sitting and ship its own validation instead of depending on a final testing ticket.",
    },
    { type: "heading", text: "Create and save each child" },
    {
      type: "code",
      code: `pst tickets write \\
  --title "Add retry configuration schema" \\
  --parent PS-42 \\
  --tags Feature

# Edit the generated child ticket, then save it
pst tickets save --id PS-43`,
    },
    {
      type: "paragraph",
      text: "Give every child concrete files, acceptance checks, `parallelizable`, and `depends_on` frontmatter. Record true sequencing dependencies rather than relying on ticket order.",
    },
    { type: "heading", text: "Inspect the breakdown" },
    { type: "code", code: "pst tickets list --parent PS-42" },
  ],
};

export const refineTicketGuide: DocPage = {
  title: "Refine a ticket",
  intro: "Research an existing ticket, fill its gaps, and leave it ready for a separate implementation session.",
  blocks: [
    { type: "heading", text: "Pull the current ticket" },
    { type: "code", code: "pst tickets pull --id PS-42" },
    {
      type: "paragraph",
      text: "The ticket is written to `.pstdio/tickets/PS-42/ticket.md`. Pull without `--force` so existing local edits cannot be overwritten accidentally.",
    },
    { type: "heading", text: "Apply a requested template" },
    {
      type: "code",
      code: `pst templates list
pst templates write --name proposal --ticket PS-42`,
    },
    {
      type: "paragraph",
      text: "Merge the useful existing content into the template. Remove placeholders that do not apply, and add researched references, scope, ordered implementation steps, acceptance checks, and dependencies.",
    },
    { type: "heading", text: "Save and hand off" },
    {
      type: "code",
      code: `pst tickets save --id PS-42

# For a refined proposal
pst tickets proposal-refined --id PS-42`,
    },
    {
      type: "paragraph",
      text: "Refinement changes the plan, not the product. Stop after saving unless the ticket is explicitly assigned for implementation.",
    },
  ],
};

export const createExtensionGuide: DocPage = {
  title: "Build an extension",
  intro:
    "Choose the right scope, expose one useful contribution, and validate the installed extension as users run it.",
  blocks: [
    { type: "heading", text: "Choose where the behavior belongs" },
    {
      type: "list",
      items: [
        "Use `.pstdio/extensions/<name>/` for repository-owned commands, hooks, checks, and worktree setup.",
        "Use `~/.pstdio/extensions/<name>/` for personal behavior shared across projects.",
        "Use `extensions/<name>/` only for first-party extensions in the Prompt Studio monorepo.",
      ],
    },
    {
      type: "paragraph",
      text: "Repo-local and user extensions use the same manifest and SDK. A repo-local extension overrides a user extension with the same package ID for that project.",
    },
    { type: "heading", text: "Create the package contract" },
    {
      type: "code",
      code: `{
  "name": "release-tools",
  "version": "0.1.0",
  "publisher": "acme",
  "main": "./extension.ts",
  "engines": { "pstdio": "^1.0.0" },
  "type": "module",
  "dependencies": { "@pstdio/sdk": "latest" }
}`,
    },
    {
      type: "paragraph",
      text: "Export one default `defineExtension({ ... })` value from `extension.ts`. Identity comes from `package.json`; do not repeat names, IDs, or versions inside `defineExtension`.",
    },
    { type: "heading", text: "Pick one contribution surface" },
    {
      type: "list",
      items: [
        "Use commands for operations triggered from the CLI, palette, dashboard, schedules, or agents.",
        "Use middleware for invocation guardrails and hooks to react to lifecycle events.",
        "Use native renderers for host-owned lists, trees, and editors; use routes for custom webview pages.",
        "Use `packageAsset()` for every shipped template, skill, theme, or webview file.",
      ],
    },
    { type: "heading", text: "Test and smoke-test the install" },
    {
      type: "code",
      code: `bun test path/to/extension.test.ts
pst extensions add ./.pstdio/extensions/release-tools --force
pst extensions check
pst release-tools --help`,
    },
    {
      type: "paragraph",
      text: "For dashboard contributions, run the repository's isolated stack and exercise the real route, menu, renderer, or command. Finish with the host repository's full validation command.",
    },
  ],
};
