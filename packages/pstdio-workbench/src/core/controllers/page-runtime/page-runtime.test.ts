import { describe, expect, test } from "bun:test";
import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import { resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { ResolvedOwnedPlacement } from "../../registries/layout/placement-reconciliation";
import {
  createWorkbenchPageRegistry,
  type WorkbenchPageContribution,
  type WorkbenchPagePlacementInput,
} from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { createDisposable } from "../../shared/disposable";
import { createWorkbench } from "../../workbench-core";
import { connectWorkbenchPageRuntime } from "./page-runtime";
import { registerResourcePage } from "./page-runtime-test-support";

const owned = (
  identity: PlacementIdentity,
  region: ResolvedOwnedPlacement<WorkbenchWidgetPlacement>["region"],
  contributionId: string,
): ResolvedOwnedPlacement<WorkbenchWidgetPlacement> => ({
  identity,
  region,
  order: 0,
  value: {
    widgetId: `renderer-${contributionId}`,
    contributionId,
    role: region === "main" ? "location" : "sub-panel",
  },
});
const page = (id: string, modeId: string): WorkbenchPageContribution => ({
  id,
  ref: { extensionId: "pstdio.test", kind: "page", id },
  title: id,
  path: id,
  modeId,
  main: {
    kind: "view",
    view: {
      kind: "view",
      id: `${id}-view`,
    },
    cardinality: "one",
  },
  slots: [],
});
const activate = (registry: ReturnType<typeof createRegistry>, pageId: string, action = "activateTestPage") => {
  const registered = registry.getPage(pageId);
  if (!registered) throw new Error(`Unknown test page: ${pageId}`);
  getWorkbenchPageRegistryInternals(registry).activateLocation({
    pageId,
    projectId: "project-1",
    location: { page: registered.ref },
    action,
  });
};
const createRegistry = () =>
  createWorkbenchPageRegistry<WorkbenchWidgetPlacement>({
    resolveShellPlacements: () => [],
    resolveModePlacements: (modeId) => [
      owned({ kind: "mode", modeId, placementId: "sessions", instanceKey: "default" }, "side", `${modeId}-sessions`),
    ],
    resolvePagePlacement: (input: WorkbenchPagePlacementInput) => ({
      widgetId: `renderer-${input.pageId}-${input.slotId}`,
      contributionId: input.viewId,
      viewId: input.viewId,
      role: input.role === "primary" ? "location" : "sub-panel",
    }),
    resources: {
      normalize: (resource) => ({ ...resource }),
      toUri: (resource) => `${resource.type}:${resource.id}`,
      fromUri: () => undefined,
    },
    valuesEqual: (left, right) =>
      left.contributionId === right.contributionId &&
      left.viewId === right.viewId &&
      left.resourceKey === right.resourceKey,
  });
describe("workbench page runtime", () => {
  test("keeps placements restored by a resource persistence scope", async () => {
    const layouts = new Map<
      string | undefined,
      Parameters<ReturnType<typeof createWorkbench>["layout"]["restoreLayout"]>[0]
    >();
    const workbench = createWorkbench({
      layoutPersistence: {
        getLayout: (scope) => layouts.get(scope),
        setLayout: (layout, scope) => layouts.set(scope, structuredClone(layout)),
      },
      resolvePagePersistenceScope: ({ projectId, resource }) => ({
        scope: projectId && resource ? `${projectId}/${resourceKey(resource)}` : undefined,
      }),
    });
    const pageRef = { extensionId: "pstdio.test", kind: "page" as const, id: "workspace" };
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    workbench.views.registerView({
      id: "workspace",
      title: "Workspace",
      body: { kind: "react", render: () => null },
    });
    workbench.views.registerView({
      id: "terminal",
      title: "Terminal",
      body: { kind: "react", render: () => null },
    });
    workbench.shellPlacements.registerPlacement({
      id: "terminal",
      item: {
        kind: "binding",
        binding: {
          kinds: [
            {
              kind: "resource-kind",
              id: "terminal",
            },
          ],
          view: {
            kind: "view",
            id: "terminal",
          },
          cardinality: "many",
        },
      },
      region: "secondary",
    });
    registerResourcePage(workbench, {
      id: "workspace",
      ref: pageRef,
      title: "Workspace",
      path: "workspace",
      modeId: "project",
      resource: {
        kinds: [
          {
            kind: "resource-kind",
            id: "workspace",
          },
        ],
      },
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "workspace",
        },
        cardinality: "one",
      },
      slots: [],
    });
    workbench.pageLocations.setProject("project-1");
    await workbench.navigation.openTarget({
      kind: "page",
      page: pageRef,
      resource: { type: "workspace", id: "workspace-1" },
    });
    workbench.shellPlacements.openPlacement({
      placementId: "terminal",
      resource: {
        type: "terminal",
        id: "terminal://workspace-1",
      },
      open: "pin",
    });
    workbench.layout.setRegionVisible("secondary", true);
    await workbench.navigation.openTarget({
      kind: "page",
      page: pageRef,
      resource: { type: "workspace", id: "workspace-2" },
    });
    await workbench.navigation.openTarget({
      kind: "page",
      page: pageRef,
      resource: { type: "workspace", id: "workspace-1" },
    });
    expect(workbench.layout.getLayout().regions.secondary).toMatchObject({
      visible: true,
      widgets: [expect.objectContaining({ resource: { type: "terminal", id: "terminal://workspace-1" } })],
    });
  });
  test("rotates the host persistence scope before applying a page resource", async () => {
    const workbench = createWorkbench({
      resolvePagePersistenceScope: ({ projectId, resource }) => ({
        scope: projectId
          ? `project/${projectId}/${resource ? `resource/${resourceKey(resource)}` : "page"}`
          : undefined,
      }),
    });
    const pageRef = { extensionId: "pstdio.test", kind: "page" as const, id: "workspace" };
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    workbench.views.registerView({
      id: "workspace",
      title: "Workspace",
      body: { kind: "react", render: () => null },
    });
    registerResourcePage(workbench, {
      id: "workspace",
      ref: pageRef,
      title: "Workspace",
      path: "workspace",
      modeId: "project",
      resource: {
        kinds: [
          {
            kind: "resource-kind",
            id: "workspace",
          },
        ],
      },
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "workspace",
        },
        cardinality: "one",
      },
      slots: [],
    });
    workbench.pageLocations.setProject("project-1");
    await workbench.navigation.openTarget({
      kind: "page",
      page: pageRef,
      resource: { type: "workspace", id: "workspace-1" },
    });
    const expectedScope = `project/project-1/resource/${resourceKey({ type: "workspace", id: "workspace-1" })}`;
    expect(workbench.layout.getPersistenceScope()).toBe(expectedScope);
    expect(workbench.panelMenuState.getPersistenceScope()).toBe(expectedScope);
    expect(workbench.getPrimaryResource()).toMatchObject({ type: "workspace", id: "workspace-1" });
  });
  test("uses the resource label for a resource-backed page slot", async () => {
    const workbench = createWorkbench();
    const pageRef = { extensionId: "pstdio.test", kind: "page" as const, id: "workspace" };
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    workbench.views.registerView({
      id: "workspace-files",
      title: "Files",
      body: { kind: "react", render: () => null },
    });
    registerResourcePage(workbench, {
      id: "test-workspace",
      ref: pageRef,
      title: "Workspace",
      path: "workspace",
      modeId: "project",
      resource: {
        kinds: [
          {
            kind: "resource-kind",
            id: "workspace",
          },
        ],
      },
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "workspace-files",
        },
        cardinality: "one",
      },
      slots: [],
    });
    workbench.pageLocations.setProject("project-1");
    await workbench.navigation.openTarget({
      kind: "page",
      page: pageRef,
      resource: { type: "workspace", id: "workspace-1", label: "Workspace A" },
    });
    expect(workbench.layout.getLayout().regions.main.widgets[0]?.title).toBe("Workspace A");
  });
});
describe("workbench page runtime placement composition", () => {
  test("keeps registered panel chrome on page and mode placements", () => {
    const workbench = createWorkbench();
    workbench.views.registerView({
      id: "page-view",
      title: "Page panel",
      body: { kind: "react", render: () => null },
    });
    workbench.views.registerView({
      id: "mode-view",
      title: "Mode panel",
      body: { kind: "react", render: () => null },
    });
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    workbench.modePlacements.registerPlacement({
      id: "project-mode-panel",
      ref: { extensionId: "pstdio.test", kind: "placement", id: "project-mode-panel" },
      modeId: "project",
      item: {
        kind: "view",
        presence: "open",
        view: {
          kind: "view",
          id: "mode-view",
        },
      },
      region: "side",
      tab: { getSnapshot: () => ({ label: "Mode panel" }) },
    });
    registerResourcePage(workbench, {
      id: "test-page",
      ref: { extensionId: "pstdio.test", kind: "page", id: "test-page" },
      title: "Test page",
      path: "test-page",
      modeId: "project",
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "page-view",
        },
        cardinality: "one",
        tab: { getSnapshot: () => ({ label: "Page panel" }) },
      },
      slots: [],
    });
    getWorkbenchPageRegistryInternals(workbench.pages).activateLocation({
      pageId: "test-page",
      projectId: "project-1",
      location: { page: { extensionId: "pstdio.test", kind: "page", id: "test-page" } },
      action: "testPanelChrome",
    });
    expect(workbench.layout.getLayout().regions.main.widgets[0]).toMatchObject({
      contributionId: "workbench.page-placement.test-page.%24main",
      title: "Page panel",
      tab: { getSnapshot: expect.any(Function) },
    });
    expect(workbench.layout.getLayout().regions.side.widgets[0]).toMatchObject({
      contributionId: "workbench.mode-placement.project-mode-panel",
      title: "Mode panel",
      tab: { getSnapshot: expect.any(Function) },
    });
  });
  test("changes mode behavior and the complete owned layout through mode placements", () => {
    const workbench = createWorkbench();
    const registry = createRegistry();
    const events: string[] = [];
    for (const modeId of ["project", "sessions"]) {
      workbench.modes.registerMode({
        id: modeId,
        activate: () => {
          events.push(`activate:${modeId}`);
        },
        seed: () => {
          events.push(`seed:${modeId}`);
        },
        enter: () => {
          events.push(`enter:${modeId}`);
          return createDisposable(() => events.push(`leave:${modeId}`));
        },
        reconcile: () => {
          events.push(`reconcile:${modeId}`);
        },
      });
    }
    registry.registerPage(page("tickets", "project"));
    registry.registerPage(page("ticket", "project"));
    registry.registerPage(page("sessions", "sessions"));
    const runtime = connectWorkbenchPageRuntime({ layout: workbench.layout, modes: workbench.modes, registry });
    const observed: string[][] = [];
    const unsubscribe = workbench.layout.store.subscribe((state) => {
      observed.push(
        Object.values(state.layout.regions)
          .flatMap((region) => region.widgets)
          .map((placement) => placement.contributionId),
      );
    });
    activate(registry, "tickets");
    activate(registry, "ticket");
    activate(registry, "sessions");
    expect(observed).toEqual([
      ["tickets-view", "project-sessions"],
      ["ticket-view", "project-sessions"],
      ["sessions-view", "sessions-sessions"],
    ]);
    expect(events).toEqual([
      "activate:project",
      "enter:project",
      "leave:project",
      "activate:sessions",
      "enter:sessions",
    ]);
    expect(workbench.modes.getActiveModeId()).toBe("sessions");
    expect(workbench.layout.getLayout().activeLocationWidgetId).toBe("renderer-sessions-$main");
    unsubscribe();
    runtime.dispose();
  });
  test("rejects an unavailable page mode before changing page or layout state", () => {
    const workbench = createWorkbench();
    const registry = createRegistry();
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    registry.registerPage(page("tickets", "project"));
    registry.registerPage(page("broken", "missing"));
    const runtime = connectWorkbenchPageRuntime({ layout: workbench.layout, modes: workbench.modes, registry });
    activate(registry, "tickets");
    expect(() => activate(registry, "broken")).toThrow("Workbench mode not registered: missing");
    expect(registry.store.getState().activePageId).toBe("tickets");
    expect(registry.store.getState().activeModeId).toBe("project");
    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(workbench.layout.getLayout().regions.main.widgets.map((placement) => placement.contributionId)).toEqual([
      "tickets-view",
    ]);
    runtime.dispose();
  });
  test("reapplies active page and mode placements after a persistence scope rotation", () => {
    const workbench = createWorkbench({
      layoutPersistence: {
        getLayout: () => undefined,
        setLayout: () => undefined,
      },
    });
    const registry = createRegistry();
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    registry.registerPage(page("tickets", "project"));
    const runtime = connectWorkbenchPageRuntime({ layout: workbench.layout, modes: workbench.modes, registry });
    activate(registry, "tickets");
    workbench.layout.setPersistenceScope("project/one/view/tickets");
    expect(workbench.layout.getLayout().regions.main.widgets.map((placement) => placement.contributionId)).toEqual([
      "tickets-view",
    ]);
    expect(workbench.layout.getLayout().regions.side.widgets.map((placement) => placement.contributionId)).toEqual([
      "project-sessions",
    ]);
    runtime.dispose();
  });
});
