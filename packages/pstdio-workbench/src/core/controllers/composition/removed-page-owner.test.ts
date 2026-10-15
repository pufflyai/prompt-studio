import { expect, test } from "bun:test";
import { resourceKey } from "@pstdio/sdk/extensions";
import { createWindowingFixture } from "../../../examples/windowing/fixture";
import { windowingExtensionId, windowingPages } from "../../../examples/windowing/resources";

const tabs = (fixture: ReturnType<typeof createWindowingFixture>) =>
  Object.values(fixture.workbench.layout.getLayout().regions).flatMap((region) => region.widgets);
const setup = async () => {
  const fixture = createWindowingFixture("windowing", { pagePanels: true });
  const { workbench, resources, probe } = fixture;
  const session = resources.sessions[1]!;
  probe.attach(session);
  await workbench.navigation.openTarget({
    kind: "panel",
    panel: { kind: "placement", extensionId: windowingExtensionId, id: "sessions" },
    resource: session,
    open: "pin",
  });
  const tab = tabs(fixture).find((tab) => tab.resource?.id === session.id)!;
  workbench.movePanel(tab.widgetId, "main");
  return { fixture, workbench, resources, probe, session, tab };
};

test("deleting a page resource atomically closes its foreign tabs and rejects later navigation", async () => {
  const { fixture, workbench, resources, probe, session, tab } = await setup();
  const deleted = resources.workspaces[0]!;
  const location = workbench.pages.store.getState().location!;
  const observations: string[] = [];
  const subscription = workbench.layout.store.subscribe(() => {
    observations.push(workbench.pages.store.getState().location?.resource?.id ?? "collection");
    if (tabs(fixture).some((item) => item.widgetId === tab.widgetId)) observations.push("stale foreign tab");
  });
  workbench.resources.removed(deleted);
  subscription();
  expect(observations.length).toBeGreaterThan(0);
  expect(new Set(observations)).toEqual(new Set(["collection"]));
  expect(workbench.pages.store.getState().activePageId).toBe("windowing.workspaces");
  expect(Object.keys(workbench.pages.store.getState().pageStates).some((key) => key.includes("workspace-1"))).toBe(
    false,
  );
  expect(workbench.pageLocations.navigate({ kind: "page", page: windowingPages.workspace, resource: deleted }).ok).toBe(
    false,
  );
  expect(workbench.pageLocations.replay(location).ok).toBe(false);
  expect(probe.store.getState().sessions[resourceKey(session)]).toEqual({ starts: 1, stops: 0, running: true });
});

test("deleting an inactive page closes saved foreign tabs and permits explicit reopening of the same session", async () => {
  const { fixture, workbench, resources, probe, session } = await setup();
  workbench.pageLocations.navigate({ kind: "page", page: windowingPages.workspace, resource: resources.workspaces[1] });
  workbench.resources.removed(resources.workspaces[0]!);
  expect(workbench.pages.store.getState().location?.resource?.id).toBe("workspace-2");
  const savedTabs = fixture.persistence.layout.listScopes!("windowing-project").flatMap((scope) =>
    Object.values(fixture.persistence.layout.getLayout(scope)!.regions).flatMap((region) => region.widgets),
  );
  expect(savedTabs.some((tab) => tab.resource?.id === session.id)).toBe(false);
  await workbench.navigation.openTarget({
    kind: "panel",
    panel: { kind: "placement", extensionId: windowingExtensionId, id: "sessions" },
    resource: session,
    open: "pin",
  });
  expect(tabs(fixture).filter((tab) => tab.resource?.id === session.id)).toHaveLength(1);
  expect(
    workbench.layout.getLayout().regions.side.widgets.find((tab) => tab.resource?.id === session.id)?.resource,
  ).toEqual(session);
  expect(probe.store.getState().sessions[resourceKey(session)]).toEqual({ starts: 1, stops: 0, running: true });
});

