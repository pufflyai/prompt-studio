import { describe, expect, test } from "bun:test";
import type { ResourceRef } from "../resources/resource-registry";
import { createDefaultWorkbenchLayout, type RegisteredWidgetContribution } from "./layout-types";
import { listEligibleSubPanels, matchesWorkbenchPanelMenuOwner } from "./panel-widget-eligibility";

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

describe("matchesWorkbenchPanelMenuOwner", () => {
  const panelMenu = (owner: RegisteredWidgetContribution["panelMenuOwner"]): RegisteredWidgetContribution =>
    widget({ id: "inspector", role: "panel-menu", region: "main-right-menu", panelMenuOwner: owner });

  test("keeps Panel-owned menus visible across Sub Panel selection", () => {
    expect(matchesWorkbenchPanelMenuOwner(panelMenu({ level: "panel" }), {})).toBe(true);
    expect(
      matchesWorkbenchPanelMenuOwner(panelMenu({ level: "panel" }), {
        subPanel: { widgetId: "notes", contributionId: "notes", role: "sub-panel" },
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
