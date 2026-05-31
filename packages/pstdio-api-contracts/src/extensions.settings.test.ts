import { describe, expect, test } from "bun:test";
import {
  extensionSettingDefinitionRecordSchema,
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
        themes: [],
        fileIconThemes: [],
        menuContributions: [],
        modes: [],
        views: [],
        routes: [],
        dataRenderers: [],
        documentEditors: [
          {
            id: "extension-lab.ticketDocument",
            extensionId: "pstdio.extension-lab",
            title: "Ticket",
            resourceKind: "ticket",
            readCommandId: "extension-lab.ticketDocument.read",
            updateCommandId: "extension-lab.ticketDocument.update",
            layout: {
              autoSave: true,
              header: { visible: false },
              properties: { target: "workbench.main.left" },
              fileOverview: { target: "workbench.main.right" },
            },
          },
        ],
        navigation: [],
        treeItems: [],
        settingsPanels: [],
        settingsDefinitions: [definition],
        templates: [],
        skills: [],
        diagnostics: [],
      }),
    ).toMatchObject({
      documentEditors: [
        {
          id: "extension-lab.ticketDocument",
          extensionId: "pstdio.extension-lab",
          title: "Ticket",
          resourceKind: "ticket",
          readCommandId: "extension-lab.ticketDocument.read",
          updateCommandId: "extension-lab.ticketDocument.update",
          layout: {
            autoSave: true,
            header: { visible: false },
            properties: { target: "workbench.main.left" },
            fileOverview: { target: "workbench.main.right" },
          },
        },
      ],
      settingsDefinitions: [definition],
    });

    expect(
      workbenchExtensionMetadataSchema.parse({
        extensions: [],
        commands: [],
        menuContributions: [],
        modes: [],
        views: [],
        routes: [],
        navigation: [],
        treeItems: [],
        settingsPanels: [],
        documentEditors: [
          {
            id: "extension-lab.ticketDocument",
            extensionId: "pstdio.extension-lab",
            title: "Ticket",
            resourceKind: "ticket",
            readCommandId: "extension-lab.ticketDocument.read",
            layout: {
              autoSave: true,
              header: { visible: false },
              properties: { target: "workbench.main.left" },
              fileOverview: { target: "workbench.main.right" },
            },
          },
        ],
        settingsDefinitions: [definition],
        diagnostics: [],
      }),
    ).toMatchObject({
      documentEditors: [
        {
          id: "extension-lab.ticketDocument",
          extensionId: "pstdio.extension-lab",
          title: "Ticket",
          resourceKind: "ticket",
          readCommandId: "extension-lab.ticketDocument.read",
          layout: {
            autoSave: true,
            header: { visible: false },
            properties: { target: "workbench.main.left" },
            fileOverview: { target: "workbench.main.right" },
          },
        },
      ],
      settingsDefinitions: [definition],
    });
  });

  test("validates update input values", () => {
    expect(updateExtensionSettingRequestSchema.parse({ value: "formal" })).toEqual({ value: "formal" });
  });
});
