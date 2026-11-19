// Temporary PS-236 acceptance fixture. Public SDK authoring only; never shipped.
import {
  collectionViewQuery,
  defineCommand,
  defineExtension,
  definePage,
  defineResourceKind,
  defineView,
  l10n,
  params,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const foobar = defineResourceKind({ id: "foobar", label: l10n("foobar", "Foobar"), icon: "box" });
const attributes = [
  {
    id: "state",
    label: "State",
    type: {
      kind: "enum" as const,
      options: [
        { value: "late", label: "Late" },
        { value: "other", label: "Other" },
      ],
    },
    filterable: true,
  },
];
const query = collectionViewQuery({
  resourceKind: "foobar",
  index: {
    name: "foobars",
    collection: "foobars",
    fields: {
      id: { type: "string", path: ["id"], derive: { kind: "collectionKey" } },
      title: { type: "string", path: ["title"] },
      state: { type: "string", path: ["state"] },
      body: { type: "string", path: ["body"] },
    },
  },
  attributes,
});
const view = defineView({ id: "foobars", title: "Foobars", body: { kind: "kanban", query, attributes } });
const page = definePage({
  id: "foobars",
  title: "Foobars",
  path: "foobars",
  mode: workbenchModes.project,
  main: { kind: "view", view: view.ref, cardinality: "one", presentation: "page" },
  slots: [],
});
const seed = defineCommand({
  id: "seed",
  title: "Seed the disposable comparison",
  params: { start: params.number({ required: true }), count: params.number({ required: true }) },
  async run(ctx, { start, count }) {
    const items = ctx.storage.collection("foobars");
    for (let n = start; n < start + count; n++) {
      const id = `foobar-${String(n).padStart(5, "0")}`;
      await items.put(id, {
        title: `Foobar ${String(n).padStart(5, "0")}`,
        state: n >= 4990 ? "late" : "other",
        body: "Foobar body. ".repeat(1400),
      });
    }
    return { saved: count };
  },
});
export default defineExtension({ resourceKinds: [foobar], views: [view], pages: [page], commands: [seed] });
