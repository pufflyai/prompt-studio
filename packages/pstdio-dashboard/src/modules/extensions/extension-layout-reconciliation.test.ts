import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createExtensionLayoutCompatibility, reconcileExtensionLayout } from "./extension-layout-reconciliation";
import { metadata } from "./module-test-fixtures";

const extensionId = "pstdio.extension-lab";
const viewId = `${extensionId}.view.overview`;
const mode = { extensionId, kind: "mode" as const, id: "lab" };
const view = {
  id: viewId,
  localId: "overview",
  extensionId,
  title: "Overview",
  body: { kind: "tree" as const, bodyHandlerId: `${viewId}.body` },
};

const createMetadata = (region: "main" | "side", includeView = true): DashboardExtensionMetadata => ({
  ...metadata,
  modes: [{ id: `${extensionId}.mode.lab`, localId: "lab", extensionId, label: "Lab" }],
  views: includeView ? [view] : [],
  placements: includeView
    ? [
        {
          id: `${extensionId}.placement.overview`,
          localId: "overview",
          extensionId,
          mode,
          item: { kind: "view", view: { extensionId, kind: "view", id: "overview" } },
          region,
        },
      ]
    : [],
});

const withView = () => {
  const layout = createWorkbenchCore().layout.getLayout();
  layout.regions.main.widgets = [
    { widgetId: viewId, contributionId: viewId, viewId, pinned: true },
    { widgetId: "dashboard.native", contributionId: "dashboard.native" },
  ];
  layout.regions.main.activeWidgetId = viewId;
  layout.activeWidgetId = viewId;
  return layout;
};

describe("extension layout reconciliation", () => {
  test("compatibility is deterministic and changes with placement", () => {
    const main = createMetadata("main");
    const reordered = { ...main, views: [...main.views].reverse(), placements: [...main.placements].reverse() };
    expect(createExtensionLayoutCompatibility(reordered)).toBe(createExtensionLayoutCompatibility(main));
    expect(createExtensionLayoutCompatibility(createMetadata("side"))).not.toBe(
      createExtensionLayoutCompatibility(main),
    );
  });

  test("moves a retained view when its placement changes", () => {
    const reconciled = reconcileExtensionLayout({
      layout: withView(),
      metadata: createMetadata("side"),
      previousCompatibility: createExtensionLayoutCompatibility(createMetadata("main")),
    });
    expect(reconciled.regions.main.widgets.map((item) => item.widgetId)).toEqual(["dashboard.native"]);
    expect(reconciled.regions.side.widgets).toEqual([expect.objectContaining({ widgetId: viewId, pinned: true })]);
  });

  test("removes a deleted extension view but keeps dashboard views", () => {
    const reconciled = reconcileExtensionLayout({
      layout: withView(),
      metadata: createMetadata("main", false),
      previousCompatibility: createExtensionLayoutCompatibility(createMetadata("main")),
    });
    expect(reconciled.regions.main.widgets.map((item) => item.widgetId)).toEqual(["dashboard.native"]);
  });
});
