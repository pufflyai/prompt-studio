import { describe, expect, test } from "bun:test";
import { commandRef, defineCommand, defineExtension } from "@pstdio/sdk/extensions";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const wrap = (name: string, definition: ReturnType<typeof defineExtension>): LoadedExtensionSource => ({
  packagePath: `/fake/${name}`,
  sourcePath: `/fake/${name}/extension.ts`,
  sourceKind: "local_path",
  manifest: {
    id: `pstdio.${name}`,
    name,
    version: "1.0.0",
    publisher: "pstdio",
    main: "./extension.ts",
    enginesPstdio: "^1.0.0",
  },
  definition,
});

const noopCommand = defineCommand({
  title: "Noop",
  async run() {
    return null;
  },
});

const labWithKeybindings = (keybindings: NonNullable<ReturnType<typeof defineExtension>["keybindings"]>) =>
  defineExtension({
    commands: { "say-hello": noopCommand, preview: noopCommand },
    keybindings,
  });

describe("normalizeExtensionSources keybindings", () => {
  test("registers a valid keybinding with canonical chord and parsed metadata", () => {
    const ext = labWithKeybindings({
      "say-hello": {
        key: "mod+shift+h",
        command: commandRef("lab.say-hello"),
      },
    });

    const runtime = normalizeExtensionSources([wrap("lab", ext)]);

    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.keybindings).toHaveLength(1);
    const [binding] = runtime.keybindings;
    expect(binding).toMatchObject({
      id: "lab.say-hello",
      commandId: "lab.say-hello",
      canonicalChord: "Mod+Shift+H",
    });
    expect(binding!.parsed.key).toBe("H");
    expect(binding!.parsed.shift).toBe(true);
    expect(binding!.parsed.meta).toBe(true);
  });

  test("collapses cmd+P and mod+P into the same canonical chord and warns", () => {
    const ext = labWithKeybindings({
      first: { key: "cmd+P", command: commandRef("lab.say-hello") },
      second: { key: "mod+P", command: commandRef("lab.say-hello") },
    });

    const runtime = normalizeExtensionSources([wrap("lab", ext)]);

    expect(runtime.keybindings).toHaveLength(1);
    expect(runtime.keybindings[0]?.id).toBe("lab.first");
    expect(runtime.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "duplicate_keybinding_chord",
        severity: "warning",
        metadata: expect.objectContaining({ canonicalChord: "Mod+P", existingId: "lab.first" }),
      }),
    );
  });

  test("treats reshuffled `when` keys as the same context for dedupe", () => {
    const ext = labWithKeybindings({
      first: {
        key: "mod+P",
        command: commandRef("lab.say-hello"),
        when: { mode: "session", resourceType: ["ticket"] },
      },
      second: {
        key: "mod+P",
        command: commandRef("lab.say-hello"),
        when: { resourceType: ["ticket"], mode: "session" },
      },
    });

    const runtime = normalizeExtensionSources([wrap("lab", ext)]);

    expect(runtime.keybindings).toHaveLength(1);
    expect(runtime.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "duplicate_keybinding_chord",
        metadata: expect.objectContaining({ existingId: "lab.first" }),
      }),
    );
  });

  test("differentiates bindings whose `when` predicate differs", () => {
    const ext = labWithKeybindings({
      first: {
        key: "mod+P",
        command: commandRef("lab.say-hello"),
        when: { mode: "session" },
      },
      second: {
        key: "mod+P",
        command: commandRef("lab.say-hello"),
        when: { mode: "workspace" },
      },
    });

    const runtime = normalizeExtensionSources([wrap("lab", ext)]);

    expect(runtime.keybindings).toHaveLength(2);
    expect(runtime.diagnostics).toEqual([]);
  });

  test("rejects unknown modifiers via validateHotkey", () => {
    const ext = labWithKeybindings({
      hyper: { key: "hyper+x", command: commandRef("lab.say-hello") },
    });

    const runtime = normalizeExtensionSources([wrap("lab", ext)]);

    expect(runtime.keybindings).toEqual([]);
    expect(runtime.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "invalid_keybinding",
        metadata: expect.objectContaining({ chord: "hyper+x" }),
      }),
    );
  });

  test("rejects modifier-only chords", () => {
    const ext = labWithKeybindings({
      ctrl: { key: "ctrl", command: commandRef("lab.say-hello") },
      shift: { key: "shift", command: commandRef("lab.say-hello") },
      combo: { key: "ctrl+shift", command: commandRef("lab.say-hello") },
    });

    const runtime = normalizeExtensionSources([wrap("lab", ext)]);

    expect(runtime.keybindings).toEqual([]);
    expect(runtime.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_keybinding",
          metadata: expect.objectContaining({ chord: "ctrl" }),
        }),
        expect.objectContaining({
          code: "invalid_keybinding",
          metadata: expect.objectContaining({ chord: "shift" }),
        }),
        expect.objectContaining({
          code: "invalid_keybinding",
          metadata: expect.objectContaining({ chord: "ctrl+shift" }),
        }),
      ]),
    );
  });

  test("rejects an empty chord", () => {
    const ext = labWithKeybindings({
      empty: { key: "", command: commandRef("lab.say-hello") },
    });

    const runtime = normalizeExtensionSources([wrap("lab", ext)]);

    expect(runtime.keybindings).toEqual([]);
    expect(runtime.diagnostics).toContainEqual(expect.objectContaining({ code: "invalid_keybinding" }));
  });

  test("validates each platform override independently", () => {
    const ext = labWithKeybindings({
      preview: {
        key: "mod+shift+p",
        win: "ctrl+shift+p",
        mac: "hyper+shift+p",
        command: commandRef("lab.preview"),
      },
    });

    const runtime = normalizeExtensionSources([wrap("lab", ext)]);

    expect(runtime.keybindings).toEqual([]);
    expect(runtime.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "invalid_keybinding",
        metadata: expect.objectContaining({ field: "mac" }),
      }),
    );
  });

  test("detects duplicate platform override chords", () => {
    const ext = labWithKeybindings({
      first: {
        key: "mod+shift+p",
        win: "ctrl+shift+p",
        command: commandRef("lab.preview"),
      },
      second: {
        key: "mod+shift+o",
        win: "ctrl+shift+p",
        command: commandRef("lab.preview"),
      },
    });

    const runtime = normalizeExtensionSources([wrap("lab", ext)]);

    expect(runtime.keybindings).toHaveLength(1);
    expect(runtime.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "duplicate_keybinding_chord",
        metadata: expect.objectContaining({ existingId: "lab.first", platform: "win" }),
      }),
    );
  });

  test("emits a diagnostic for an unknown command reference", () => {
    const ext = labWithKeybindings({
      preview: {
        key: "mod+shift+p",
        command: commandRef("lab.missing"),
      },
    });

    const runtime = normalizeExtensionSources([wrap("lab", ext)]);

    expect(runtime.keybindings).toEqual([]);
    expect(runtime.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "extension_keybinding_command_missing",
        metadata: expect.objectContaining({ commandId: "lab.missing" }),
      }),
    );
  });

  test("propagates platform overrides and when predicate unchanged into metadata", () => {
    const ext = labWithKeybindings({
      preview: {
        key: "mod+shift+p",
        win: "ctrl+shift+p",
        command: commandRef("lab.preview"),
        when: { resourceType: ["marp.presentation"] },
      },
    });

    const runtime = normalizeExtensionSources([wrap("lab", ext)]);

    expect(runtime.keybindings).toHaveLength(1);
    const [binding] = runtime.keybindings;
    expect(binding!.contribution.win).toBe("ctrl+shift+p");
    expect(binding!.when).toEqual({ resourceType: ["marp.presentation"] });
  });
});
