import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createPreviewResource } from "./preview-resource";

const baseMetadata = {
  commands: [],
  commandPaletteContributions: [],
  diagnostics: [],
  extensions: [],
  menuContributions: [],
  modes: [],
  pages: [],
  views: [],
  viewMenus: [],
  placements: [],
  resourceKinds: [],
  resourceHierarchyProviders: [],
  navigationItems: [],
  navigationTrees: [],
  statusBarItems: [],
  statuses: [],
  activityItems: [],
  settingsSections: [],
  settingsDefinitions: [],
  settingsPanels: [],
  commandPaletteResources: [],
  keybindings: [],
} satisfies WorkbenchExtensionMetadata;

describe("createPreviewResource", () => {
  test("uses a neutral preview resource when the extension has no resource kind", () => {
    const resource = createPreviewResource({
      ...baseMetadata,
      views: [
        {
          id: "pstdio.extension-lab.view.lab-page",
          localId: "lab-page",
          extensionId: "pstdio.extension-lab",
          title: "Lab",
          body: {
            kind: "webview",
            webview: {
              entry: { kind: "package-asset", baseUrl: "file:///extension.ts", path: "./lab.tsx" },
              moduleUrl: "/lab.js",
              runtimeUrl: "/runtime.html",
            },
          },
        },
      ],
    });

    expect(resource).toEqual({
      kind: "extension-preview",
      uri: "bench://extension-preview/default",
      id: "preview",
      label: "Extension preview",
      icon: "FileText",
    });
  });

  test("uses a ticket preview resource when the extension declares a ticket resource kind", () => {
    const resource = createPreviewResource({
      ...baseMetadata,
      resourceKinds: [
        {
          id: "tickets.ticket",
          localId: "ticket",
          extensionId: "pstdio.tickets",
          menuSlots: [],
        },
      ],
    });

    expect(resource).toEqual({
      kind: "ticket",
      uri: "bench://ticket/PS-16",
      id: "PS-16",
      label: "PS-16 Tree renderer preview",
      icon: "FileText",
    });
  });
});
