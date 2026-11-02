import { expect, test } from "bun:test";
import { resolveArrangement } from "../../registries/layout/panel-positions";
import { createWorkbench } from "../../workbench-core";

test("panel navigation does not measure visibility in a direction without a neighbor", () => {
  const core = createWorkbench();
  core.focus.setActiveRegion("side");
  core.keyboard.registerVisibleRegion("side", () => {
    throw new Error("An unavailable vertical move must not measure panel geometry");
  });
  expect(core.commands.isCommandEnabled("workbench.keyboard.focus.up")).toBe(false);
  expect(core.commands.isCommandEnabled("workbench.keyboard.focus.down")).toBe(false);
});

test("panel navigation reads live visibility once when finding a destination", () => {
  const core = createWorkbench();
  core.layout.registerWidget({ id: "tool", title: "Tool", region: "main", rendererId: "test" });
  const tab = core.layout.openWidget("tool", { region: "main" });
  core.focus.setActiveRegion("side");
  let visible = true;
  let reads = 0;
  core.keyboard.registerVisibleRegion("main", () => {
    reads++;
    return visible ? [tab.widgetId] : [];
  });
  const id = `workbench.keyboard.focus.${resolveArrangement(core.layout.getLayout().arrangement).side === "left" ? "right" : "left"}`;
  expect(core.commands.isCommandEnabled(id)).toBe(true);
  expect(reads).toBe(1);
  visible = false;
  expect(core.commands.isCommandEnabled(id)).toBe(false);
  expect(reads).toBe(2);
});
