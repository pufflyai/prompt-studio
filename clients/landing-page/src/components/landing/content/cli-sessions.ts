import type { DocPage } from "../doc-view";

export const cliSessionsPage: DocPage = {
  title: "Sessions",
  intro:
    "A session is a durable conversation and execution record between a user and one agent, optionally linked to a workspace and ticket.",
  blocks: [
    { type: "heading", text: "Create from a prompt" },
    {
      type: "code",
      code: `pst sessions create \\
  --title "Implement the API" \\
  --prompt "Implement the API changes from PS-42." \\
  --workspace-id PS-42_A1 \\
  --agent pstdio.harness-codex.codex`,
    },
    {
      type: "paragraph",
      text: "The current linked project is used by default. Pass `--project-id` outside its repository, `--model` for a harness-specific model override, and repeat `--attach` to include local files in the initial request.",
    },
    { type: "heading", text: "Create from a prompt template" },
    {
      type: "code",
      code: `pst sessions create \\
  --template implement-ticket \\
  --var TICKET_ID=PS-42 \\
  --workspace-id PS-42_A1`,
    },
    {
      type: "paragraph",
      text: "`--prompt` and `--template` are mutually exclusive. Repeat `--var KEY=value` to fill the selected template. When no title is provided, the CLI derives one from the prompt or template name.",
    },
    { type: "heading", text: "Find and inspect sessions" },
    {
      type: "code",
      code: `pst sessions list
pst sessions list --status awaiting_input
pst sessions list --agent pstdio.harness-codex.codex --workspace-id PS-42_A1
pst sessions view --id SESSION_ID
pst sessions stream --id SESSION_ID`,
    },
    {
      type: "paragraph",
      text: "`list` is project-scoped and can include archived sessions with `--archived`. `view` prints durable metadata; `stream` tails live message patches, approval requests, and the terminal status event.",
    },
    { type: "heading", text: "Continue or hand off a conversation" },
    {
      type: "code",
      code: `pst sessions follow-up \\
  --id SESSION_ID \\
  --prompt "Address the review feedback." \\
  --attach review-notes.md

pst sessions follow-up \\
  --id SESSION_ID \\
  --summary-of SOURCE_SESSION_ID \\
  --summary-format detailed \\
  --summary-role all \\
  --agent pstdio.harness-claude-code.claude-code`,
    },
    {
      type: "paragraph",
      text: "Follow-ups can use a prompt, a template, or a summary of another session. They may switch harness or model. If work is already running, the follow-up is queued and its position is reported.",
    },
    { type: "heading", text: "Resolve permissions and lifecycle" },
    {
      type: "code",
      code: `pst sessions approve --id SESSION_ID --approval-id APPROVAL_ID
pst sessions deny --id SESSION_ID --approval-id APPROVAL_ID
pst sessions stop --id SESSION_ID
pst sessions archive --id SESSION_ID`,
    },
    {
      type: "paragraph",
      text: "Approve or deny a pending tool request using the IDs shown by `stream` or the workbench. Stop gracefully asks the harness to end the active run. Archive hides a finished session from the default list without deleting its record.",
    },
    { type: "heading", text: "Session statuses" },
    {
      type: "list",
      items: [
        "`queued` — waiting for an earlier request on the session to finish.",
        "`in_progress` — the harness is actively processing a request.",
        "`awaiting_input` — the session needs a user answer or tool approval.",
        "`completed` — the latest request finished successfully.",
        "`failed`, `cancelled`, or `disconnected` — the run ended without normal completion.",
      ],
    },
    { type: "heading", text: "Resolve an external session ID" },
    {
      type: "code",
      code: `pst sessions resolve-session-id \\
  --agent pstdio.harness-codex.codex \\
  --agent-session-id EXTERNAL_SESSION_ID \\
  --cwd /path/to/workspace`,
    },
    {
      type: "paragraph",
      text: "Use this bridge when an agent reports its own session ID and you need the Prompt Studio session record. Add `--json` for machine-readable output.",
    },
  ],
};
