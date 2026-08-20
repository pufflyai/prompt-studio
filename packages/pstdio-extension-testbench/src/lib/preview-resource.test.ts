import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createPreviewResource } from "./preview-resource";

const baseMetadata = {
  commands: [],
  kanbanRenderers: [],
  diagnostics: [],
  extensions: [],
  menuContributions: [],
  modes: [],
  routes: [],
  settingsDefinitions: [],
  settingsPanels: [],
  treeItems: [],
  treeRenderers: [],
  panels: [],
} satisfies WorkbenchExtensionMetadata;

describe("createPreviewResource", () => {
  test("uses the first route for route-only extensions", () => {
    const resource = createPreviewResource({
      ...baseMetadata,
      routes: [
        {
          id: "extension-lab.labPage",
          extensionId: "pstdio.extension-lab",
          label: "Lab",
          path: "lab",
          webview: {
            entry: { kind: "package-asset", baseUrl: "file:///extension.ts", path: "./lab.tsx" },
            moduleUrl: "/lab.js",
            runtimeUrl: "/runtime.html",
          },
        },
      ],
    });

    expect(resource).toEqual({
      kind: "extension-route",
      uri: "workbench://extension-route/extension-lab.labPage",
      id: "extension-lab.labPage",
      label: "Lab",
      icon: "FileText",
    });
  });

  test("uses a ticket preview resource when the extension declares a ticket resource kind", () => {
    const resource = createPreviewResource({
      ...baseMetadata,
      resourceKinds: [
        {
          id: "tickets.ticket",
          extensionId: "pstdio.tickets",
          surface: "primary",
          slots: { primary: { cardinality: "one", external: false } },
        },
      ],
      resourcePanels: [
        {
          id: "tickets.editorPanel",
          extensionId: "pstdio.tickets",
          resourceKind: "tickets.ticket",
          panel: "tickets.editor",
          slot: "primary",
        },
      ],
      panels: [
        {
          id: "tickets.editor",
          extensionId: "pstdio.tickets",
          title: "Ticket",
          supportedRegions: ["main"],
          renderer: { kind: "file", id: "tickets.editorRenderer" },
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

  test("derives the kind from a resource-panel edge when no resource kind is declared", () => {
    const resource = createPreviewResource({
      ...baseMetadata,
      resourcePanels: [
        {
          id: "acme.plannerInsights",
          extensionId: "acme.insights",
          resourceKind: "planner.note",
          panel: "acme.insights",
          slot: "inspector",
        },
      ],
      panels: [
        {
          id: "acme.insights",
          extensionId: "acme.insights",
          title: "Insights",
          supportedRegions: ["side", "secondary"],
          renderer: { kind: "controls", id: "acme.insightControls" },
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
