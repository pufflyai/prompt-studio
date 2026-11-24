import { expect, test } from "bun:test";
import { type NavigationTarget, workbenchCommands } from "@pstdio/sdk/extensions";
import { createWorkbench, type PreferenceValue } from "@pstdio/workbench";
import { createRecentResourcesModule } from "./module";

const page = (id: string) => ({ kind: "page" as const, extensionId: "example", id });
const resource = (type: string, id: string, projectId = "one") => ({
  type,
  id,
  projectId,
  label: id,
  extensionId: "example",
});
const harness = (values = new Map<string, PreferenceValue>()) => {
  const w = createWorkbench({
    preferencePersistence: {
      getValue: (name, scope) => values.get(`${name}:${scope.scopeId}`),
      setValue: (name, value, scope) => {
        values.set(`${name}:${scope.scopeId}`, value);
      },
    },
  });
  w.modes.registerMode({ id: "project", activate() {} });
  w.views.registerView({ id: "view", title: "Resource", body: { kind: "react", render: () => null } });
  w.pages.registerPage({
    id: "home",
    ref: page("home"),
    path: "home",
    modeId: "project",
    main: { kind: "view", view: { kind: "view", id: "view" }, cardinality: "one", presentation: "page" },
    slots: [],
  });
  for (const type of ["session", "ticket", "artifact", "workspace", "file"]) {
    w.resources.registerKind({ kind: type, extensionId: "example", label: type, icon: "file" });
    w.pages.registerPage({
      id: type,
      ref: page(type),
      parentId: "home",
      path: type,
      modeId: "project",
      resource: { kinds: [{ kind: "resource-kind", extensionId: "example", id: type }] },
      main: { kind: "view", view: { kind: "view", id: "view" }, cardinality: "many", presentation: "page" },
      slots: [],
    });
  }
  const module = w.registerModule(createRecentResourcesModule());
  w.pageLocations.setProject("one");
  return {
    w,
    module,
    values,
    read: () =>
      w.commands.executeCommand(workbenchCommands.recentResources.id) as Promise<
        Array<{
          resource: ReturnType<typeof resource>;
          target: Extract<NavigationTarget, { kind: "page" | "compound" }>;
        }>
      >,
  };
};
const open = (type: string, id: string, projectId = "one") => ({
  kind: "page" as const,
  page: page(type),
  resource: resource(type, id, projectId),
});

test("Recent keeps a resource tab's semantic destination when it is selected and reopened elsewhere", async () => {
  const { w, read } = harness();
  w.pages.registerPage({
    id: "collection",
    ref: page("collection"),
    path: "collection",
    modeId: "project",
    main: { kind: "panels" },
    slots: [],
  });
  w.pageLocations.navigate({ kind: "page", page: page("collection") });
  await w.navigation.openTarget({ ...open("ticket", "a"), open: "pin" });
  const first = w.layout.getActivePanel("main")!;
  await w.navigation.openTarget({ ...open("artifact", "b"), open: "pin" });
  w.layout.activatePanel(first.instanceId);
  const recent = (await read())[0]!;
  expect(recent.target).toMatchObject(open("ticket", "a"));
  w.pageLocations.navigate(open("session", "other"));
  await w.navigation.openTarget(recent.target);
  expect(w.pages.store.getState().location?.page).toEqual(page("ticket"));
  expect(w.pages.getContent()?.resource?.id).toBe("a");
});

