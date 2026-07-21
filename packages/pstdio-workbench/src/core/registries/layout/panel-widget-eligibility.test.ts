import { describe, expect, test } from "bun:test";
import type { ResourceRef } from "../resources/resource-registry";
import { createDefaultWorkbenchLayout, type RegisteredWidgetContribution } from "./layout-types";
import { listEligiblePanelWidgets } from "./panel-widget-eligibility";

const resource: ResourceRef = {
  kind: "workspace",
  uri: "workspace:one",
};

const widget = (overrides: Partial<RegisteredWidgetContribution>): RegisteredWidgetContribution => ({
  id: "files",
  title: "Files",
  region: "main",
  rendererId: "files.renderer",
  panelAddable: true,
  singleton: true,
  reuse: "resource",
  source: "module",
  ownerId: "test",
  priority: 0,
  ...overrides,
});

describe("listEligiblePanelWidgets", () => {
  test("uses destination, resource, and singleton state for one shared openability decision", () => {
    const layout = createDefaultWorkbenchLayout();
    layout.regions.main.widgets.push({
      widgetId: "open-preview",
      contributionId: "preview",
    });

    const widgets = [
      widget({ id: "files", fallbackRegion: "side", resourceKinds: ["workspace"] }),
      widget({ id: "tickets", resourceKinds: ["ticket"] }),
      widget({ id: "preview", singleton: true }),
      widget({ id: "terminal", region: "secondary", singleton: false, reuse: "none" }),
      widget({ id: "unavailable", canOpen: () => false }),
      widget({ id: "settings", panelAddable: false }),
    ];

    expect(listEligiblePanelWidgets({ widgets, layout, region: "main", resource }).map((item) => item.id)).toEqual([
      "files",
    ]);
    expect(listEligiblePanelWidgets({ widgets, layout, region: "side", resource }).map((item) => item.id)).toEqual([
      "files",
    ]);
    expect(listEligiblePanelWidgets({ widgets, layout, region: "secondary", resource }).map((item) => item.id)).toEqual(
      ["terminal"],
    );
  });

  test("requires widgets to opt into the Add panel menu", () => {
    const widgets = [widget({ id: "workspaces" }), widget({ id: "settings", panelAddable: false })];

    expect(
      listEligiblePanelWidgets({ widgets, layout: createDefaultWorkbenchLayout(), region: "main" }).map(
        (item) => item.id,
      ),
    ).toEqual(["workspaces"]);
  });
});
