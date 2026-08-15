import { describe, expect, test } from "bun:test";
import { normalizeExtensionSources } from "pstdio-extensions";
import { createExtensionWebviewAccess } from "./extension-webview-access";
import {
  type BuildWorkbenchExtensionMetadataInput,
  buildWorkbenchExtensionMetadata as buildWorkbenchExtensionMetadataWithAccess,
} from "./workbench-extension-metadata";

const webviewUrlIssuer = createExtensionWebviewAccess({ signingKey: Buffer.from("test-webview-signing-key") });
const buildWorkbenchExtensionMetadata = (input: Omit<BuildWorkbenchExtensionMetadataInput, "webviewUrlIssuer">) =>
  buildWorkbenchExtensionMetadataWithAccess({ ...input, webviewUrlIssuer });

const asset = (path: string) => ({ kind: "package-asset" as const, path, baseUrl: "file:///extension/extension.ts" });

describe("buildWorkbenchExtensionMetadata mode layouts", () => {
  test("preserves valid mode layouts with resolved extension view ids", () => {
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
          modes: {
            lab: {
              id: "pstdio.lab.mode",
              label: "Lab",
              resourceKind: "ticket",
              layout: {
                panels: ["main"],
                open: [
                  { region: "sidenav", panel: "sidenav", pinned: true },
                  { region: "main", panel: "overview" },
                ],
              },
            },
          },
          panels: {
            sidenav: {
              title: "Lab sidenav",
              region: "sidenav",
              closable: false,
              webview: { entry: asset("./src/sidenav.tsx") },
            },
            overview: {
              title: "Lab overview",
              region: "main",
              closable: false,
              webview: { entry: asset("./src/overview.tsx") },
            },
          },
        },
      },
    ]);

    const metadata = buildWorkbenchExtensionMetadata({
      installNamesByExtensionId: new Map([["pstdio.lab", "lab"]]),
      runtime,
      webviewCacheRoot: "/cache",
    });

    expect(metadata.diagnostics).toEqual([]);
    expect(metadata.panels.map((panel) => panel.id)).toEqual(["lab.sidenav", "lab.overview"]);
    expect(metadata.modes[0]).toMatchObject({
      modeId: "pstdio.lab.mode",
      resourceKind: "ticket",
      layout: {
        panels: ["main"],
        open: [
          { region: "sidenav", panel: "lab.sidenav", pinned: true },
          { region: "main", panel: "lab.overview" },
        ],
      },
    });
  });

  test("diagnoses duplicate extension mode ids and reserved host mode ids", () => {
    const source = (name: string, modeId: string) => ({
      sourcePath: `/extensions/${name}/extension.ts`,
      sourceKind: "local_path" as const,
      packagePath: `/extensions/${name}`,
      manifest: {
        id: `pstdio.${name}`,
        name,
        displayName: name,
        version: "1.0.0",
        publisher: "pstdio",
        main: "./extension.ts",
        enginesPstdio: "^1.0.0",
      },
      definition: {
        modes: {
          lab: { id: modeId, label: "Lab" },
        },
      },
    });
    const runtime = normalizeExtensionSources([
      source("one", "pstdio.lab.mode"),
      source("two", "pstdio.lab.mode"),
      source("three", "project"),
    ]);

    const metadata = buildWorkbenchExtensionMetadata({
      installNamesByExtensionId: new Map(),
      runtime,
      webviewCacheRoot: "/cache",
    });

    expect(metadata.modes.map((mode) => mode.modeId)).toEqual(["pstdio.lab.mode"]);
    expect(metadata.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "extension_mode_duplicate", extensionId: "pstdio.two" }),
        expect.objectContaining({ code: "extension_mode_duplicate", extensionId: "pstdio.three" }),
      ]),
    );
  });

  test("diagnoses invalid mode layouts and skips the mode", () => {
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
          modes: {
            lab: {
              id: "pstdio.lab.bad",
              label: "Bad",
              layout: {
                panels: ["secondary"],
                open: [{ region: "main", resource: "lab" }],
              },
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

    expect(metadata.modes).toEqual([]);
    expect(metadata.diagnostics).toEqual([
      expect.objectContaining({
        code: "extension_mode_layout_invalid",
        extensionId: "pstdio.lab",
        metadata: expect.objectContaining({
          modeId: "pstdio.lab.bad",
          unavailableOpenRegions: ["main"],
        }),
      }),
    ]);
  });
});
