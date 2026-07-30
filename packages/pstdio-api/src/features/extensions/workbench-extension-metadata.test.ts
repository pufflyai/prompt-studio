import { describe, expect, test } from "bun:test";
import type { WebviewCapabilityDeclaration } from "pstdio-api-contracts/extension-kernel";
import { normalizeExtensionSources } from "pstdio-extensions";
import { buildWorkbenchExtensionMetadata } from "./workbench-extension-metadata";

const asset = (path: string) => ({ kind: "package-asset" as const, path, baseUrl: "file:///extension/extension.ts" });

const runtimeWithRoute = (entryPath: string, capabilities?: WebviewCapabilityDeclaration[]) =>
  normalizeExtensionSources([
    {
      sourcePath: "/extension/extension.ts",
      sourceKind: "local_path",
      packagePath: "/extension",
      manifest: {
        id: "pstdio.lab",
        name: "lab",
        displayName: "Lab",
        description: "Lab extension for dashboard experiments.",
        version: "1.0.0",
        publisher: "pstdio",
        main: "./extension.ts",
        enginesPstdio: "^1.0.0",
      },
      definition: {
        routes: {
          page: {
            path: "lab",
            label: "Lab",
            webview: { entry: asset(entryPath), capabilities },
          },
        },
      },
    },
  ]);

