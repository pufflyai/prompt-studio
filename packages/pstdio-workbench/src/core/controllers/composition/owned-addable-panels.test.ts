import { describe, expect, test } from "bun:test";
import type { PlacementItem } from "@pstdio/sdk/extensions";
import { createWorkbench } from "../../workbench-core";
import { harness, navigate } from "./placement-lifecycle-test-support";

test("the declared tool catalog includes fixed tools and focuses a moved instance", async () => {
  const w = harness();
  w.modePlacements.registerPlacement({
    id: "files",
    ref: { kind: "placement", extensionId: "test", id: "files" },
    modeId: "edit",
    region: "side",
    item: { kind: "view", view: { kind: "view", id: "empty" }, presence: "fixed" },
  });
  await w.navigation.openTarget(navigate("alpha"));
  const tool = w.layout.getLayout().regions.side.widgets[0]!;
  w.movePanel(tool.widgetId, "secondary");
  const add = w.composition.panelsFor("side").addable.find((p) => p.panelId === tool.contributionId);
  expect(add).toBeDefined();
  await add!.open?.();
  expect(w.layout.getLayout().regions.secondary.widgets[0]?.widgetId).toBe(tool.widgetId);
  expect(w.layout.getLayout().activeWidgetId).toBe(tool.widgetId);
  expect(w.layout.getLayout().regions.side.widgets).toEqual([]);
});

describe("placement add command availability", () => {
  test.each(["shell", "mode", "page"] as const)("%s bindings only offer available add commands", (owner) => {
    const workbench = createWorkbench();
    let enabled = true;
    let visible = true;
    const args = { kind: "guide" };
    workbench.commands.registerCommand(
      { id: "open-guide", label: "Open guide", when: "guidesAvailable" },
      {
        execute: () => undefined,
        isEnabled: (input) => enabled && input === args,
        isVisible: (input) => visible && input === args,
      },
    );
    workbench.context.set("guidesAvailable", true);
    workbench.views.registerView({ id: "guide", title: "Guide", body: { kind: "react", render: () => null } });
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    const item: PlacementItem = {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "guide" }],
        view: { kind: "view", id: "guide" },
        cardinality: "many",
        add: { kind: "command", target: { command: { kind: "command", id: "open-guide" }, params: args } },
      },
    };
    const placement = { id: "guide", region: "side" as const, item };
    if (owner === "shell") workbench.shellPlacements.registerPlacement(placement);
    if (owner === "mode") {
      workbench.modePlacements.registerPlacement({
        ...placement,
        ref: { extensionId: "test", kind: "placement", id: "guide" },
        modeId: "project",
      });
    }
    const page = { extensionId: "test", kind: "page" as const, id: "start" };
    workbench.pages.registerPage({
      id: "start",
      ref: page,
      path: "",
      modeId: "project",
      main: { kind: "view", view: { kind: "view", id: "guide" }, cardinality: "one" },
      slots: owner === "page" ? [placement] : [],
    });
    workbench.pageLocations.setProject("storybook");
    workbench.pageLocations.navigate({ kind: "page", page });
    const addable = () => workbench.composition.panelsFor("side").addable;
    expect(addable()).toHaveLength(1);
    enabled = false;
    expect(addable()).toHaveLength(0);
    enabled = true;
    visible = false;
    expect(addable()).toHaveLength(0);
    visible = true;
    workbench.context.set("guidesAvailable", false);
    expect(addable()).toHaveLength(0);
    workbench.context.set("guidesAvailable", true);
    expect(addable()).toHaveLength(1);
  });
});
