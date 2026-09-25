import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

const owner = "acme.notes";
const pageRef = (id: string) => ({ kind: "page" as const, extensionId: owner, id });
const resource = (id: string) => ({ type: "note", id, extensionId: owner, projectId: "project" });
const setup = () => {
  const core = createWorkbench();
  core.modes.registerMode({ id: "project", activate: () => undefined });
  core.views.registerView({ id: "editor", title: "Editor", body: { kind: "react", render: () => null } });
  for (const id of ["collection", "notes", "other"])
    core.pages.registerPage({
      id,
      ref: pageRef(id),
      modeId: "project",
      path: id,
      slots: [],
      ...(id === "collection"
        ? {}
        : {
            parentId: "collection",
            resource: { kinds: [{ kind: "resource-kind" as const, id: "note", extensionId: owner }] },
          }),
      main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: id === "collection" ? "one" : "many" },
    });
  core.pageLocations.setProject("project");
  const open = (id: string, page = "notes") =>
    core.pageLocations.navigate({ kind: "page", page: pageRef(page), resource: resource(id), open: "pin" });
  return { core, open };
};

test("removal selects another primary resource and finally its parent", () => {
  const { core, open } = setup();
  open("b");
  open("a");
  core.resources.removed(resource("a"));
  expect(core.getPrimaryResource()?.id).toBe("b");
  core.resources.removed(resource("a"));
  expect(core.getPrimaryResource()?.id).toBe("b");
  core.resources.removed(resource("b"));
  expect(core.pages.store.getState().activePageId).toBe("collection");
});

test("removal updates inactive page state without moving the active route", () => {
  const { core, open } = setup();
  open("a");
  open("b");
  open("c", "other");
  core.resources.removed(resource("a"));
  expect(core.getPrimaryResource()?.id).toBe("c");
  const instances = Object.values(core.pages.store.getState().pageStates.notes!.resourceInstances).flat();
  expect(instances.map((instance) => instance.resource.id)).toEqual(["b"]);
  core.resources.removed({ ...resource("b"), projectId: "different" });
  expect(Object.values(core.pages.store.getState().pageStates.notes!.resourceInstances).flat()).toHaveLength(1);
});

test("an editor can retain its dirty placement while other bindings are removed", () => {
  const { core, open } = setup();
  open("a");
  const identity = core.layout.getLayout().regions.main.widgets[0]!.placementIdentity!;
  const subscription = core.resources.onWillRemove(() => [identity]);
  core.resources.removed(resource("a"));
  expect(core.getPrimaryResource()?.id).toBe("a");
  expect(core.layout.getLayout().regions.main.widgets).toHaveLength(1);
  subscription.dispose();
  core.resources.removed(resource("a"));
  expect(core.pages.store.getState().activePageId).toBe("collection");
});

test("removal reconciles mode and shell bindings including inactive cached shell scopes", async () => {
  const saved = new Map<string | undefined, import("../../registries/layout/layout-types").WorkbenchLayout>();
  const core = createWorkbench({
    layoutPersistence: {
      getLayout: (scope) => saved.get(scope),
      setLayout: (layout, scope) => {
        saved.set(scope, layout);
      },
    },
    resolvePagePersistenceScope: ({ projectId, pageId }) => ({ scope: `${projectId}/${pageId}` }),
  });
  core.modes.registerMode({ id: "project", activate: () => undefined });
  core.views.registerView({ id: "editor", title: "Editor", body: { kind: "react", render: () => null } });
  for (const id of ["one", "two"])
    core.pages.registerPage({
      id,
      ref: pageRef(id),
      modeId: "project",
      path: id,
      main: { kind: "panels", empty: { kind: "view", id: "editor" } },
      slots: [],
    });
  const placement = {
    id: "notes",
    region: "secondary" as const,
    item: {
      kind: "binding" as const,
      binding: {
        kinds: [{ kind: "resource-kind" as const, id: "note", extensionId: owner }],
        view: { kind: "view" as const, id: "editor" },
        cardinality: "many" as const,
      },
    },
  };
  core.shellPlacements.registerPlacement(placement);
  core.modePlacements.registerPlacement({
    ...placement,
    modeId: "project",
    ref: { kind: "placement", id: "notes", extensionId: owner },
  });
  core.pageLocations.setProject("project");
  core.pageLocations.navigate({ kind: "page", page: pageRef("one") });
  await core.navigation.openTarget({
    kind: "panel",
    panel: { kind: "shell-placement", id: "notes" },
    resource: resource("a"),
    open: "pin",
  });
  await core.navigation.openTarget({
    kind: "panel",
    panel: { kind: "placement", id: "notes", extensionId: owner },
    resource: resource("a"),
    open: "pin",
  });
  core.pageLocations.navigate({ kind: "page", page: pageRef("two") });
  core.resources.removed(resource("a"));
  expect(core.layout.getLayout().regions.secondary.widgets).toHaveLength(0);
  core.pageLocations.navigate({ kind: "page", page: pageRef("one") });
  expect(core.layout.getLayout().regions.secondary.widgets).toHaveLength(0);
});
