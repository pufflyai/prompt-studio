import { describe, expect, test } from "bun:test";
import {
  extensionKeybindingRecordSchema,
  extensionsCheckResponseSchema,
  workbenchExtensionMetadataSchema,
} from "./extensions";

const record = {
  id: "lab.preview",
  extensionId: "pstdio.lab",
  commandId: "lab.preview",
  key: "mod+shift+p",
  canonicalChord: "Mod+Shift+P",
  parsed: {
    key: "P",
    ctrl: false,
    shift: true,
    alt: false,
    meta: true,
    modifiers: ["Shift", "Meta"],
  },
  platformOverrides: { win: "ctrl+shift+p" },
  when: { resourceType: ["marp.presentation"] },
};

describe("extension keybinding contracts", () => {
  test("parses a full keybinding record", () => {
    expect(extensionKeybindingRecordSchema.parse(record)).toEqual(record);
  });

  test("requires the keybindings field on the check response", () => {
    expect(() =>
      extensionsCheckResponseSchema.parse({
        extensionsRoot: "/extensions",
        extensionsRootExists: true,
        errorCount: 0,
        warningCount: 0,
        extensions: [],
        commands: [],
        middlewares: [],
        hooks: [],
        schedules: [],
        artifactMounts: [],
        commandPaletteContributions: [],
        themes: [],
        fileIconThemes: [],
        menuContributions: [],
        modes: [],
        panels: [],
        routes: [],
        kanbanRenderers: [],
        commandPaletteResources: [],
        treeItems: [],
        treeRenderers: [],
        settingsPanels: [],
        templates: [],
        skills: [],
        diagnostics: [],
      }),
    ).toThrow();
  });

  test("accepts keybindings in workbench metadata", () => {
    const parsed = workbenchExtensionMetadataSchema.parse({
      extensions: [],
      commands: [],
      menuContributions: [],
      modes: [],
      panels: [],
      routes: [],
      settingsPanels: [],
      keybindings: [record],
      diagnostics: [],
    });

    expect(parsed.keybindings).toEqual([record]);
  });
});
