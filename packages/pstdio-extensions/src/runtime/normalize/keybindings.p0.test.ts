import { describe, expect, test } from "bun:test";
import { defineCommand, defineExtension, defineKeybinding } from "@pstdio/sdk/extensions";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const source = (definition: LoadedExtensionSource["definition"]): LoadedExtensionSource => ({
  packagePath: "/fake/lab",
  sourcePath: "/fake/lab/extension.ts",
  sourceKind: "local_path",
  manifest: {
    id: "pstdio.lab",
    name: "lab",
    version: "1.0.0",
    publisher: "pstdio",
    main: "./extension.ts",
    enginesPstdio: "^0.1.0",
  },
  definition,
});

describe("normalizeExtensionSources keybindings", () => {
  test("validates every layered platform override", () => {
    const command = defineCommand({ id: "hello", title: "Hello", async run() {} });
    const definition = defineExtension({
      commands: [command],
      keybindings: [
        defineKeybinding({
          id: "layer",
          layer: "go",
          key: "P",
          mac: "Ctrl+K",
          action: { kind: "command", target: { command: command.ref } },
        }),
      ],
    });
    const runtime = normalizeExtensionSources([source(definition)]);
    expect(runtime.keybindings).toHaveLength(0);
    expect(runtime.diagnostics).toContainEqual(expect.objectContaining({ code: "invalid_keybinding" }));
  });
  test("normalizes typed command refs and canonical chords", () => {
    const command = defineCommand({ id: "hello", title: "Hello", async run() {} });
    const definition = defineExtension({
      commands: [command],
      keybindings: [
        defineKeybinding({
          id: "hello",
          key: "mod+shift+h",
          action: { kind: "command", target: { command: command.ref } },
        }),
      ],
    });

    const runtime = normalizeExtensionSources([source(definition)]);

    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.keybindings[0]).toMatchObject({
      id: "pstdio.lab.keybinding.hello",
      action: {
        kind: "command",
        target: { command: { extensionId: "pstdio.lab", kind: "command", id: "hello" } },
      },
      canonicalChord: "Mod+Shift+H",
    });
  });

  test("drops direct keys that type text and keeps them in shortcut-mode layers", () => {
    const command = defineCommand({ id: "hello", title: "Hello", async run() {} });
    const action = { kind: "command" as const, target: { command: command.ref } };
    const definition = defineExtension({
      commands: [command],
      keybindings: [
        defineKeybinding({ id: "letter", key: "E", action }),
        defineKeybinding({ id: "shifted", key: "Shift+/", action }),
        defineKeybinding({ id: "override", key: "Mod+E", win: "Shift+E", action }),
        defineKeybinding({ id: "sequence", key: "G H", action }),
        defineKeybinding({ id: "physical", key: "Shift+[Slash]", action }),
        defineKeybinding({ id: "layered", key: "E", layer: "go", action }),
        defineKeybinding({ id: "chord", key: "Mod+/", action }),
        defineKeybinding({ id: "physical-chord", key: "Mod+[KeyS]", action }),
      ],
    });
    const runtime = normalizeExtensionSources([source(definition)]);
    expect(runtime.keybindings.map((binding) => binding.localId)).toEqual(["layered", "chord", "physical-chord"]);
    expect(
      runtime.diagnostics.filter((entry) => entry.code === "invalid_keybinding").map((entry) => entry.metadata),
    ).toEqual([
      expect.objectContaining({ contributionId: "pstdio.lab.keybinding.letter" }),
      expect.objectContaining({ contributionId: "pstdio.lab.keybinding.shifted" }),
      expect.objectContaining({ contributionId: "pstdio.lab.keybinding.override", field: "win" }),
      expect.objectContaining({ contributionId: "pstdio.lab.keybinding.sequence" }),
      expect.objectContaining({ contributionId: "pstdio.lab.keybinding.physical" }),
    ]);
  });

  test("named keys in any case reach the host in the case the shortcut matcher recognizes", () => {
    const command = defineCommand({ id: "hello", title: "Hello", async run() {} });
    const definition = defineExtension({
      commands: [command],
      keybindings: [
        defineKeybinding({
          id: "back",
          key: "alt+shift+arrowleft",
          win: "ctrl+alt+f2",
          action: { kind: "command", target: { command: command.ref } },
        }),
        defineKeybinding({
          id: "close",
          key: "Mod+Esc",
          linux: "Alt+Shift+Up",
          action: { kind: "command", target: { command: command.ref } },
        }),
      ],
    });
    const runtime = normalizeExtensionSources([source(definition)]);
    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.keybindings.map((binding) => binding.contribution)).toEqual([
      expect.objectContaining({ key: "alt+shift+ArrowLeft", win: "ctrl+alt+F2" }),
      expect.objectContaining({ key: "Mod+Escape", linux: "Alt+Shift+ArrowUp" }),
    ]);
  });

  test("keeps the first binding when two chords and contexts are equal", () => {
    const command = defineCommand({ id: "hello", title: "Hello", async run() {} });
    const definition = defineExtension({
      commands: [command],
      keybindings: [
        defineKeybinding({ id: "first", key: "cmd+P", action: { kind: "command", target: { command: command.ref } } }),
        defineKeybinding({ id: "second", key: "mod+P", action: { kind: "command", target: { command: command.ref } } }),
      ],
    });

    const runtime = normalizeExtensionSources([source(definition)]);

    expect(runtime.keybindings).toHaveLength(1);
    expect(runtime.keybindings[0]?.localId).toBe("first");
    expect(runtime.diagnostics).toContainEqual(expect.objectContaining({ code: "duplicate_keybinding_chord" }));
  });
});

test("layered suggestions keep shared keys as resolver candidates", () => {
  const first = defineCommand({ id: "first", title: "First", async run() {} });
  const second = defineCommand({ id: "second", title: "Second", async run() {} });
  const definition = defineExtension({
    commands: [first, second],
    keybindings: [
      defineKeybinding({
        id: "first",
        key: "S",
        layer: "current",
        targetScope: "resource",
        action: { kind: "command", target: { command: first.ref } },
      }),
      defineKeybinding({
        id: "second",
        key: "S",
        layer: "current",
        targetScope: "panel",
        sticky: true,
        action: { kind: "command", target: { command: second.ref } },
      }),
    ],
  });
  const runtime = normalizeExtensionSources([source(definition)]);
  expect(runtime.keybindings).toHaveLength(2);
  expect(runtime.diagnostics).not.toContainEqual(expect.objectContaining({ code: "duplicate_keybinding_chord" }));
});

test("layer sequences stay distinct from direct operating-system chords", () => {
  const command = defineCommand({ id: "first", title: "First", async run() {} });
  const definition = defineExtension({
    commands: [command],
    keybindings: [
      defineKeybinding({
        id: "nested",
        key: "N S",
        layer: "extensions",
        action: { kind: "command", target: { command: command.ref } },
      }),
    ],
  });
  const runtime = normalizeExtensionSources([source(definition)]);
  expect(runtime.keybindings).toHaveLength(1);
  expect(runtime.diagnostics).toEqual([]);
});
