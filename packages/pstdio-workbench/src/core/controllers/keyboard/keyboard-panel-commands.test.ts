import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

test.each([
  "closeTab",
  "pinTab",
  "moveTab",
])("%s rejects a resource replacement with the same local id", async (command) => {
  const core = createWorkbench();
  core.layout.registerWidget({ id: "tool", title: "Tool", region: "main", rendererId: "test", closable: true });
  const tab = core.layout.openWidget("tool", {
    region: "main",
    tabRetention: "persistent",
    resource: { type: "ticket", id: "same", extensionId: "planner" },
  });
  await core.commands.executeCommand(`workbench.keyboard.${command}`);
  if (command === "moveTab") await core.keyboard.choose("1");
  core.layout.updatePanel(tab.widgetId, { resource: { type: "note", id: "same", extensionId: "notes" } });
  await core.keyboard.choose("1");
  expect(core.layout.getLayout().regions.main.widgets).toHaveLength(1);
  expect(core.layout.getLayout().regions.main.widgets[0]?.tabRetention).toBe("persistent");
  expect(core.keyboard.store.getState().message).toBe("This tab is no longer available.");
});

test("typed New Session finds owned binding panels and runs their normal add action", async () => {
  const core = createWorkbench();
  let created = 0;
  core.commands.registerCommand(
    { id: "new-session", label: "New session" },
    {
      execute() {
        created++;
      },
    },
  );
  core.views.registerView({ id: "session", title: "Session", body: { kind: "react", render: () => null } });
  core.shellPlacements.registerPlacement({
    id: "sessions",
    region: "main",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "session-draft" }],
        view: { kind: "view", id: "session" },
        cardinality: "many",
        add: { kind: "command", target: { command: { kind: "command", id: "new-session" } } },
      },
    },
  });
  await core.commands.executeCommand("workbench.keyboard.newTab", { resourceKind: "session-draft" });
  expect(core.keyboard.store.getState().selection?.choices.length).toBeGreaterThan(0);
  await core.keyboard.choose("1");
  await core.keyboard.choose("1");
  expect(created).toBe(1);
});

test("close picks the visible instance of a contribution that has several tabs", async () => {
  const core = createWorkbench();
  core.layout.registerWidget({
    id: "tool",
    title: "Tool",
    region: "main",
    rendererId: "test",
    closable: true,
    singleton: false,
    reuse: "none",
  });
  const first = core.layout.openWidget("tool", { region: "main" });
  const second = core.layout.openWidget("tool", { region: "main" });
  await core.commands.executeCommand("workbench.keyboard.closeTab");
  expect(core.keyboard.store.getState().selection?.choices).toHaveLength(1);
  await core.keyboard.choose("1");
  expect(core.layout.getLayout().regions.main.widgets.map((tab) => tab.widgetId)).toEqual([first.widgetId]);
  expect(second.widgetId).not.toBe(first.widgetId);
});

test("move accepts a visible single-view panel without numbered tabs", async () => {
  const core = createWorkbench();
  core.layout.registerWidget({ id: "tool", title: "Tool", region: "main", rendererId: "test", closable: false });
  const tab = core.layout.openWidget("tool", { region: "main" });
  expect(core.keyboard.listTabs()).toHaveLength(0);
  await core.commands.executeCommand("workbench.keyboard.moveTab");
  await core.keyboard.choose("1");
  await core.keyboard.choose("1");
  expect(core.keyboard.visibleTargets().find((target) => target.id === tab.widgetId)?.region).toBe("secondary");
});
