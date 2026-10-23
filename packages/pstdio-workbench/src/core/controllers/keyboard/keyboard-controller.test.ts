import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

const setup = () => {
  const core = createWorkbench({ initialSidePanelMode: "attached" });
  core.modes.registerMode({ id: "keyboard-test", activate() {} });
  core.modes.setActiveMode("keyboard-test");
  core.layout.registerWidget({
    id: "ticket",
    title: "Ticket",
    region: "main",
    rendererId: "test",
    closable: true,
    singleton: false,
    reuse: "none",
  });
  const ticket = (id: string, region: "main" | "secondary" | "side" = "main") => {
    core.layout.setRegionVisible(region, true);
    return core.layout.openWidget("ticket", {
      region,
      role: "location",
      tabRetention: "persistent",
      resource: { type: "ticket", id, label: id },
    });
  };
  return { core, ticket };
};

test("direct shortcuts preserve the live view and resource context", () => {
  const { core } = setup();
  core.context.set("workbench.view.id", "ticket-editor");
  core.context.set("workbench.resource.type", "ticket");
  core.commands.registerCommand({ id: "contextual-direct", label: "Direct" }, { execute() {} });
  core.keybindings.registerKeybinding({
    id: "contextual-direct",
    action: { kind: "command", commandId: "contextual-direct" },
    keybinding: "Alt+K",
    when: 'workbench.view.id == "ticket-editor" && workbench.resource.type == "ticket"',
  });
  expect(core.keyboard.catalog().find((entry) => entry.id === "contextual-direct")?.disabled).toBe(false);
});

test("layer-only assignments validate the retained direct chord", async () => {
  const { core } = setup();
  core.commands.registerCommand({ id: "direct", label: "Direct" }, { execute() {} });
  core.keybindings.registerKeybinding({
    id: "direct",
    action: { kind: "command", commandId: "direct" },
    keybinding: "Alt+K",
  });
  await expect(core.keyboard.setAssignment("direct", { layer: "go" })).rejects.toThrow("Layer shortcuts");
  expect(core.keyboard.getAssignment("direct")).toBeUndefined();
});

test("catalog observers refresh when menus or navigation action contributions change", () => {
  const { core } = setup();
  core.commands.registerCommand({ id: "known", label: "Known" }, { execute() {} });
  let updates = 0;
  core.keyboard.store.subscribe(() => {
    updates++;
  });
  core.layout.registerMenuItem(["test"], { commandId: "known" });
  expect(updates).toBeGreaterThan(0);
  updates = 0;
  core.navigationTrees.registerContribution({
    id: "late",
    owner: { kind: "mode", id: "keyboard-test", extensionId: "test" },
    sourceExtensionId: "test",
    declarationIndex: 0,
    getSections: () => [],
    listActions: () => [{ label: "Known", action: { kind: "command", commandId: "known" } }],
  });
  expect(updates).toBeGreaterThan(0);
});

test("Current view selects between resources in every visible panel instead of using focus", async () => {
  const { core, ticket } = setup();
  ticket("A");
  ticket("B", "secondary");
  const changed: string[] = [];
  core.commands.registerCommand(
    { id: "ticket.status", label: "Change ticket status" },
    {
      execute: (_args, context) => {
        changed.push(context?.resource?.id ?? "missing");
      },
    },
  );
  core.keybindings.registerKeybinding({
    id: "ticket-status",
    action: { kind: "command", commandId: "ticket.status" },
    keybinding: "S",
    layer: "current",
    targetScope: "resource",
  });
  core.keyboard.open();
  await core.keyboard.press("a");
  await core.keyboard.press("s");
  expect(changed).toEqual([]);
  expect(core.keyboard.store.getState().selection?.choices).toHaveLength(2);
  await core.keyboard.choose("2");
  expect(changed).toEqual(["B"]);
  expect(core.keyboard.store.getState().active).toBe(false);
});

