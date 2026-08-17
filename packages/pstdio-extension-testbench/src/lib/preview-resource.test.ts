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

  test("uses a ticket preview resource when the extension contributes ticket views", () => {
    const resource = createPreviewResource({
      ...baseMetadata,
      panels: [
        {
          id: "tickets.editor",
          extensionId: "pstdio.tickets",
          resourceKind: "ticket",
          region: "main",
          closable: false,
          title: "Ticket",
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
