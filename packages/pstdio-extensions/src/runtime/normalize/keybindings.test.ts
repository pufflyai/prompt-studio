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
