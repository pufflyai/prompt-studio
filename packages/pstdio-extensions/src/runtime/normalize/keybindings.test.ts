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
    enginesPstdio: "1.0.0-alpha.4",
  },
  definition,
});

describe("normalizeExtensionSources keybindings", () => {
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
