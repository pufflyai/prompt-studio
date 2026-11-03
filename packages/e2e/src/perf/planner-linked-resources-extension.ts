import {
  defineCommand,
  defineExtension,
  definePage,
  defineResourceKind,
  defineView,
  params,
  type ResourceRef,
  workbenchModes,
} from "@pstdio/sdk/extensions";

// Synthetic owners exercise the public resource contract without GitHub credentials or network traffic.
const resolve = defineCommand({
  id: "resolve",
  title: "Resolve synthetic linked resources",
  params: { resources: params.json<ResourceRef[]>() },
  run: (_ctx, input) =>
    (input.resources ?? []).map((resource) => ({
      resource: {
        ...resource,
        label: resource.type === "pull-request" ? `PR #${resource.id}` : `Build #${resource.id}`,
        icon: resource.type === "pull-request" ? "git-pull-request" : "check-check",
      },
      target: { kind: "page" as const, page: { kind: "page" as const, id: "resource" }, resource },
    })),
});
const kinds = ["pull-request", "build"].map((id) =>
  defineResourceKind({
    id,
    label: id === "pull-request" ? "Synthetic GitHub PR" : "Synthetic CI build",
    resolveMany: resolve.ref,
  }),
);
const link = defineCommand({
  id: "link",
  title: "Attach synthetic PR and build",
  mutating: true,
  params: { ticket: params.text({ required: true }), number: params.text({ required: true }) },
  async run(ctx, input) {
    const ticket = { type: "ticket", extensionId: "pstdio.pstdio-planner", id: input.ticket };
    // Exercise outgoing and incoming links on every card, alongside incoming workspace anchors.
    await ctx.resources.addAnchors(ticket, [{ type: "pull-request", id: input.number, label: `PR #${input.number}` }]);
    await ctx.resources.addAnchors({ type: "build", id: input.number, label: `Build #${input.number}` }, [ticket]);
  },
});
const view = defineView({
  id: "resource",
  title: "Synthetic resource destination",
  body: { kind: "dataTable", columns: [], query: () => ({ rows: [] }) },
});
const home = definePage({
  id: "home",
  title: "Synthetic linked resources",
  path: "linked-resources",
  mode: workbenchModes.project,
  main: { kind: "view", view: view.ref, cardinality: "one" },
  slots: [],
});
const page = definePage({
  id: "resource",
  title: "Synthetic resource destination",
  path: "linked-resource",
  mode: workbenchModes.project,
  parent: home.ref,
  resource: { kinds: kinds.map((kind) => kind.ref) },
  main: { kind: "view", view: view.ref, cardinality: "one" },
  slots: [],
});
export default defineExtension({ commands: [resolve, link], resourceKinds: kinds, views: [view], pages: [home, page] });
