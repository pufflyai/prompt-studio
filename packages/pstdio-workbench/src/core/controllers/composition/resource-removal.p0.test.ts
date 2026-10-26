import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

const owner = "acme.notes";
const pageRef = (id: string) => ({ kind: "page" as const, extensionId: owner, id });
const resource = (id: string) => ({ type: "note", id, extensionId: owner, projectId: "project" });
const setup = (input: Parameters<typeof createWorkbench>[0] = {}) => {
  const core = createWorkbench(input);
  core.modes.registerMode({ id: "project", activate: () => undefined });
  core.views.registerView({ id: "editor", title: "Editor", body: { kind: "react", render: () => null } });
  const registrations = new Map<string, { dispose(): void }>();
  for (const id of ["collection", "notes", "other"])
    registrations.set(
      id,
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
      }),
    );
  core.pageLocations.setProject("project");
  const open = (id: string, page = "notes") =>
    core.pageLocations.navigate({ kind: "page", page: pageRef(page), resource: resource(id), open: "pin" });
  return { core, open, registrations };
};

test("removing the routed resource returns to its parent and preserves other pages", () => {
  const { core, open } = setup();
  open("b");
  open("a");
  core.resources.removed(resource("a"));
  expect(core.pages.store.getState().activePageId).toBe("collection");
  core.resources.removed(resource("a"));
  expect(core.pages.store.getState().activePageId).toBe("collection");
  open("b");
  expect(core.getPrimaryResource()?.id).toBe("b");
  core.resources.removed(resource("b"));
  expect(core.pages.store.getState().activePageId).toBe("collection");
});

test("removing an unscoped resource closes its active viewer", () => {
  const { core } = setup();
  const note = { type: "note", id: "global", extensionId: owner };
  core.pageLocations.navigate({ kind: "page", page: pageRef("notes"), resource: note });
  expect(core.getPrimaryResource()?.id).toBe("global");
  core.resources.removed(note);
  expect(core.pages.store.getState().activePageId).toBe("collection");
});

test("removal updates inactive page state without moving the active route", () => {
  const { core, open } = setup();
  open("a");
  open("b");
  open("c", "other");
  core.resources.removed(resource("a"));
  expect(core.getPrimaryResource()?.id).toBe("c");
  const instances = () =>
    Object.entries(core.pages.store.getState().pageStates)
      .filter(([key]) => key.startsWith("notes|"))
      .flatMap(([, state]) => Object.values(state.resourceInstances).flat());
  expect(instances().map((instance) => instance.resource.id)).toEqual(["b"]);
  core.resources.removed({ ...resource("b"), projectId: "different" });
  expect(instances()).toHaveLength(1);
});

test("deleting a resource in an inactive project clears its saved route and navigation memory", () => {
  const { core, open } = setup({ startPage: pageRef("collection") });
  open("a");
  core.pageLocations.switchProject("other-project");
  core.pageLocations.navigate({
    kind: "page",
    page: pageRef("other"),
    resource: {
      ...resource("b"),
      projectId: "other-project",
    },
  });
  core.resources.removed(resource("a"));
  expect(core.getPrimaryResource()?.id).toBe("b");
  core.pageLocations.switchProject("project");
  expect(core.pages.store.getState().activePageId).toBe("collection");
  expect(core.getPrimaryResource()).toBeUndefined();
  core.pageLocations.navigate({ kind: "page", page: pageRef("notes"), intent: "restore" });
  expect(core.getPrimaryResource()).toBeUndefined();
  open("a");
  expect(core.getPrimaryResource()?.id).toBe("a");
});

test("inactive project deletion clears routes owned by an extension unavailable in the active project", () => {
  const { core, open, registrations } = setup({ startPage: pageRef("collection") });
  open("a");
  const notes = core.pages.getPage("notes")!;
  core.pageLocations.switchProject("other-project");
  registrations.get("notes")!.dispose();
  core.resources.removed(resource("a"));
  expect(core.pages.store.getState().activePageId).toBe("collection");
  core.pages.registerPage(notes);
  core.pageLocations.switchProject("project");
  expect(core.pages.store.getState().activePageId).toBe("collection");
  expect(core.getPrimaryResource()).toBeUndefined();
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