describe("buildWorkbenchExtensionMetadata webview assets", () => {
  test("includes extension description in extension records", () => {
    const runtime = normalizeExtensionSources([
      {
        sourcePath: "/extension/extension.ts",
        sourceKind: "local_path",
        packagePath: "/extension",
        manifest: {
          id: "pstdio.lab",
          name: "lab",
          displayName: "Lab",
          description: "Lab extension for dashboard experiments.",
          version: "1.0.0",
          publisher: "pstdio",
          main: "./extension.ts",
          enginesPstdio: "^1.0.0",
        },
        definition: {},
      },
    ]);

    const metadata = buildWorkbenchExtensionMetadata({
      installNamesByExtensionId: new Map(),
      runtime,
      webviewCacheRoot: "/cache",
    });

    expect(metadata.extensions[0]?.description).toBe("Lab extension for dashboard experiments.");
  });

  test("adds module bridge URLs for managed source webviews", () => {
    const metadata = buildWorkbenchExtensionMetadata({
      installNamesByExtensionId: new Map([["pstdio.lab", "extension-lab"]]),
      runtime: runtimeWithRoute("./src/main.tsx"),
      webviewCacheRoot: "/cache",
    });

    const webview = metadata.routes[0]?.webview;

    expect(webview?.runtimeUrl).toBe("/v1/extensions/runtime");
    expect(webview?.moduleUrl).toBe("/v1/extensions/installed/extension-lab/webviews/lab.page/module.js");
    expect(webview).not.toHaveProperty("assetUrl");
  });

  test("cache-busts managed webview module URLs with the completed build revision", () => {
    const metadata = buildWorkbenchExtensionMetadata({
      assetRevisionsByExtensionId: new Map([["pstdio.lab", "build-2"]]),
      extensionInstanceIdsByExtensionId: new Map([["pstdio.lab", "instance-1"]]),
      installedExtensionIdsByExtensionId: new Map([["pstdio.lab", "installed-1"]]),
      installNamesByExtensionId: new Map([["pstdio.lab", "extension-lab"]]),
      runtime: runtimeWithRoute("./src/main.tsx"),
      webviewCacheRoot: "/cache",
    });

    expect(metadata.routes[0]).toMatchObject({
      extensionInstanceId: "instance-1",
      installedExtensionId: "installed-1",
      installName: "extension-lab",
    });
    expect(metadata.routes[0]?.webview.moduleUrl).toBe(
      "/v1/extensions/installed/extension-lab/webviews/lab.page/module.js?h=build-2",
    );
  });

  test("keeps pre-build metadata on the previous module URL until build completion changes revision", () => {
    const input = {
      installNamesByExtensionId: new Map([["pstdio.lab", "extension-lab"]]),
      runtime: runtimeWithRoute("./src/main.tsx"),
      webviewCacheRoot: "/cache",
    };

    const beforeBuild = buildWorkbenchExtensionMetadata({
      ...input,
      assetRevisionsByExtensionId: new Map([["pstdio.lab", "build-1"]]),
    });
    const afterBuild = buildWorkbenchExtensionMetadata({
      ...input,
      assetRevisionsByExtensionId: new Map([["pstdio.lab", "build-2"]]),
    });

    expect(beforeBuild.routes[0]?.webview.moduleUrl).toBe(
      "/v1/extensions/installed/extension-lab/webviews/lab.page/module.js?h=build-1",
    );
    expect(afterBuild.routes[0]?.webview.moduleUrl).toBe(
      "/v1/extensions/installed/extension-lab/webviews/lab.page/module.js?h=build-2",
    );
  });

  test("preserves declared webview capabilities in workbench metadata", () => {
    const metadata = buildWorkbenchExtensionMetadata({
      installNamesByExtensionId: new Map([["pstdio.lab", "extension-lab"]]),
      runtime: runtimeWithRoute("./src/main.tsx", ["commands.execute", "preferences.set@1"]),
      webviewCacheRoot: "/cache",
    });

    expect(metadata.routes[0]?.webview.capabilities).toEqual(["commands.execute", "preferences.set@1"]);
  });

  test("preserves menu when expressions in workbench metadata", () => {
    const runtime = normalizeExtensionSources([
      {
        sourcePath: "/extension/extension.ts",
        sourceKind: "local_path",
        packagePath: "/extension",
        manifest: {
          id: "pstdio.lab",
          name: "lab",
          displayName: "Lab",
          description: "Lab extension for dashboard experiments.",
          version: "1.0.0",
          publisher: "pstdio",
          main: "./extension.ts",
          enginesPstdio: "^1.0.0",
        },
        definition: {
          commands: {
            sayHello: {
              title: "Say hello",
              menus: [
                {
                  slot: "project.headerPrimary",
                  label: "Say hello",
                  when: {
                    resourceType: ["extension-route"],
                    metadata: { extensionId: "pstdio.lab", routePath: "lab" },
                  },
                },
              ],
              run: async () => undefined,
            },
          },
        },
      },
    ]);

    const metadata = buildWorkbenchExtensionMetadata({
      installNamesByExtensionId: new Map(),
      runtime,
      webviewCacheRoot: "/cache",
    });

    expect(metadata.menuContributions[0]?.when).toEqual({
      resourceType: ["extension-route"],
      metadata: { extensionId: "pstdio.lab", routePath: "lab" },
    });
  });

  test("includes workbench mode contributions", () => {
    const runtime = normalizeExtensionSources([
      {
        sourcePath: "/extension/extension.ts",
        sourceKind: "local_path",
        packagePath: "/extension",
        manifest: {
          id: "pstdio.mode-lab",
          name: "mode-lab",
          displayName: "Mode Lab",
          description: "Built-in lab workbench mode.",
          version: "1.0.0",
          publisher: "pstdio",
          main: "./extension.ts",
          enginesPstdio: "^1.0.0",
        },
        definition: {
          modes: {
            sessions: {
              id: "sessions",
              label: "Sessions",
              icon: "MessageCircle",
            },
          },
        },
      },
    ]);

    const metadata = buildWorkbenchExtensionMetadata({
      installNamesByExtensionId: new Map(),
      runtime,
      webviewCacheRoot: "/cache",
    });

    expect(metadata.modes).toEqual([
      {
        id: "mode-lab.sessions",
        extensionId: "pstdio.mode-lab",
        modeId: "sessions",
        label: "Sessions",
        icon: "MessageCircle",
      },
    ]);
  });

  test("includes DataTable multi-selection contributions", () => {
    const runtime = normalizeExtensionSources([
      {
        sourcePath: "/extension/extension.ts",
        sourceKind: "local_path",
        packagePath: "/extension",
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
            query: { title: "Query rows", run: async () => ({ rows: [] }) },
            restart: { title: "Restart rows", run: async () => undefined },
          },
          dataTableRenderers: {
            services: {
              title: "Services",
              queryCommand: "query",
              selectionMode: "multiple",
              selectionActions: [{ id: "restart", label: "Restart selected", command: "restart" }],
            },
          },
        },
      },
    ]);

    const metadata = buildWorkbenchExtensionMetadata({
      installNamesByExtensionId: new Map(),
      runtime,
      webviewCacheRoot: "/cache",
    });

    expect(metadata.dataTableRenderers).toHaveLength(1);
    expect(metadata.dataTableRenderers?.[0]).toMatchObject({
      id: "lab.services",
      selectionMode: "multiple",
      selectionActions: [{ id: "restart", label: "Restart selected", commandId: "lab.restart" }],
    });
  });
});