test("deletion removes moved bindings from other owners and their saved selections", async () => {
  const fixture = createWindowingFixture("windowing", { pagePanels: true });
  const { workbench, resources } = fixture;
  const files = workbench.layout.getLayout().regions.main.widgets.find((tab) => tab.viewId === "windowing.files")!;
  workbench.movePanel(files.widgetId, "side");
  workbench.pageLocations.navigate({ kind: "page", page: windowingPages.workspace, resource: resources.workspaces[1] });
  workbench.resources.removed(resources.workspaces[0]!);
  expect(tabs(fixture).some((tab) => tab.resource?.id === "workspace-1")).toBe(false);
  for (const scope of fixture.persistence.layout.listScopes!("windowing-project")) {
    const layout = fixture.persistence.layout.getLayout(scope)!;
    expect(
      Object.values(layout.regions)
        .flatMap((region) => region.widgets)
        .some((tab) => tab.resource?.id === "workspace-1"),
    ).toBe(false);
    expect(layout.activeWidgetId).not.toBe(files.widgetId);
    expect(JSON.stringify(layout.locationSubPanelSelections ?? {})).not.toContain(files.widgetId);
  }
});

test("Reset preserves a reopened foreign session once without restoring its deleted owner", async () => {
  const { fixture, workbench, resources, session } = await setup();
  workbench.resources.removed(resources.workspaces[0]!);
  workbench.pageLocations.navigate({ kind: "page", page: windowingPages.workspace, resource: resources.workspaces[1] });
  await workbench.navigation.openTarget({
    kind: "panel",
    panel: { kind: "placement", extensionId: windowingExtensionId, id: "sessions" },
    resource: session,
    open: "pin",
  });
  const tab = tabs(fixture).find((tab) => tab.resource?.id === session.id)!;
  workbench.movePanel(tab.widgetId, "bottom");
  workbench.resetPageLayout();
  expect(
    tabs(fixture)
      .filter((item) => item.resource?.id === session.id)
      .map((item) => item.widgetId),
  ).toEqual([tab.widgetId]);
  expect(tabs(fixture).some((item) => item.resource?.id === "workspace-1")).toBe(false);
  expect(tabs(fixture).filter((item) => item.viewId === "windowing.terminal")).toHaveLength(1);
});

test("a forbidden matching session destination rejects explicit reopening after owner cleanup", async () => {
  const { fixture, workbench, resources, session, probe } = await setup();
  workbench.resources.removed(resources.workspaces[0]!);
  workbench.sidePanel.setMode("closed");
  workbench.modes.getMode("windowing")!.panels = ["main", "secondary"];
  const layout = workbench.layout.getLayout();
  await expect(
    workbench.navigation.openTarget({
      kind: "panel",
      panel: { kind: "placement", extensionId: windowingExtensionId, id: "sessions" },
      resource: session,
      open: "pin",
    }),
  ).rejects.toThrow("Panel is not provided: side");
  expect(workbench.layout.getLayout()).toBe(layout);
  expect(tabs(fixture).some((tab) => tab.resource?.id === session.id)).toBe(false);
  expect(probe.store.getState().sessions[resourceKey(session)]).toEqual({ starts: 1, stops: 0, running: true });
});

test("reload does not restore deleted owners or navigate to their stale saved location", async () => {
  const { fixture, resources, tab, session, probe } = await setup();
  const deleted = resources.workspaces[0]!;
  fixture.removeResource(deleted);
  expect(
    fixture.persistence.layout.listScopes!("windowing-project").some((scope) => scope.includes("workspace-1")),
  ).toBe(false);
  await fixture.reload();
  const workbench = fixture.workbench;
  expect(tabs(fixture).some((item) => item.widgetId === tab.widgetId)).toBe(false);
  expect(workbench.pageLocations.navigate({ kind: "page", page: windowingPages.workspace, resource: deleted }).ok).toBe(
    false,
  );
  workbench.resetPageLayout();
  expect(tabs(fixture).some((item) => item.resource?.id === session.id)).toBe(false);
  expect(probe.store.getState().sessions[resourceKey(session)]).toEqual({ starts: 1, stops: 0, running: true });
});

test("unregistering an active page closes its foreign tab and keeps its runtime running", async () => {
  const { fixture, workbench, session, tab, probe } = await setup();
  fixture.removeContribution("workspace");
  expect(tabs(fixture).some((item) => item.widgetId === tab.widgetId)).toBe(false);
  expect(workbench.pages.store.getState().activePageId).toBe("windowing.workspaces");
  expect(
    workbench.pageLocations.navigate({
      kind: "page",
      page: windowingPages.workspace,
      resource: fixture.resources.workspaces[0],
    }).ok,
  ).toBe(false);
  expect(probe.store.getState().sessions[resourceKey(session)]).toEqual({ starts: 1, stops: 0, running: true });
});

