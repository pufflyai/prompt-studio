import type { DocPage } from "../../doc-view";

export const firstProjectGuide: DocPage = {
  title: "Set up your first project",
  intro: "Install the CLI, connect the coding agent you already use, and open your repository in the workbench.",
  blocks: [
    { type: "heading", text: "Install and start the workbench" },
    { type: "code", code: "bun add --global pstdio@latest\npst", language: "bash" },
    {
      type: "paragraph",
      text: "`pst` starts the local API and dashboard, then prints both URLs. Everything runs on your machine and your data stays in your repository.",
    },
    { type: "heading", text: "Connect an agent" },
    { type: "code", code: "pst agents list\npst agents setup claude-code", language: "bash" },
    {
      type: "paragraph",
      text: "Prompt Studio does not ship a model. A harness extension connects an agent you already have — Claude Code, Codex, or OpenCode — and `agents setup` installs the project skills that agent can follow.",
    },
    { type: "heading", text: "Create the project" },
    { type: "code", code: "pst projects create acme-app --repo .", language: "bash" },
    {
      type: "paragraph",
      text: "A project groups repositories with their tickets, documentation, sessions, and extensions. Repeat `--repo` for every repository the work touches.",
    },
    { type: "heading", text: "Link this checkout to the project" },
    { type: "code", code: "pst projects list\npst projects link --project-id <project-id>", language: "bash" },
    {
      type: "paragraph",
      text: "Linking records the project in `.pstdio/config.json`, so every `pst` command run from this checkout targets the same project.",
    },
    { type: "heading", text: "Check the result" },
    { type: "code", code: "pst projects view", language: "bash" },
    {
      type: "paragraph",
      text: "Open the dashboard URL that `pst` printed. The sidebar lists the project resources and the agent panel is ready for your first session.",
    },
  ],
};

export const firstSessionGuide: DocPage = {
  title: "Run your first agent session",
  intro: "Give an agent a task, let it work in an isolated workspace, then review the result and merge it.",
  blocks: [
    { type: "heading", text: "Work in an isolated workspace" },
    { type: "code", code: "pst workspaces create --base main\npst workspaces list", language: "bash" },
    {
      type: "paragraph",
      text: "A workspace is a separate working area, backed by a git worktree by default. The agent edits files there, so your branch stays untouched and several sessions can run at the same time.",
    },
    { type: "heading", text: "Start the session" },
    {
      type: "code",
      code: `pst sessions create \\
  --prompt "Add a health check endpoint" \\
  --agent claude-code \\
  --workspace-id <workspace-id>`,
      language: "bash",
    },
    {
      type: "paragraph",
      text: "The command prints a session id. A session keeps the prompt, live output, approvals, attachments, and the execution record together, so the work stays readable after it finishes.",
    },
    { type: "heading", text: "Follow the work" },
    { type: "code", code: "pst sessions stream --id <session-id>", language: "bash" },
    {
      type: "paragraph",
      text: "`stream` prints output as it arrives; `sessions view` prints the record so far. When the agent asks permission for a step, answer it:",
    },
    {
      type: "code",
      code: "pst sessions approve --id <session-id> --approval-id <approval-id>",
      language: "bash",
    },
    { type: "heading", text: "Ask for a change" },
    {
      type: "code",
      code: `pst sessions follow-up --id <session-id> \\
  --prompt "Add a test for the new endpoint"`,
      language: "bash",
    },
    {
      type: "paragraph",
      text: "A follow-up continues the same session, so the agent keeps everything it already learned instead of starting over.",
    },
    { type: "heading", text: "Review and merge" },
    { type: "code", code: "pst workspaces merge --id <workspace-id> --delete-workspace", language: "bash" },
    {
      type: "paragraph",
      text: "Read the diff in the workbench first. Merging brings the workspace changes back into your branch and removes the worktree.",
    },
  ],
};