describe("buildWorkbenchExtensionMetadata kanban renderers", () => {
  test("includes workbench kanban renderer contributions", () => {
    const runtime = normalizeExtensionSources([
      {
        sourcePath: "/extension/extension.ts",
        sourceKind: "local_path",
        packagePath: "/extension",
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
          kanbanRenderers: {
            tickets: {
              title: "Tickets",
              resourceKind: "ticket",
              queryCommand: "planner.ticketBoard.read",
              createRow: {
                command: "planner.tickets.create",
                title: "Create ticket",
                columnParam: "status",
                params: {
                  content: { type: "longtext", label: "Ticket content", required: true },
                },
                attributesParam: "attributes",
                attachments: {
                  command: "planner.attach-file",
                  resourceParam: "ticketId",
                  fileParam: "ref",
                },
              },
              defaultSettings: { viewMode: "board", columnGrouping: "status" },
            },
          },
        },
      },
    ]);

    const metadata = buildWorkbenchExtensionMetadata({
      extensionInstanceIdsByExtensionId: new Map([["pstdio.planner", "planner-instance"]]),
      installNamesByExtensionId: new Map(),
      runtime,
      webviewCacheRoot: "/cache",
    });

    expect(metadata.kanbanRenderers).toEqual([
      expect.objectContaining({
        id: "planner.tickets",
        extensionId: "pstdio.planner",
        extensionInstanceId: "planner-instance",
        title: "Tickets",
        resourceKind: "ticket",
        queryCommandId: "planner.ticketBoard.read",
        createRow: expect.objectContaining({
          commandId: "planner.tickets.create",
          columnParam: "status",
          attributesParam: "attributes",
          attachments: {
            commandId: "planner.attach-file",
            resourceParam: "ticketId",
            fileParam: "ref",
          },
        }),
        defaultSettings: { viewMode: "board", columnGrouping: "status" },
      }),
    ]);
  });
});

describe("buildWorkbenchExtensionMetadata keybindings", () => {
  test("includes workbench keybinding contributions", () => {
    const runtime = normalizeExtensionSources([
      {
        sourcePath: "/extension/extension.ts",
        sourceKind: "local_path",
        packagePath: "/extension",
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
            preview: { title: "Preview", run: async () => null },
          },
          keybindings: {
            preview: {
              key: "mod+shift+p",
              command: "lab.preview",
              when: { resourceType: ["ticket"] },
            },
          },
        },
      },
    ]);

    const metadata = buildWorkbenchExtensionMetadata({
      installNamesByExtensionId: new Map(),
      runtime,
      webviewCacheRoot: "/cache",
    });

    expect(metadata.keybindings).toEqual([
      expect.objectContaining({
        id: "lab.preview",
        commandId: "lab.preview",
        key: "mod+shift+p",
        canonicalChord: "Mod+Shift+P",
        when: { resourceType: ["ticket"] },
      }),
    ]);
  });
});

describe("buildWorkbenchExtensionMetadata tree renderers", () => {
  test("includes workbench tree renderer contributions and tree-backed Panels", () => {
    const runtime = normalizeExtensionSources([
      {
        sourcePath: "/extension/extension.ts",
        sourceKind: "local_path",
        packagePath: "/extension",
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
          commands: {
            listFiles: { title: "List files", run: async () => [] },
          },
          treeRenderers: {
            files: {
              title: "Files",
              icon: "Files",
              bodyCommand: "planner.listFiles",
              defaultExpandedSectionIds: ["files"],
            },
          },
          panels: {
            ticketFiles: {
              title: "Files",
              resourceKind: "ticket",
              region: "sidenav",
              closable: false,
              treeRenderer: "files",
            },
          },
        },
      },
    ]);

    const metadata = buildWorkbenchExtensionMetadata({
      installNamesByExtensionId: new Map(),
      runtime,
      webviewCacheRoot: "/cache",
    });

    expect(metadata.treeRenderers).toEqual([
      expect.objectContaining({
        id: "planner.files",
        extensionId: "pstdio.planner",
        title: "Files",
        icon: "Files",
        bodyCommandId: "planner.listFiles",
        defaultExpandedSectionIds: ["files"],
      }),
    ]);
    expect(metadata.panels).toEqual([
      expect.objectContaining({
        id: "planner.ticketFiles",
        region: "sidenav",
        closable: false,
        resourceKind: "ticket",
        treeRendererId: "planner.files",
      }),
    ]);
    expect(metadata.panels[0]).not.toHaveProperty("webview");
  });
});

describe("buildWorkbenchExtensionMetadata webview filtering", () => {
  test("does not emit html webviews in workbench metadata", () => {
    const metadata = buildWorkbenchExtensionMetadata({
      installNamesByExtensionId: new Map([["pstdio.lab", "extension-lab"]]),
      runtime: runtimeWithRoute("./static.html"),
      webviewCacheRoot: "/cache",
    });

    expect(metadata.routes).toEqual([]);
  });
});
