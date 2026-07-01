import { describe, expect, test } from "bun:test";
import type { ExtensionsCheckResponse } from "pstdio-api-contracts";
import { mergeCheck } from "./merge-checks";

const check = (overrides: Partial<ExtensionsCheckResponse> = {}): ExtensionsCheckResponse => ({
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
  modes: [],
  views: [],
  routes: [],
  navigation: [],
  treeItems: [],
  treeRenderers: [],
  fileRenderers: [],
  controls: [],
  keybindings: [],
  settingsPanels: [],
  dataRenderers: [],
  commandPaletteResources: [],
  settingsDefinitions: [],
  templates: [],
  skills: [],
  diagnostics: [],
  ...overrides,
});

describe("mergeCheck", () => {
  test("merges controls renderer records", () => {
    const target = check();
    const source = check({
      controls: [
        {
          id: "planner.ticketInspector",
          extensionId: "pstdio.planner",
          title: "Ticket inspector",
          queryCommandId: "planner.readTicketControls",
        },
      ],
    });

    mergeCheck(target, source);

    expect(target.controls).toEqual(source.controls);
  });
});
