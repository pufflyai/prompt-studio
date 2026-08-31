import { describe, expect, test } from "bun:test";
import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { ResolvedOwnedPlacement } from "../../registries/layout/placement-reconciliation";
import {
  createWorkbenchPageRegistry,
  type WorkbenchPageContribution,
  type WorkbenchPagePlacementInput,
} from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { createDisposable } from "../../shared/disposable";
import { createWorkbenchCore } from "../../workbench-core";
import { connectWorkbenchPageRuntime } from "./page-runtime";

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
  slots: [{ id: "content", role: "primary", region: "main", viewId: `${id}-view` }],
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
    resolveModePanelTarget: () => {
      throw new Error("No mode panel targets are used in this test");
    },
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
      left.resourceUri === right.resourceUri,
  });

describe("workbench page runtime", () => {
  test("changes mode behavior and the complete owned layout without legacy mode composition", () => {
    const workbench = createWorkbenchCore();
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
    expect(workbench.layout.getLayout().activeLocationWidgetId).toBe("renderer-sessions-content");

    unsubscribe();
    runtime.dispose();
  });

  test("opens a page panel beside a mode panel without changing the routed primary", () => {
    const workbench = createWorkbenchCore();
    const registry = createRegistry();
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    registry.registerPage({
      ...page("tickets", "project"),
      slots: [
        { id: "content", role: "primary", region: "main", viewId: "tickets-view" },
        {
          id: "inspector",
          role: "auxiliary",
          region: "side",
          cardinality: "many",
          binding: { resourceKind: "emoji", viewId: "emoji-view" },
        },
      ],
    });
    const runtime = connectWorkbenchPageRuntime({ layout: workbench.layout, modes: workbench.modes, registry });
    activate(registry, "tickets");
    const location = registry.store.getState().location;
    let updates = 0;
    const unsubscribe = workbench.layout.store.subscribe(() => {
      updates += 1;
    });

    getWorkbenchPageRegistryInternals(registry).openPanel({
      kind: "panel",
      panel: {
        kind: "page-slot",
        page: { extensionId: "pstdio.test", kind: "page", id: "tickets" },
        id: "inspector",
      },
      resource: { type: "emoji", id: "smile" },
    });

    const layout = workbench.layout.getLayout();
    expect(updates).toBe(1);
    expect(layout.regions.side.widgets.map((placement) => placement.contributionId)).toEqual([
      "project-sessions",
      "emoji-view",
    ]);
    expect(layout.regions.side.activeWidgetId).toBe("renderer-tickets-inspector");
    expect(layout.activeLocationWidgetId).toBe("renderer-tickets-content");
    expect(registry.store.getState().location).toBe(location);

    unsubscribe();
    runtime.dispose();
  });

  test("rejects an unavailable page mode before changing page or layout state", () => {
    const workbench = createWorkbenchCore();
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
});
