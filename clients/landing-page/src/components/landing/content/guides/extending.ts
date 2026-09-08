import type { DocPage } from "../../doc-view";

export const addPageGuide: DocPage = {
  title: "Add a page to the workbench",
  intro: "The workbench has no fixed layout. An extension can add a project page and render your own view inside it.",
  blocks: [
    { type: "heading", text: "Describe the page you want" },
    { type: "quote", text: "Add a workbench page that lists our failing checks and lets me re-run one." },
    {
      type: "paragraph",
      text: "Your agent writes the extension. The steps below are what it produces, so you know what to review.",
    },
    { type: "heading", text: "Expose the data as a command" },
    {
      type: "code",
      code: `// src/commands/checks.ts
import { defineCommand } from "@pstdio/sdk/extensions";

export const checkCommands = {
  "checks.list": defineCommand({
    title: "List failing checks",
    async run(ctx) {
      return { checks: await readChecks(ctx) };
    },
  }),
};`,
      language: "typescript",
    },
    {
      type: "paragraph",
      text: "Commands are the shared verb layer. The same command backs the page, the CLI, the command palette, and the agent, so there is one implementation to keep correct.",
    },
    { type: "heading", text: "Bind a view to a navigation item" },
    {
      type: "code",
      code: `// extension.ts
import {
  defineExtension,
  defineNavigationItem,
  defineView,
  packageAsset,
  workbenchSlots,
} from "@pstdio/sdk/extensions";
import { checkCommands } from "./src/commands/checks";

const checksView = defineView({
  id: "checks",
  path: "checks",
  title: "Checks",
  body: {
    kind: "webview",
    entry: packageAsset("./src/webviews/checks.tsx", import.meta.url),
    capabilities: ["commands.execute"],
  },
});

export default defineExtension({
  commands: checkCommands,
  views: [checksView],
  navigationItems: [
    defineNavigationItem({
      id: "checks",
      slot: workbenchSlots.projectNavigation,
      label: "Checks",
      icon: "circle-check",
      action: { kind: "view", view: checksView.ref },
    }),
  ],
});`,
      language: "typescript",
    },
    {
      type: "paragraph",
      text: "The view declares only the capabilities it needs. `path` also gives the page a deep link without adding a second navigation entry.",
    },
    { type: "heading", text: "Read the command from the page" },
    {
      type: "code",
      code: `// src/webviews/checks.tsx
import { createWebviewClient, defineExtensionView } from "@pstdio/sdk/extensions";
import { useCommandQuery } from "@pstdio/sdk/extensions/react";
import type { checkCommands } from "../commands/checks";

export default defineExtensionView({
  render({ mount, host }) {
    const client = createWebviewClient<typeof checkCommands>(host);

    const Checks = () => {
      const checks = useCommandQuery({
        queryKey: ["checks"],
        command: client.commands["checks.list"],
      });

      return <CheckList checks={checks.data?.checks ?? []} />;
    };

    mount(<Checks />);
  },
});`,
      language: "tsx",
    },
    { type: "heading", text: "Install it and open the page" },
    {
      type: "code",
      code: `pst extensions add ./.pstdio/extensions/checks --force
pst extensions check`,
      language: "bash",
    },
    {
      type: "paragraph",
      text: "`extensions check` validates the manifest and contributions. Reload the workbench and the page appears in the project navigation.",
    },
  ],
};

export const automateTaskGuide: DocPage = {
  title: "Automate a repeating task",
  intro: "Run a command on a schedule, or let it run whenever something happens in the project.",
  blocks: [
    { type: "heading", text: "Start from a command" },
    {
      type: "code",
      code: `// src/commands/digest.ts
import { defineCommand } from "@pstdio/sdk/extensions";

export const digestCommand = defineCommand({
  id: "digest.write",
  title: "Write the daily digest",
  cli: true,
  agent: true,
  async run(ctx) {
    const digest = await buildDigest(ctx);
    await ctx.storage.set("digest:latest", digest);
    return { digest };
  },
});`,
      language: "typescript",
    },
    {
      type: "paragraph",
      text: "Write the automation as an ordinary command first. You can run it by hand while you get it right, and the schedule reuses it unchanged.",
    },
    { type: "heading", text: "Run it on a schedule" },
    {
      type: "code",
      code: `import { defineExtension, defineSchedule } from "@pstdio/sdk/extensions";
import { digestCommand } from "./src/commands/digest";

export default defineExtension({
  commands: [digestCommand],
  schedules: [
    defineSchedule({
      id: "daily-digest",
      title: "Daily digest",
      schedule: "0 7 * * *",
      command: digestCommand.ref,
    }),
  ],
});`,
      language: "typescript",
    },
    {
      type: "paragraph",
      text: "A schedule invokes the same command the CLI and agents call, so scheduled work stays inspectable instead of hiding in a background job.",
    },
    { type: "heading", text: "React to an event instead" },
    {
      type: "code",
      code: `import { defineExtension, sessionEvents } from "@pstdio/sdk/extensions";

export default defineExtension({
  hooks: {
    digestOnCompletion: {
      event: sessionEvents.completed,
      async handler(ctx, event) {
        await ctx.notifications.create({
          title: "Session finished",
          body: \`Session \${event.session.id} is ready for review.\`,
        });
      },
    },
  },
});`,
      language: "typescript",
    },
    {
      type: "paragraph",
      text: "Hooks observe events; they do not veto the operation that emitted them. Use them for follow-up work such as review requests, cleanup, notifications, and activity records.",
    },
    { type: "heading", text: "Watch it run" },
    { type: "code", code: "pst inbox\npst logs", language: "bash" },
    {
      type: "paragraph",
      text: "`inbox` lists pending project notifications. `logs` prints the runtime log, which is where a failing schedule or hook reports itself.",
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
      language: "bash",
    },
    {
      type: "paragraph",
      text: "For dashboard contributions, run the repository's isolated stack and exercise the real route, menu, renderer, or command. Finish with the host repository's full validation command.",
    },
  ],
};
