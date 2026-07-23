import { describe, expect, test } from "bun:test";
import type { ResourceRef } from "../resources/resource-registry";
import { createDefaultWorkbenchLayout, type RegisteredWidgetContribution } from "./layout-types";
import {
  allowsWorkbenchFloatingPanels,
  listEligibleSubPanels,
  matchesWorkbenchPanelMenuOwner,
  matchesWorkbenchPanelPlacementLocation,
} from "./panel-widget-eligibility";

const resource: ResourceRef = {
  kind: "workspace",
  uri: "workspace:one",
};

const widget = (overrides: Partial<RegisteredWidgetContribution>): RegisteredWidgetContribution => ({
  id: "files",
  title: "Files",
  region: "main",
  rendererId: "files.renderer",
  role: "sub-panel",
  singleton: true,
  reuse: "resource",
  source: "module",
  ownerId: "test",
  priority: 0,
  ...overrides,
});

describe("listEligibleSubPanels", () => {
  test("uses destination, resource, and singleton state for one shared openability decision", () => {
    const layout = createDefaultWorkbenchLayout();
    layout.regions.main.widgets.push({
      widgetId: "open-preview",
      contributionId: "preview",
      ownerResourceUri: resource.uri,
    });

    const widgets = [
      widget({ id: "files", fallbackRegion: "side", resourceKinds: ["workspace"] }),
      widget({ id: "tickets", resourceKinds: ["ticket"] }),
      widget({ id: "preview", singleton: true }),
      widget({ id: "terminal", region: "secondary", singleton: false, reuse: "none" }),
      widget({ id: "unavailable", canOpen: () => false }),
      widget({ id: "settings", role: "content" }),
    ];

    expect(listEligibleSubPanels({ widgets, layout, region: "main", resource }).map((item) => item.id)).toEqual([
      "files",
    ]);
    expect(listEligibleSubPanels({ widgets, layout, region: "side", resource }).map((item) => item.id)).toEqual([
      "files",
    ]);
    expect(listEligibleSubPanels({ widgets, layout, region: "secondary", resource }).map((item) => item.id)).toEqual([
      "terminal",
    ]);
  });

  test("requires widgets to opt into the Add panel menu", () => {
    const widgets = [widget({ id: "workspaces" }), widget({ id: "settings", role: "content" })];

    expect(
      listEligibleSubPanels({ widgets, layout: createDefaultWorkbenchLayout(), region: "main" }).map((item) => item.id),
    ).toEqual(["workspaces"]);
  });

  test("matches explicit location owners", () => {
    const widgets = [
      widget({ id: "ticket-files", eligibleLocations: { resourceKinds: ["ticket"] } }),
      widget({ id: "workspace-files", eligibleLocations: { resourceKinds: ["workspace"] } }),
    ];

    expect(
      listEligibleSubPanels({ widgets, layout: createDefaultWorkbenchLayout(), region: "main", resource }),
    ).toEqual([expect.objectContaining({ id: "workspace-files" })]);
  });

  test("allows one singleton Sub Panel placement in each Location", () => {
    const layout = createDefaultWorkbenchLayout();
    layout.regions.main.widgets.push({
      widgetId: "files-alpha",
      contributionId: "files",
      role: "sub-panel",
      ownerResourceUri: "workspace:alpha",
    });

    expect(listEligibleSubPanels({ widgets: [widget({})], layout, region: "main", resource })).toEqual([
      expect.objectContaining({ id: "files" }),
    ]);
  });
});

