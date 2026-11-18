import {
  defineCommand,
  defineExtension,
  definePage,
  defineView,
  packageAsset,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const read = defineCommand({
  id: "read",
  title: "Read counter",
  run: async (ctx) => ({ counter: (await ctx.storage.get<number>("counter")) ?? 0 }),
});
const bump = defineCommand({
  id: "bump",
  title: "Increment counter",
  run: async (ctx) => {
    const counter = ((await ctx.storage.get<number>("counter")) ?? 0) + 1;
    await ctx.storage.set("counter", counter);
    await ctx.events.emit({ kind: "event", id: "changed" }, {});
    return { counter };
  },
});
const view = defineView({
  id: "page",
  title: "Host page",
  body: { kind: "webview", entry: packageAsset("./view.ts", import.meta.url), capabilities: ["commands.execute"] },
});
const page = definePage({
  id: "host",
  path: "host",
  title: "Host page",
  mode: workbenchModes.project,
  main: { kind: "view", view: view.ref, cardinality: "one" },
  slots: [],
});
export default defineExtension({ commands: [read, bump], views: [view], pages: [page] });
