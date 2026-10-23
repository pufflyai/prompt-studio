import {
  defineCommand,
  defineExtension,
  defineNavigationItem,
  definePage,
  defineResourceKind,
  defineView,
  params,
  type ResourceRef,
  resourceMenuSlotRef,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const related = defineCommand({
  id: "related",
  title: "Related documents",
  run: () => [
    { resource: { type: "document", id: "deleted", label: "Deleted target" }, autoOpen: true, region: "side" },
    { resource: { type: "document", id: "kept", label: "Kept target" }, autoOpen: true, region: "secondary" },
  ],
});
const resolve = defineCommand({
  id: "resolve",
  title: "Resolve documents",
  params: { resources: params.json<ResourceRef[]>() },
  async run(ctx, args) {
    const removed = await ctx.storage.get<boolean>("removed");
    return (args.resources ?? [])
      .filter((resource) => resource.id !== "deleted" || !removed)
      .map((resource) => ({ resource, target: { kind: "page", page: { kind: "page", id: "document" }, resource } }));
  },
});
const kind = defineResourceKind({
  id: "document",
  label: "Document",
  resolveMany: resolve.ref,
  relatedOpenings: related.ref,
  menuSlots: [{ id: "actions", placement: "header-overflow", label: "Document actions", access: "owner" }],
});
const remove = defineCommand({
  id: "remove",
  title: "Delete related target",
  menus: [{ slot: resourceMenuSlotRef(kind.ref, "actions"), label: "Delete related target" }],
  async run(ctx) {
    await ctx.storage.set("removed", true);
    await ctx.resources.removed({ type: "document", id: "deleted" });
  },
});
const view = defineView({
  id: "document",
  title: "Document",
  body: { kind: "dataTable", columns: [], query: () => ({ rows: [] }) },
});
const home = definePage({
  id: "home",
  title: "Removal home",
  path: "removal-home",
  mode: workbenchModes.project,
  main: { kind: "view", view: view.ref, cardinality: "one" },
  slots: [],
});
const document = definePage({
  id: "document",
  title: "Removal source",
  path: "removal-source",
  parent: home.ref,
  mode: workbenchModes.project,
  resource: { kinds: [kind.ref] },
  main: { kind: "view", view: view.ref, cardinality: "one" },
  slots: [],
});
export default defineExtension({
  commands: [related, resolve, remove],
  resourceKinds: [kind],
  views: [view],
  pages: [home, document],
  navigationItems: [
    defineNavigationItem({
      id: "source",
      label: "Removal source",
      owner: workbenchModes.project,
      action: {
        kind: "page",
        page: document.ref,
        resource: { type: "document", id: "source", label: "Removal source" },
      },
    }),
    defineNavigationItem({
      id: "home",
      label: "Removal home",
      owner: workbenchModes.project,
      action: { kind: "page", page: home.ref },
    }),
  ],
});
