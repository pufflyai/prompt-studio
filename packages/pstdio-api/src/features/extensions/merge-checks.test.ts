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
  viewMenus: [],
  placements: [],
  resourceKinds: [],
  pages: [],
  resourceHierarchyProviders: [],
  navigationItems: [],
  statusBarItems: [],
  statuses: [],
  activityItems: [],
  settingsSections: [],
  keybindings: [],
  settingsPanels: [],
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
  test("merges view records", () => {
    const target = check();
    const source = check({
      views: [
        {
          id: "pstdio.planner.view.ticket-inspector",
          localId: "ticket-inspector",
          extensionId: "pstdio.planner",
          title: "Ticket inspector",
          body: {
            kind: "controls",
            queryHandlerId: "pstdio.planner.view.ticket-inspector.controls.query",
          },
        },
      ],
    });

    mergeCheck(target, source);

    expect(target.views).toEqual(source.views);
  });

  test("merges page records", () => {
    const target = check();
    const source = check({
      pages: [
        {
          id: "pstdio.planner.page.tickets",
          localId: "tickets",
          extensionId: "pstdio.planner",
          title: "Tickets",
          slots: [],
        },
      ],
    });

    mergeCheck(target, source);

    expect(target.pages).toEqual(source.pages);
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
