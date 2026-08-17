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
  panels: [],
  routes: [],
  navigation: [],
  treeItems: [],
  treeRenderers: [],
  fileRenderers: [],
  controlsRenderers: [],
  keybindings: [],
  settingsPanels: [],
  kanbanRenderers: [],
  commandPaletteResources: [],
  settingsDefinitions: [],
  templates: [],
  skills: [],
  diagnostics: [],
  hostCompatibility: {
    status: "verified",
    host: { host: "dashboard", hostVersion: "0.25.2", capabilities: {} },
    diagnostics: [],
  },
  ...overrides,
});

describe("mergeCheck", () => {
  test("merges controls renderer records", () => {
    const target = check();
    const source = check({
      controlsRenderers: [
        {
          id: "planner.ticketInspector",
          extensionId: "pstdio.planner",
          title: "Ticket inspector",
          queryHandlerId: "planner.ticketInspector.query",
        },
      ],
    });

    mergeCheck(target, source);

    expect(target.controlsRenderers).toEqual(source.controlsRenderers);
  });

  test("preserves an unverified host compatibility result", () => {
    const target = check();
    const source = check({
      hostCompatibility: {
        status: "unverified",
        diagnostics: [
          {
            code: "extension_host_capability_check_unverified",
            severity: "warning",
            message: "Host compatibility was not verified",
          },
        ],
      },
    });

    mergeCheck(target, source);

    expect(target.hostCompatibility).toEqual(source.hostCompatibility);
  });
});
