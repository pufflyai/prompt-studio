import type { DocPage } from "../doc-view";

export const cliOverviewPage: DocPage = {
  title: "CLI reference",
  intro:
    "Use pst to launch the workbench and drive the same projects, agents, sessions, and extension workflows it exposes.",
  blocks: [
    { type: "heading", text: "Install and launch" },
    {
      type: "code",
      code: `bun add -g pstdio@latest

# Start the API and dashboard, then open the browser
pst`,
    },
    {
      type: "paragraph",
      text: "Run `pst --help` to discover core command groups. Run `pst <group> --help` and `pst <group> <command> --help` for the commands and options supported by your installed version.",
    },
    { type: "heading", text: "Core command groups" },
    {
      type: "list",
      items: [
        "[Projects](/docs/cli/projects) connect repositories to a Prompt Studio project.",
        "[Workspaces](/docs/cli/workspaces) isolate each ticket attempt in its own git worktree.",
        "[Agents](/docs/cli/agents) discover harnesses and install workflow skills for them.",
        "[Sessions](/docs/cli/sessions) launch agents, continue conversations, stream output, and resolve approvals.",
        "[Extensions and serve](/docs/cli/extensions-and-serve) install capabilities, validate them, and control the local server.",
      ],
    },
    { type: "heading", text: "Extension command groups" },
    {
      type: "paragraph",
      text: "Enabled extensions contribute their own top-level commands. The built-in Planner and Reports extensions provide `pst tickets`, `pst templates`, `pst statuses`, `pst tags`, and `pst reports`. Their help is generated from the same command definitions used by the dashboard and agents.",
    },
    { type: "heading", text: "Workbench options" },
    {
      type: "code",
      code: `pst --api-port 19841 --dashboard-port 5556
pst --open-browser=false
pst close`,
    },
    {
      type: "paragraph",
      text: "The default API port is `19840` and the default dashboard port is `5555`. `pst close` stops the background API started by `pst`.",
    },
  ],
};

export const cliProjectsPage: DocPage = {
  title: "Projects",
  intro:
    "A project groups repositories, tickets, documents, templates, skills, workspaces, and agent sessions under one ID.",
  blocks: [
    { type: "heading", text: "Create a project" },
    {
      type: "code",
      code: `pst projects create
pst projects create my-app
pst projects create my-platform --repo ./api --repo ./web`,
    },
    {
      type: "paragraph",
      text: "The name defaults to the current folder. Inside a git repository, the current repository is linked automatically unless one or more `--repo` paths are provided.",
    },
    { type: "heading", text: "Link an existing project" },
    {
      type: "code",
      code: `pst projects list
pst projects link --project-id PROJECT_ID
pst projects unlink`,
    },
    {
      type: "paragraph",
      text: "Linking writes `.pstdio/config.json` at the git root. Unlinking removes the local association; it does not delete the project or its stored resources.",
    },
    { type: "heading", text: "Inspect repositories and metadata" },
    {
      type: "code",
      code: `pst projects view
pst projects view --project-id PROJECT_ID
pst projects repos --project-id PROJECT_ID`,
    },
    { type: "heading", text: "Delete a project" },
    { type: "code", code: "pst projects delete PROJECT_ID" },
    {
      type: "paragraph",
      text: "Deletion targets the project ID directly. Inspect the project and its repositories first; this is different from unlinking the current checkout.",
    },
  ],
};

export const cliWorkspacesPage: DocPage = {
  title: "Workspaces",
  intro:
    "A workspace is an isolated working area. Create one directly for ad hoc work, or let a ticket implementation create a linked attempt.",
  blocks: [
    { type: "heading", text: "Create a standalone workspace" },
    {
      type: "code",
      code: `pst workspaces create
pst workspaces create --base main
pst workspaces list`,
    },
    {
      type: "paragraph",
      text: "`--base` accepts a branch or git ref and defaults to `HEAD`. Standalone workspaces receive a shorthand such as `WS-1`; use `pst tickets implement --id PS-42` when the workspace should belong to a ticket attempt.",
    },
    { type: "heading", text: "Use the workspace with a session" },
    {
      type: "code",
      code: `pst sessions create \\
  --workspace-id PS-42_A1 \\
  --agent pstdio.harness-codex.codex \\
  --prompt "Implement PS-42."`,
    },
    {
      type: "paragraph",
      text: "Sessions linked to different workspaces can run concurrently without sharing a checkout. `pst tickets implement --id PS-42` creates and links this workflow for you.",
    },
    { type: "heading", text: "Merge and clean up" },
    {
      type: "code",
      code: `pst workspaces merge --id PS-42_A1
pst workspaces merge --id PS-42_A1 --delete-workspace
pst workspaces delete --id PS-42_A1`,
    },
    {
      type: "paragraph",
      text: "Merge squash-merges the workspace changes into the current branch. Delete force-removes a workspace, so use it only after its changes and evidence are no longer needed.",
    },
    { type: "heading", text: "Ticket status ownership" },
    {
      type: "paragraph",
      text: "During planning, `tickets update --status` is valid. Once implementation starts, ticket transitions are derived from live session and workspace activity; avoid forcing status changes by hand.",
    },
  ],
};

