import { describe, expect, test } from "bun:test";
import {
  extensionKeybindingContributionSchema,
  extensionsCheckResponseSchema,
  workbenchExtensionMetadataSchema,
} from "./extensions";

const keybinding = {
  id: "extension-lab.say-hello",
  extensionId: "pstdio.extension-lab",
  commandId: "extension-lab.say-hello",
  key: "mod+shift+h",
  chordId: "mod+shift+H",
  mac: "cmd+shift+h",
  when: { resourceType: ["lab.slide"] },
};

describe("extension keybinding contracts", () => {
  test("parses a keybinding contribution", () => {
    expect(extensionKeybindingContributionSchema.parse(keybinding)).toEqual(keybinding);
  });

  test("threads keybindings through the check response schema", () => {
    const parsed = extensionsCheckResponseSchema.parse({
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
      themes: [],
      fileIconThemes: [],
      menuContributions: [],
      commandPaletteContributions: [],
      keybindings: [keybinding],
      modes: [],
      views: [],
      routes: [],
      navigation: [],
      treeItems: [],
      settingsPanels: [],
      dataRenderers: [],
      commandPaletteResources: [],
      treeRenderers: [],
      templates: [],
      skills: [],
      diagnostics: [],
    });
    expect(parsed.keybindings).toEqual([keybinding]);
  });

  test("threads keybindings through the workbench metadata schema", () => {
    const parsed = workbenchExtensionMetadataSchema.parse({
      extensions: [],
      commands: [],
      menuContributions: [],
      keybindings: [keybinding],
      modes: [],
      views: [],
      routes: [],
      navigation: [],
      treeItems: [],
      treeRenderers: [],
      settingsPanels: [],
      diagnostics: [],
    });
    expect(parsed.keybindings).toEqual([keybinding]);
  });
});
