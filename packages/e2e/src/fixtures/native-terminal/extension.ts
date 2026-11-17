import {
  defineCommand,
  defineExtension,
  defineNavigationItem,
  definePage,
  defineView,
  type TerminalViewBody,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const body: TerminalViewBody = {
  kind: "terminal",
  async session(ctx) {
    const count = (await ctx.storage.get<number>("opens")) ?? 0;
    await ctx.storage.set("opens", count + 1);
    return { workspaceId: ctx.workspaceId, env: { PSTDIO_NATIVE_VIEW: "public-fixture" } };
  },
};
const terminal = defineView({ id: "shell", title: "Public shell", body });
const landing = defineView({
  id: "landing",
  title: "Native console",
  body: { kind: "controls", query: () => ({ params: [] }) },
});
const page = definePage({
  id: "console",
  title: "Native console",
  path: "console",
  mode: workbenchModes.project,
  main: { kind: "view", view: landing.ref, cardinality: "one" },
  slots: [
    {
      id: "shell",
      region: "secondary",
      item: { kind: "view", view: terminal.ref, presence: "closed" },
      mountStrategy: "keep-mounted",
    },
  ],
});
const open = defineCommand({
  id: "open",
  title: "Open public shell",
  run(ctx) {
    ctx.navigation.open({ kind: "panel", panel: page.panels.shell! });
    return { opened: true };
  },
});
const status = defineCommand({
  id: "status",
  title: "Read console status",
  run: async (ctx) => ({ opens: (await ctx.storage.get<number>("opens")) ?? 0 }),
});
export default defineExtension({
  views: [terminal, landing],
  pages: [page],
  commands: [open, status],
  navigationItems: [
    defineNavigationItem({
      id: "open",
      label: "Open public shell",
      owner: workbenchModes.project,
      action: { kind: "command", target: { command: open.ref } },
    }),
  ],
});