test("same-resource mutations run once, while panel-local actions keep distinct targets", async () => {
  const { core, ticket } = setup();
  ticket("A");
  ticket("A", "secondary");
  let calls = 0;
  core.commands.registerCommand(
    { id: "ticket.status", label: "Status" },
    {
      execute: () => {
        calls++;
      },
    },
  );
  core.keybindings.registerKeybinding({
    id: "status",
    action: { kind: "command", commandId: "ticket.status" },
    keybinding: "S",
    layer: "current",
    targetScope: "resource",
  });
  core.keybindings.registerKeybinding({
    id: "panel",
    action: { kind: "command", commandId: "ticket.status" },
    keybinding: "P",
    layer: "current",
    targetScope: "panel",
  });
  core.keyboard.open();
  await core.keyboard.press("a");
  await core.keyboard.press("s");
  expect(calls).toBe(1);
  core.keyboard.open();
  await core.keyboard.press("a");
  await core.keyboard.press("p");
  expect(core.keyboard.store.getState().selection?.choices).toHaveLength(2);
});

test("selectors freeze identities and never transfer a disappearing target's key", async () => {
  const { core, ticket } = setup();
  ticket("A");
  const removed = ticket("B", "secondary");
  const changed: string[] = [];
  core.commands.registerCommand(
    { id: "status", label: "Status" },
    {
      execute: (_args, context) => {
        changed.push(context?.resource?.id ?? "");
      },
    },
  );
  core.keybindings.registerKeybinding({
    id: "status",
    action: { kind: "command", commandId: "status" },
    keybinding: "S",
    layer: "current",
    targetScope: "resource",
  });
  core.keyboard.open();
  await core.keyboard.press("a");
  await core.keyboard.press("s");
  core.layout.closeWidget(removed.widgetId);
  ticket("C", "secondary");
  await core.keyboard.choose("2");
  expect(changed).toEqual([]);
  expect(core.keyboard.store.getState().message).toContain("available");
});

test("global numbers follow spatial placement and compact after moves and closure", () => {
  const { core, ticket } = setup();
  const a = ticket("A");
  const b = ticket("B");
  ticket("C", "secondary");
  ticket("D", "side");
  expect(core.keyboard.listTabs().map((tab) => tab.resource?.id)).toEqual(["A", "B", "D", "C"]);
  core.layout.closeWidget(a.widgetId);
  expect(core.keyboard.listTabs().map((tab) => tab.number)).toEqual([1, 2, 3]);
  core.movePanel(b.widgetId, "side");
  expect(core.keyboard.listTabs().map((tab) => tab.resource?.id)).toEqual(["D", "B", "C"]);
});

test("navigation stays sticky and direct selection outside mode stays outside", async () => {
  const { core, ticket } = setup();
  ticket("A");
  ticket("B", "secondary");
  await core.keyboard.selectTab(2);
  expect(core.keyboard.store.getState().active).toBe(false);
  core.keyboard.open();
  await core.keyboard.press("ArrowRight");
  expect(core.layout.getLayout().activeWidgetId).toBe(core.keyboard.listTabs()[0]?.id);
  expect(core.keyboard.store.getState().active).toBe(true);
  await core.keyboard.press("ArrowLeft");
  expect(core.keyboard.store.getState().selectedRegion).toBe("secondary");
  await core.keyboard.press("Enter");
  expect(core.keyboard.store.getState().active).toBe(false);
  expect(core.focus.getActiveRegion()).toBe("secondary");
});

test("any contributed shortcut can declare sticky behavior", async () => {
  const { core } = setup();
  let calls = 0;
  core.commands.registerCommand(
    { id: "test", label: "Test" },
    {
      execute: () => {
        calls++;
      },
    },
  );
  core.keybindings.registerKeybinding({
    id: "sticky",
    action: { kind: "command", commandId: "test" },
    layer: "help",
    keybinding: "T",
    sticky: true,
  });
  core.keyboard.open();
  await core.keyboard.press("h");
  await core.keyboard.press("t");
  await core.keyboard.press("t");
  expect(calls).toBe(2);
  expect(core.keyboard.store.getState().active).toBe(true);
  await core.keyboard.press("Escape");
  expect(core.keyboard.store.getState().active).toBe(false);
});

