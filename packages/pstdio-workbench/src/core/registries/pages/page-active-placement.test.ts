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
  viewId: id,
  resource: { type: "note", id },
  placementIdentity: { kind: "page", pageId: "notes", slotId: "notes", instanceKey: id },
});

test("collection breadcrumb uses Main's selected resource even when Side has focus", () => {
  const layout = createDefaultWorkbenchLayout();
  const main = tab("main-note");
  const side = tab("side-note");
  layout.regions.main.widgets = [main];
  layout.regions.main.activeWidgetId = main.widgetId;
  layout.regions.side.widgets = [side];
  layout.regions.side.activeWidgetId = side.widgetId;
  layout.activeWidgetId = side.widgetId;
  expect(resolvePageActivePlacement(layout, page)).toBe(main);
});

test("a routed workspace breadcrumb never appends an embedded resource", () => {
  const layout = createDefaultWorkbenchLayout();
  layout.regions.main.widgets = [tab("foreign-session")];
  expect(
    resolvePageActivePlacement(layout, { ...page, resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] } }),
  ).toBeUndefined();
});
