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
          kanbanRenderers: {
            rows: { title: "Rows", queryCommand: "queryRows" },
          },
          modes: {
            review: {
              id: "pstdio.lab.review",
              label: "Review",
              resourceKind: "ticket",
              layout: { panels: ["main"], open: [{ region: "main", panel: "ticketPanel" }] },
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
              icon: "flask-conical",
              webview: { entry: webviewAsset("./settings.tsx") },
            },
          },
          treeItems: {
            rows: {
              target: "workbench.left.tree",
              label: "Rows",
              action: { kind: "kanbanRenderer", kanbanRenderer: "rows" },
            },
          },
          treeRenderers: {
            files: { title: "Files", bodyCommand: "treeBody" },
          },
          panels: {
            files: {
              title: "Files",
              region: "main",
              closable: false,
              treeRenderer: "files",
            },
            ticketPanel: {
              title: "Ticket",
              region: "main",
              closable: false,
              resourceKind: "ticket",
              webview: { entry: webviewAsset("./ticket.tsx") },
            },
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
    expect(metadata.panels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "lab.ticketPanel",
          resourceKind: "ticket",
          webview: expect.objectContaining({ moduleUrl: "/modules/lab.ticketPanel.js" }),
        }),
        expect.objectContaining({
          id: "lab.files",
          treeRendererId: "lab.files",
        }),
      ]),
    );
    expect(metadata.routes[0]).toMatchObject({
      id: "lab.details",
      webview: { moduleUrl: "/modules/lab.details.js" },
    });
    expect(metadata.settingsPanels[0]).toMatchObject({
      id: "lab.project",
      slotId: "project.settingsPanels",
      icon: "flask-conical",
      webview: { runtimeUrl: "/runtime/lab.project.html" },
    });
    expect(metadata.kanbanRenderers?.[0]).toMatchObject({ id: "lab.rows", queryCommandId: "lab.queryRows" });
    expect(metadata.treeItems?.[0]).toMatchObject({
      id: "lab.rows",
      action: { kind: "kanbanRenderer", kanbanRendererId: "lab.rows" },
    });
    expect(metadata.settingsDefinitions?.[0]).toMatchObject({ key: "enabled", default: true });
    expect(metadata.modes[0]).toMatchObject({
      modeId: "pstdio.lab.review",
      resourceKind: "ticket",
      layout: { panels: ["main"], open: [{ region: "main", panel: "lab.ticketPanel" }] },
    });
  });

  test("maps command palette resource providers with resolved query command and refresh events", () => {
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
          commands: { queryTickets: { title: "Query tickets", run: async () => ({ items: [] }) } },
          commandPaletteResources: {
            tickets: {
              title: "Tickets",
              resourceKind: "ticket",
              queryCommand: "queryTickets",
              refreshEvents: ["lab.ticket.changed"],
            },
          },
        },
      },
    ]);

    const metadata = createWorkbenchExtensionMetadata({ runtime });

    expect(metadata.commandPaletteResources).toEqual([
      {
        id: "lab.tickets",
        extensionId: "pstdio.lab",
        title: "Tickets",
        resourceKind: "ticket",
        queryCommandId: "lab.queryTickets",
        refreshEventIds: ["lab.ticket.changed"],
      },
    ]);
  });

  test("emits keybinding records with canonical chord, platform overrides, and when predicate", () => {
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
          commands: { preview: { title: "Preview", run: async () => null } },
          keybindings: {
            preview: {
              key: "mod+shift+p",
              win: "ctrl+shift+p",
              command: "lab.preview",
              when: { resourceType: ["marp.presentation"] },
            },
          },
        },
      },
    ]);

    const metadata = createWorkbenchExtensionMetadata({ runtime });

    expect(metadata.keybindings).toEqual([
      expect.objectContaining({
        id: "lab.preview",
        commandId: "lab.preview",
        key: "mod+shift+p",
        canonicalChord: "Mod+Shift+P",
        platformOverrides: { win: "ctrl+shift+p" },
        when: { resourceType: ["marp.presentation"] },
      }),
    ]);
  });
});

