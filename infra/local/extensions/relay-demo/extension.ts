import {
  defineCommand,
  defineExtension,
  defineNavigationItem,
  definePage,
  defineView,
  eventRef,
  params,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const changed = eventRef({ extensionId: "pstdio-tests.relay-demo", id: "storage-changed" });
const read = defineCommand({
  id: "read",
  title: "Read shared message",
  run: async (ctx) => ({ message: (await ctx.storage.get<string>("message")) ?? "" }),
});
const save = defineCommand({
  id: "save",
  title: "Save shared message",
  mutating: true,
  params: { message: params.text({ required: true }) },
  async run(ctx, { message }) {
    await ctx.storage.set("message", message);
    await ctx.events.emit(changed, {});
    return { message };
  },
});
const editor = defineView({
  id: "message",
  title: "Shared message",
  body: {
    kind: "controls",
    refreshEvents: [changed],
    async query(ctx) {
      return {
        params: [{ id: "message", type: "text", name: "Shared message", defaultValue: "" }],
        values: { message: (await ctx.storage.get<string>("message")) ?? "" },
      };
    },
    async onValueChange(ctx, { value }) {
      await ctx.storage.set("message", String(value));
      await ctx.events.emit(changed, {});
    },
  },
});
const page = definePage({
  id: "relay",
  title: "Relay test",
  path: "relay",
  mode: workbenchModes.project,
  main: { kind: "view", view: editor.ref, cardinality: "one" },
  slots: [],
});
const navigation = defineNavigationItem({
  id: "relay",
  owner: workbenchModes.project,
  slot: "content",
  label: "Relay test",
  icon: "network",
  group: "",
  action: { kind: "page", page: page.ref },
});
export default defineExtension({
  commands: [read, save],
  views: [editor],
  pages: [page],
  navigationItems: [navigation],
});
