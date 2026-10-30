import { describe, expect, test } from "bun:test";
import { createContextKeyService } from "../../shared/context/context-key-service";
import { createWorkbench } from "../../workbench-core";
import { createCommandRegistry } from "../commands/command-registry";
import { createKeybindingRegistry } from "./keybinding-registry";

test("direct input dispatch does not enumerate unassigned navigation actions", () => {
  const commands = createCommandRegistry();
  commands.registerCommand({ id: "direct", label: "Direct" }, { execute() {} });
  const keybindings = createKeybindingRegistry({
    commands,
    context: createContextKeyService(),
    actions: () => {
      throw new Error("Navigation discovery is not needed to dispatch an assigned chord");
    },
  });
  keybindings.registerKeybinding({ action: { kind: "command", commandId: "direct" }, keybinding: "Alt+J" });
  expect(keybindings.listActiveKeybindings()).toMatchObject([{ keybinding: "Alt+J" }]);
});

test("assigning a chord makes a discovered command active without an explicit binding", async () => {
  const core = createWorkbench();
  core.commands.registerCommand({ id: "discovered", label: "Discovered" }, { execute() {} });
  expect(core.keybindings.listActiveKeybindings().some((binding) => binding.id === "discovered")).toBe(false);
  await core.keyboard.setAssignment("discovered", { layer: "direct", keybinding: "Alt+J" });
  expect(core.keybindings.listActiveKeybindings()).toContainEqual(
    expect.objectContaining({ id: "discovered", keybinding: "Alt+J" }),
  );
});

test("extension navigation actions retain their owner in the shortcut catalog", () => {
  const core = createWorkbench();
  core.navigationTrees.registerContribution({
    id: "links",
    owner: { kind: "mode", id: "project", extensionId: "pstdio" },
    sourceExtensionId: "acme.links",
    declarationIndex: 0,
    getSections: () => [],
    listActions: () => [{ label: "Open tools", action: { kind: "href", href: "https://example.com" } }],
  });
  expect(core.keyboard.catalog().find((entry) => entry.label === "Open tools")?.binding.sourceExtensionId).toBe(
    "acme.links",
  );
});

describe("createKeybindingRegistry", () => {
  test("menu aliases share the source action's catalog entry", () => {
    const commands = createCommandRegistry();
    const context = createContextKeyService();
    commands.registerCommand({ id: "greet", label: "Greeting" }, { execute() {} });
    commands.registerCommand({ id: "palette-greet", label: "Greeting" }, { execute() {} });
    const keybindings = createKeybindingRegistry({
      commands,
      context,
      actions: () => [
        {
          label: "Greeting",
          ownerId: "test",
          aliasCommandId: "palette-greet",
          action: { kind: "command", commandId: "greet" },
        },
      ],
    });
    keybindings.registerKeybinding({ action: { kind: "command", commandId: "greet" }, keybinding: "Alt+G" });
    expect(keybindings.listCatalog()).toHaveLength(1);
  });
  test("registers keybindings against commands and filters by context", () => {
    const commands = createCommandRegistry();
    const context = createContextKeyService();
    const keybindings = createKeybindingRegistry({ commands, context });

    commands.registerCommand({ id: "resource.open", label: "Open Resource" }, { execute: () => undefined });
    keybindings.registerKeybinding({
      action: { kind: "command", commandId: "resource.open" },
      keybinding: "enter",
      when: "resourceSelected && !inputFocus",
    });

    context.set("resourceSelected", true);
    context.set("inputFocus", false);

    expect(keybindings.listActiveKeybindings()).toMatchObject([
      { action: { kind: "command", commandId: "resource.open" }, keybinding: "enter" },
    ]);
  });

  test("expands whitespace-delimited keybinding chords", () => {
    const commands = createCommandRegistry();
    const context = createContextKeyService();
    const keybindings = createKeybindingRegistry({ commands, context });

    commands.registerCommand({ id: "sessions.new", label: "New Session" }, { execute: () => undefined });
    keybindings.registerKeybinding({
      action: { kind: "command", commandId: "sessions.new" },
      keybinding: "Ctrl+Shift+S N",
    });

    expect(keybindings.listKeybindings()).toMatchObject([
      { action: { kind: "command", commandId: "sessions.new" }, keybinding: ["Ctrl+Shift+S", "N"] },
    ]);
  });

  test("rejects keybindings for unknown commands", () => {
    const commands = createCommandRegistry();
    const context = createContextKeyService();
    const keybindings = createKeybindingRegistry({ commands, context });

    expect(() =>
      keybindings.registerKeybinding({ action: { kind: "command", commandId: "missing" }, keybinding: "mod+k" }),
    ).toThrow("Keybinding command not registered: missing");
  });
});
