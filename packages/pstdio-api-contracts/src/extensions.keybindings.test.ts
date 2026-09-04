import { describe, expect, test } from "bun:test";
import {
  extensionKeybindingRecordSchema,
  extensionsCheckResponseSchema,
  workbenchExtensionMetadataSchema,
} from "./extensions";

const record = {
  id: "lab.preview",
  extensionId: "pstdio.lab",
  action: {
    kind: "command" as const,
    target: { command: { extensionId: "pstdio.lab", kind: "command" as const, id: "preview" } },
  },
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
        views: [],
        viewMenus: [],
        placements: [],
        pages: [],
        resourceKinds: [],
        navigationItems: [],
        navigationTrees: [],
        statusBarItems: [],
        statuses: [],
        commandPaletteResources: [],
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
      commandPaletteContributions: [],
      modes: [],
      views: [],
      viewMenus: [],
      placements: [],
      pages: [],
      resourceKinds: [],
      navigationItems: [],
      navigationTrees: [],
      statusBarItems: [],
      statuses: [],
      settingsPanels: [],
      keybindings: [record],
      diagnostics: [],
    });

    expect(parsed.keybindings).toEqual([record]);
  });
});
