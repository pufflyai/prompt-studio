import { describe, expect, test } from "bun:test";
import {
  extensionSettingDefinitionRecordSchema,
  extensionSettingsPanelRecordSchema,
  extensionSettingValueRecordSchema,
  extensionsCheckResponseSchema,
  updateExtensionSettingRequestSchema,
  workbenchExtensionMetadataSchema,
} from "./extensions";

const definition = {
  key: "counter.step",
  extensionId: "pstdio.extension-lab",
  type: "number" as const,
  scope: "project" as const,
  default: 1,
  title: "Counter step",
};

describe("extension settings contracts", () => {
  test("serializes declared setting definitions and effective values", () => {
    expect(extensionSettingDefinitionRecordSchema.parse(definition)).toEqual(definition);
    expect(
      extensionSettingValueRecordSchema.parse({
        ...definition,
        value: 1,
        source: "default",
      }),
    ).toEqual({
      ...definition,
      value: 1,
      source: "default",
    });
  });

  test("includes declared settings in extension metadata responses", () => {
    expect(
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
        fileRenderers: [],
        commandPaletteResources: [],
        navigation: [],
        treeItems: [],
        treeRenderers: [],
        controlsRenderers: [],
        keybindings: [],
        settingsPanels: [],
        settingsDefinitions: [definition],
        templates: [],
        skills: [],
        diagnostics: [],
        hostCompatibility: {
          status: "verified",
          host: { host: "dashboard", hostVersion: "0.25.2", capabilities: {} },
          diagnostics: [],
        },
      }),
    ).toMatchObject({
      settingsDefinitions: [definition],
    });

    expect(
      workbenchExtensionMetadataSchema.parse({
        extensions: [],
        commands: [],
        menuContributions: [],
        modes: [],
        panels: [],
        routes: [],
        navigation: [],
        treeItems: [],
        treeRenderers: [],
        controlsRenderers: [],
        fileRenderers: [],
        settingsPanels: [],
        settingsDefinitions: [definition],
        diagnostics: [],
      }),
    ).toMatchObject({
      settingsDefinitions: [definition],
    });
  });

  test("validates update input values", () => {
    expect(updateExtensionSettingRequestSchema.parse({ value: "formal" })).toEqual({ value: "formal" });
  });

  test("accepts settings panel records with and without an icon", () => {
    const basePanel = {
      id: "lab.project",
      extensionId: "pstdio.lab",
      slotId: "project.settingsPanels",
      target: "workbench.settings" as const,
      scope: "project" as const,
      title: "Lab settings",
      webview: {
        entry: { kind: "package-asset" as const, path: "./src/settings.tsx", baseUrl: "file:///extension.ts" },
      },
    };

    expect(extensionSettingsPanelRecordSchema.parse(basePanel).icon).toBeUndefined();
    expect(extensionSettingsPanelRecordSchema.parse({ ...basePanel, icon: "tag" })).toMatchObject({ icon: "tag" });
  });
});
