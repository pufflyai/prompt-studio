import { expect, test } from "bun:test";
import { createDefaultWorkbenchLayout, type WorkbenchWidgetPlacement } from "../layout/layout-types";
import { resolvePageActivePlacement } from "./page-active-placement";
import type { WorkbenchPageContribution } from "./page-registry-types";

const page: WorkbenchPageContribution = {
  id: "notes",
  ref: { kind: "page", id: "notes" },
  modeId: "project",
  path: "notes",
  main: { kind: "panels", empty: { kind: "view", id: "empty" } },
  slots: [],
};
const tab = (id: string): WorkbenchWidgetPlacement => ({
  widgetId: id,
  contributionId: id,
  resource: { type: "note", id },
  placementIdentity: { kind: "page", pageId: "notes", slotId: "notes", instanceKey: id },
});

test("page document selection stays with Main when an auxiliary panel has focus", () => {
  const layout = createDefaultWorkbenchLayout();
  const document = tab("document");
  layout.regions.main.widgets = [document];
  layout.regions.main.activeWidgetId = document.widgetId;
  for (const region of ["side", "secondary"] as const) {
    const auxiliary = tab(region);
    layout.regions[region].widgets = [auxiliary];
    layout.regions[region].activeWidgetId = auxiliary.widgetId;
    layout.activeWidgetId = auxiliary.widgetId;
    expect(resolvePageActivePlacement(layout, page)).toBe(document);
  }
});

test("a page without a selected Main document has no document context", () => {
  const layout = createDefaultWorkbenchLayout();
  const auxiliary = tab("inspector");
  layout.regions.side.widgets = [auxiliary];
  layout.regions.side.activeWidgetId = auxiliary.widgetId;
  layout.activeWidgetId = auxiliary.widgetId;
  expect(resolvePageActivePlacement(layout, page)).toBeUndefined();
});