export const cliExtensionsPage: DocPage = {
  title: "Extensions & serve",
  intro:
    "Install editable extension sources, validate every discovered source, and control the local Prompt Studio server.",
  blocks: [
    { type: "heading", text: "Install an extension source" },
    {
      type: "code",
      code: `pst extensions add ./my-extension
pst extensions add https://github.com/acme/my-extension --name my-extension
pst extensions add ./my-extension --force`,
    },
    {
      type: "paragraph",
      text: "The source is required. `--name` chooses the install folder and `--force` replaces an existing install. A normal install creates package-local dependencies so the extension does not depend on a repository checkout.",
    },
    { type: "heading", text: "Validate installed sources" },
    {
      type: "code",
      code: `pst extensions check
pst extensions check --json`,
    },
    {
      type: "paragraph",
      text: "Check validates user and repository-local extension roots. JSON output is useful for scripts; the default output is easier to read interactively.",
    },
    { type: "heading", text: "Run the server" },
    {
      type: "code",
      code: `pst
pst serve
pst serve --host localhost --port 19841
pst close`,
    },
    {
      type: "paragraph",
      text: "`pst` runs the API in the background and opens the dashboard. `serve` keeps the API and dashboard in one foreground process. `close` stops the background API.",
    },
    {
      type: "quote",
      text: "The development server has no authentication. Binding `0.0.0.0` exposes it to the network, so do that only on a trusted LAN.",
    },
    { type: "heading", text: "Troubleshoot startup" },
    {
      type: "list",
      items: [
        "Run `pst extensions check` when contributed commands or views are missing.",
        "Confirm `.pstdio/config.json` exists when the CLI cannot find the current project.",
        "Inspect `~/.pstdio/logs.jsonl` when the API fails to start or an extension fails to load.",
      ],
    },
  ],
};

export const cliPlannerPage: DocPage = {
  title: "Planner & reports",
  intro:
    "The built-in Planner and Reports extensions contribute the ticket lifecycle, project catalogs, and review artifacts.",
  blocks: [
    { type: "heading", text: "Create, filter, and inspect tickets" },
    {
      type: "code",
      code: `pst tickets write --title "Add dark mode" --status Backlog --tags Feature
pst tickets create --content '# Add dark mode\n\nImplement the approved behavior.'
pst tickets list --status Ready --tags Feature
pst tickets view --id PS-42`,
    },
    {
      type: "paragraph",
      text: "`write` creates an editable local draft; `create` persists complete Markdown in one call. `view` prints the current ticket record for the supplied shorthand.",
    },
    { type: "heading", text: "Edit ticket files locally" },
    {
      type: "code",
      code: `pst tickets pull --id PS-42
# Edit .pstdio/tickets/PS-42/ticket.md and its files/
pst tickets save --id PS-42`,
    },
    {
      type: "paragraph",
      text: "Use `--force` with pull only when overwriting local edits is intentional. Save reconciles frontmatter, Markdown, and attachments with the canonical ticket.",
    },
    { type: "heading", text: "Implement and inspect attempts" },
    {
      type: "code",
      code: `pst tickets implement --id PS-42 --agent pstdio.harness-codex.codex
pst tickets workspaces --id PS-42
pst tickets worktrees list --id PS-42
pst tickets files --id PS-42`,
    },
    { type: "heading", text: "Templates" },
    {
      type: "code",
      code: `pst templates list
pst templates write --name ticket --ticket PS-42
pst templates write --name adr --target docs/decision.md --var TITLE="Storage"
pst templates create --name runbook --type document --file ./runbook.md
pst templates update --name runbook --file ./runbook.md
pst templates delete --name runbook`,
    },
    { type: "heading", text: "Statuses and tags" },
    {
      type: "code",
      code: `pst statuses list
pst statuses create --label "Needs QA" --color violet
pst statuses set-default --status Backlog

pst tags list
pst tags create --name Security --type multi_select`,
    },
    { type: "heading", text: "Validation and handoff reports" },
    {
      type: "code",
      code: `pst reports write --kind validation --name implementation
pst reports save --name implementation
pst reports delete --name implementation`,
    },
    {
      type: "paragraph",
      text: "Reports live under `.pstdio/reports/<name>/`; place screenshots, logs, traces, and other inspectable evidence in the report's `files/` directory before saving.",
    },
    { type: "heading", text: "Archive or delete" },
    {
      type: "code",
      code: `pst tickets archive --id PS-42
pst tickets delete --id PS-42`,
    },
  ],
};

export const cliConfigurationPage: DocPage = {
  title: "Configuration",
  intro: "Prompt Studio keeps the repository link intentionally small and stores workflow resources under .pstdio.",
  blocks: [
    { type: "heading", text: "Project link" },
    {
      type: "paragraph",
      text: "`.pstdio/config.json` lives at the git root and connects the checkout to one Prompt Studio project:",
    },
    {
      type: "code",
      code: `{
  "project_id": "PROJECT_ID"
}`,
    },
    {
      type: "paragraph",
      text: "Create it with `pst projects create` or `pst projects link --project-id PROJECT_ID`. Agent definitions do not live in this file; harnesses come from extensions and are discovered with `pst agents list`.",
    },
    { type: "heading", text: "Project files" },
    {
      type: "code",
      code: `.pstdio/
├── config.json
├── tickets/<shorthand>/ticket.md
├── reports/<name>/report.md
├── templates/
├── skills/
└── prompts/`,
    },
    {
      type: "paragraph",
      text: "Ticket and report folders are local checkouts of canonical resources and may include `files/` attachments. Project templates, skills, and prompts override enabled extension assets when the workflow supports an override.",
    },
    { type: "heading", text: "Runtime locations" },
    {
      type: "list",
      items: [
        "User extensions are installed below `~/.pstdio/extensions/` by default.",
        "Runtime diagnostics are written to `~/.pstdio/logs.jsonl` unless the home or log location is configured differently.",
        "Keep secrets such as provider API keys in the agent's supported environment or credential store, not in `.pstdio/config.json`.",
      ],
    },
  ],
};