describe("createWorkbenchExtensionMetadata kanban renderers", () => {
  test("preserves extension-declared default saved views", () => {
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
          commands: { queryRows: { title: "Query rows", run: async () => ({ rows: [] }) } },
          kanbanRenderers: {
            rows: {
              title: "Rows",
              queryCommand: "queryRows",
              onRowActivate: async () => undefined,
              defaultViews: [
                {
                  id: "all",
                  title: "All rows",
                  settings: {
                    viewMode: "board",
                    columnGrouping: "status",
                    rowGrouping: "none",
                    ordering: { attributeId: "manual", direction: "asc" },
                    displayProperties: [],
                  },
                  filters: {},
                  isDefault: true,
                },
              ],
              defaultActiveViewId: "all",
            },
          },
        },
      },
    ]);

    const metadata = createWorkbenchExtensionMetadata({ runtime });

    expect(metadata.kanbanRenderers?.[0]).toMatchObject({
      id: "lab.rows",
      rowActivationCommandId: "lab.rows.__kanbanRowActivate",
      defaultViews: [
        {
          id: "all",
          title: "All rows",
          settings: {
            viewMode: "board",
            columnGrouping: "status",
            rowGrouping: "none",
            ordering: { attributeId: "manual", direction: "asc" },
            displayProperties: [],
          },
          filters: {},
          isDefault: true,
        },
      ],
      defaultActiveViewId: "all",
    });
  });
});

describe("createWorkbenchExtensionMetadata Panel Menu owners", () => {
  test("resolves a Sub Panel panel reference to its contribution id", () => {
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
          panels: {
            notes: {
              title: "Notes",
              region: "main",
              closable: true,
              webview: { entry: webviewAsset("./notes.tsx") },
              panelMenus: {
                tools: {
                  title: "Notes tools",
                  side: "right",
                  webview: { entry: webviewAsset("./notes-tools.tsx") },
                },
              },
            },
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
        styles: [],
      }),
    });

    expect(metadata.panels).toContainEqual(
      expect.objectContaining({
        id: "lab.notes",
        panelMenus: [
          expect.objectContaining({
            id: "lab.notes.tools",
            ownerPanelId: "lab.notes",
            webview: expect.objectContaining({
              runtimeUrl: "/runtime/lab.notes.tools.html",
              moduleUrl: "/modules/lab.notes.tools.js",
            }),
          }),
        ],
      }),
    );
  });
});

describe("createWorkbenchExtensionMetadata data table renderers", () => {
  test("maps table contributions and table-backed panels", () => {
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
            queryTable: { title: "Query table", run: async () => ({ rows: [] }) },
            restartRows: { title: "Restart rows", run: async () => undefined },
          },
          dataTableRenderers: {
            health: {
              title: "Health",
              queryCommand: "queryTable",
              onRowActivate: async () => undefined,
              columns: [{ id: "score", label: "Score" }],
              selectionMode: "multiple",
              selectionActions: [
                {
                  id: "restart",
                  label: "Restart selected",
                  command: "restartRows",
                },
              ],
            },
          },
          panels: {
            health: { title: "Health", region: "main", closable: false, dataTableRenderer: "health" },
          },
        },
      },
    ]);

    const metadata = createWorkbenchExtensionMetadata({ runtime });

    expect(metadata.dataTableRenderers?.[0]).toMatchObject({
      id: "lab.health",
      queryCommandId: "lab.queryTable",
      rowActivationCommandId: "lab.health.__dataTableRowActivate",
      columns: [{ id: "score", label: "Score" }],
      selectionMode: "multiple",
      selectionActions: [
        {
          id: "restart",
          label: "Restart selected",
          commandId: "lab.restartRows",
        },
      ],
    });
    expect(metadata.panels[0]).toMatchObject({ id: "lab.health", dataTableRendererId: "lab.health" });
  });
});

describe("createWorkbenchExtensionMetadata tree item actions", () => {
  test("preserves host workbench command ids", () => {
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
          treeItems: {
            switchMode: {
              target: "workbench.left.tree",
              label: "Lab mode",
              action: {
                kind: "command",
                command: "workbench.action.switchMode",
                params: { modeId: "pstdio.lab.review" },
              },
            },
          },
        },
      },
    ]);

    const metadata = createWorkbenchExtensionMetadata({ runtime });

    expect(metadata.treeItems?.[0]).toMatchObject({
      action: {
        kind: "command",
        commandId: "workbench.action.switchMode",
        args: { modeId: "pstdio.lab.review" },
      },
    });
  });
});
