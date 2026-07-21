import type { DocPage } from "../doc-view";

export const sdkOverviewPage: DocPage = {
  title: "SDK reference",
  intro:
    "@pstdio/sdk is the public integration surface for authoring extensions, calling the HTTP API, and sharing types.",
  blocks: [
    { type: "heading", text: "Installation" },
    { type: "code", code: "bun add @pstdio/sdk" },
    {
      type: "paragraph",
      text: "The package is ESM-only and published through subpath exports. Import from the entry point you need, not from `@pstdio/sdk` directly.",
    },
    { type: "heading", text: "Entry points" },
    {
      type: "list",
      items: [
        "`@pstdio/sdk/extensions` — extension authoring types (`defineExtension`, contribution surfaces)",
        "`@pstdio/sdk/client` — runtime HTTP client for Prompt Studio",
        "`@pstdio/sdk/api` — request and response payload types",
        "`@pstdio/sdk/resources` — shared resource and entity types",
        "`@pstdio/sdk/prompts` — prompt rendering helpers",
        "`@pstdio/sdk/hooks` — hook context and client types",
      ],
    },
    { type: "heading", text: "Anatomy of an extension" },
    {
      type: "paragraph",
      text: "An extension is a plain package: identity lives in `package.json`, and `extension.ts` exports a single default `defineExtension({ ... })` value describing what it contributes — commands, views, renderers, hooks, schedules, templates, skills, and themes.",
    },
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
      text: "`name`, `version`, `publisher`, `main`, and `engines.pstdio` are required. Do not repeat identity fields in `defineExtension()`. The manifest above derives extension ID `acme.release-tools`, command IDs under `release-tools.*`, and artifact storage under `.pstdio/release-tools/`.",
    },
    { type: "heading", text: "Choose the smallest surface" },
    {
      type: "list",
      items: [
        "Commands expose user-triggered work; middleware guards invocations; hooks observe lifecycle events; schedules invoke commands on cron expressions.",
        "Native renderers keep workbench chrome and resource behavior host-owned; routes and webviews provide fully custom pages.",
        "Templates, skills, themes, and icon themes package reusable catalog assets.",
        "Harnesses and workspace types are advanced provider APIs for new execution or isolation backends.",
      ],
    },
  ],
};

export const sdkCommandsPage: DocPage = {
  title: "Extension commands",
  intro:
    "Commands are the shared verb layer: the CLI, palette, dashboard, schedules, and agents all call the same commands.",
  blocks: [
    { type: "heading", text: "Defining a command" },
    {
      type: "code",
      code: `export default defineExtension({
  commands: {
    "tickets.create": {
      title: "Create ticket",
      cli: true,
      palette: { label: "Create ticket" },
      params: {
        title: params.text({ label: "Title", required: true }),
      },
      async run(ctx) {
        return { title: ctx.params.title };
      },
    },
  },
});`,
    },
    {
      type: "list",
      items: [
        "`cli: true` exposes the command as a `pst` subcommand.",
        "`cli: { path, description, examples }` customizes the generated command contract.",
        "`palette` surfaces it in the command palette.",
        "`agent: true` hands the command to agents as a tool.",
        "`params` declares typed inputs; the dashboard renders a form for them automatically.",
      ],
    },
    { type: "heading", text: "Parameters and context" },
    {
      type: "paragraph",
      text: "Param builders cover text, long text, numbers, booleans, selects, repositories, harnesses, templates, resources, and JSON. A command receives the validated values on `ctx.params` plus project, resource, storage, file, ticket, session, workspace, process, network, logger, settings, event, and notification APIs.",
    },
    {
      type: "quote",
      text: "Return transport-safe JSON from commands. Store files through context APIs; never return a live File, stream, or process object.",
    },
    { type: "heading", text: "Middlewares" },
    {
      type: "paragraph",
      text: "Middlewares run before a command no matter which surface invoked it. Continue unchanged, patch or replace parameters, replace invocation context, or reject with a structured code and reason.",
    },
    { type: "heading", text: "Typed references" },
    {
      type: "paragraph",
      text: "Prefer typed refs from `commandRef`, `commandsOf`, and `eventRef` over string ids when wiring commands together across extensions.",
    },
  ],
};

export const sdkViewsPage: DocPage = {
  title: "Views & renderers",
  intro:
    "Extensions contribute the workbench UI itself — native renderers for files, trees, and data, plus custom webview pages.",
  blocks: [
    { type: "heading", text: "Views" },
    {
      type: "paragraph",
      text: "A view binds exactly one of `webview`, `treeRenderer`, or `fileRenderer`, and resource `modes` decide how views open or pin inside the workbench.",
    },
    {
      type: "paragraph",
      text: "A native resource screen normally combines a mode, one file renderer for document content, one tree renderer for navigation, and views that bind those renderers to the resource kind and workbench slots.",
    },
    { type: "heading", text: "Renderer types" },
    {
      type: "list",
      items: [
        "**Data renderers** — Planner-style native dashboard lists and boards; project-sidebar entries are created from `dataRenderers`.",
        "**File renderers** — native resource file content such as markdown, code, and image previews.",
        "**Tree renderers** — native workbench trees such as resource files, outline, or navigation panels.",
        "**Controls renderers** — ParamEditor-backed property or inspector panels driven by query and update commands.",
        "**Routes + tree items** — custom webview pages in the project sidebar for UI that isn't a native resource screen.",
      ],
    },
    { type: "heading", text: "Navigation rules" },
    {
      type: "list",
      items: [
        "Do not add a route tree item for a data renderer; the dashboard creates its project-sidebar entry.",
        "Route tree-item actions use the route's `path`, not its normalized contribution ID.",
        "Every webview declares only the capabilities it needs, such as command execution or resource opening.",
        "Every native view needs a target, slot, resource kind, or reference from a mode layout so the host can reach it.",
      ],
    },
    { type: "heading", text: "Other surfaces" },
    {
      type: "paragraph",
      text: "Extensions can also contribute settings panels, activity renderers, session anchor renderers, and command-backed control panels rendered through the ParamEditor.",
    },
  ],
};

