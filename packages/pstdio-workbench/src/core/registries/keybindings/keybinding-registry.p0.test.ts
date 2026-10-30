import { describe, expect, test } from "bun:test";
import { createContextKeyService } from "../../shared/context/context-key-service";
import { createWorkbench } from "../../workbench-core";
import { createCommandRegistry } from "../commands/command-registry";
import { createKeybindingRegistry } from "./keybinding-registry";

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

test("only chords holding Alt, Ctrl or Cmd work while typing", () => {
  const core = createWorkbench();
  for (const [id, keybinding] of [
    ["plain", "F2"],
    ["shifted", "Shift+J"],
    ["held", "Alt+Shift+J"],
    ["command", "Mod+J"],
  ] as const) {
    core.commands.registerCommand({ id, label: id }, { execute() {} });
    core.keybindings.registerKeybinding({
      id,
      action: { kind: "command", commandId: id },
      keybinding,
      allowInInputs: true,
    });
  }
  const typing = Object.fromEntries(
    core.keybindings
      .listActiveKeybindings()
      .filter((binding) => ["plain", "shifted", "held", "command"].includes(binding.id!))
      .map((binding) => [binding.id, Boolean(binding.allowInInputs)]),
  );
  expect(typing).toEqual({ plain: false, shifted: false, held: true, command: true });
});
