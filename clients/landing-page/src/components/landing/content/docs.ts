import type { DocPage } from "../doc-view";

export const conceptsPage: DocPage = {
  title: "Core concepts",
  intro: "The project, workflow, and agent resources that Prompt Studio keeps connected.",
  blocks: [
    { type: "heading", text: "Projects" },
    {
      type: "paragraph",
      text: "A project connects one or more repositories to the workbench. Each project keeps its own resources, sessions, and settings, and shows up as a tab so you can switch between them instantly. [Explore project commands →](/docs/cli/projects)",
    },
    { type: "heading", text: "Workspaces" },
    {
      type: "paragraph",
      text: "A workspace is an isolated working area where an agent (or you) makes changes without touching your branch. The default workspace provider backs each workspace with a git worktree, but workspaces don't have to be worktrees — extensions can contribute other workspace types. [Explore workspace commands →](/docs/cli/workspaces)",
    },
    { type: "heading", text: "The workbench" },
    {
      type: "paragraph",
      text: "The workbench is the surface where your work happens: a resource sidebar, editors and renderers in the main area, and an agent panel beside them. It isn't a fixed layout — everything in it is contributed by extensions, so it grows around what your team actually does. [Explore views and renderers →](/docs/sdk/views-and-renderers)",
    },
    { type: "heading", text: "Extensions" },
    {
      type: "paragraph",
      text: "Extensions add capabilities: commands, editors, views, templates, skills, and automation. They're plain packages built with `@pstdio/sdk`. The tools you wish existed are one prompt away — your agent can write an extension and the workbench picks it up. [Explore extensions and serve →](/docs/cli/extensions-and-serve)",
    },
    { type: "heading", text: "Agents" },
    {
      type: "paragraph",
      text: "Prompt Studio doesn't ship its own model. Harness extensions connect the coding agents you already use — Codex, Claude Code, OpenCode, or another provider — while Prompt Studio supplies the project context and workflow. [Configure agents →](/docs/cli/agents)",
    },
    { type: "heading", text: "Sessions" },
    {
      type: "paragraph",
      text: "A session is the durable conversation and execution record for one agent. It can stand alone or link to a workspace and ticket, and it keeps prompts, live output, approvals, follow-ups, attachments, and lifecycle state together. [Work with sessions →](/docs/cli/sessions)",
    },
    { type: "heading", text: "Skills" },
    {
      type: "paragraph",
      text: "Skills are Markdown instruction packages that teach an agent a project workflow — creating a ticket, implementing it, writing a proposal, or building an extension. Prompt Studio installs enabled skills into each agent's supported directory without overwriting local edits. [Install agent skills →](/docs/cli/agents)",
    },
    { type: "heading", text: "Commands" },
    {
      type: "paragraph",
      text: "Commands are the shared verb layer: the command palette, buttons, automation, and agents all call the same commands. Register a command once and every surface — human or agent — can use it. [Explore extension commands →](/docs/sdk/commands)",
    },
  ],
};
