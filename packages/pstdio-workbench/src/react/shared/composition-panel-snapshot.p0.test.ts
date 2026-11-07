import { expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { createCompositionPanelSnapshot } from "./composition-panel-snapshot";

const fixture = (isEnabled = () => true) => {
  const workbench = createWorkbench();
  workbench.commands.registerCommand(
    { id: "create-tool", label: "New tool", when: "tools.available" },
    { execute: () => undefined, isEnabled },
  );
  workbench.context.set("tools.available", true);
  workbench.views.registerView({ id: "tool", title: "Tool", body: { kind: "react", render: () => null } });
  workbench.modes.registerMode({ id: "project", activate() {} });
  workbench.shellPlacements.registerPlacement({
    id: "tool",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "tool" }],
        view: { kind: "view", id: "tool" },
        cardinality: "many",
        add: { kind: "command", target: { command: { kind: "command", id: "create-tool" } } },
      },
    },
  });
  workbench.modes.setActiveMode("project");
  return workbench;
};

test("unchanged panel choices keep one snapshot through unrelated layout and context updates", () => {
  const workbench = fixture();
  const reader = createCompositionPanelSnapshot(workbench, "side");
  const first = reader.read();
  expect(first.addable.map((choice) => choice.contribution.title)).toContain("New tool");
  expect(reader.read()).toBe(first);
  workbench.shell.setRegionOpen("secondary", true);
  workbench.context.set("unrelated.value", 1);
  expect(reader.read()).toBe(first);
});

test("panel availability still follows current command context", () => {
  const workbench = fixture();
  const reader = createCompositionPanelSnapshot(workbench, "side");
  expect(reader.read().addable).toHaveLength(1);
  workbench.context.set("tools.available", false);
  expect(reader.read().addable).toHaveLength(0);
  workbench.context.set("tools.available", true);
  expect(reader.read().addable).toHaveLength(1);
});

test("an explicit render refresh observes live provider availability without a store write", () => {
  let enabled = true;
  const workbench = fixture(() => enabled);
  const reader = createCompositionPanelSnapshot(workbench, "side");
  expect(reader.read().addable).toHaveLength(1);
  enabled = false;
  reader.refresh();
  expect(reader.read().addable).toHaveLength(0);
  enabled = true;
  reader.refresh();
  expect(reader.read().addable).toHaveLength(1);
});
