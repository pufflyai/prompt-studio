import { describe, expect, test } from "bun:test";
import { createContextKeyService } from "../../shared/context/context-key-service";
import { createCommandRegistry } from "../commands/command-registry";
import { createKeybindingRegistry } from "./keybinding-registry";

describe("createKeybindingRegistry", () => {
  test("registers keybindings against commands and filters by context", () => {
    const commands = createCommandRegistry();
    const context = createContextKeyService();
    const keybindings = createKeybindingRegistry({ commands, context });

    commands.registerCommand({ id: "resource.open", label: "Open Resource" }, { execute: () => undefined });
    keybindings.registerKeybinding({
      commandId: "resource.open",
      keybinding: "enter",
      when: "resourceSelected && !inputFocus",
    });

    context.set("resourceSelected", true);
    context.set("inputFocus", false);

    expect(keybindings.listActiveKeybindings()).toMatchObject([{ commandId: "resource.open", keybinding: "enter" }]);
  });

  test("rejects keybindings for unknown commands", () => {
    const commands = createCommandRegistry();
    const context = createContextKeyService();
    const keybindings = createKeybindingRegistry({ commands, context });

    expect(() => keybindings.registerKeybinding({ commandId: "missing", keybinding: "mod+k" })).toThrow(
      "Keybinding command not registered: missing",
    );
  });
});