test("user bindings persist through the preference adapter and reset removes the override", async () => {
  const values = new Map<string, import("../../registries/preferences/preference-registry").PreferenceValue>();
  const persistence = {
    getValue: (key: string) => values.get(key),
    setValue: (key: string, value: import("../../registries/preferences/preference-registry").PreferenceValue) => {
      values.set(key, value);
    },
  };
  const first = createWorkbench({ preferencePersistence: persistence });
  await first.keyboard.setAssignment("test", { keybinding: "U" });
  const second = createWorkbench({ preferencePersistence: persistence });
  expect(second.keyboard.getAssignment("test")).toEqual({ keybinding: "U" });
  await second.keyboard.resetAssignment("test");
  expect(second.keyboard.getAssignment("test")).toBeUndefined();
});

test("rebinding rejects direct collisions and prefix aliases without changing saved values", async () => {
  const { core } = setup();
  await expect(
    core.keyboard.setAssignment("workbench.keyboard.tab.1", { keybinding: "Alt+Shift+Space" }),
  ).rejects.toThrow("assigned");
  expect(core.keyboard.getAssignment("workbench.keyboard.tab.1")).toBeUndefined();
  await core.keyboard.setAlias("one", "P");
  await expect(core.keyboard.setAlias("two", "PL")).rejects.toThrow("prefix");
});

test("move flow changes nothing until a destination is selected and preserves presentation identity", async () => {
  const { core, ticket } = setup();
  const original = ticket("A");
  ticket("B", "secondary");
  core.keyboard.open();
  await core.keyboard.press("v");
  await core.keyboard.press("o");
  expect(core.keyboard.store.getState().selection?.choices).toHaveLength(2);
  await core.keyboard.choose("1");
  expect(core.keyboard.listTabs().find((tab) => tab.id === original.widgetId)?.region).toBe("main");
  core.keyboard.finish();
  expect(core.keyboard.listTabs().find((tab) => tab.id === original.widgetId)?.region).toBe("main");
  core.keyboard.open();
  await core.keyboard.press("v");
  await core.keyboard.press("o");
  await core.keyboard.choose("1");
  await core.keyboard.choose("1");
  expect(core.keyboard.listTabs().find((tab) => tab.id === original.widgetId)?.region).toBe("secondary");
});

test("hints match typed arguments and show the remaining layer path", async () => {
  const { core } = setup();
  core.commands.registerCommand({ id: "open", label: "Open" }, { execute() {} });
  core.keybindings.registerKeybinding({
    action: { kind: "command", commandId: "open", args: { id: "one" } },
    keybinding: "P",
    layer: "go",
    sticky: true,
  });
  core.keyboard.open();
  expect(core.keyboard.hint({ kind: "command", commandId: "open", args: { id: "two" } })).toBeUndefined();
  expect(core.keyboard.hint({ kind: "command", commandId: "open", args: { id: "one" } })).toBe("G → P");
  await core.keyboard.press("g");
  expect(core.keyboard.hint({ kind: "command", commandId: "open", args: { id: "one" } })).toBe("P");
});

test("current action resolves hidden resource parameters from the chosen target", async () => {
  const { core, ticket } = setup();
  ticket("A");
  ticket("B", "secondary");
  let changed: unknown;
  core.commands.registerCommand(
    { id: "rename", label: "Rename", params: { ticketId: { type: "string", resolvedFrom: "resource" } } },
    {
      execute: (args) => {
        changed = args;
      },
    },
  );
  core.keybindings.registerKeybinding({
    action: { kind: "command", commandId: "rename" },
    layer: "current",
    keybinding: "R",
    targetScope: "resource",
  });
  core.keyboard.open();
  await core.keyboard.press("a");
  await core.keyboard.press("r");
  await core.keyboard.choose("2");
  expect(changed).toEqual({ ticketId: "B" });
});

