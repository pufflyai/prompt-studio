import {
  defineCommand,
  defineExtension,
  defineNavigationItem,
  definePage,
  defineResourceKind,
  defineView,
  params,
  resourceMenuSlotRef,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const kind = defineResourceKind({
  id: "instance",
  label: "Instance",
  menuSlots: [{ id: "actions", placement: "header-overflow", label: "Instance actions", access: "owner" }],
});
const choices = defineCommand({
  id: "templates",
  title: "List templates",
  params: { instance: params.text({ required: true }) },
  run: (_ctx, { instance }) => [{ id: `${instance}-template`, name: `Template for ${instance}` }],
});
const run = defineCommand({
  id: "run",
  title: "Choose instance template",
  menus: [{ slot: resourceMenuSlotRef(kind.ref, "actions"), label: "Choose instance template" }],
  params: {
    instance: params.text({ required: true, resolvedFrom: "resource" }),
    template: params.select({
      required: true,
      options: {
        command: choices.ref,
        valueField: "id",
        labelField: "name",
        params: { instance: params.valueOf("instance") },
      },
    }),
  },
  run: (_ctx, args) => args,
});
const view = defineView({
  id: "empty",
  title: "Instance",
  body: { kind: "dataTable", columns: [], query: () => ({ rows: [] }) },
});
const home = definePage({
  id: "home",
  title: "Instances",
  path: "resource-choices-home",
  mode: workbenchModes.project,
  main: { kind: "view", view: view.ref, cardinality: "one" },
  slots: [],
});
const page = definePage({
  id: "instance",
  title: "Instance",
  path: "resource-choices",
  mode: workbenchModes.project,
  parent: home.ref,
  resource: { kinds: [kind.ref] },
  main: { kind: "view", view: view.ref, cardinality: "one" },
  slots: [],
});
export default defineExtension({
  commands: [choices, run],
  resourceKinds: [kind],
  views: [view],
  pages: [home, page],
  navigationItems: ["first", "second"].map((id) =>
    defineNavigationItem({
      id,
      label: `Instance ${id}`,
      owner: workbenchModes.project,
      action: {
        kind: "page",
        page: page.ref,
        resource: { type: "instance", id, label: `Instance ${id}`, metadata: { instance: id } },
      },
    }),
  ),
});
