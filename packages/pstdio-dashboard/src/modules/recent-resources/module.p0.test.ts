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
    main: { kind: "view", view: { kind: "view", id: "view" }, cardinality: "one" },
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
      main: { kind: "view", view: { kind: "view", id: "view" }, cardinality: "many" },
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