describe("Location Panel presentation", () => {
  test("does not count a placement that is ineligible for the active Location", () => {
    const contribution = widget({
      eligibleLocations: { canOpen: (candidate) => candidate.id !== "sessions" },
    });
    const placement = {
      widgetId: "files",
      contributionId: "files",
      role: "sub-panel" as const,
      ownerResourceUri: "dashboard:sessions",
    };
    const sessions = { kind: "dashboard-view", id: "sessions", uri: "dashboard:sessions" };

    expect(matchesWorkbenchPanelPlacementLocation(contribution, sessions, "sessions", placement)).toBe(false);
  });

  test("validates a resource-backed Sub Panel against its own resource and its Location separately", () => {
    const contribution = widget({
      resourceKinds: ["note"],
      eligibleLocations: { resourceKinds: ["workspace"] },
    });
    const placement = {
      widgetId: "note:alpha",
      contributionId: "files",
      role: "sub-panel" as const,
      ownerResourceUri: resource.uri,
      resource: { kind: "note", uri: "note:alpha" },
    };

    expect(matchesWorkbenchPanelPlacementLocation(contribution, resource, "workspace", placement)).toBe(true);
  });

  test("can keep a Side Panel placement eligible independently of its Location resource", () => {
    const contribution = widget({
      eligibleLocations: {
        resourceKinds: ["workspace"],
        resourceIds: ["alpha"],
        canOpen: (candidate) => candidate.id === "alpha",
      },
    });
    const placement = {
      widgetId: "files",
      contributionId: "files",
      role: "sub-panel" as const,
      ownerResourceUri: "workspace:alpha",
    };
    const ticket = { kind: "ticket", id: "beta", uri: "ticket:beta" };

    expect(
      matchesWorkbenchPanelPlacementLocation(contribution, ticket, "workspace", placement, {
        ignoreResourceLocation: true,
      }),
    ).toBe(true);
  });

  test("lets the selected Location or Sub Panel keep floating panels off its content", () => {
    const layout = createDefaultWorkbenchLayout();
    layout.regions.main.widgets.push(
      { widgetId: "location", contributionId: "location", role: "location" },
      { widgetId: "notes", contributionId: "notes", role: "sub-panel" },
    );
    layout.activeLocationWidgetId = "location";
    layout.regions.main.activeWidgetId = "location";
    const widgets = [
      widget({ id: "location", role: "location", floatingPanels: "hidden" }),
      widget({ id: "notes", role: "sub-panel" }),
    ];

    expect(allowsWorkbenchFloatingPanels(layout, widgets)).toBe(false);

    layout.regions.main.activeWidgetId = "notes";
    expect(allowsWorkbenchFloatingPanels(layout, widgets)).toBe(true);
  });
});

describe("matchesWorkbenchPanelMenuOwner", () => {
  const panelMenu = (owner: RegisteredWidgetContribution["panelMenuOwner"]): RegisteredWidgetContribution =>
    widget({ id: "inspector", role: "panel-menu", region: "main-right-menu", panelMenuOwner: owner });

  test("shows menus only for the selected Panel or Sub Panel", () => {
    const location = { widgetId: "project", contributionId: "project.location", role: "location" as const };
    const notes = { widgetId: "notes", contributionId: "notes", role: "sub-panel" as const };

    expect(matchesWorkbenchPanelMenuOwner(panelMenu({ level: "panel" }), { locationPanel: location })).toBe(true);
    expect(
      matchesWorkbenchPanelMenuOwner(panelMenu({ level: "panel" }), {
        locationPanel: location,
        subPanel: notes,
      }),
    ).toBe(false);
    expect(
      matchesWorkbenchPanelMenuOwner(panelMenu({ level: "sub-panel", contributionId: "notes" }), {
        locationPanel: location,
        subPanel: notes,
      }),
    ).toBe(true);
  });

  test("shows a menu declared by a Location Panel only with that Location Panel type", () => {
    const contribution = panelMenu({ level: "panel", contributionId: "notes.location" });

    expect(
      matchesWorkbenchPanelMenuOwner(contribution, {
        locationPanel: { widgetId: "notes", contributionId: "notes.location", role: "location" },
      }),
    ).toBe(true);
    expect(
      matchesWorkbenchPanelMenuOwner(contribution, {
        locationPanel: { widgetId: "tickets", contributionId: "tickets.location", role: "location" },
      }),
    ).toBe(false);
  });

  test("shows Sub-Panel-owned menus only with their owning Sub Panel", () => {
    const contribution = panelMenu({ level: "sub-panel", contributionId: "notes" });

    expect(
      matchesWorkbenchPanelMenuOwner(contribution, {
        subPanel: { widgetId: "notes", contributionId: "notes", role: "sub-panel" },
      }),
    ).toBe(true);
    expect(
      matchesWorkbenchPanelMenuOwner(contribution, {
        subPanel: { widgetId: "reports", contributionId: "reports", role: "sub-panel" },
      }),
    ).toBe(false);
    expect(matchesWorkbenchPanelMenuOwner(contribution, {})).toBe(false);
  });
});