export const sdkHooksPage: DocPage = {
  title: "Hooks & schedules",
  intro: "React to what happens in the workbench, or run commands on a schedule.",
  blocks: [
    { type: "heading", text: "Hooks" },
    {
      type: "paragraph",
      text: "Hooks react to emitted events without vetoing the original operation. Extensions can subscribe to project, ticket, workspace, worktree, git, session, attempt-status, and command lifecycle events.",
    },
    {
      type: "paragraph",
      text: 'Prefer kernel refs such as `sessionEvents.completed`, `workspaceEvents.created`, and `gitEvents.merged`. Use `commandEvent(commandRef, "completed")` for the lifecycle of a contributed command.',
    },
    {
      type: "paragraph",
      text: "Typical uses: trigger an automated review when an agent finishes an implementation, capture a screenshot after frontend changes, or open a pull request when a workspace merges.",
    },
    { type: "heading", text: "Provisioning versus background work" },
    {
      type: "paragraph",
      text: "`workspace.provision` is awaited and gates session launch, so use it only for files or setup the session must have. `workspace.ready` is fire-and-forget and suits longer background setup after the workspace becomes usable.",
    },
    { type: "heading", text: "Schedules" },
    {
      type: "paragraph",
      text: "Schedules run a command on a cron expression — the command is the same one the CLI, palette, and agents can call, so scheduled work stays inspectable.",
    },
  ],
};

export const sdkClientPage: DocPage = {
  title: "Client & types",
  intro: "Call the Prompt Studio HTTP API from scripts or services with full type coverage.",
  blocks: [
    { type: "heading", text: "HTTP client" },
    {
      type: "code",
      code: `import { createClient, PstdioApiError } from "@pstdio/sdk/client";
import type { CreateTicketInput } from "@pstdio/sdk/api";
import type { TicketDetail } from "@pstdio/sdk/resources";

const client = createClient({
  baseUrl: process.env.PSTDIO_API_URL,
});`,
    },
    {
      type: "list",
      items: [
        "`createClient()` — a typed client for the running Prompt Studio API.",
        "`PstdioApiError` — structured errors for failed requests.",
        "`@pstdio/sdk/api` and `@pstdio/sdk/resources` — the request payload and entity types the API speaks.",
      ],
    },
    { type: "heading", text: "Prompts" },
    {
      type: "paragraph",
      text: "`renderPrompt` from `@pstdio/sdk/prompts` renders prompt templates with typed variables — the same rendering the workbench uses for templates.",
    },
    { type: "heading", text: "Extension context types" },
    {
      type: "paragraph",
      text: "Extension authors usually work through typed context services rather than constructing HTTP requests. Command and hook contexts expose scoped clients for tickets, sessions, workspaces, worktrees, repositories, commands, events, activity, notifications, settings, storage, artifacts, files, processes, and network access.",
    },
  ],
};

export const sdkAssetsPage: DocPage = {
  title: "Assets & catalog",
  intro: "Ship templates, skills, and themes as packaged assets alongside your extension code.",
  blocks: [
    { type: "heading", text: "Packaged assets" },
    {
      type: "paragraph",
      text: "Use `packageAsset()` for every shipped file or directory asset, with paths relative to (and inside) the extension package:",
    },
    {
      type: "code",
      code: `templates: {
  ticket: {
    title: "Ticket",
    type: "ticket",
    source: packageAsset("./templates/ticket.md", import.meta.url),
  },
},`,
    },
    { type: "heading", text: "Catalog contributions" },
    {
      type: "list",
      items: [
        "**Templates** — reusable documents for tickets and files, with per-project overrides.",
        "**Skills** — a directory containing `SKILL.md` and optional support files, installed via `pst agents install-skills`.",
        "**Themes & file icon themes** — restyle the whole workbench (this is how Base themes works).",
      ],
    },
    { type: "heading", text: "Artifact mounts" },
    {
      type: "paragraph",
      text: "Artifact mounts give an extension a durable home for generated files under `.pstdio/<extension-package-name>/` in the project.",
    },
    {
      type: "paragraph",
      text: 'Commands access a declared mount through `ctx.artifacts.mount("<mount-id>")`. Mount paths stay inside the extension\'s artifact root, keeping generated reports and evidence separate from package assets.',
    },
    { type: "heading", text: "Validation" },
    {
      type: "code",
      code: `pst extensions add ./my-extension --force
pst extensions check
pst my-extension --help`,
    },
    {
      type: "paragraph",
      text: "Install without `--skip-install` for a production-like smoke test, then inspect generated help and exercise one happy-path command. Validate dashboard surfaces in an isolated Prompt Studio stack.",
    },
  ],
};