for (const instancePolicy of ["multiple", undefined] as const) {
  test(`deleted resources cannot reopen through a panel with instance policy ${instancePolicy}`, async () => {
    const fixture = createWindowingFixture("windowing", { pagePanels: true });
    const { workbench, resources } = fixture;
    workbench.views.getView("windowing.session")!.instancePolicy = instancePolicy;
    const target = {
      kind: "panel" as const,
      panel: { kind: "placement" as const, extensionId: windowingExtensionId, id: "sessions" },
      resource: resources.sessions[1]!,
      open: "pin" as const,
    };
    await workbench.navigation.openTarget(target);
    fixture.removeResource(target.resource);
    await expect(workbench.navigation.openTarget(target)).rejects.toThrow("Resource was deleted");
    expect(tabs(fixture).some((tab) => tab.resource?.id === target.resource.id)).toBe(false);
  });
}

test("unqualified deletion removes qualified owners and bindings in the active project", async () => {
  const { fixture, workbench, resources, session, tab } = await setup();
  const deleted = { ...resources.workspaces[0]!, projectId: "windowing-project" };
  workbench.pageLocations.navigate({ kind: "page", page: windowingPages.workspace, resource: deleted });
  workbench.resources.removed(resources.workspaces[0]!);
  expect(workbench.pages.store.getState().activePageId).toBe("windowing.workspaces");
  expect(tabs(fixture).some((item) => item.resource?.id === deleted.id || item.widgetId === tab.widgetId)).toBe(false);
  expect(
    workbench.pageLocations.navigate({
      kind: "page",
      page: windowingPages.workspace,
      resource: resources.workspaces[1],
    }).ok,
  ).toBe(true);
  expect(fixture.probe.store.getState().sessions[resourceKey(session)]?.running).toBe(true);
});

test("unqualified deletion clears qualified mode bindings across later navigation", async () => {
  const fixture = createWindowingFixture("windowing", { pagePanels: true });
  const { workbench, resources } = fixture;
  await workbench.navigation.openTarget({
    kind: "panel",
    panel: { kind: "placement", extensionId: windowingExtensionId, id: "sessions" },
    resource: { ...resources.sessions[1]!, projectId: "windowing-project" },
    open: "pin",
  });
  workbench.resources.removed(resources.sessions[1]!);
  expect(
    workbench.pageLocations.navigate({
      kind: "page",
      page: windowingPages.workspace,
      resource: resources.workspaces[1],
    }).ok,
  ).toBe(true);
  expect(tabs(fixture).some((tab) => tab.resource?.id === resources.sessions[1]!.id)).toBe(false);
});

test.each([
  "active",
  "inactive",
])("a foreign session can reopen after its %s page contribution unregisters", async (owner) => {
  const { fixture, workbench, probe, session, tab } = await setup();
  if (owner === "inactive") workbench.pageLocations.navigate({ kind: "page", page: windowingPages.workspaces });
  fixture.removeContribution("workspace");
  const savedTabs = fixture.persistence.layout.listScopes!("windowing-project").flatMap((scope) =>
    Object.values(fixture.persistence.layout.getLayout(scope)?.regions ?? {}).flatMap((region) => region.widgets),
  );
  expect(savedTabs.some((saved) => saved.widgetId === tab.widgetId)).toBe(false);
  await workbench.navigation.openTarget({
    kind: "panel",
    panel: { kind: "placement", extensionId: windowingExtensionId, id: "sessions" },
    resource: session,
    open: "pin",
  });
  expect(tabs(fixture).filter((tab) => tab.resource?.id === session.id)).toHaveLength(1);
  expect(
    workbench.layout.getLayout().regions.side.widgets.find((tab) => tab.resource?.id === session.id)?.resource,
  ).toEqual(session);
  expect(probe.store.getState().sessions[resourceKey(session)]).toEqual({ starts: 1, stops: 0, running: true });
});
