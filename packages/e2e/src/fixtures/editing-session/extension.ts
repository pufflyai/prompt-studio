import {
  applyEditingChanges,
  defineCommand,
  defineExtension,
  definePage,
  defineView,
  l10n,
  packageAsset,
  params,
  type WebviewEditingChange,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { editingChanged } from "./events";

const initial = { title: "Original", position: { x: 0, y: 0 } };
export const editingCommands = {
  "editing.read": defineCommand({
    id: "editing.read",
    title: l10n("commands.editingRead", "Read editing document"),
    async run(ctx) {
      return (await ctx.storage.collection<typeof initial>("editing").get("document")) ?? initial;
    },
  }),
  "editing.save": defineCommand({
    id: "editing.save",
    title: l10n("commands.editingSave", "Save editing document"),
    params: { changes: params.json<WebviewEditingChange[], { required: true }>({ required: true }) },
    async run(ctx, input) {
      const collection = ctx.storage.collection<typeof initial>("editing");
      const state = (await collection.get("document")) ?? initial;
      await collection.put("document", applyEditingChanges(state, input.changes));
      await ctx.events.emit(editingChanged, {});
    },
  }),
};
export const editingViews = ["canvas", "inspector"].map((name) =>
  defineView({
    id: `editing-${name}`,
    title: l10n(`views.editing.${name}`, `Editing ${name}`),
    body: {
      kind: "webview",
      entry: packageAsset("./view.ts", import.meta.url),
      capabilities: ["commands.execute", "editing.session"],
    },
  }),
);
export const editingPage = definePage({
  id: "editing",
  title: l10n("pages.editing", "Editing sessions"),
  path: "editing",
  mode: workbenchModes.project,
  main: { kind: "view", view: editingViews[0].ref, cardinality: "one" },
  slots: [{ id: "inspector", region: "side", item: { kind: "view", view: editingViews[1].ref, presence: "fixed" } }],
});

export default defineExtension({ commands: Object.values(editingCommands), views: editingViews, pages: [editingPage] });
