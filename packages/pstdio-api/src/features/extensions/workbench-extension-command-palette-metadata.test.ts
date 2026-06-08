import { describe, expect, test } from "bun:test";
import { normalizeExtensionSources } from "pstdio-extensions";
import { buildWorkbenchExtensionMetadata } from "./workbench-extension-metadata";

describe("buildWorkbenchExtensionMetadata command palette resources", () => {
  test("qualifies local query command ids", () => {
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
            queryWorkspaces: { title: "Query workspaces", run: async () => ({ items: [] }) },
          },
          commandPaletteResources: {
            workspaces: {
              title: "Workspaces",
              resourceKind: "workspace",
              queryCommand: "queryWorkspaces",
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

    expect(metadata.commandPaletteResources?.[0]?.queryCommandId).toBe("lab.queryWorkspaces");
  });
});