test("Recent distinguishes a selected semantic tab from its container with the same resource", async () => {
  const { w, read } = harness();
  const kinds = [{ kind: "resource-kind" as const, extensionId: "example", id: "workspace" }];
  w.pages.registerPage({
    id: "workspace-detail",
    ref: page("workspace-detail"),
    path: "workspace-detail",
    modeId: "project",
    parentId: "home",
    resource: { kinds },
    main: { kind: "panels", landing: "files" },
    slots: [
      { id: "files", region: "main", item: { kind: "view", view: { kind: "view", id: "view" }, presence: "open" } },
    ],
  });
  w.views.registerView({ id: "history", title: "History", body: { kind: "react", render: () => null } });
  w.pages.registerPage({
    id: "history",
    ref: page("history"),
    path: "history",
    modeId: "project",
    parentId: "home",
    resource: { kinds },
    main: { kind: "view", view: { kind: "view", id: "history" }, cardinality: "one", presentation: "page" },
    slots: [],
  });
  const workspace = resource("workspace", "a");
  const history = { kind: "page" as const, page: page("history"), resource: workspace };
  w.pageLocations.navigate({ kind: "page", page: page("workspace-detail"), resource: workspace });
  await w.navigation.openTarget({ ...history, open: "pin" });
  expect((await read())[0]!.target).toMatchObject(history);
  const tab = w.layout.getActivePanel("main")!;
  const files = w.layout.listPanelInstances("main").find((tab) => tab.placementIdentity?.kind === "page")!;
  w.layout.activatePanel(files.instanceId);
  expect((await read())[0]!.target).toMatchObject({
    kind: "page",
    page: page("workspace-detail"),
    resource: workspace,
  });
  w.layout.activatePanel(tab.instanceId);
  expect((await read())[0]!.target).toMatchObject(history);
  await w.navigation.openTarget({ ...open("ticket", "other"), open: "pin" });
  w.layout.activatePanel(tab.instanceId);
  expect((await read())[0]!.target).toMatchObject(history);
  expect(w.pages.store.getState().activePageId).toBe("workspace-detail");
});

test("Recent orders opened resources across kinds, deduplicates revisits and restores exact destinations", async () => {
  const { w, read, values } = harness();
  for (const type of ["session", "ticket", "artifact", "workspace", "file"])
    await w.navigation.openTarget(open(type, "same-id"));
  await w.navigation.openTarget(open("ticket", "same-id"));
  const items = await read();
  expect(items.map(({ resource }) => resource.type)).toEqual(["ticket", "file", "workspace", "artifact", "session"]);
  expect(items[0]!.target).toMatchObject(open("ticket", "same-id"));
  const restored = harness(values);
  expect(await restored.read()).toEqual(items);
  await restored.w.navigation.openTarget(items[1]!.target);
  expect(restored.w.pages.store.getState().location?.resource?.type).toBe("file");
});

test("Recent keeps projects separate and excludes failed navigation and removed resources", async () => {
  const { w, read } = harness();
  await w.navigation.openTarget(open("ticket", "one-ticket"));
  await expect(w.navigation.openTarget({ ...open("ticket", "bad"), page: page("missing") })).rejects.toThrow();
  expect((await read()).map((item) => item.resource.id)).toEqual(["one-ticket"]);
  w.pageLocations.setProject("two");
  expect(await read()).toEqual([]);
  await w.navigation.openTarget(open("artifact", "two-artifact", "two"));
  expect((await read())[0]!.resource.id).toBe("two-artifact");
  w.pageLocations.setProject("one");
  w.resources.removed(resource("ticket", "one-ticket"));
  expect(await read()).toEqual([]);
  await expect(
    w.commands.executeCommand(workbenchCommands.recentResources.id, {}, { projectId: "two" }),
  ).rejects.toThrow();
});

test("Recent reads live owner labels and status without changing the order", async () => {
  const { w, read } = harness();
  await w.navigation.openTarget(open("session", "session"));
  await w.navigation.openTarget(open("ticket", "ticket"));
  w.resources.getKind("session", "example")!.resolve = (ref) => ({
    ...ref,
    label: "Renamed conversation",
    metadata: { status: "completed" },
  });
  expect((await read()).map((item) => item.resource)).toMatchObject([
    { type: "ticket" },
    { type: "session", label: "Renamed conversation", metadata: { status: "completed" } },
  ]);
});