test("target availability receives the same resolved resource arguments as execution", async () => {
  const { core, ticket } = setup();
  ticket("A");
  ticket("B", "secondary");
  let changed: unknown;
  core.commands.registerCommand(
    { id: "scoped-rename", label: "Rename", params: { ticketId: { type: "string", resolvedFrom: "resource" } } },
    {
      isEnabled: (args: { ticketId?: string } | undefined) => args?.ticketId === "B",
      execute: (args) => {
        changed = args;
      },
    },
  );
  core.keybindings.registerKeybinding({
    action: { kind: "command", commandId: "scoped-rename" },
    layer: "current",
    keybinding: "R",
    targetScope: "resource",
  });
  core.keyboard.open();
  await core.keyboard.press("a");
  await core.keyboard.press("r");
  expect(changed).toEqual({ ticketId: "B" });
});

test("matching action contributions combine their visible targets before resolving ambiguity", async () => {
  const { core, ticket } = setup();
  ticket("A");
  ticket("B", "secondary");
  let calls = 0;
  core.commands.registerCommand(
    { id: "same", label: "Same action" },
    {
      execute: () => {
        calls++;
      },
    },
  );
  for (const id of ["A", "B"])
    core.keybindings.registerKeybinding({
      id,
      action: { kind: "command", commandId: "same" },
      keybinding: "S",
      layer: "current",
      targetScope: "resource",
      when: `workbench.resource.id == '${id}'`,
    });
  core.keyboard.open();
  await core.keyboard.press("a");
  await core.keyboard.press("s");
  expect(calls).toBe(0);
  expect(core.keyboard.store.getState().selection?.choices).toHaveLength(2);
});

test("disabling an arrow shortcut stops its execution in keyboard mode", async () => {
  const { core, ticket } = setup();
  ticket("A");
  ticket("B");
  core.keyboard.open();
  const before = core.keyboard.store.getState().selectedId;
  await core.keyboard.setAssignment("workbench.keyboard.ArrowRight", { disabled: true });
  await core.keyboard.press("ArrowRight");
  expect(core.keyboard.store.getState().selectedId).toBe(before);
});

test("panel focus can select a single view that has no numbered tab", () => {
  const { core } = setup();
  core.layout.registerWidget({
    id: "single",
    title: "Single view",
    region: "main",
    rendererId: "test",
    closable: false,
  });
  const single = core.layout.openWidget("single", { role: "location" });
  expect(core.keyboard.listTabs()).toHaveLength(0);
  core.keyboard.open();
  core.keyboard.selectPresentation(single.widgetId);
  expect(core.keyboard.store.getState().selectedId).toBe(single.widgetId);
  expect(core.keyboard.store.getState().active).toBe(true);
});

test("Current view follows rendered visibility when a menu collapses responsively", () => {
  const { core, ticket } = setup();
  const a = ticket("A");
  const b = ticket("B", "secondary");
  let visible = true;
  core.keyboard.registerVisibleRegion("main", () => [a.widgetId]);
  const registration = core.keyboard.registerVisibleRegion("secondary", () => (visible ? [b.widgetId] : []));
  expect(core.keyboard.visibleTargets().map((target) => target.id)).toContain(b.widgetId);
  visible = false;
  expect(core.keyboard.visibleTargets().map((target) => target.id)).toEqual([a.widgetId]);
  registration.dispose();
});

