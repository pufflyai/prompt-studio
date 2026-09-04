import { describe, expect, test } from "bun:test";
import type { ExtensionKeybindingRecord } from "pstdio-api-contracts";
import { createWorkbench } from "../../core";
import {
  registerWorkbenchExtensionKeybindings,
  resolveExtensionKeybindingChord,
} from "./workbench-extension-keybindings";

const binding = {
  id: "pstdio.lab.keybinding.hello",
  extensionId: "pstdio.lab",
  action: {
    kind: "command" as const,
    target: {
      command: { extensionId: "pstdio.lab", kind: "command" as const, id: "hello" },
      params: { greeting: "hello" },
    },
  },
  key: "mod+h",
  canonicalChord: "Mod+H",
  parsed: { key: "H", ctrl: false, shift: false, alt: false, meta: true, modifiers: ["Meta"] },
  platformOverrides: { mac: "cmd+shift+h", linux: "ctrl+shift+h" },
  when: { mode: "pstdio.lab.mode.lab" },
} satisfies ExtensionKeybindingRecord;

describe("extension keybindings", () => {
  test("uses a platform override when one is defined", () => {
    expect(resolveExtensionKeybindingChord(binding, "mac")).toBe("cmd+shift+h");
    expect(resolveExtensionKeybindingChord(binding, "linux")).toBe("ctrl+shift+h");
    expect(resolveExtensionKeybindingChord(binding, "win")).toBe("mod+h");
  });

  test("registers the command, context, and arguments with the workbench", () => {
    const workbench = createWorkbench();
    workbench.commands.registerCommand(
      { id: "pstdio.lab.command.hello", label: "Hello" },
      { execute: () => undefined },
    );

    registerWorkbenchExtensionKeybindings({
      bindings: [binding],
      createWhenExpression: (when) => (when?.mode ? `activeWorkbenchMode == ${when.mode}` : undefined),
      workbench,
    });

    expect(workbench.keybindings.listKeybindings()).toContainEqual(
      expect.objectContaining({
        action: {
          kind: "command",
          commandId: "pstdio.lab.command.hello",
          args: { greeting: "hello" },
        },
        keybinding: expect.any(String),
        when: "activeWorkbenchMode == pstdio.lab.mode.lab",
      }),
    );
  });
});
