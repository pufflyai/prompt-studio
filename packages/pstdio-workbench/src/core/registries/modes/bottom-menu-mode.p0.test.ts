import { expect, test } from "bun:test";
import { createLayoutModel } from "../layout/layout-model";
import { applyModePanelAvailability, getWorkbenchModePanelForRegion, restoreUnscopedModeLayout } from "./mode-layout";

test("bottom menus follow their panel's mode availability and saved layout", () => {
  const model = createLayoutModel();
  const defaults = model.getLayout();
  model.registerWidget({ id: "activity", title: "Activity", region: "side-bottom-menu", rendererId: "activity" });
  const menu = model.openWidget("activity");
  const saved = model.getLayout();
  expect(getWorkbenchModePanelForRegion("side-bottom-menu")).toBe("side");
  expect(applyModePanelAvailability(saved, ["main"]).regions["side-bottom-menu"].widgets).toEqual([]);
  expect(
    restoreUnscopedModeLayout(defaults, saved, ["main", "side"], defaults).regions["side-bottom-menu"].widgets[0]
      ?.widgetId,
  ).toBe(menu.widgetId);
});
