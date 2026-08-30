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
  test("keeps preview data separate from an unbound extension view", () => {
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

  test("derives the kind from a page binding when no resource kind is declared", () => {
    const noteKind = { extensionId: "pstdio.planner", kind: "resource-kind" as const, id: "note" };
    const resource = createPreviewResource({
      ...baseMetadata,
      pages: [
        {
          id: "acme.insights.page.notes",
          localId: "notes",
          extensionId: "acme.insights",
          title: "Notes",
          slots: [{ id: "note", region: "main", cardinality: "one" }],
          bindings: [
            {
              resourceKind: noteKind,
              view: { extensionId: "acme.insights", kind: "view", id: "insights" },
              slot: "note",
            },
          ],
        },
      ],
    });

    expect(resource).toEqual({
      kind: "note",
      uri: "bench://note/preview",
      id: "preview",
      label: "note preview",
      icon: "FileText",
    });
  });
});
