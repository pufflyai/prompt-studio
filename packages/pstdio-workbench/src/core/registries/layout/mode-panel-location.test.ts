import { expect, test } from "bun:test";
import { resourceKey } from "@pstdio/sdk/extensions";
import {
  harness,
  navigate,
  page,
  panel,
  resource,
} from "../../controllers/composition/placement-lifecycle-test-support";
import { isWorkbenchPanelPlacementVisible } from "./panel-widget-eligibility";

const create = (saved = new Map()) => {
  const w = harness(saved);
  w.pages.registerPage({
    id: "notes",
    ref: page("notes"),
    path: "notes",
    modeId: "edit",
    main: { kind: "view", view: { kind: "view", id: "empty" }, cardinality: "one" },
    slots: [],
  });
  w.pages.registerPage({
    id: "note",
    ref: page("note"),
    path: "note",
    parentId: "notes",
    modeId: "edit",
    resource: { kinds: [{ kind: "resource-kind", id: "note" }] },
    main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "one" },
    slots: [],
  });
  return w;
};

test("a mode resource tab in Secondary stays visible after visiting a single-resource page and reloading", async () => {
  const saved = new Map();
  const w = create(saved);
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("terminal"), open: "pin" });
  const tab = w.layout.getLayout().regions.side.widgets[0]!;
  w.movePanel(tab.widgetId, "secondary");
  await w.navigation.openTarget({ kind: "page", page: page("note"), resource: { type: "note", id: "checklist" } });
  await w.navigation.openTarget(navigate("alpha"));
  const terminal = w.layout.getLayout().regions.secondary.widgets.find((p) => p.widgetId === tab.widgetId)!;
  expect(terminal.resourceKey).toBe(resourceKey(resource("terminal")));
  expect(terminal.ownerResourceKey).toBeUndefined();
  expect(
    isWorkbenchPanelPlacementVisible(
      w.layout.getWidget(terminal.contributionId)!,
      w.getPrimaryResource(),
      "edit",
      terminal,
    ),
  ).toBe(true);
  for (const [scope, layout] of saved) saved.set(scope, JSON.parse(JSON.stringify(layout)));
  const restored = create(saved);
  await restored.navigation.openTarget(navigate("alpha"));
  const again = restored.layout.getLayout().regions.secondary.widgets.find((p) => p.widgetId === tab.widgetId)!;
  expect(again.resource).toEqual(resource("terminal"));
  expect(
    isWorkbenchPanelPlacementVisible(
      restored.layout.getWidget(again.contributionId)!,
      restored.getPrimaryResource(),
      "edit",
      again,
    ),
  ).toBe(true);
});