test("Recent reopens auxiliary resources in their original page and retires its listeners on disposal", async () => {
  const { w, read, module } = harness();
  const panel = { kind: "placement" as const, extensionId: "example", id: "files" };
  w.modePlacements.registerPlacement({
    id: "files",
    ref: panel,
    modeId: "project",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "file", extensionId: "example" }],
        view: { kind: "view", id: "view" },
        cardinality: "many",
      },
    },
  });
  await w.navigation.openTarget(open("workspace", "workspace"));
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("file", "README.md") });
  const file = (await read())[0]!;
  expect(file.resource.id).toBe("README.md");
  expect(file.target).toMatchObject({
    kind: "compound",
    targets: [
      { kind: "page", page: page("workspace") },
      { kind: "panel", panel },
    ],
  });
  await w.navigation.openTarget(open("ticket", "ticket"));
  await w.navigation.openTarget(file.target);
  expect(w.pages.store.getState().location?.page).toEqual(page("workspace"));
  expect(w.layout.getLayout().regions.side.widgets.some((widget) => widget.resource?.id === "README.md")).toBe(true);
  expect((await read())[0]!.resource.id).toBe("README.md");
  module.dispose();
  await w.navigation.openTarget(open("ticket", "unrecorded"));
  w.registerModule(createRecentResourcesModule());
  expect((await read()).some((item) => item.resource.id === "unrecorded")).toBe(false);
});

test("Recent deduplicates normal references that omit their project", async () => {
  const { w, read } = harness();
  const { projectId: _projectId, ...ref } = resource("workspace", "workspace");
  await w.navigation.openTarget({ kind: "page", page: page("workspace"), resource: ref });
  await w.navigation.openTarget({ kind: "page", page: page("home") });
  await w.navigation.openTarget({ kind: "page", page: page("workspace"), resource: ref });
  expect(await read()).toHaveLength(1);
  w.resources.removed(ref);
  expect(await read()).toEqual([]);
});

test("Recent refreshes last-seen extension presentation without promoting a metadata change", async () => {
  const { w, read, values } = harness();
  await w.navigation.openTarget(open("ticket", "ticket"));
  const ticket = w.pages.store.getState().location!;
  const panel = { kind: "placement" as const, extensionId: "example", id: "files" };
  w.modePlacements.registerPlacement({
    id: "files",
    ref: panel,
    modeId: "project",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "file", extensionId: "example" }],
        view: { kind: "view", id: "view" },
        cardinality: "many",
      },
    },
  });
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("file", "file") });
  w.pageLocations.replay({ ...ticket, resource: { ...ticket.resource!, label: "Renamed ticket", icon: "component" } });
  expect((await read()).map((item) => item.resource.label)).toEqual(["file", "Renamed ticket"]);
  await w.navigation.openTarget({ kind: "page", page: page("home") });
  expect((await harness(values).read()).map((item) => item.resource.label)).toEqual(["Renamed ticket"]);
});

test("Recent hides unavailable contextual ancestors and restores entries when their owner returns", async () => {
  const { w, read } = harness();
  const ancestor = {
    id: "ancestor",
    ref: page("ancestor"),
    path: "ancestor",
    modeId: "project",
    main: { kind: "panels" as const, empty: { kind: "view" as const, id: "view" } },
    slots: [],
  };
  const registration = w.pages.registerPage(ancestor);
  await w.navigation.openTarget({ ...open("ticket", "ticket"), parent: { kind: "page", page: page("ancestor") } });
  await w.navigation.openTarget({ kind: "page", page: page("home") });
  registration.dispose();
  expect(await read()).toEqual([]);
  w.pages.registerPage(ancestor);
  expect(await read()).toHaveLength(1);
});

test("Recent projects held resource changes and restores its items after rejection", async () => {
  const { w, read } = harness();
  const target = open("ticket", "before");
  const item = target.resource;
  await w.navigation.openTarget(target);
  try {
    const rename = Promise.withResolvers<void>();
    const pendingRename = w.resources.preview
      .submit(item, () => rename.promise, { label: "During rename" }, "Rename ticket")
      .catch((error: unknown) => error);
    expect(await read()).toMatchObject([{ resource: { label: "During rename" }, target }]);
    rename.reject(new Error("Rename refused"));
    await pendingRename;
    expect(await read()).toMatchObject([{ resource: { label: "before" }, target }]);

    const removal = Promise.withResolvers<void>();
    const pendingRemoval = w.resources.preview
      .submit(item, () => removal.promise, { removed: true }, "Remove ticket")
      .catch((error: unknown) => error);
    expect(await read()).toEqual([]);
    removal.reject(new Error("Removal refused"));
    await pendingRemoval;
    expect(await read()).toMatchObject([{ resource: { label: "before" }, target }]);
  } finally {
    await w.dispose();
  }
});
