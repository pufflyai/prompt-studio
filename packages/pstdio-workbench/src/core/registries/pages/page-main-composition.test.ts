import { expect, test } from "bun:test";
import { createWorkbenchPageRegistry } from "./page-registry";
import { getWorkbenchPageRegistryInternals } from "./page-registry-internals";

const createEditor = () => {
  const registry = createWorkbenchPageRegistry({
    resolveShellPlacements: () => [],
    resolveModePlacements: () => [],
    resolvePagePlacement: (input) => ({ view: input.viewId, resource: input.resource }),
    resources: {
      normalize: (resource) => resource,
      toUri: (resource) => `${resource.type}:${resource.id}`,
      fromUri: () => undefined,
    },
    valuesEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
  });
  const ref = { kind: "page" as const, extensionId: "test.tools", id: "workspace" };
  registry.registerPage({
    id: "workspace",
    ref,
    path: "workspace",
    modeId: "project",
    resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] },
    main: { kind: "panels", empty: { kind: "view", id: "empty" } },
    slots: [
      {
        id: "editors",
        region: "main",
        item: {
          kind: "binding",
          binding: {
            kinds: [{ kind: "resource-kind", id: "file" }],
            view: { kind: "view", id: "editor" },
            cardinality: "many",
          },
        },
      },
    ],
  });
  const open = (id: string) => {
    const resource = { type: "workspace", id };
    getWorkbenchPageRegistryInternals(registry).activateLocation({
      pageId: "workspace",
      projectId: "project-1",
      location: { page: ref, resource },
      resource,
      action: "openWorkspace",
    });
  };
  const edit = (id: string) =>
    registry.openSlot({ pageId: "workspace", slotId: "editors", resource: { type: "file", id }, open: "pin" });
  return { registry, ref, open, edit };
};

test("renders peer Main panels while the page keeps its routed resource context", () => {
  const { registry, ref, open, edit } = createEditor();
  open("ws-1");
  expect(registry.store.getState().placements.map((placement) => placement.value.view)).toEqual(["empty"]);
  edit("notes.ts");
  expect(registry.store.getState().placements.map((placement) => placement.value.view)).toEqual(["editor"]);
  expect(registry.store.getState().location).toEqual({ page: ref, resource: { type: "workspace", id: "ws-1" } });
});

test("scopes Main panel collections to the routed page location", () => {
  const { registry, open, edit } = createEditor();
  open("ws-1");
  edit("notes.ts");
  open("ws-2");
  expect(registry.store.getState().placements.map((placement) => placement.value.view)).toEqual(["empty"]);
  edit("tasks.ts");
  open("ws-1");
  expect(registry.store.getState().placements.map((placement) => placement.value.resource?.id)).toEqual(["notes.ts"]);
});