test("panel focus remains sticky and one-shot selector commands preserve their Back layer", async () => {
  const { core, ticket } = setup();
  ticket("A");
  ticket("B", "secondary");
  core.keyboard.open();
  await core.keyboard.press("v");
  await core.keyboard.press("f");
  await core.keyboard.choose("2");
  expect(core.keyboard.store.getState().active).toBe(true);
  expect(core.keyboard.store.getState().selectedRegion).toBe("secondary");
  await core.keyboard.press("o");
  core.keyboard.back();
  expect(core.keyboard.store.getState().path).toEqual(["V"]);
  expect(core.keyboard.catalog().find((entry) => entry.id === "workbench.keyboard.moveTab")?.binding.sticky).toBe(
    false,
  );
});

test("layer assignments reject strict prefixes while keeping exact-key conflicts available", async () => {
  const { core } = setup();
  for (const id of ["short", "long"]) core.commands.registerCommand({ id, label: id }, { execute() {} });
  core.keybindings.registerKeybinding({
    id: "short",
    sourceExtensionId: "one",
    action: { kind: "command", commandId: "short" },
    layer: "help",
    keybinding: "Q",
  });
  core.keybindings.registerKeybinding({
    id: "long",
    sourceExtensionId: "two",
    action: { kind: "command", commandId: "long" },
    layer: "help",
    keybinding: "Z",
  });
  await expect(core.keyboard.setAssignment("long", { keybinding: "Q S" })).rejects.toThrow("prefix");
  await core.keyboard.setAssignment("long", { keybinding: "Q" });
  expect(core.keyboard.getAssignment("long")?.keybinding).toBe("Q");
});

test("contributed terminal and longer paths require an explicit action choice", async () => {
  const { core } = setup();
  const calls: string[] = [];
  for (const [id, keybinding] of [
    ["short", "Q"],
    ["long", "Q S"],
  ]) {
    core.commands.registerCommand(
      { id: id!, label: id! },
      {
        execute() {
          calls.push(id!);
        },
      },
    );
    core.keybindings.registerKeybinding({
      action: { kind: "command", commandId: id! },
      layer: "help",
      keybinding: keybinding!,
    });
  }
  core.keyboard.open();
  await core.keyboard.press("h");
  await core.keyboard.press("q");
  expect(calls).toEqual([]);
  expect(core.keyboard.store.getState().selection?.title).toBe("Choose action");
  await core.keyboard.choose("2");
  expect(calls).toEqual(["long"]);
});

test("directional panel navigation lands on Secondary's selected presentation and stays active", async () => {
  const { core, ticket } = setup();
  const main = ticket("A");
  ticket("B", "secondary");
  const secondary = ticket("C", "secondary");
  core.keyboard.open();
  core.keyboard.selectPresentation(main.widgetId);
  await core.keyboard.press("v");
  await core.keyboard.press("d");
  expect(core.keyboard.store.getState().selectedId).toBe(secondary.widgetId);
  expect(core.keyboard.store.getState().active).toBe(true);
  expect(core.commands.isCommandEnabled("workbench.keyboard.focus.down")).toBe(false);
});

test("panel directions refresh when discovery selects the active Secondary tab", async () => {
  const { core, ticket } = setup();
  ticket("A");
  ticket("B", "secondary");
  core.keyboard.catalog();
  core.keyboard.open();
  await core.keyboard.press("V");
  expect(core.keyboard.entries().some((entry) => entry.key === "U")).toBe(true);
  expect(core.keyboard.entries().some((entry) => entry.key === "D")).toBe(false);
});

test("pin selector toggles retention without reordering the tab", async () => {
  const { core, ticket } = setup();
  const tab = ticket("A");
  core.keyboard.open();
  await core.keyboard.press("v");
  await core.keyboard.press("p");
  await core.keyboard.choose("1");
  expect(core.keyboard.listTabs()[0]?.id).toBe(tab.widgetId);
  expect(core.keyboard.listTabs()[0]?.tabRetention).toBe("preview");
  expect(core.keyboard.store.getState().active).toBe(false);
});
