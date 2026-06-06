import { describe, expect, test } from "bun:test";
import { packageAsset } from "@pstdio/sdk/extensions";
import { normalizeExtensionSources } from "../../runtime/normalize";
import { createWorkbenchExtensionMetadata } from "./workbench-extension-metadata";

const sourcePath = "/extensions/lab/extension.ts";
const webviewAsset = (path: string) => packageAsset(path, `file://${sourcePath}`);

describe("createWorkbenchExtensionMetadata", () => {
  test("maps runtime contributions into workbench metadata with injected webview URLs", () => {
    const runtime = normalizeExtensionSources([
      {
        sourcePath,
        sourceKind: "local_path",
        packagePath: "/extensions/lab",
        manifest: {
          id: "pstdio.lab",
          name: "lab",
          displayName: "Lab",
          version: "1.0.0",
          publisher: "pstdio",
          main: "./extension.ts",
          enginesPstdio: "^1.0.0",
        },
        definition: {
          commands: {
            open: {
              title: "Open",
              palette: { group: "Lab", icon: "flask-conical", when: { resourceType: ["ticket"] } },
              run: async () => undefined,
            },
            queryRows: { title: "Query rows", run: async () => ({ rows: [] }) },
            treeBody: { title: "Tree body", run: async () => [] },
          },
          dataRenderers: {
            rows: { title: "Rows", queryCommand: "queryRows" },
          },
          modes: {
            review: {
              id: "pstdio.lab.review",
              label: "Review",
              layout: { open: [{ target: "workbench.main", view: "ticketPanel" }] },
            },
          },
          routes: {
            details: { path: "details", label: "Details", webview: { entry: webviewAsset("./details.tsx") } },
          },
          settings: {
            properties: {
              enabled: { type: "boolean", scope: "project", default: true, description: "Enable lab" },
            },
          },
          settingsPanels: {
            project: {
              target: "workbench.settings",
              scope: "project",
              title: "Lab settings",
              webview: { entry: webviewAsset("./settings.tsx") },
            },
          },
          treeItems: {
            rows: {
              target: "workbench.left.tree",
              label: "Rows",
              action: { kind: "dataRenderer", dataRenderer: "rows" },
            },
          },
          treeRenderers: {
            files: { title: "Files", bodyCommand: "treeBody" },
          },
          views: {
            files: { title: "Files", target: "workbench.main.left", treeRenderer: "files" },
            ticketPanel: { title: "Ticket", resourceKind: "ticket", webview: { entry: webviewAsset("./ticket.tsx") } },
          },
        },
      },
    ]);

    const metadata = createWorkbenchExtensionMetadata({
      runtime,
      resolveWebview: ({ id, webview }) => ({
        ...webview,
        runtimeUrl: `/runtime/${id}.html`,
        moduleUrl: `/modules/${id}.js`,
        styles: [`/modules/${id}.css`],
      }),
    });

    expect(metadata.commands.map((command) => command.id)).toEqual(["lab.open", "lab.queryRows", "lab.treeBody"]);
    expect(metadata.commandPaletteContributions).toEqual([
      expect.objectContaining({
        id: "lab.open.palette.0",
        commandId: "lab.open",
        group: "Lab",
        icon: "flask-conical",
        label: "Open",
        when: { resourceType: ["ticket"] },
      }),
    ]);
    expect(metadata.views).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "lab.ticketPanel",
          resourceKind: "ticket",
          webview: expect.objectContaining({ moduleUrl: "/modules/lab.ticketPanel.js" }),
        }),
        expect.objectContaining({ id: "lab.files", treeRendererId: "lab.files" }),
      ]),
    );
    expect(metadata.routes[0]).toMatchObject({
      id: "lab.details",
      webview: { moduleUrl: "/modules/lab.details.js" },
    });
    expect(metadata.settingsPanels[0]).toMatchObject({
      id: "lab.project",
      slotId: "project.settingsPanels",
      webview: { runtimeUrl: "/runtime/lab.project.html" },
    });
    expect(metadata.dataRenderers?.[0]).toMatchObject({ id: "lab.rows", queryCommandId: "lab.queryRows" });
    expect(metadata.treeItems?.[0]).toMatchObject({
      id: "lab.rows",
      action: { kind: "dataRenderer", dataRendererId: "lab.rows" },
    });
    expect(metadata.settingsDefinitions?.[0]).toMatchObject({ key: "enabled", default: true });
    expect(metadata.modes[0]).toMatchObject({
      modeId: "pstdio.lab.review",
      layout: { open: [{ target: "workbench.main", view: "lab.ticketPanel" }] },
    });
  });
});
