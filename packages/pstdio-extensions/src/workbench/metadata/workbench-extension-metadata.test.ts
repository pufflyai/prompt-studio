import { describe, expect, test } from "bun:test";
import { commandRef, eventRef, packageAsset, type RendererEventReference } from "@pstdio/sdk/extensions";
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
            rows: { title: "Rows", query: async () => ({ rows: [] }) },
          },
          modes: {
            review: {
              id: "pstdio.lab.review",
              label: "Review",
              panelRegions: ["main"],
              resources: {
                ticket: { slots: { primary: { region: "main", required: true } } },
              },
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
              action: { kind: "panel", panel: "rows" },
            },
          },
          treeRenderers: {
            files: {
              title: "Files",
              searchable: true,
              searchPlaceholder: "Search files",
              body: async () => [],
            },
          },
          panels: {
            rows: {
              title: "Rows",
              show: { region: "main" },
              renderer: { kind: "kanban", id: "rows" },
            },
            files: {
              title: "Files",
              show: { region: "main" },
              renderer: { kind: "tree", id: "files" },
            },
            ticketPanel: {
              title: "Ticket",
              show: { region: "main" },
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
          show: { region: "main" },
          webview: expect.objectContaining({ moduleUrl: "/modules/lab.ticketPanel.js" }),
        }),
        expect.objectContaining({
          id: "lab.files",
          renderer: { kind: "tree", id: "lab.files" },
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
    expect(metadata.kanbanRenderers?.[0]).toMatchObject({
      id: "lab.rows",
      queryHandlerId: "lab.rows.kanban.query",
    });
    expect(metadata.treeRenderers?.[0]).toMatchObject({
      id: "lab.files",
      searchable: true,
      searchPlaceholder: "Search files",
    });
    expect(metadata.treeItems?.[0]).toMatchObject({
      id: "lab.rows",
      action: { kind: "panel", panelId: "lab.rows" },
    });
    expect(metadata.settingsDefinitions?.[0]).toMatchObject({ key: "enabled", default: true });
    expect(metadata.modes[0]).toMatchObject({
      modeId: "pstdio.lab.review",
      panelRegions: ["main"],
      resources: { ticket: { slots: { primary: { region: "main", required: true } } } },
    });
  });
});

describe("createWorkbenchExtensionMetadata renderer refresh events", () => {
  test("normalizes typed and string event references once for every native renderer", () => {
    const changed = eventRef("lab.changed");
    const refreshEvents = [changed, "external.changed", changed, ""] as unknown as RendererEventReference[];
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
          treeRenderers: { tree: { title: "Tree", body: async () => [], refreshEvents } },
          fileRenderers: { file: { title: "File", load: async () => ({ content: "" }), refreshEvents } },
          controlsRenderers: {
            controls: { title: "Controls", query: async () => ({ values: {} }), refreshEvents },
          },
          dataTableRenderers: {
            table: { title: "Table", query: async () => ({ rows: [] }), refreshEvents },
          },
          kanbanRenderers: {
            board: { title: "Board", query: async () => ({ rows: [] }), refreshEvents },
          },
        },
      },
    ]);

    const metadata = createWorkbenchExtensionMetadata({ runtime });
    const expected = ["lab.changed", "external.changed"];

    expect(metadata.treeRenderers?.[0]?.refreshEventIds).toEqual(expected);
    expect(metadata.fileRenderers?.[0]?.refreshEventIds).toEqual(expected);
    expect(metadata.controlsRenderers?.[0]?.refreshEventIds).toEqual(expected);
    expect(metadata.dataTableRenderers?.[0]?.refreshEventIds).toEqual(expected);
    expect(metadata.kanbanRenderers?.[0]?.refreshEventIds).toEqual(expected);
  });
});

describe("createWorkbenchExtensionMetadata command records", () => {
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
              queryCommand: commandRef("queryTickets"),
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

  test("keeps renderer callback handlers out of public command metadata", () => {
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
          kanbanRenderers: {
            rows: { title: "Rows", query: async () => ({ rows: [] }) },
          },
        },
      },
    ]);

    const metadata = createWorkbenchExtensionMetadata({ runtime });

    expect(metadata.commands).toEqual([]);
    expect(metadata.kanbanRenderers?.[0]).toMatchObject({
      id: "lab.rows",
      queryHandlerId: "lab.rows.kanban.query",
    });
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
              query: async () => ({ rows: [] }),
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
      rowActivationHandlerId: "lab.rows.kanban.onRowActivate",
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
              show: { region: "main" },
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
            restartRows: { title: "Restart rows", run: async () => undefined },
          },
          dataTableRenderers: {
            health: {
              title: "Health",
              query: async () => ({ rows: [] }),
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
            health: { title: "Health", show: { region: "main" }, renderer: { kind: "dataTable", id: "health" } },
          },
        },
      },
    ]);

    const metadata = createWorkbenchExtensionMetadata({ runtime });

    expect(metadata.dataTableRenderers?.[0]).toMatchObject({
      id: "lab.health",
      queryHandlerId: "lab.health.dataTable.query",
      rowActivationHandlerId: "lab.health.dataTable.onRowActivate",
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
    expect(metadata.panels[0]).toMatchObject({ id: "lab.health", renderer: { kind: "dataTable", id: "lab.health" } });
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

describe("createWorkbenchExtensionMetadata resource kind references", () => {
  test("resolves both reference spellings to the plain declared resource kind id", () => {
    const runtime = normalizeExtensionSources([
      {
        packagePath: "/extension",
        sourcePath: "/extension/extension.ts",
        sourceKind: "local_path",
        manifest: {
          id: "pstdio.planner",
          name: "planner",
          displayName: "Planner",
          version: "1.0.0",
          publisher: "pstdio",
          main: "./extension.ts",
          enginesPstdio: "^1.0.0",
        },
        definition: {
          resourceKinds: {
            ticket: { surface: "primary", slots: { primary: { cardinality: "one", external: false } } },
          },
          kanbanRenderers: {
            tickets: { title: "Tickets", resourceKind: "ticket", query: async () => ({ rows: [] }) },
            sessions: { title: "Sessions", resourceKind: "session", query: async () => ({ rows: [] }) },
            owned: { title: "Owned", resourceKind: "planner.ticket", query: async () => ({ rows: [] }) },
          },
        },
      },
    ]);

    const metadata = createWorkbenchExtensionMetadata({ runtime });

    // A resource kind keeps the plain name it was declared with, so the bare reference
    // already names it and the namespaced reference resolves to the same id.
    expect(metadata.resourceKinds?.map((record) => record.id)).toEqual(["ticket"]);
    expect(metadata.kanbanRenderers?.[0]?.resourceKind).toBe("ticket");
    // `session` is a host kind the planner does not declare, so it stays as written.
    expect(metadata.kanbanRenderers?.[1]?.resourceKind).toBe("session");
    expect(metadata.kanbanRenderers?.[2]?.resourceKind).toBe("ticket");
  });
});
